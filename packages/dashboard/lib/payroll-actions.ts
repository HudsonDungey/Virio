"use client";

import * as React from "react";
import { useAccount, useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt, readContract } from "wagmi/actions";
import { decodeEventLog, encodePacked, keccak256, maxUint256, type Hex } from "viem";
import { payrollAbi, erc20Abi, executorAbi } from "./abis";
import { usePulseConfig } from "@/app/providers";

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

/// Wallet-side actions for PulsePayrollManager. Each write is signed by the
/// connected wallet via wagmi; reads come from `lib/payroll-reads.ts` API routes.
export function usePayrollActions() {
  const config = useConfig();
  const account = useAccount();
  const publicCfg = usePulseConfig();
  const expectedChainId = chainIdFor(publicCfg.network);
  const payrollAddress = publicCfg.contracts.payrollManager;
  const executorAddress = publicCfg.contracts.executor;

  /// paymentId = keccak256(manager, innerId, chainid). Mirrors PulseExecutor.sol.
  function computePaymentId(manager: Hex, innerId: Hex): Hex {
    return keccak256(
      encodePacked(["address", "bytes32", "uint256"], [manager, innerId, BigInt(expectedChainId)]),
    );
  }

  function assertExecutorReady() {
    if (!executorAddress || executorAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error(
        "executor contract not configured — set contracts.executor in pulse.local.json",
      );
    }
  }

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
        "payrollManager address not set in pulse.local.json — deploy it first",
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

  /// Trigger a single payroll execution via PulseExecutor. The caller pays gas
  /// and earns the executor fee (minus any penalty per the router's rules).
  /// planId is unused in the call but kept in the signature for callsite parity
  /// with the older payrollManager.executePayroll(planId, recipientId).
  async function executePayroll(_planId: Hex, recipientId: Hex): Promise<Hex> {
    assertReady();
    assertExecutorReady();
    const paymentId = computePaymentId(payrollAddress, recipientId);
    const hash = await writeContract(config, {
      address: executorAddress,
      abi: executorAbi,
      functionName: "execute",
      args: [paymentId],
      chainId: expectedChainId,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  }

  async function executePayrollBatch(_planId: Hex, recipientIds: Hex[]): Promise<Hex> {
    assertReady();
    assertExecutorReady();
    const paymentIds = recipientIds.map((rid) => computePaymentId(payrollAddress, rid));
    const hash = await writeContract(config, {
      address: executorAddress,
      abi: executorAbi,
      functionName: "executeBatch",
      args: [paymentIds],
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
