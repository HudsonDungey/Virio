import type { Hex, Log } from "viem";
import {
  publicClient,
  MANAGER_ADDRESS,
  managerAbi,
  usdcDisplay,
  executorWallet,
  DEPLOYMENT_BLOCK,
  NETWORK,
} from "./chain";
import { getStore } from "./store";
import type { Plan, Subscription, Transaction } from "./types";

// Cache the start block. On Sepolia we start from the configured deploymentBlock to
// avoid scanning ~7M blocks of pre-deployment history. On anvil we start from 0.
let lastSyncedBlock: bigint = DEPLOYMENT_BLOCK > 0n ? DEPLOYMENT_BLOCK - 1n : 0n;
const INITIAL_FROM_BLOCK = lastSyncedBlock;
const planEvents: { planId: Hex; merchant: Hex; token: Hex; amount: bigint; period: bigint; blockNumber: bigint }[] = [];
const planDeactivations = new Set<string>();
const subEvents: { subId: Hex; planId: Hex; customer: Hex; totalSpendCap: bigint; blockNumber: bigint }[] = [];
const cancelledSubs = new Set<string>();
const chargeEvents: {
  subId: Hex;
  executor: Hex;
  customer: Hex;
  gross: bigint;
  merchantAmount: bigint;
  executorFee: bigint;
  protocolFee: bigint;
  nextChargeAt: bigint;
  txHash: Hex;
  blockNumber: bigint;
  timestamp: number;          // unix seconds from the block this event was emitted in
}[] = [];

// Cache block.timestamp by block number to avoid repeated RPC calls.
const blockTimestamps = new Map<bigint, number>();
async function timestampOf(blockNumber: bigint): Promise<number> {
  const cached = blockTimestamps.get(blockNumber);
  if (cached !== undefined) return cached;
  const block = await publicClient.getBlock({ blockNumber });
  const ts = Number(block.timestamp);
  blockTimestamps.set(blockNumber, ts);
  return ts;
}

// Public RPCs cap getLogs ranges — the free thirdweb fallback is 1000, Alchemy free
// is ~500 for filtered topics. 500 blocks is the safe slice that works on both.
const MAX_LOG_RANGE = NETWORK === "sepolia" ? 500n : 50_000n;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// Concurrent callers share one in-flight sync rather than each running their own,
// which would cause the same log range to be ingested multiple times.
let syncInFlight: Promise<void> | null = null;

function syncEvents(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = doSyncEvents().finally(() => { syncInFlight = null; });
  return syncInFlight;
}

async function doSyncEvents(): Promise<void> {
  // Don't try to scan if the user hasn't configured the manager address yet.
  // Returns silently — the UI will just show empty plans/subs/transactions.
  if (MANAGER_ADDRESS.toLowerCase() === ZERO_ADDR) return;

  const head = await publicClient.getBlockNumber();
  if (head <= lastSyncedBlock) return;
  let cursor = lastSyncedBlock + 1n;

  const events = managerAbi.filter((x) => x.type === "event") as never;
  while (cursor <= head) {
    const sliceEnd = cursor + MAX_LOG_RANGE - 1n < head ? cursor + MAX_LOG_RANGE - 1n : head;
    const logs = await publicClient.getLogs({
      address: MANAGER_ADDRESS,
      fromBlock: cursor,
      toBlock: sliceEnd,
      events,
    });
    await ingestLogs(logs);
    cursor = sliceEnd + 1n;
  }
  lastSyncedBlock = head;
}

async function ingestLogs(logs: unknown[]) {

  for (const log of logs as unknown as Array<Log & { eventName: string; args: Record<string, unknown> }>) {
    const name = log.eventName;
    const a = log.args;
    if (name === "PlanCreated") {
      planEvents.push({
        planId: a.planId as Hex,
        merchant: a.merchant as Hex,
        token: a.token as Hex,
        amount: a.amount as bigint,
        period: a.period as bigint,
        blockNumber: log.blockNumber!,
      });
    } else if (name === "PlanDeactivated") {
      planDeactivations.add((a.planId as string).toLowerCase());
    } else if (name === "Subscribed") {
      subEvents.push({
        subId: a.subscriptionId as Hex,
        planId: a.planId as Hex,
        customer: a.customer as Hex,
        totalSpendCap: a.totalSpendCap as bigint,
        blockNumber: log.blockNumber!,
      });
    } else if (name === "Cancelled") {
      cancelledSubs.add((a.subscriptionId as string).toLowerCase());
    } else if (name === "ChargeExecuted") {
      const ts = await timestampOf(log.blockNumber!);
      chargeEvents.push({
        subId: a.subscriptionId as Hex,
        executor: a.executor as Hex,
        customer: a.customer as Hex,
        gross: a.gross as bigint,
        merchantAmount: a.merchantAmount as bigint,
        executorFee: a.executorFee as bigint,
        protocolFee: a.protocolFee as bigint,
        nextChargeAt: a.nextChargeAt as bigint,
        txHash: log.transactionHash!,
        blockNumber: log.blockNumber!,
        timestamp: ts,
      });
    }
  }
}

/// Detect chain reset (head went backwards — only really applies on anvil) and reset caches.
async function resyncIfReset() {
  try {
    const head = await publicClient.getBlockNumber();
    if (head < lastSyncedBlock) {
      lastSyncedBlock = INITIAL_FROM_BLOCK;
      planEvents.length = 0;
      planDeactivations.clear();
      subEvents.length = 0;
      cancelledSubs.clear();
      chargeEvents.length = 0;
    }
  } catch {
    // ignore — RPC may be temporarily down
  }
}

export async function listPlans(): Promise<Plan[]> {
  await resyncIfReset();
  await syncEvents();
  const store = getStore();
  const out: Plan[] = [];
  for (const p of planEvents) {
    const meta = store.planMeta.get(p.planId.toLowerCase());
    const deactivated = planDeactivations.has(p.planId.toLowerCase());
    out.push({
      id: p.planId,
      name: meta?.name ?? `${p.planId.slice(0, 10)}`,
      description: meta?.description ?? "",
      price: usdcDisplay(p.amount),
      intervalLabel: meta?.intervalLabel ?? `${p.period}s`,
      intervalSeconds: Number(p.period),
      cancelAfterCharges: meta?.cancelAfterCharges ?? null,
      active: !deactivated,
      createdAt: meta?.createdAt ?? new Date(0).toISOString(),
      isTestInterval: meta?.isTestInterval ?? Number(p.period) < 300,
    });
  }
  return out.reverse(); // newest first
}

export async function plansByMerchant(address: Hex): Promise<Plan[]> {
  await resyncIfReset();
  await syncEvents();
  const target = address.toLowerCase();
  const wanted = new Set(
    planEvents
      .filter((p) => p.merchant.toLowerCase() === target)
      .map((p) => p.planId.toLowerCase()),
  );
  if (wanted.size === 0) return [];
  const all = await listPlans();
  return all.filter((p) => wanted.has(p.id.toLowerCase()));
}

/// Single eth_call against the manager's `getMerchantStats` view. Returns the
/// merchant's aggregate counters (revenue, fees, charges, active counts) so
/// the dashboard overview can render without scanning the entire event log.
export async function merchantStats(merchant: Hex): Promise<{
  totalEarned: bigint;
  totalFeesPaid: bigint;
  totalCharges: bigint;
  activePlans: bigint;
  activeSubs: bigint;
}> {
  if (MANAGER_ADDRESS.toLowerCase() === ZERO_ADDR) {
    return { totalEarned: 0n, totalFeesPaid: 0n, totalCharges: 0n, activePlans: 0n, activeSubs: 0n };
  }
  return await publicClient.readContract({
    address: MANAGER_ADDRESS,
    abi: managerAbi,
    functionName: "getMerchantStats",
    args: [merchant],
  });
}

/// Charges paid to a specific merchant. Used to render the merchant-scoped
/// recent transactions list without leaking other merchants' activity.
export async function transactionsByMerchant(merchant: Hex): Promise<Transaction[]> {
  await resyncIfReset();
  await syncEvents();
  const target = merchant.toLowerCase();
  const merchantPlanIds = new Set(
    planEvents.filter((p) => p.merchant.toLowerCase() === target).map((p) => p.planId.toLowerCase()),
  );
  if (merchantPlanIds.size === 0) return [];
  const subPlan = new Map<string, Hex>();
  for (const s of subEvents) subPlan.set(s.subId.toLowerCase(), s.planId);

  const plans = await listPlans();
  const planLookup = new Map(plans.map((p) => [p.id.toLowerCase(), p]));

  const out: Transaction[] = [];
  for (const c of chargeEvents) {
    const planId = subPlan.get(c.subId.toLowerCase());
    if (!planId || !merchantPlanIds.has(planId.toLowerCase())) continue;
    const plan = planLookup.get(planId.toLowerCase());
    out.push({
      id: c.txHash,
      type: "subscription",
      subscriptionId: c.subId,
      planId,
      planName: plan?.name ?? "(deleted plan)",
      counterparty: c.customer,
      merchantAmount: usdcDisplay(c.merchantAmount),
      fee: usdcDisplay(c.protocolFee + c.executorFee),
      gross: usdcDisplay(c.gross),
      direction: "in",
      status: "success",
      timestamp: new Date(c.timestamp * 1000).toISOString(),
    });
  }
  return out.reverse();
}

export async function plansByCustomer(address: Hex): Promise<Plan[]> {
  await resyncIfReset();
  await syncEvents();
  const target = address.toLowerCase();
  const wanted = new Set(
    subEvents
      .filter((s) => s.customer.toLowerCase() === target)
      .map((s) => s.planId.toLowerCase()),
  );
  if (wanted.size === 0) return [];
  const all = await listPlans();
  return all.filter((p) => wanted.has(p.id.toLowerCase()));
}

export async function listSubscriptions(): Promise<Subscription[]> {
  await resyncIfReset();
  await syncEvents();
  const store = getStore();
  const plans = await listPlans();
  const planLookup = new Map(plans.map((p) => [p.id.toLowerCase(), p]));
  const planMerchant = new Map(planEvents.map((p) => [p.planId.toLowerCase(), p.merchant]));

  const out: Subscription[] = [];
  for (const s of subEvents) {
    const plan = planLookup.get(s.planId.toLowerCase());
    if (!plan) continue;
    const cancelled = cancelledSubs.has(s.subId.toLowerCase());
    const myCharges = chargeEvents.filter(
      (c) => c.subId.toLowerCase() === s.subId.toLowerCase(),
    );
    const chargeCount = myCharges.length;
    const totalPaid = myCharges.reduce((sum, c) => sum + usdcDisplay(c.gross), 0);

    const lastCharge = myCharges[myCharges.length - 1];
    const nextChargeAt = lastCharge
      ? Number(lastCharge.nextChargeAt)
      : 0; // 0 = immediately chargeable until first charge

    const completedByCount =
      plan.cancelAfterCharges !== null && chargeCount >= plan.cancelAfterCharges;
    const completedByCap =
      s.totalSpendCap > 0n &&
      myCharges.reduce((sum, c) => sum + c.gross, 0n) >= s.totalSpendCap;

    const status: Subscription["status"] = cancelled
      ? "cancelled"
      : completedByCap
        ? "completed"
        : completedByCount
          ? "completed"
          : "active";

    const meta = store.subMeta.get(s.subId.toLowerCase());

    out.push({
      id: s.subId,
      planId: s.planId,
      planName: plan.name,
      merchant: planMerchant.get(s.planId.toLowerCase()) ?? "0x0",
      customer: s.customer,
      spendCap: s.totalSpendCap === 0n ? null : usdcDisplay(s.totalSpendCap),
      chargeCount,
      totalPaid: Math.round(totalPaid * 100) / 100,
      nextChargeAt,
      status,
      createdAt: meta?.createdAt ?? new Date(0).toISOString(),
    });
  }
  return out.reverse();
}

export async function subscriptionsByWallet(wallet: Hex): Promise<Subscription[]> {
  const target = wallet.toLowerCase();
  const all = await listSubscriptions();
  return all.filter(
    (s) => s.customer.toLowerCase() === target || s.merchant.toLowerCase() === target,
  );
}

export async function transactionsByWallet(wallet: Hex): Promise<Transaction[]> {
  await resyncIfReset();
  await syncEvents();
  const target = wallet.toLowerCase();
  const planMerchant = new Map(planEvents.map((p) => [p.planId.toLowerCase(), p.merchant.toLowerCase()]));
  const subPlan = new Map<string, Hex>();
  for (const s of subEvents) subPlan.set(s.subId.toLowerCase(), s.planId);
  const plans = await listPlans();
  const planLookup = new Map(plans.map((p) => [p.id.toLowerCase(), p]));

  const out: Transaction[] = [];
  for (const c of chargeEvents) {
    const planId = subPlan.get(c.subId.toLowerCase());
    if (!planId) continue;
    const merchant = planMerchant.get(planId.toLowerCase());
    if (!merchant) continue;
    const isMerchant = merchant === target;
    const isCustomer = c.customer.toLowerCase() === target;
    if (!isMerchant && !isCustomer) continue;
    const plan = planLookup.get(planId.toLowerCase());
    out.push({
      id: c.txHash,
      type: "subscription",
      subscriptionId: c.subId,
      planId,
      planName: plan?.name ?? "(deleted plan)",
      counterparty: isMerchant ? c.customer : merchant,
      merchantAmount: usdcDisplay(c.merchantAmount),
      fee: usdcDisplay(c.protocolFee + c.executorFee),
      gross: usdcDisplay(c.gross),
      direction: isMerchant ? "in" : "out",
      status: "success",
      timestamp: new Date(c.timestamp * 1000).toISOString(),
    });
  }
  return out.reverse();
}

export async function listTransactions(): Promise<Transaction[]> {
  await resyncIfReset();
  await syncEvents();
  const plans = await listPlans();
  const planLookup = new Map(plans.map((p) => [p.id.toLowerCase(), p]));
  const subPlan = new Map<string, Hex>();
  for (const s of subEvents) subPlan.set(s.subId.toLowerCase(), s.planId);

  const out: Transaction[] = [];
  for (const c of chargeEvents) {
    const planId = subPlan.get(c.subId.toLowerCase());
    const plan = planId ? planLookup.get(planId.toLowerCase()) : undefined;
    out.push({
      id: c.txHash,
      type: "subscription",
      subscriptionId: c.subId,
      planId: planId ?? ("0x" as Hex),
      planName: plan?.name ?? "(deleted plan)",
      counterparty: c.customer,
      merchantAmount: usdcDisplay(c.merchantAmount),
      fee: usdcDisplay(c.protocolFee + c.executorFee),
      gross: usdcDisplay(c.gross),
      direction: "in",
      status: "success",
      timestamp: new Date(c.timestamp * 1000).toISOString(),
    });
  }
  return out.reverse();
}

/// Compute subscriptions that are due for charging right now (nextChargeAt <= now).
export async function dueSubscriptions(): Promise<{ subId: Hex; merchant: Hex }[]> {
  await syncEvents();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const out: { subId: Hex; merchant: Hex }[] = [];
  for (const s of subEvents) {
    if (cancelledSubs.has(s.subId.toLowerCase())) continue;
    // Read current sub state from chain — cheap on anvil.
    const sub = await publicClient.readContract({
      address: MANAGER_ADDRESS,
      abi: managerAbi,
      functionName: "getSubscription",
      args: [s.subId],
    });
    if (!sub.active) continue;
    if (sub.nextChargeAt > now) continue;
    out.push({ subId: s.subId, merchant: sub.merchant });
  }
  return out;
}

/// Trigger a single charge from the executor wallet (env-configured Sepolia EOA).
/// Throws a clear error if EXECUTOR_PRIVATE_KEY isn't configured.
export async function chargeOnce(subId: Hex): Promise<Hex> {
  const wallet = executorWallet();
  if (!wallet) {
    throw new Error(
      "executor wallet not configured — set EXECUTOR_PRIVATE_KEY in .env.local " +
        "(a dedicated Sepolia EOA funded with a small amount of ETH for gas).",
    );
  }
  const hash = await wallet.writeContract({
    address: MANAGER_ADDRESS,
    abi: managerAbi,
    functionName: "charge",
    args: [subId],
    account: wallet.account!,
    chain: wallet.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  // Force-sync new events so reads reflect the charge.
  await syncEvents();
  return hash;
}

// ─── Income time series ─────────────────────────────────────────────────────

export type Range = "1d" | "1w" | "1m" | "1y";

export interface IncomePoint {
  /// unix seconds — left edge of the bucket
  t: number;
  /// merchant net income summed across charges in this bucket
  income: number;
  /// total gross volume in this bucket (for tooltip context)
  gross: number;
  /// number of charges in this bucket
  count: number;
}

export interface IncomeSeries {
  range: Range;
  bucketSeconds: number;
  points: IncomePoint[];
}

const RANGE_CONFIG: Record<Range, { spanSec: number; bucketSec: number; label: string }> = {
  // 24 buckets, 1 hour each, last 24h
  "1d": { spanSec: 24 * 3600,             bucketSec: 3600,         label: "1 day"    },
  // 7 buckets, 1 day each, last 7d
  "1w": { spanSec: 7 * 24 * 3600,         bucketSec: 24 * 3600,    label: "1 week"   },
  // 30 buckets, 1 day each, last 30d
  "1m": { spanSec: 30 * 24 * 3600,        bucketSec: 24 * 3600,    label: "1 month"  },
  // 12 buckets, 30 days each, last 360d
  "1y": { spanSec: 360 * 24 * 3600,       bucketSec: 30 * 24 * 3600, label: "1 year" },
};

export async function incomeSeries(range: Range): Promise<IncomeSeries> {
  await resyncIfReset();
  await syncEvents();
  const { spanSec, bucketSec } = RANGE_CONFIG[range];
  const now = Math.floor(Date.now() / 1000);
  const buckets = Math.ceil(spanSec / bucketSec);

  // Anchor the rightmost bucket on the one containing "now" so the latest
  // charges always show up; the leftmost bucket is (buckets - 1) back from it.
  const lastBucketStart = Math.floor(now / bucketSec) * bucketSec;
  const startAligned = lastBucketStart - (buckets - 1) * bucketSec;

  const points: IncomePoint[] = [];
  for (let i = 0; i < buckets; i++) {
    points.push({
      t: startAligned + i * bucketSec,
      income: 0,
      gross: 0,
      count: 0,
    });
  }

  for (const c of chargeEvents) {
    if (c.timestamp < startAligned || c.timestamp >= startAligned + buckets * bucketSec) continue;
    const idx = Math.floor((c.timestamp - startAligned) / bucketSec);
    if (idx < 0 || idx >= buckets) continue;
    const bucket = points[idx];
    bucket.income += usdcDisplay(c.merchantAmount);
    bucket.gross  += usdcDisplay(c.gross);
    bucket.count  += 1;
  }

  // Round display values to cents.
  for (const p of points) {
    p.income = Math.round(p.income * 100) / 100;
    p.gross  = Math.round(p.gross  * 100) / 100;
  }

  return { range, bucketSeconds: bucketSec, points };
}
