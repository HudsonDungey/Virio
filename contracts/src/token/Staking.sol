// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// Staking — the 1:1 stPULSE staking primitive for Pulse.
//
// One Staking contract is deployed per chain. It custodies the chain-local
// PULSE that users stake, mints stPULSE 1:1 to depositors, and continuously
// accrues fee-token rewards (USDC etc.) to stPULSE balances using the
// Synthetix `StakingRewards` math, generalised to N reward tokens.
//
// Key invariants:
//   1. stPULSE.totalSupply() == PULSE balance held by this contract.
//      Strict 1:1 — N PULSE in mints N stPULSE; N stPULSE burned returns N PULSE.
//   2. Multi-token rewards: any ERC-20 transferred in via notifyReward becomes
//      a claimable yield stream. Each reward token has its own independent
//      rewardPerToken accumulator. The reward-token set is owner-curated and
//      capped at MAX_REWARD_TOKENS to bound per-transfer gas.
//   3. No timing-attack on distributions. Every stake / unstake / transfer
//      settles the user's accrued share for every registered reward token
//      *before* mutating their balance — so a user who stakes between two
//      notifyReward() calls earns only the second one.
//   4. Receipt token is ERC-20 + ERC20Votes, fully transferable.
//   5. Unstake cooldown is DAO-tunable. Default 0 (unstake any time).
//      Capped at MAX_COOLDOWN so governance cannot trap user funds.
// ─────────────────────────────────────────────────────────────────────────────

import {ERC20}        from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes}   from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces}       from "@openzeppelin/contracts/utils/Nonces.sol";
import {Ownable}      from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20}       from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}    from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Staking is ERC20, ERC20Permit, ERC20Votes, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Immutable ────────────────────────────────────────────────────────────

    IERC20 public immutable stakedToken;

    /// @notice 7 days hard ceiling on unstake cooldown.
    uint256 public constant MAX_COOLDOWN = 7 days;

    /// @notice Cap on the reward-token list so per-transfer gas is bounded.
    uint256 public constant MAX_REWARD_TOKENS = 16;

    // ─── Reward accounting ────────────────────────────────────────────────────

    /// @dev Ordered list of registered reward tokens, owner-curated.
    address[] public rewardTokens;

    /// @dev Membership lookup so notifyReward / register are O(1).
    mapping(address => bool) public isRewardToken;

    /// @dev Per-reward-token cumulative reward-per-stPULSE, scaled by 1e18.
    mapping(address => uint256) public rewardPerTokenStored;

    /// @dev Per-user snapshot of rewardPerTokenStored at last interaction.
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;

    /// @dev Per-user accrued (claimable) balance.
    mapping(address => mapping(address => uint256)) public rewardsAccrued;

    // ─── Cooldown ─────────────────────────────────────────────────────────────

    uint256 public cooldown;
    mapping(address => uint256) public cooldownUntil;

    // ─── Events ───────────────────────────────────────────────────────────────

    event RewardTokenAdded(address indexed token);
    event RewardTokenRemoved(address indexed token);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardNotified(address indexed token, uint256 amount, uint256 newRewardPerToken);
    event RewardClaimed(address indexed user, address indexed token, uint256 amount);
    event CooldownSet(uint256 cooldown);
    event UnstakeQueued(address indexed user, uint256 readyAt);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAmount();
    error NoStakedSupply();
    error CooldownActive(uint256 readyAt);
    error CooldownTooLong(uint256 max);
    error UnknownRewardToken();
    error AlreadyRegistered();
    error TooManyRewardTokens();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(IERC20 _stakedToken, address _initialOwner)
        ERC20("Staked Pulse", "stPULSE")
        ERC20Permit("Staked Pulse")
        Ownable(_initialOwner)
    {
        require(address(_stakedToken) != address(0), "Staking: zero token");
        stakedToken = _stakedToken;
    }

    // ─── Public actions ───────────────────────────────────────────────────────

    function stake(uint256 amount) external nonReentrant {
        _stake(msg.sender, msg.sender, amount);
    }

    function stakeFor(address recipient, uint256 amount) external nonReentrant {
        _stake(msg.sender, recipient, amount);
    }

    function queueUnstake() external {
        cooldownUntil[msg.sender] = block.timestamp + cooldown;
        emit UnstakeQueued(msg.sender, cooldownUntil[msg.sender]);
    }

    function unstake(uint256 amount) external nonReentrant {
        if (cooldown != 0) {
            uint256 readyAt = cooldownUntil[msg.sender];
            if (readyAt == 0 || block.timestamp < readyAt) revert CooldownActive(readyAt);
            cooldownUntil[msg.sender] = 0;
        }
        _unstake(msg.sender, amount);
    }

    function claim(address rewardToken) external nonReentrant returns (uint256 paid) {
        if (!isRewardToken[rewardToken]) revert UnknownRewardToken();
        _settle(msg.sender);
        paid = rewardsAccrued[rewardToken][msg.sender];
        if (paid > 0) {
            rewardsAccrued[rewardToken][msg.sender] = 0;
            IERC20(rewardToken).safeTransfer(msg.sender, paid);
            emit RewardClaimed(msg.sender, rewardToken, paid);
        }
    }

    function claimAll() external nonReentrant {
        _settle(msg.sender);
        uint256 n = rewardTokens.length;
        for (uint256 i; i < n; ++i) {
            address t = rewardTokens[i];
            uint256 paid = rewardsAccrued[t][msg.sender];
            if (paid > 0) {
                rewardsAccrued[t][msg.sender] = 0;
                IERC20(t).safeTransfer(msg.sender, paid);
                emit RewardClaimed(msg.sender, t, paid);
            }
        }
    }

    // ─── Reward injection ─────────────────────────────────────────────────────

    /// @notice Pull `amount` of an owner-registered reward token from the caller
    ///         and distribute it pro-rata across the current stPULSE supply.
    function notifyReward(address rewardToken, uint256 amount) external nonReentrant {
        if (!isRewardToken[rewardToken]) revert UnknownRewardToken();
        if (amount == 0) revert ZeroAmount();
        uint256 supply = totalSupply();
        if (supply == 0) revert NoStakedSupply();

        IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256 delta = (amount * 1e18) / supply;
        uint256 newStored = rewardPerTokenStored[rewardToken] + delta;
        rewardPerTokenStored[rewardToken] = newStored;

        emit RewardNotified(rewardToken, amount, newStored);
    }

    // ─── Governance ───────────────────────────────────────────────────────────

    /// @notice Owner-only: register a new reward token. Capped at MAX_REWARD_TOKENS
    ///         so per-transfer settlement gas stays bounded.
    function registerRewardToken(address token) external onlyOwner {
        require(token != address(0), "Staking: zero reward token");
        if (isRewardToken[token]) revert AlreadyRegistered();
        if (rewardTokens.length >= MAX_REWARD_TOKENS) revert TooManyRewardTokens();
        isRewardToken[token] = true;
        rewardTokens.push(token);
        emit RewardTokenAdded(token);
    }

    /// @notice Owner-only: stop accepting new notifications for `token`.
    ///         Existing accrued balances remain claimable. We don't remove from
    ///         the iteration list so historical settlement still runs.
    function deregisterRewardToken(address token) external onlyOwner {
        if (!isRewardToken[token]) revert UnknownRewardToken();
        isRewardToken[token] = false;
        emit RewardTokenRemoved(token);
    }

    function setCooldown(uint256 newCooldown) external onlyOwner {
        if (newCooldown > MAX_COOLDOWN) revert CooldownTooLong(MAX_COOLDOWN);
        cooldown = newCooldown;
        emit CooldownSet(newCooldown);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function rewardTokensLength() external view returns (uint256) {
        return rewardTokens.length;
    }

    function earned(address user, address rewardToken) external view returns (uint256) {
        uint256 stored = rewardPerTokenStored[rewardToken];
        uint256 paid   = userRewardPerTokenPaid[rewardToken][user];
        uint256 bal    = balanceOf(user);
        return rewardsAccrued[rewardToken][user] + (bal * (stored - paid)) / 1e18;
    }

    // ─── Internal: stake / unstake ────────────────────────────────────────────

    function _stake(address payer, address recipient, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        stakedToken.safeTransferFrom(payer, address(this), amount);
        _mint(recipient, amount);
        emit Staked(recipient, amount);
    }

    function _unstake(address user, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        _burn(user, amount);
        stakedToken.safeTransfer(user, amount);
        emit Unstaked(user, amount);
    }

    // ─── Internal: settle pending rewards for a user across every token ──────

    function _settle(address user) internal {
        if (user == address(0)) return;
        uint256 bal = balanceOf(user);
        uint256 n   = rewardTokens.length;
        for (uint256 i; i < n; ++i) {
            address t = rewardTokens[i];
            uint256 stored = rewardPerTokenStored[t];
            uint256 paid   = userRewardPerTokenPaid[t][user];
            if (stored != paid) {
                if (bal > 0) {
                    rewardsAccrued[t][user] += (bal * (stored - paid)) / 1e18;
                }
                userRewardPerTokenPaid[t][user] = stored;
            }
        }
    }

    // ─── ERC-20 hook: settle on every balance change ──────────────────────────

    /// @dev Called by OZ ERC20 on mint, burn, and transfer. Settles both
    ///      participants before the balance change so accrual is exact.
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        // mint:   from == 0,    to != 0  → settle `to` so they start fresh
        // burn:   from != 0,    to == 0  → settle `from` so they don't lose pending
        // transfer: both non-zero        → settle both
        _settle(from);
        _settle(to);
        super._update(from, to, value);
    }

    function nonces(address account)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(account);
    }
}
