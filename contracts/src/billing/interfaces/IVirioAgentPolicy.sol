// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVirioAuthorizationRegistry} from "./IVirioAuthorizationRegistry.sol";

/// @title IVirioAgentPolicy — DESIGN ONLY, NOT IMPLEMENTED OR DEPLOYED
/// @notice Interface sketch for delegated agent spending. No contract in this
///         repository implements it, nothing is deployed, and the SDK feature
///         flag `agentDelegation` is off. It exists so the shape of the
///         eventual module is fixed now, while it is cheap to change.
///
///         THE DESIGN, IN ONE LINE
///         An agent policy is not a new payment protocol. It is an
///         authorization whose payer is an agent acting for an owner, settled
///         through the same registry, under the same caps, by the same modules.
///         Everything an agent spends is already bounded by the authorization
///         layer that exists today.
///
///           Owner ──authorizes──▶ AgentPolicy (this module)
///                                     │ opens authorizations on the owner's
///                                     │ behalf, never exceeding the policy
///                                     ▼
///                            VirioAuthorizationRegistry
///                                     │ per-charge / period / lifetime caps
///                                     ▼
///                            Recurring · Metered modules
///
///         WHY IT IS NOT BUILT YET
///         A module that opens authorizations on an owner's behalf needs
///         `authorizeFor(owner, …)` in the registry — the one function that
///         would let a registered contract bind an owner's funds without the
///         owner signing that specific authorization. That is a materially
///         larger trust surface than anything shipped here, and it deserves a
///         dedicated security review rather than being slipped in alongside
///         metered billing. The registry deliberately has no such function.
///
///         WHAT COMES LATER, IN ORDER
///           1. This module, on testnet, with allowlisted merchants only.
///           2. Merchant/denylists, per-service sub-limits, category limits.
///           3. EIP-7702 / session-key authorization, which lets an agent
///              spend from the owner's own EOA. That is a strictly larger
///              surface again and is gated behind its own review — see
///              VirioSubscriptionDelegate7702, which remains experimental.
interface IVirioAgentPolicy {
    /// @dev Deliberately mirrors the registry's Authorization: an agent policy
    ///      is a *template* for authorizations, with the same shape of limits
    ///      plus the two fields that make it a delegation (owner and agent).
    ///      Daily and monthly caps are two periods where an authorization has
    ///      one, which is the single genuine structural difference.
    struct AgentPolicy {
        address owner;
        address agent;
        address token;
        uint128 maxPerTransaction;
        uint128 dailyCap;
        uint128 monthlyCap;
        uint128 spentToday;
        uint128 spentThisMonth;
        uint64 dayStart;
        uint64 monthStart;
        uint64 validAfter;
        uint64 validUntil;
        bool active;
    }

    event AgentPolicyCreated(
        bytes32 indexed policyId,
        address indexed owner,
        address indexed agent,
        address token,
        uint128 maxPerTransaction,
        uint128 dailyCap,
        uint128 monthlyCap,
        uint64 validAfter,
        uint64 validUntil
    );

    event AgentPolicyRevoked(bytes32 indexed policyId, address indexed caller);

    /// Emitted when a policy opens a registry authorization for the agent.
    event AgentAuthorizationOpened(
        bytes32 indexed policyId,
        bytes32 indexed authorizationId,
        address indexed merchant,
        uint128 maxPerCharge
    );

    /// @notice Owner grants an agent a spending budget.
    function createPolicy(
        address agent,
        address token,
        uint128 maxPerTransaction,
        uint128 dailyCap,
        uint128 monthlyCap,
        uint64 validAfter,
        uint64 validUntil
    ) external returns (bytes32 policyId);

    /// @notice Owner revokes immediately. The emergency lever, and the reason
    ///         a policy is a contract rather than an off-chain key grant.
    function revokePolicy(bytes32 policyId) external;

    /// @notice Agent opens a Virio authorization within its policy. Every limit
    ///         on the resulting authorization is the tighter of what the agent
    ///         asked for and what the policy allows.
    function openAuthorization(
        bytes32 policyId,
        address merchant,
        IVirioAuthorizationRegistry.BillingType billingType,
        uint128 maxPerCharge,
        uint128 periodSpendCap,
        uint64 periodDuration
    ) external returns (bytes32 authorizationId);

    function getPolicy(bytes32 policyId) external view returns (AgentPolicy memory);

    /// @notice Headroom under the policy's own daily and monthly caps.
    function remaining(bytes32 policyId) external view returns (uint256 daily, uint256 monthly);
}
