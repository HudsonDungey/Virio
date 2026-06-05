"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  maxUint256,
  parseEventLogs,
  type Address,
  type Chain,
  type EIP1193Provider,
  type Hash,
  type Hex,
} from "viem";

import { VIRIO_ABI, ERC20_ABI } from "../abi.js";
import { computeSubscriptionId, formatUnits, PERIOD } from "../helpers.js";
import type { WcProvider } from "./walletconnect.js";

// The spec's VirioSubscriptionService + VirioTransactionManager: load a plan,
// check allowance, build the minimal signature sequence, and return the
// subscription id. All reads go through a public client built from the RPC URL;
// writes go through a wallet client wrapping the WalletConnect provider. We talk
// to the contract directly (rather than the high-level Virio client) so the
// modal can surface each tx hash the instant it is signed — the "preparing →
// signing → pending → success" flow the UX requires.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface PlanSummary {
  planId: Hex;
  merchant: Address;
  token: Address;
  /** Gross amount per charge, in the token's smallest unit. */
  amount: bigint;
  /** Seconds between charges. */
  period: bigint;
  active: boolean;
  /** Token decimals, resolved for display + allowance math. */
  decimals: number;
  /** Token symbol, e.g. "USDC". */
  symbol: string;
}

export interface LoadPlanArgs {
  rpcUrl: string;
  chain: Chain;
  contractAddress: Address;
  planId: Hex;
}

/** Resolve a plan and its payment token's display metadata from the chain. */
export async function loadPlan(args: LoadPlanArgs): Promise<PlanSummary> {
  if (args.contractAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(
      "Virio: contractAddress is not configured. Pass `contractAddress` to <VirioProvider>.",
    );
  }

  const pub = createPublicClient({ chain: args.chain, transport: http(args.rpcUrl) });
  const plan = await pub.readContract({
    address: args.contractAddress,
    abi: VIRIO_ABI,
    functionName: "getPlan",
    args: [args.planId],
  });

  if (!plan.active) throw new Error("Virio: this plan is not active.");

  const [decimals, symbol] = await Promise.all([
    pub.readContract({ address: plan.token, abi: ERC20_ABI, functionName: "decimals" }),
    pub.readContract({ address: plan.token, abi: ERC20_ABI, functionName: "symbol" }),
  ]);

  return {
    planId: args.planId,
    merchant: plan.merchant,
    token: plan.token,
    amount: plan.amount,
    period: plan.period,
    active: plan.active,
    decimals: Number(decimals),
    symbol,
  };
}

export interface SubscribeArgs {
  rpcUrl: string;
  chain: Chain;
  contractAddress: Address;
  plan: PlanSummary;
  account: Address;
  provider: WcProvider;
  /** Fired with each tx hash the moment it is broadcast, before confirmation. */
  onPending?: (txHash: Hash) => void;
}

/**
 * Subscribe the connected account to a plan, approving the token first when the
 * current allowance is insufficient. We approve `maxUint256` so the recurring
 * charges a subscription implies don't each require a fresh approval — the
 * spend is still bounded on-chain by the plan and any subscription spend cap.
 */
export async function subscribeToPlan(
  args: SubscribeArgs,
): Promise<{ subscriptionId: Hex; txHash: Hash }> {
  const pub = createPublicClient({ chain: args.chain, transport: http(args.rpcUrl) });
  const wallet = createWalletClient({
    account: args.account,
    chain: args.chain,
    transport: custom(args.provider as unknown as EIP1193Provider),
  });

  const allowance = await pub.readContract({
    address: args.plan.token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [args.account, args.contractAddress],
  });

  if (allowance < args.plan.amount) {
    const approveHash = await wallet.writeContract({
      address: args.plan.token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [args.contractAddress, maxUint256],
      account: args.account,
      chain: args.chain,
    });
    args.onPending?.(approveHash);
    await pub.waitForTransactionReceipt({ hash: approveHash });
  }

  const subscribeHash = await wallet.writeContract({
    address: args.contractAddress,
    abi: VIRIO_ABI,
    functionName: "subscribe",
    args: [args.plan.planId, 0n],
    account: args.account,
    chain: args.chain,
  });
  args.onPending?.(subscribeHash);
  const receipt = await pub.waitForTransactionReceipt({ hash: subscribeHash });

  const logs = parseEventLogs({ abi: VIRIO_ABI, eventName: "Subscribed", logs: receipt.logs });
  const subscriptionId =
    (logs[0]?.args as { subscriptionId?: Hex } | undefined)?.subscriptionId ??
    computeSubscriptionId(args.plan.planId, args.account);

  return { subscriptionId, txHash: subscribeHash };
}

// ── Display helpers (UI edge: bigint → string) ──

/** "20 USDC" */
export function formatAmount(plan: PlanSummary): string {
  return `${formatUnits(plan.amount, plan.decimals)} ${plan.symbol}`;
}

/** "Every Month" for known periods, else "Every N days". */
export function formatInterval(period: bigint): string {
  switch (period) {
    case PERIOD.DAILY:
      return "Every Day";
    case PERIOD.WEEKLY:
      return "Every Week";
    case PERIOD.MONTHLY:
      return "Every Month";
    case PERIOD.ANNUALLY:
      return "Every Year";
    default: {
      const days = Number(period) / 86_400;
      return days >= 1 ? `Every ${days} days` : `Every ${Number(period)}s`;
    }
  }
}
