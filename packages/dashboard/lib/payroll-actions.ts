"use client";

import * as React from "react";
import { useAccount, useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt, readContract } from "wagmi/actions";
import { decodeEventLog, maxUint256, type Hex } from "viem";
import { payrollAbi, erc20Abi } from "./abis";
import { useVirioConfig } from "@/app/providers";

export function usdcUnits(display: number): bigint {
  return BigInt(Math.round(display * 1_000_000));
}

function chainIdFor(network: "sepolia" | "anvil"): number {
  return network === "anvil" ? 31337 : 11155111;
}

interface CreatePayrollPlanInput {
  periodSeconds: number;
}

interface AddRecipientInput {
  planId: Hex;
  wallet: Hex;
  amountUsdc: number;
  spendCapUsdc?: number | null;
}

/// Wallet-side actions for VirioPayrollManager. Each write is signed by the
/// connected wallet via wagmi; reads come from `lib/payroll-reads.ts` API routes.
export function usePayrollActions() {
  const config = useConfig();
  const account = useAccount();
  const publicCfg = useVirioConfig();
  const expectedChainId = chainIdFor(publicCfg.network);
  const payrollAddress = publicCfg.contracts.payrollManager;

  function assertReady() {
    if (!account.address) throw new Error("connect your wallet first");
    if (account.chainId !== expectedChainId) {
      throw new Error(
        `wrong network — switch to ${
          publicCfg.network === "anvil" ? "Anvil (31337)" : "Sepolia (11155111)"
        }`,
      );
    }
    if (payrollAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error(
        "payrollManager address not configured — set the contract addresses in lib/addresses.ts",
      );
    }
  }

  /// Ensure the employer has approved enough USDC for the payroll contract.
  /// Pulled into a helper so add/execute paths can both call it.
  async function ensureAllowance(): Promise<void> {
    const allowance = (await readContract(config, {
      address: publicCfg.contracts.usdc,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address!, payrollAddress],
      chainId: expectedChainId,
    })) as bigint;
    if (allowance >= 1_000_000_000_000n) return;
    const hash = await writeContract(config, {
      address: publicCfg.contracts.usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [payrollAddress, maxUint256],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
  }

  async function createPlan(input: CreatePayrollPlanInput): Promise<{ hash: Hex; planId: Hex }> {
    assertReady();
    const hash = await writeContract(config, {
      address: payrollAddress,
      abi: payrollAbi,
      functionName: "createPlan",
      args: [publicCfg.contracts.usdc, BigInt(input.periodSeconds)],
      chainId: expectedChainId,
    });
    const receipt = await waitForTransactionReceipt(config, { hash });
    let planId: Hex | undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: payrollAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "PlanCreated") {
          planId = (decoded.args as { planId: Hex }).planId;
          break;
        }
      } catch {
        /* not a payroll log */
      }
    }
    if (!planId) throw new Error("PlanCreated event not found");
    return { hash, planId };
  }

  async function deactivatePlan(planId: Hex): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: payrollAddress,
      abi: payrollAbi,
      functionName: "deactivatePlan",
      args: [planId],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  async function addRecipient(input: AddRecipientInput): Promise<{ hash: Hex; recipientId: Hex }> {
    assertReady();
    await ensureAllowance();
    const amount = usdcUnits(input.amountUsdc);
    const cap = input.spendCapUsdc != null ? usdcUnits(input.spendCapUsdc) : 0n;
    const hash = await writeContract(config, {
      address: payrollAddress,
      abi: payrollAbi,
      functionName: "addRecipient",
      args: [input.planId, input.wallet, amount, cap],
      chainId: expectedChainId,
    });
    const receipt = await waitForTransactionReceipt(config, { hash });
    let recipientId: Hex | undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: payrollAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "RecipientAdded") {
          recipientId = (decoded.args as { recipientId: Hex }).recipientId;
          break;
        }
      } catch {
        /* not a payroll log */
      }
    }
    if (!recipientId) throw new Error("RecipientAdded event not found");
    return { hash, recipientId };
  }

  async function removeRecipient(planId: Hex, recipientId: Hex): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: payrollAddress,
      abi: payrollAbi,
      functionName: "removeRecipient",
      args: [planId, recipientId],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  async function executePayroll(planId: Hex, recipientId: Hex): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: payrollAddress,
      abi: payrollAbi,
      functionName: "executePayroll",
      args: [planId, recipientId],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  async function executePayrollBatch(planId: Hex, recipientIds: Hex[]): Promise<Hex> {
    assertReady();
    const hash = await writeContract(config, {
      address: payrollAddress,
      abi: payrollAbi,
      functionName: "executePayrollBatch",
      args: [planId, recipientIds],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  return {
    createPlan,
    deactivatePlan,
    addRecipient,
    removeRecipient,
    executePayroll,
    executePayrollBatch,
    ensureAllowance,
    account,
    expectedChainId,
  };
}
