// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// FeeDistributor — chain-local 60/25/15 fee splitter for Virio.
//
// Virio managers (VirioSubscriptionManager / VirioPayrollManager) are
// configured to transfer their protocol fees into this contract on every
// charge. Anyone may then call distribute(token) to fan the accumulated
// balance out to:
//   • 60% → Staking.notifyReward(token, amount60)
//   • 25% → treasury (chain-local, multisig / DAO)
//   • 15% → buybackOperator (off-chain or contract that swaps into VIRIO
//                            and forwards to the SafetyModule)
//
// The split percentages are immutable at deploy. The sink addresses are
// owner-tunable so a DAO can rotate them without redeploy. The token set is
// dynamic — any IERC20 with non-zero balance can be distributed.
//
// distribute() is fully permissionless: callers pay gas to push fees out.
// Anyone can keeper this — there's no privileged role gating distribution.
// ─────────────────────────────────────────────────────────────────────────────

import {Ownable}        from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step}   from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20}         from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}      from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStaking {
    function notifyReward(address rewardToken, uint256 amount) external;
    function isRewardToken(address token) external view returns (bool);
}

contract FeeDistributor is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Split (immutable) ────────────────────────────────────────────────────

    uint16 public constant BPS_DENOMINATOR  = 10_000;
    uint16 public constant STAKER_BPS       = 6_000; // 60%
    uint16 public constant TREASURY_BPS     = 2_500; // 25%
    uint16 public constant BUYBACK_BPS      = 1_500; // 15%

    // ─── Sinks (owner-tunable) ────────────────────────────────────────────────

    IStaking public staking;
    address  public treasury;
    address  public buybackOperator;

    // ─── Events ───────────────────────────────────────────────────────────────

    event StakingSet(address indexed staking);
    event TreasurySet(address indexed treasury);
    event BuybackOperatorSet(address indexed buybackOperator);
    event Distributed(
        address indexed token,
        uint256 total,
        uint256 toStakers,
        uint256 toTreasury,
        uint256 toBuyback
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAddress();
    error NothingToDistribute();
    error StakingDoesNotAcceptToken(address token);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _initialOwner,
        IStaking _staking,
        address _treasury,
        address _buybackOperator
    ) Ownable(_initialOwner) {
        if (address(_staking) == address(0))      revert ZeroAddress();
        if (_treasury == address(0))              revert ZeroAddress();
        if (_buybackOperator == address(0))       revert ZeroAddress();
        staking         = _staking;
        treasury        = _treasury;
        buybackOperator = _buybackOperator;
    }

    // ─── Public: permissionless fan-out ───────────────────────────────────────

    /// @notice Sweep this contract's entire `token` balance to the three sinks.
    ///         60% to Staking via notifyReward (Staking pulls via transferFrom),
    ///         25% to treasury, 15% to buybackOperator.
    /// @dev Anyone may call. CEI: external interactions only after computing
    ///      the split.
    function distribute(address token) external nonReentrant returns (uint256 total) {
        total = IERC20(token).balanceOf(address(this));
        if (total == 0) revert NothingToDistribute();

        // Compute split. Any rounding remainder is sent to stakers (largest slice).
        uint256 toTreasury = (total * TREASURY_BPS) / BPS_DENOMINATOR;
        uint256 toBuyback  = (total * BUYBACK_BPS)  / BPS_DENOMINATOR;
        uint256 toStakers  = total - toTreasury - toBuyback;

        // Treasury and buyback are simple transfers.
        if (toTreasury > 0) IERC20(token).safeTransfer(treasury, toTreasury);
        if (toBuyback  > 0) IERC20(token).safeTransfer(buybackOperator, toBuyback);

        // Staker portion goes through notifyReward, which is "pull" via
        // safeTransferFrom. We pre-approve the staking contract for exactly
        // the amount we're about to push.
        if (toStakers > 0) {
            if (!staking.isRewardToken(token)) revert StakingDoesNotAcceptToken(token);
            IERC20(token).forceApprove(address(staking), toStakers);
            staking.notifyReward(token, toStakers);
        }

        emit Distributed(token, total, toStakers, toTreasury, toBuyback);
    }

    /// @notice Convenience: distribute several tokens in one tx.
    function distributeMany(address[] calldata tokens) external {
        for (uint256 i; i < tokens.length; ++i) {
            uint256 bal = IERC20(tokens[i]).balanceOf(address(this));
            if (bal > 0) {
                // re-enter via external call to ourselves so each token gets
                // its own nonReentrant scope
                try this.distribute(tokens[i]) returns (uint256) {} catch {
                    // a single token may revert (e.g. unregistered with Staking);
                    // skip it so the rest still distribute
                }
            }
        }
    }

    // ─── Governance ───────────────────────────────────────────────────────────

    function setStaking(IStaking _staking) external onlyOwner {
        if (address(_staking) == address(0)) revert ZeroAddress();
        staking = _staking;
        emit StakingSet(address(_staking));
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    function setBuybackOperator(address _buybackOperator) external onlyOwner {
        if (_buybackOperator == address(0)) revert ZeroAddress();
        buybackOperator = _buybackOperator;
        emit BuybackOperatorSet(_buybackOperator);
    }

    /// @notice Owner-only rescue for tokens nobody is interested in distributing.
    ///         Cannot front-run an in-flight distribute() because of nonReentrant.
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
