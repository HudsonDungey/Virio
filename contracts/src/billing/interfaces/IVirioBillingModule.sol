// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVirioAuthorizationRegistry} from "./IVirioAuthorizationRegistry.sol";

/// @title IVirioBillingModule
/// @notice The whole contract a billing module owes the registry.
///
///         A module answers one question — what is owed — and calls
///         `registry.settle()` to collect it. It holds no funds, enforces no
///         spend limits of its own, and is interchangeable: adding a billing
///         model means deploying a module and registering it, not changing the
///         authorization layer.
interface IVirioBillingModule {
    /// @notice Which authorizations this module may settle. The registry pairs
    ///         this against the authorization's own billing type.
    function BILLING_TYPE() external view returns (IVirioAuthorizationRegistry.BillingType);

    /// @notice The authorization registry this module settles through.
    function registry() external view returns (IVirioAuthorizationRegistry);
}
