// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// SubscriptionDelegate7702
//
// EIP-7702 delegation target.  When an EOA sets this contract as its delegate
// via a Type 4 transaction, address(this) == the EOA — the EOA's code IS this
// contract.  All token balances and allowances still belong to the EOA.
//
// Key design invariants:
//   1. Only config.manager (VirioSubscriptionManager) may call executeTransfer.
//   2. Only config.token (the whitelisted ERC-20) may be moved.
//   3. Per-period spend cap enforced independently from the subscription cap.
//   4. Epoch-based revocation: revoking increments authEpoch; any stored
//      initEpoch that doesn't match is considered invalid.
//   5. EIP-712 signed initialization prevents front-running.
//   6. executeTransfer calls token.transfer() — address(this) IS the holder.
//   7. revoke() requires msg.sender == address(this) — the EOA must call
//      its own delegate code to revoke.
// ─────────────────────────────────────────────────────────────────────────────

interface IERC20Transfer {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract SubscriptionDelegate7702 {
    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotManager();
    error WrongToken();
    error PeriodCapExceeded();
    error InvalidSignature();
    error Expired();
    error NonceUsed();
    error AlreadyInitialized();
    error NotOwner();
    error ZeroAddress();

    // ─── Events ───────────────────────────────────────────────────────────────

    event Initialized(address indexed manager, address indexed token, uint256 maxPerPeriod, uint256 periodDuration);
    event TransferExecuted(address indexed to, uint256 amount, uint256 periodId, uint256 spentInPeriod);
    event Revoked(uint256 newEpoch);

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Config {
        address manager;
        address token;
        uint256 maxPerPeriod;
        uint256 periodDuration;
        uint256 initEpoch;
        uint256 nonce;
    }

    struct DelegateInit {
        address manager;
        address token;
        uint256 maxPerPeriod;
        uint256 periodDuration;
        uint256 nonce;
        uint256 expiry;
    }

    // ─── EIP-712 ──────────────────────────────────────────────────────────────

    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public constant DELEGATE_INIT_TYPEHASH = keccak256(
        "DelegateInit(address manager,address token,uint256 maxPerPeriod,uint256 periodDuration,uint256 nonce,uint256 expiry)"
    );

    string public constant NAME    = "SubscriptionDelegate7702";
    string public constant VERSION = "1";

    // ─── State ────────────────────────────────────────────────────────────────

    Config public config;
    uint256 public authEpoch;

    /// @dev Per-period spend tracking.
    mapping(uint256 periodId => uint256 spent) public spentInPeriod;

    // ─── Initialization ───────────────────────────────────────────────────────

    /// @notice Initialize via EIP-712 signed parameters.
    ///         The signer MUST be address(this) (the EOA that set this delegate).
    /// @param init  Initialization parameters.
    /// @param sig   EIP-712 signature over `init`.
    function initWithSig(DelegateInit calldata init, bytes calldata sig) external {
        if (config.manager != address(0)) revert AlreadyInitialized();
        if (block.timestamp > init.expiry) revert Expired();
        if (init.nonce != authEpoch) revert NonceUsed();
        if (init.manager == address(0)) revert ZeroAddress();
        if (init.token   == address(0)) revert ZeroAddress();

        bytes32 digest = _hashTypedData(
            keccak256(abi.encode(
                DELEGATE_INIT_TYPEHASH,
                init.manager,
                init.token,
                init.maxPerPeriod,
                init.periodDuration,
                init.nonce,
                init.expiry
            ))
        );

        address signer = _recoverSigner(digest, sig);
        // The EOA (address(this)) must have signed the init params.
        if (signer != address(this)) revert InvalidSignature();

        config = Config({
            manager:        init.manager,
            token:          init.token,
            maxPerPeriod:   init.maxPerPeriod,
            periodDuration: init.periodDuration,
            initEpoch:      authEpoch,
            nonce:          init.nonce
        });

        emit Initialized(init.manager, init.token, init.maxPerPeriod, init.periodDuration);
    }

    // ─── Manager-only transfer ────────────────────────────────────────────────

    /// @notice Transfer tokens from this EOA to `to`.
    ///         Only callable by the whitelisted manager contract.
    function executeTransfer(address token, address to, uint256 amount) external {
        if (msg.sender != config.manager)    revert NotManager();
        if (token      != config.token)      revert WrongToken();
        // Revocation check: stored initEpoch must match current authEpoch.
        if (config.initEpoch != authEpoch)   revert NotManager();

        uint256 pid = currentPeriodId();
        uint256 newSpent = spentInPeriod[pid] + amount;
        if (newSpent > config.maxPerPeriod)  revert PeriodCapExceeded();

        // EFFECTS before INTERACTIONS
        spentInPeriod[pid] = newSpent;

        // address(this) IS the token holder — use transfer, not transferFrom.
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Transfer.transfer.selector, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "Delegate: transfer failed");

        emit TransferExecuted(to, amount, pid, newSpent);
    }

    // ─── Revocation ───────────────────────────────────────────────────────────

    /// @notice Revoke this delegation.
    ///         msg.sender must be address(this) — the EOA calls its own code.
    function revoke() external {
        if (msg.sender != address(this)) revert NotOwner();
        uint256 newEpoch = ++authEpoch;
        // Clear config so isInitialized() returns false.
        delete config;
        emit Revoked(newEpoch);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    /// @notice Returns true if initialized and not revoked.
    function isInitialized() external view returns (bool) {
        return config.manager != address(0) && config.initEpoch == authEpoch;
    }

    /// @notice Current period id based on block.timestamp.
    function currentPeriodId() public view returns (uint256) {
        uint256 dur = config.periodDuration;
        if (dur == 0) return 0;
        return block.timestamp / dur;
    }

    /// @notice Remaining allowance for the current period.
    function remainingPeriodAllowance() external view returns (uint256) {
        uint256 pid   = currentPeriodId();
        uint256 spent = spentInPeriod[pid];
        uint256 max   = config.maxPerPeriod;
        if (spent >= max) return 0;
        return max - spent;
    }

    // ─── EIP-712 internals ────────────────────────────────────────────────────

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256(bytes(NAME)),
            keccak256(bytes(VERSION)),
            block.chainid,
            address(this)
        ));
    }

    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function _recoverSigner(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Delegate: bad sig length");
        bytes32 r;
        bytes32 s;
        uint8   v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        return ecrecover(digest, v, r, s);
    }
}
