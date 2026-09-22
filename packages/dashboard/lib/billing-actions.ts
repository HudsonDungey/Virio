"use client";

import * as React from "react";
import { useAccount, useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { decodeEventLog, type Hex } from "viem";
import { registryAbi, recurringAbi, meteredAbi } from "./billing-abis";
import { BILLING } from "./billing-config";
import { useVirioConfig } from "@/app/providers";
import { chainIdFor, networkLabel } from "./networks";

/// Client-side billing writes. Every one is signed by the connected wallet —
/// the dashboard never holds a key and never signs on a user's behalf.

/// Convert a USDC display amount (e.g. 29.00) to base units (6 decimals).
export function usdcUnits(display: number): bigint {
  return BigInt(Math.round(display * 1_000_000));
}

const BILLING_TYPE_INDEX = { recurring: 0, metered: 1, hybrid: 2 } as const;
export type BillingTypeName = keyof typeof BILLING_TYPE_INDEX;

export interface AuthorizeInput {
  merchant: Hex;
  billingType: BillingTypeName;
  /// Largest single charge, in display USDC.
  maxPerChargeUsdc: number;
  /// Ceiling per period; 0 leaves the period uncapped.
  periodCapUsdc: number;
  /// Lifetime ceiling; 0 leaves it uncapped.
  totalCapUsdc: number;
  /// Seconds in a spend period. Required when periodCapUsdc > 0.
  periodSeconds: number;
  /// Unix seconds; 0 means no expiry.
  validUntil: number;
}

export function useBillingActions() {
  const config = useConfig();
  const account = useAccount();
  const publicCfg = useVirioConfig();

  const expectedChainId = React.useMemo(
    () => chainIdFor(publicCfg.network),
    [publicCfg.network],
  );

  function assertReady() {
    if (!account.address) throw new Error("connect your wallet first");
    if (account.chainId !== expectedChainId) {
      throw new Error(`wrong network — switch your wallet to ${networkLabel(publicCfg.network)}`);
    }
    if (BILLING.authorizationRegistry === "0x0000000000000000000000000000000000000000") {
      throw new Error(
        "billing contracts are not configured — set NEXT_PUBLIC_VIRIO_AUTHORIZATION_REGISTRY and friends",
      );
    }
  }

  /// Grant a merchant permission to pull payments within fixed limits.
  /// This moves no money and grants no allowance on its own — the payer must
  /// also approve the registry on the ERC-20.
  async function authorize(input: AuthorizeInput): Promise<{ hash: Hex; authorizationId: Hex }> {
    assertReady();
    if (input.periodCapUsdc > 0 && input.periodSeconds <= 0) {
      throw new Error("a period cap needs a period to measure over");
    }

    const hash = await writeContract(config, {
      address: BILLING.authorizationRegistry,
      abi: registryAbi,
      functionName: "authorize",
      args: [
        {
          merchant: input.merchant,
          token: publicCfg.contracts.usdc,
          billingType: BILLING_TYPE_INDEX[input.billingType],
          maxPerCharge: usdcUnits(input.maxPerChargeUsdc),
          periodSpendCap: usdcUnits(input.periodCapUsdc),
          totalSpendCap: usdcUnits(input.totalCapUsdc),
          periodDuration: BigInt(input.periodCapUsdc > 0 ? input.periodSeconds : 0),
          validAfter: 0n,
          validUntil: BigInt(input.validUntil),
        },
      ],
      chainId: expectedChainId,
    });

    const receipt = await waitForTransactionReceipt(config, { hash });
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: registryAbi, ...log });
        if (decoded.eventName === "AuthorizationCreated") {
          return {
            hash,
            authorizationId: (decoded.args as { authorizationId: Hex }).authorizationId,
          };
        }
      } catch {
        // Logs from other contracts in the same tx won't decode; skip them.
      }
    }
    throw new Error("AuthorizationCreated event not found in receipt");
  }

  /// Revoke an authorization. Stops every billing module at once.
  async function revoke(authorizationId: Hex): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: BILLING.authorizationRegistry,
      abi: registryAbi,
      functionName: "revoke",
      args: [authorizationId],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  /// Tighten an authorization's limits. The contract rejects anything looser.
  async function restrict(
    authorizationId: Hex,
    limits: { maxPerChargeUsdc?: number; periodCapUsdc?: number; totalCapUsdc?: number },
  ): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: BILLING.authorizationRegistry,
      abi: registryAbi,
      functionName: "restrict",
      args: [
        authorizationId,
        usdcUnits(limits.maxPerChargeUsdc ?? 0),
        usdcUnits(limits.periodCapUsdc ?? 0),
        usdcUnits(limits.totalCapUsdc ?? 0),
        0n,
      ],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  /// Bind an authorization the connected wallet owns to a recurring plan.
  async function subscribe(planId: Hex, authorizationId: Hex): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: BILLING.recurringBilling,
      abi: recurringAbi,
      functionName: "subscribe",
      args: [planId, authorizationId],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  /// Publish a metered price. The unit label is hashed for on-chain storage;
  /// the readable label is served by the indexer.
  async function createMeter(input: {
    unit: Hex;
    unitPriceUsdc: number;
    includedUnitsPerPeriod: number;
    settlementSeconds: number;
  }): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: BILLING.meteredBilling,
      abi: meteredAbi,
      functionName: "createMeter",
      args: [
        publicCfg.contracts.usdc,
        input.unit,
        usdcUnits(input.unitPriceUsdc),
        BigInt(input.includedUnitsPerPeriod),
        BigInt(input.settlementSeconds),
      ],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  return { account, authorize, revoke, restrict, subscribe, createMeter };
}
