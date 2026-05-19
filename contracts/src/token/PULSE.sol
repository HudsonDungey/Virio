// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// PULSE — the cross-chain governance token for Pulse.
//
// Same source, deployed identically on every supported EVM via CREATE3.
// Standards:
//   • ERC-20 (fungible)
//   • ERC-20 Permit (EIP-2612 signed approvals)
//   • ERC-20 Votes (snapshot voting for governance)
//   • xERC-20 / ERC-7281 (sovereign bridge mint+burn with per-bridge rate limits)
//
// Key invariants:
//   1. Total cross-chain supply == 1,000,000,000 * 1e18. Mathematically forced
//      by the burn-and-mint bridge model — bridges may only mint as much as
//      they have burned (modulo independent per-bridge rate-limit caps), and
//      the initial 1B is minted exactly once on the home chain.
//   2. Initial 1B is minted to `genesisRecipient` only when this contract is
//      deployed on the home chain (`block.chainid == HOME_CHAIN_ID`). On every
//      other chain `totalSupply()` starts at zero and only grows as bridges
//      mint inbound supply.
//   3. mint() / burn() are gated to allowlisted bridges. Each bridge has
//      independent mint and burn ceilings that refill linearly from 0 → max
//      over RATE_LIMIT_DURATION.
//   4. The owner (Pulse multisig → DAO at month 12) adds/removes bridges and
//      tunes ceilings via setLimits().
//   5. No public mint after genesis. No inflation. No backdoors.
// ─────────────────────────────────────────────────────────────────────────────

import {ERC20}        from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes}   from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces}       from "@openzeppelin/contracts/utils/Nonces.sol";
import {Ownable}      from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IXERC20} from "./interfaces/IXERC20.sol";

contract PULSE is ERC20, ERC20Permit, ERC20Votes, Ownable2Step, IXERC20 {
    // ─── Constants ────────────────────────────────────────────────────────────

    /// @notice Total supply cap. Minted once on the home chain at deploy.
    uint256 public constant GENESIS_SUPPLY = 1_000_000_000e18;

    /// @notice Ethereum mainnet. The only chain where the initial supply is minted.
    uint256 public constant HOME_CHAIN_ID = 1;

    /// @notice Each bridge limit refills linearly from 0 → max over this window.
    ///         24h matches industry standard (USDC CCTP, USDT0, etc.).
    uint256 public constant RATE_LIMIT_DURATION = 1 days;

    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev Per-bridge mint and burn rate-limit accumulators.
    mapping(address => BridgeParameters) internal _mintingLimits;
    mapping(address => BridgeParameters) internal _burningLimits;

    /// @notice Optional lockbox (xERC20 standard, unused in greenfield launch).
    address public lockbox;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error IXERC20_NotHighEnoughLimits();
    error IXERC20_LimitsTooHigh();

    // ─── Constructor ──────────────────────────────────────────────────────────

    /// @param _initialOwner    Multisig / DAO address controlling bridge limits.
    /// @param _genesisRecipient Address receiving the 1B initial mint on the home chain.
    constructor(address _initialOwner, address _genesisRecipient)
        ERC20("Pulse", "PULSE")
        ERC20Permit("Pulse")
        Ownable(_initialOwner)
    {
        if (block.chainid == HOME_CHAIN_ID) {
            require(_genesisRecipient != address(0), "PULSE: zero recipient");
            _mint(_genesisRecipient, GENESIS_SUPPLY);
        }
        // On every other chain totalSupply starts at zero; supply only enters
        // via bridges burning on a different chain and minting here.
    }

    // ─── xERC20: mint / burn ──────────────────────────────────────────────────

    /// @inheritdoc IXERC20
    function mint(address to, uint256 amount) external {
        _useMinterLimits(msg.sender, amount);
        _mint(to, amount);
    }

    /// @inheritdoc IXERC20
    function burn(address from, uint256 amount) external {
        if (msg.sender != from) {
            _spendAllowance(from, msg.sender, amount);
        }
        _useBurnerLimits(msg.sender, amount);
        _burn(from, amount);
    }

    // ─── xERC20: owner-only configuration ─────────────────────────────────────

    /// @inheritdoc IXERC20
    function setLimits(address bridge, uint256 mintingLimit, uint256 burningLimit)
        external
        onlyOwner
    {
        require(bridge != address(0), "PULSE: zero bridge");
        // Prevent overflow in ratePerSecond arithmetic.
        if (mintingLimit > type(uint256).max / 2 || burningLimit > type(uint256).max / 2) {
            revert IXERC20_LimitsTooHigh();
        }
        _changeMinterLimit(bridge, mintingLimit);
        _changeBurnerLimit(bridge, burningLimit);
        emit BridgeLimitsSet(bridge, mintingLimit, burningLimit);
    }

    /// @notice Owner-only: set the optional Lockbox address (xERC20 standard).
    function setLockbox(address _lockbox) external onlyOwner {
        lockbox = _lockbox;
        emit LockboxSet(_lockbox);
    }

    // ─── xERC20: views ────────────────────────────────────────────────────────

    function mintingMaxLimitOf(address bridge) external view returns (uint256) {
        return _mintingLimits[bridge].maxLimit;
    }

    function burningMaxLimitOf(address bridge) external view returns (uint256) {
        return _burningLimits[bridge].maxLimit;
    }

    function mintingCurrentLimitOf(address bridge) external view returns (uint256) {
        return _currentLimit(_mintingLimits[bridge]);
    }

    function burningCurrentLimitOf(address bridge) external view returns (uint256) {
        return _currentLimit(_burningLimits[bridge]);
    }

    // ─── Internal rate-limit machinery ────────────────────────────────────────

    function _currentLimit(BridgeParameters storage p) internal view returns (uint256) {
        if (p.maxLimit == 0) return 0;
        uint256 elapsed = block.timestamp - p.timestamp;
        uint256 refill  = elapsed * p.ratePerSecond;
        uint256 limit   = p.currentLimit + refill;
        return limit > p.maxLimit ? p.maxLimit : limit;
    }

    function _useMinterLimits(address bridge, uint256 amount) internal {
        BridgeParameters storage p = _mintingLimits[bridge];
        uint256 current = _currentLimit(p);
        if (current < amount) revert IXERC20_NotHighEnoughLimits();
        p.timestamp    = block.timestamp;
        p.currentLimit = current - amount;
    }

    function _useBurnerLimits(address bridge, uint256 amount) internal {
        BridgeParameters storage p = _burningLimits[bridge];
        uint256 current = _currentLimit(p);
        if (current < amount) revert IXERC20_NotHighEnoughLimits();
        p.timestamp    = block.timestamp;
        p.currentLimit = current - amount;
    }

    function _changeMinterLimit(address bridge, uint256 newMax) internal {
        BridgeParameters storage p = _mintingLimits[bridge];
        uint256 oldMax  = p.maxLimit;
        uint256 current = _currentLimit(p);
        p.maxLimit      = newMax;
        if (newMax == 0) {
            p.currentLimit = 0;
        } else if (oldMax == 0) {
            // First-time configuration: start fully empty so a freshly-added
            // bridge has to wait RATE_LIMIT_DURATION before reaching its cap.
            p.currentLimit = 0;
        } else if (current > newMax) {
            p.currentLimit = newMax;
        } else {
            p.currentLimit = current;
        }
        p.ratePerSecond = newMax / RATE_LIMIT_DURATION;
        p.timestamp     = block.timestamp;
    }

    function _changeBurnerLimit(address bridge, uint256 newMax) internal {
        BridgeParameters storage p = _burningLimits[bridge];
        uint256 oldMax  = p.maxLimit;
        uint256 current = _currentLimit(p);
        p.maxLimit      = newMax;
        if (newMax == 0) {
            p.currentLimit = 0;
        } else if (oldMax == 0) {
            p.currentLimit = 0;
        } else if (current > newMax) {
            p.currentLimit = newMax;
        } else {
            p.currentLimit = current;
        }
        p.ratePerSecond = newMax / RATE_LIMIT_DURATION;
        p.timestamp     = block.timestamp;
    }

    // ─── OZ ERC20Votes plumbing ───────────────────────────────────────────────

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
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
