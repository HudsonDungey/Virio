"use client";

import * as React from "react";
import { useAccount, useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt, readContract } from "wagmi/actions";
import { decodeEventLog, maxUint256, type Hex } from "viem";
import { managerAbi, erc20Abi } from "./abis";
import { useVirioConfig } from "@/app/providers";

/// Convert a USDC display amount (e.g. 9.99) to base units (6 decimals).
export function usdcUnits(display: number): bigint {
  return BigInt(Math.round(display * 1_000_000));
}

interface WriteHelpers {
  /// On Sepolia we expect the user to be on Sepolia (11155111). On anvil we expect 31337.
  expectedChainId: number;
}

function chainIdFor(network: "sepolia" | "anvil"): number {
  return network === "anvil" ? 31337 : 11155111;
}

interface CreatePlanInput {
  priceUsdc: number;
  periodSeconds: number;
}

interface SubscribeInput {
  planId: Hex;
  spendCapUsdc: number | null;
}

/// Client-side wallet actions — every write here is signed by the connected wallet.
/// Each action returns the transaction hash AND the decoded eventful arg (planId, subId)
/// where applicable, so callers can post off-chain metadata under that id.
export function useVirioActions() {
  const config = useConfig();
  const account = useAccount();
  const publicCfg = useVirioConfig();
  const expectedChainId = chainIdFor(publicCfg.network);

  const help = React.useMemo<WriteHelpers>(() => ({ expectedChainId }), [expectedChainId]);

  function assertReady() {
    if (!account.address) throw new Error("connect your wallet first");
    if (account.chainId !== help.expectedChainId) {
      throw new Error(
        `wrong network — please switch your wallet to ${publicCfg.network === "anvil" ? "Anvil (31337)" : "Sepolia (11155111)"}`,
      );
    }
    if (publicCfg.contracts.manager === "0x0000000000000000000000000000000000000000") {
      throw new Error(
        "manager address not set in virio.local.json — deploy the contracts and paste the address there",
      );
    }
  }

  async function createPlan(input: CreatePlanInput): Promise<{ hash: Hex; planId: Hex }> {
    assertReady();
    const amount = usdcUnits(input.priceUsdc);
    const period = BigInt(input.periodSeconds);
    const hash = await writeContract(config, {
      address: publicCfg.contracts.manager,
      abi: managerAbi,
      functionName: "createPlan",
      args: [publicCfg.contracts.usdc, amount, period],
      chainId: help.expectedChainId,
    });
    const receipt = await waitForTransactionReceipt(config, { hash });
    let planId: Hex | undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: managerAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "PlanCreated") {
          planId = (decoded.args as { planId: Hex }).planId;
          break;
        }
      } catch {
        // not a manager log
      }
    }
    if (!planId) throw new Error("PlanCreated event not found in receipt");
    return { hash, planId };
  }

  async function deactivatePlan(planId: Hex): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: publicCfg.contracts.manager,
      abi: managerAbi,
      functionName: "deactivatePlan",
      args: [planId],
      chainId: help.expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  /// USDC allowance check + (infinite) approve if needed, then `manager.subscribe`.
  /// `onStep` is invoked between steps so the caller can update its loading text.
  async function subscribe(
    input: SubscribeInput,
    onStep?: (step: "approve" | "subscribe") => void,
  ): Promise<{ hash: Hex; subscriptionId: Hex }> {
    assertReady();
    const customer = account.address!;
    const spendCap = input.spendCapUsdc != null ? usdcUnits(input.spendCapUsdc) : 0n;

    // Check current allowance — if it's already large enough for many periods, skip approve.
    const allowance = (await readContract(config, {
      address: publicCfg.contracts.usdc,
      abi: erc20Abi,
      functionName: "allowance",
      args: [customer, publicCfg.contracts.manager],
      chainId: help.expectedChainId,
    })) as bigint;

    // Threshold: if allowance is less than ~1M USDC (1e12 units), prompt for max approval.
    if (allowance < 1_000_000_000_000n) {
      onStep?.("approve");
      const approveHash = await writeContract(config, {
        address: publicCfg.contracts.usdc,
        abi: erc20Abi,
        functionName: "approve",
        args: [publicCfg.contracts.manager, maxUint256],
        chainId: help.expectedChainId,
      });
      await waitForTransactionReceipt(config, { hash: approveHash });
    }

    onStep?.("subscribe");
    const hash = await writeContract(config, {
      address: publicCfg.contracts.manager,
      abi: managerAbi,
      functionName: "subscribe",
      args: [input.planId, spendCap],
      chainId: help.expectedChainId,
    });
    const receipt = await waitForTransactionReceipt(config, { hash });
    let subscriptionId: Hex | undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: managerAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "Subscribed") {
          subscriptionId = (decoded.args as { subscriptionId: Hex }).subscriptionId;
          break;
        }
      } catch {
        // not a manager log
      }
    }
    if (!subscriptionId) throw new Error("Subscribed event not found in receipt");
    return { hash, subscriptionId };
  }

  async function cancel(subId: Hex): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: publicCfg.contracts.manager,
      abi: managerAbi,
      functionName: "cancel",
      args: [subId],
      chainId: help.expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  return { createPlan, deactivatePlan, subscribe, cancel, account, expectedChainId };
}
