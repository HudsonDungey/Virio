/// On-chain readers for VirioPayrollManager. Pattern mirrors `chain-reads.ts`:
/// stateful event ingestion + slot reads layered on top.
///
/// Server-only — every public function returns plain JSON shapes for API routes.

import type { Hex, Log } from "viem";
import {
  publicClient,
  PAYROLL_ADDRESS,
  payrollAbi,
  usdcDisplay,
  PAYROLL_DEPLOYMENT_BLOCK,
  NETWORK,
} from "./chain";
import type {
  PayrollPlan,
  PayrollRecipient,
  PayrollExecution,
  PayrollStats,
  Transaction,
  TaxReportEntry,
} from "./types";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

let lastSyncedBlock: bigint =
  PAYROLL_DEPLOYMENT_BLOCK > 0n ? PAYROLL_DEPLOYMENT_BLOCK - 1n : 0n;
const INITIAL_FROM_BLOCK = lastSyncedBlock;

interface PlanEvent {
  planId: Hex;
  employer: Hex;
  token: Hex;
  period: bigint;
  blockNumber: bigint;
  timestamp: number;
}
const planEvents: PlanEvent[] = [];
const planDeactivations = new Set<string>();

interface RecipientAddedEvent {
  planId: Hex;
  recipientId: Hex;
  wallet: Hex;
  amount: bigint;
  spendCap: bigint;
}
const recipientAdds: RecipientAddedEvent[] = [];
const recipientRemovals = new Set<string>(); // recipientId.toLowerCase()
/// Holds the last seen (amount, spendCap) for a recipientId — RecipientUpdated overrides.
const recipientUpdates = new Map<string, { amount: bigint; spendCap: bigint }>();

interface ExecutionEvent {
  planId: Hex;
  recipientId: Hex;
  executor: Hex;
  recipient: Hex;
  grossAmount: bigint;
  recipientAmount: bigint;
  executorFee: bigint;
  protocolFee: bigint;
  nextPayAt: bigint;
  txHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number;
}
const executions: ExecutionEvent[] = [];

interface BatchEvent {
  planId: Hex;
  executor: Hex;
  successCount: bigint;
  failCount: bigint;
  blockNumber: bigint;
}
const batchEvents: BatchEvent[] = [];

const blockTimestamps = new Map<bigint, number>();
async function timestampOf(blockNumber: bigint): Promise<number> {
  const cached = blockTimestamps.get(blockNumber);
  if (cached !== undefined) return cached;
  const block = await publicClient.getBlock({ blockNumber });
  const ts = Number(block.timestamp);
  blockTimestamps.set(blockNumber, ts);
  return ts;
}

const MAX_LOG_RANGE = NETWORK === "sepolia" ? 500n : 50_000n;

async function syncEvents() {
  if (PAYROLL_ADDRESS.toLowerCase() === ZERO_ADDR) return;
  const head = await publicClient.getBlockNumber();
  if (head <= lastSyncedBlock) return;

  let cursor = lastSyncedBlock + 1n;
  const events = payrollAbi.filter((x) => x.type === "event") as never;

  while (cursor <= head) {
    const sliceEnd = cursor + MAX_LOG_RANGE - 1n < head ? cursor + MAX_LOG_RANGE - 1n : head;
    const logs = await publicClient.getLogs({
      address: PAYROLL_ADDRESS,
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
  for (const log of logs as unknown as Array<
    Log & { eventName: string; args: Record<string, unknown> }
  >) {
    const name = log.eventName;
    const a = log.args;
    const blockNumber = log.blockNumber!;
    const ts = await timestampOf(blockNumber);

    if (name === "PlanCreated") {
      planEvents.push({
        planId: a.planId as Hex,
        employer: a.employer as Hex,
        token: a.token as Hex,
        period: a.period as bigint,
        blockNumber,
        timestamp: ts,
      });
    } else if (name === "PlanDeactivated") {
      planDeactivations.add((a.planId as string).toLowerCase());
    } else if (name === "RecipientAdded") {
      recipientAdds.push({
        planId: a.planId as Hex,
        recipientId: a.recipientId as Hex,
        wallet: a.wallet as Hex,
        amount: a.amount as bigint,
        spendCap: a.spendCap as bigint,
      });
    } else if (name === "RecipientRemoved") {
      recipientRemovals.add((a.recipientId as string).toLowerCase());
    } else if (name === "RecipientUpdated") {
      recipientUpdates.set((a.recipientId as string).toLowerCase(), {
        amount: a.newAmount as bigint,
        spendCap: a.newSpendCap as bigint,
      });
    } else if (name === "PayrollExecuted") {
      executions.push({
        planId: a.planId as Hex,
        recipientId: a.recipientId as Hex,
        executor: a.executor as Hex,
        recipient: a.recipient as Hex,
        grossAmount: a.grossAmount as bigint,
        recipientAmount: a.recipientAmount as bigint,
        executorFee: a.executorFee as bigint,
        protocolFee: a.protocolFee as bigint,
        nextPayAt: a.nextPayAt as bigint,
        txHash: log.transactionHash!,
        blockNumber,
        logIndex: log.logIndex ?? 0,
        timestamp: ts,
      });
    } else if (name === "BatchPayrollExecuted") {
      batchEvents.push({
        planId: a.planId as Hex,
        executor: a.executor as Hex,
        successCount: a.successCount as bigint,
        failCount: a.failCount as bigint,
        blockNumber,
      });
    }
  }
}

async function resyncIfReset() {
  try {
    const head = await publicClient.getBlockNumber();
    if (head < lastSyncedBlock) {
      lastSyncedBlock = INITIAL_FROM_BLOCK;
      planEvents.length = 0;
      planDeactivations.clear();
      recipientAdds.length = 0;
      recipientRemovals.clear();
      recipientUpdates.clear();
      executions.length = 0;
      batchEvents.length = 0;
    }
  } catch {
    /* ignore — RPC briefly down */
  }
}

function intervalLabel(seconds: number): string {
  if (seconds % 604_800 === 0) return seconds === 604_800 ? "Weekly" : `Every ${seconds / 604_800} weeks`;
  if (seconds % 86_400 === 0) return seconds === 86_400 ? "Daily" : `Every ${seconds / 86_400} days`;
  if (seconds % 3_600 === 0) return seconds === 3_600 ? "Hourly" : `Every ${seconds / 3_600} hours`;
  if (seconds % 60 === 0) return `Every ${seconds / 60} minutes`;
  return `${seconds}s`;
}

// ─── Public reads ─────────────────────────────────────────────────────────

export async function listPayrollPlans(employer?: string): Promise<PayrollPlan[]> {
  await resyncIfReset();
  await syncEvents();

  const filter = employer?.toLowerCase();
  return planEvents
    .filter((p) => !filter || p.employer.toLowerCase() === filter)
    .map((p) => {
      const recipients = recipientAdds.filter(
        (r) =>
          r.planId.toLowerCase() === p.planId.toLowerCase() &&
          !recipientRemovals.has(r.recipientId.toLowerCase()),
      );
      return {
        id: p.planId,
        employer: p.employer,
        token: p.token,
        intervalSeconds: Number(p.period),
        intervalLabel: intervalLabel(Number(p.period)),
        active: !planDeactivations.has(p.planId.toLowerCase()),
        createdAt: new Date(p.timestamp * 1000).toISOString(),
        recipientCount: recipients.length,
      };
    })
    .reverse(); // newest first
}

export async function listPayrollRecipients(planId: string): Promise<PayrollRecipient[]> {
  await resyncIfReset();
  await syncEvents();

  const adds = recipientAdds.filter(
    (r) => r.planId.toLowerCase() === planId.toLowerCase(),
  );

  // For each active recipient, fall back to a fresh on-chain view to get the
  // current totalPaid / nextPayAt (which aren't on the events).
  const out: PayrollRecipient[] = [];
  for (const r of adds) {
    if (recipientRemovals.has(r.recipientId.toLowerCase())) continue;
    const updated = recipientUpdates.get(r.recipientId.toLowerCase());

    // Resolve live state from the contract (totalPaid, nextPayAt, active).
    const live = (await publicClient.readContract({
      address: PAYROLL_ADDRESS,
      abi: payrollAbi,
      functionName: "getRecipient" as never,
      args: [r.planId as Hex, r.recipientId as Hex],
    } as never)) as {
      wallet: Hex;
      amount: bigint;
      nextPayAt: bigint;
      totalPaid: bigint;
      spendCap: bigint;
      active: boolean;
    };

    out.push({
      id: r.recipientId,
      planId: r.planId,
      wallet: r.wallet,
      amount: usdcDisplay(updated?.amount ?? live.amount),
      nextPayAt: Number(live.nextPayAt),
      totalPaid: usdcDisplay(live.totalPaid),
      spendCap: usdcDisplay(updated?.spendCap ?? live.spendCap),
      active: live.active,
    });
  }
  return out;
}

export async function listPayrollExecutions(
  filter?: { planId?: string; recipientId?: string; employer?: string },
): Promise<PayrollExecution[]> {
  await resyncIfReset();
  await syncEvents();

  // Optionally pre-restrict to a particular employer's plans
  const employerPlanIds = filter?.employer
    ? new Set(
        planEvents
          .filter((p) => p.employer.toLowerCase() === filter.employer!.toLowerCase())
          .map((p) => p.planId.toLowerCase()),
      )
    : null;

  return executions
    .filter((e) => {
      if (filter?.planId && e.planId.toLowerCase() !== filter.planId.toLowerCase()) return false;
      if (filter?.recipientId && e.recipientId.toLowerCase() !== filter.recipientId.toLowerCase())
        return false;
      if (employerPlanIds && !employerPlanIds.has(e.planId.toLowerCase())) return false;
      return true;
    })
    .map((e) => ({
      id: `${e.txHash}-${e.logIndex}`,
      planId: e.planId,
      recipientId: e.recipientId,
      executor: e.executor,
      recipient: e.recipient,
      gross: usdcDisplay(e.grossAmount),
      recipientAmount: usdcDisplay(e.recipientAmount),
      executorFee: usdcDisplay(e.executorFee),
      protocolFee: usdcDisplay(e.protocolFee),
      nextPayAt: Number(e.nextPayAt),
      timestamp: e.timestamp,
    }))
    .reverse(); // newest first
}

export async function payrollTransactionsByWallet(wallet: string): Promise<Transaction[]> {
  await resyncIfReset();
  await syncEvents();
  const target = wallet.toLowerCase();
  const planEmployer = new Map(planEvents.map((p) => [p.planId.toLowerCase(), p.employer.toLowerCase()]));

  const out: Transaction[] = [];
  for (const e of executions) {
    const employer = planEmployer.get(e.planId.toLowerCase());
    if (!employer) continue;
    const isEmployer = employer === target;
    const isRecipient = e.recipient.toLowerCase() === target;
    if (!isEmployer && !isRecipient) continue;
    out.push({
      id: `${e.txHash}-${e.logIndex}`,
      type: "payroll",
      planId: e.planId,
      planName: `Payroll ${e.planId.slice(0, 10)}`,
      counterparty: isEmployer ? e.recipient : employer,
      merchantAmount: usdcDisplay(e.recipientAmount),
      fee: usdcDisplay(e.executorFee + e.protocolFee),
      gross: usdcDisplay(e.grossAmount),
      direction: isEmployer ? "out" : "in",
      status: "success",
      timestamp: new Date(e.timestamp * 1000).toISOString(),
    });
  }
  return out.reverse();
}

/// All payroll executions for a wallet (as employer or recipient), filtered to sinceUnix,
/// with fees broken out for tax reporting.
export async function payrollReportEntriesByWallet(wallet: string, sinceUnix: number): Promise<TaxReportEntry[]> {
  await resyncIfReset();
  await syncEvents();
  const target = wallet.toLowerCase();
  const planEmployer = new Map(planEvents.map((p) => [p.planId.toLowerCase(), p.employer.toLowerCase()]));

  const out: TaxReportEntry[] = [];
  for (const e of executions) {
    if (e.timestamp < sinceUnix) continue;
    const employer = planEmployer.get(e.planId.toLowerCase());
    if (!employer) continue;
    const isEmployer = employer === target;
    const isRecipient = e.recipient.toLowerCase() === target;
    if (!isEmployer && !isRecipient) continue;
    out.push({
      txHash: `${e.txHash}-${e.logIndex}`,
      timestamp: new Date(e.timestamp * 1000).toISOString(),
      type: "payroll",
      planId: e.planId,
      planName: `Payroll ${e.planId.slice(0, 10)}`,
      counterparty: isEmployer ? e.recipient : employer,
      gross: usdcDisplay(e.grossAmount),
      netAmount: isEmployer ? usdcDisplay(e.grossAmount) : usdcDisplay(e.recipientAmount),
      protocolFee: usdcDisplay(e.protocolFee),
      executorFee: usdcDisplay(e.executorFee),
      direction: isEmployer ? "out" : "in",
    });
  }
  return out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function payrollStats(employer?: string): Promise<PayrollStats> {
  const plans = await listPayrollPlans(employer);
  const planIds = new Set(plans.map((p) => p.id.toLowerCase()));

  // Roll up live recipient counts (active only) via getPlanRecipients (cheaper than per-recipient)
  let totalRecipients = 0;
  for (const p of plans) {
    const list = (await publicClient.readContract({
      address: PAYROLL_ADDRESS,
      abi: payrollAbi,
      functionName: "getPlanRecipients" as never,
      args: [p.id as Hex],
    } as never)) as Array<{ active: boolean }>;
    totalRecipients += list.filter((r) => r.active).length;
  }

  const relevantExecs = executions.filter(
    (e) => !employer || planIds.has(e.planId.toLowerCase()),
  );
  const totalVolume = relevantExecs.reduce((s, e) => s + usdcDisplay(e.grossAmount), 0);
  const failedRecent = batchEvents
    .filter((b) => !employer || planIds.has(b.planId.toLowerCase()))
    .filter((b) => b.failCount > 0n).length;

  return {
    totalVolume,
    totalRecipients,
    activePlans: plans.filter((p) => p.active).length,
    failedRecent,
    recentExecutions: (await listPayrollExecutions({ employer })).slice(0, 10),
  };
}
