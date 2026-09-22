// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {VirioAuthorizationRegistry} from "../../src/billing/VirioAuthorizationRegistry.sol";
import {VirioRecurringBilling} from "../../src/billing/VirioRecurringBilling.sol";
import {VirioMeteredBilling} from "../../src/billing/VirioMeteredBilling.sol";
import {IVirioAuthorizationRegistry as IReg} from
    "../../src/billing/interfaces/IVirioAuthorizationRegistry.sol";
import {IVirioMeteredBilling} from "../../src/billing/interfaces/IVirioMeteredBilling.sol";
import {MockUSDC} from "../../src/test-helpers/MockUSDC.sol";

/// Shared fixture for the billing stack: registry + both modules + a funded
/// payer. Kept in one place so every billing test observes the same wiring an
/// actual deployment produces.
abstract contract BillingTestBase is Test {
    VirioAuthorizationRegistry internal reg;
    VirioRecurringBilling internal recurring;
    VirioMeteredBilling internal metered;
    MockUSDC internal usdc;

    address internal OWNER = makeAddr("owner");
    address internal FEE_RECIP = makeAddr("feeRecipient");
    address internal MERCHANT;
    uint256 internal MERCHANT_PK;
    address internal PAYER = makeAddr("payer");
    address internal EXECUTOR = makeAddr("executor");
    address internal STRANGER = makeAddr("stranger");

    uint64 internal constant MONTH = 30 days;
    uint64 internal constant DAY = 1 days;

    /// @dev Re-derived here rather than read from the contract, so the tests
    ///      verify the EIP-712 encoding independently instead of trusting the
    ///      hasher they are testing. Keeping it local also means signing makes
    ///      no external call, which would otherwise consume the next cheatcode.
    bytes32 internal constant METER_STATEMENT_TYPEHASH = keccak256(
        "MeterStatement(bytes32 meterId,bytes32 authorizationId,uint64 periodStart,uint64 periodEnd,uint128 units,uint128 unitPrice,uint128 amount,uint256 nonce)"
    );
    bytes32 internal meteredDomainSeparator;

    function setUp() public virtual {
        (MERCHANT, MERCHANT_PK) = makeAddrAndKey("merchant");

        vm.startPrank(OWNER);
        usdc = new MockUSDC();
        reg = new VirioAuthorizationRegistry(FEE_RECIP);
        recurring = new VirioRecurringBilling(reg);
        metered = new VirioMeteredBilling(reg);
        reg.setModuleStatus(address(recurring), IReg.ModuleStatus.Active);
        reg.setModuleStatus(address(metered), IReg.ModuleStatus.Active);
        vm.stopPrank();

        meteredDomainSeparator = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("VirioMeteredBilling")),
                keccak256(bytes("1")),
                block.chainid,
                address(metered)
            )
        );

        usdc.mint(PAYER, 1_000_000e6);
        vm.prank(PAYER);
        usdc.approve(address(reg), type(uint256).max);

        // Start well past epoch so `validAfter`/period arithmetic is realistic.
        vm.warp(1_800_000_000);
    }

    // ─── Fixture helpers ──────────────────────────────────────────────────────

    function _authorize(
        IReg.BillingType billingType,
        uint128 maxPerCharge,
        uint128 periodSpendCap,
        uint128 totalSpendCap,
        uint64 periodDuration
    ) internal returns (bytes32) {
        vm.prank(PAYER);
        return reg.authorize(
            IReg.AuthorizationParams({
                merchant: MERCHANT,
                token: address(usdc),
                billingType: billingType,
                maxPerCharge: maxPerCharge,
                periodSpendCap: periodSpendCap,
                totalSpendCap: totalSpendCap,
                periodDuration: periodDuration,
                validAfter: 0,
                validUntil: 0
            })
        );
    }

    /// Fee split mirroring VirioAuthorizationRegistry.settle() at default fees.
    function _split(uint256 amount)
        internal
        view
        returns (uint256 merchantAmount, uint256 executorFee, uint256 protocolFee)
    {
        executorFee = (amount * reg.executorFeeBps()) / 10_000;
        protocolFee = (amount * reg.protocolFeeBps()) / 10_000 + reg.protocolFlatFee();
        merchantAmount = amount - executorFee - protocolFee;
    }

    /// The EIP-712 digest for a statement, computed locally.
    function _digest(IVirioMeteredBilling.MeterStatement memory statement)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                METER_STATEMENT_TYPEHASH,
                statement.meterId,
                statement.authorizationId,
                statement.periodStart,
                statement.periodEnd,
                statement.units,
                statement.unitPrice,
                statement.amount,
                statement.nonce
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", meteredDomainSeparator, structHash));
    }

    /// Sign a meter statement as the merchant, over the module's EIP-712 domain.
    function _sign(IVirioMeteredBilling.MeterStatement memory statement)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MERCHANT_PK, _digest(statement));
        return abi.encodePacked(r, s, v);
    }

    /// Sign as an arbitrary key — used to prove a non-merchant signature fails.
    function _signAs(uint256 pk, IVirioMeteredBilling.MeterStatement memory statement)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, _digest(statement));
        return abi.encodePacked(r, s, v);
    }

    function _statement(
        bytes32 meterId,
        bytes32 authId,
        uint64 periodStart,
        uint64 periodEnd,
        uint128 units,
        uint128 unitPrice,
        uint256 nonce
    ) internal pure returns (IVirioMeteredBilling.MeterStatement memory) {
        return IVirioMeteredBilling.MeterStatement({
            meterId: meterId,
            authorizationId: authId,
            periodStart: periodStart,
            periodEnd: periodEnd,
            units: units,
            unitPrice: unitPrice,
            amount: units * unitPrice,
            nonce: nonce
        });
    }
}
