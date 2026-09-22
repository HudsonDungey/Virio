/// Server-side reads for the programmable billing stack (authorizations,
/// meters, settlements). Mirrors lib/chain-reads.ts, which serves the original
/// subscription manager — the two contracts are separate deployments and the
/// dashboard shows both.
///
/// Everything here is derived from chain state or `Settled` events. Nothing is
/// estimated, projected, or carried in a local database.

import type { Hex, Log } from "viem";
import { publicClient, NETWORK } from "./chain";
import { registryAbi, recurringAbi, meteredAbi } from "./billing-abis";
import { BILLING, BILLING_DEPLOYMENT_BLOCK, isBillingConfigured } from "./billing-config";

export type BillingType = "recurring" | "metered" | "hybrid";

const BILLING_TYPES: BillingType[] = ["recurring", "metered", "hybrid"];

export interface Authorization {
  id: Hex;
  payer: Hex;
  merchant: Hex;
  token: Hex;
  billingType: BillingType;
  maxPerCharge: bigint;
  periodSpendCap: bigint;
  totalSpendCap: bigint;
  spentThisPeriod: bigint;
  totalSpent: bigint;
  periodStart: bigint;
  periodDuration: bigint;
  validAfter: bigint;
  validUntil: bigint;
  active: boolean;
}

export interface SettlementRecord {
  id: string; // txHash:logIndex — unique per settlement
  authorizationId: Hex;
  module: Hex;
  executor: Hex;
  gross: bigint;
  merchantAmount: bigint;
  executorFee: bigint;
  protocolFee: bigint;
  periodStart: bigint;
  txHash: Hex;
  blockNumber: bigint;
  timestamp: number;
}

export interface MeterRecord {
  id: Hex;
  merchant: Hex;
  token: Hex;
  unit: Hex;
  unitPrice: bigint;
  includedUnitsPerPeriod: bigint;
  settlementInterval: bigint;
  active: boolean;
}

/// Aggregate numbers for a merchant, summed from `Settled` events. Every figure
/// is money that actually moved on-chain — nothing here is projected.
export interface BillingStats {
  settledVolume: bigint; // gross across all settlements
  merchantRevenue: bigint; // net after protocol and executor fees
  feesPaid: bigint;
  settlementCount: number;
  activeAuthorizations: number;
  recurringAuthorizations: number;
  meteredAuthorizations: number;
  hybridAuthorizations: number;
}

// ─── Event index ─────────────────────────────────────────────────────────────
// Same shape as chain-reads.ts: an in-process cache of decoded logs, paged in
// slices a rate-limited public RPC will serve.

const MAX_LOG_RANGE = NETWORK === "anvil" ? 50_000n : 500n;

let lastSyncedBlock: bigint =
  BILLING_DEPLOYMENT_BLOCK > 0n ? BILLING_DEPLOYMENT_BLOCK - 1n : 0n;
const INITIAL_FROM_BLOCK = lastSyncedBlock;

const authorizationIds = new Map<string, { id: Hex; payer: Hex; merchant: Hex }>();
const settlements: SettlementRecord[] = [];
const meterIds = new Map<string, Hex>();

const blockTimestamps = new Map<bigint, number>();
async function timestampOf(blockNumber: bigint): Promise<number> {
  const cached = blockTimestamps.get(blockNumber);
  if (cached !== undefined) return cached;
  const block = await publicClient.getBlock({ blockNumber });
  const ts = Number(block.timestamp);
  blockTimestamps.set(blockNumber, ts);
  return ts;
}

/// Concurrent callers share one in-flight sync, so the same log range is never
/// ingested twice.
let syncInFlight: Promise<void> | null = null;

function syncEvents(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = doSync().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function doSync(): Promise<void> {
  if (!isBillingConfigured()) return;

  const head = await publicClient.getBlockNumber();
  // A chain reset (a fresh anvil) rewinds the head below our cursor; start over
  // rather than serving state from a chain that no longer exists.
  if (head < lastSyncedBlock) {
    lastSyncedBlock = INITIAL_FROM_BLOCK;
    authorizationIds.clear();
    settlements.length = 0;
    meterIds.clear();
  }
  if (head <= lastSyncedBlock) return;

  let cursor = lastSyncedBlock + 1n;
  const registryEvents = registryAbi.filter((x) => x.type === "event") as never;
  const meteredEvents = meteredAbi.filter((x) => x.type === "event") as never;

  while (cursor <= head) {
    const end = cursor + MAX_LOG_RANGE - 1n < head ? cursor + MAX_LOG_RANGE - 1n : head;
    const [registryLogs, meterLogs] = await Promise.all([
      publicClient.getLogs({
        address: BILLING.authorizationRegistry,
        fromBlock: cursor,
        toBlock: end,
        events: registryEvents,
      }),
      publicClient.getLogs({
        address: BILLING.meteredBilling,
        fromBlock: cursor,
        toBlock: end,
        events: meteredEvents,
      }),
    ]);
    await ingest(registryLogs, meterLogs);
    cursor = end + 1n;
  }
  lastSyncedBlock = head;
}

type DecodedLog = Log & { eventName: string; args: Record<string, unknown> };

async function ingest(registryLogs: unknown[], meterLogs: unknown[]): Promise<void> {
  for (const log of registryLogs as DecodedLog[]) {
    const args = log.args;
    if (log.eventName === "AuthorizationCreated") {
      const id = args.authorizationId as Hex;
      authorizationIds.set(id.toLowerCase(), {
        id,
        payer: args.payer as Hex,
        merchant: args.merchant as Hex,
      });
    } else if (log.eventName === "Settled") {
      settlements.push({
        id: `${log.transactionHash}:${log.logIndex}`,
        authorizationId: args.authorizationId as Hex,
        module: args.module as Hex,
        executor: args.executor as Hex,
        gross: args.gross as bigint,
        merchantAmount: args.merchantAmount as bigint,
        executorFee: args.executorFee as bigint,
        protocolFee: args.protocolFee as bigint,
        periodStart: args.periodStart as bigint,
        txHash: log.transactionHash as Hex,
        blockNumber: log.blockNumber as bigint,
        timestamp: await timestampOf(log.blockNumber as bigint),
      });
    }
  }

  for (const log of meterLogs as DecodedLog[]) {
    if (log.eventName === "MeterCreated") {
      const id = log.args.meterId as Hex;
      meterIds.set(id.toLowerCase(), id);
    }
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/// Current on-chain state of one authorization.
export async function authorizationById(id: Hex): Promise<Authorization | null> {
  if (!isBillingConfigured()) return null;
  const raw = await publicClient.readContract({
    address: BILLING.authorizationRegistry,
    abi: registryAbi,
    functionName: "getAuthorization",
    args: [id],
  });
  // A never-created id reads back as an all-zero struct.
  if (raw.payer === "0x0000000000000000000000000000000000000000") return null;
  return {
    id,
    payer: raw.payer,
    merchant: raw.merchant,
    token: raw.token,
    billingType: BILLING_TYPES[Number(raw.billingType)] ?? "recurring",
    maxPerCharge: raw.maxPerCharge,
    periodSpendCap: raw.periodSpendCap,
    totalSpendCap: raw.totalSpendCap,
    spentThisPeriod: raw.spentThisPeriod,
    totalSpent: raw.totalSpent,
    periodStart: raw.periodStart,
    periodDuration: raw.periodDuration,
    validAfter: raw.validAfter,
    validUntil: raw.validUntil,
    active: raw.active,
  };
}

/// Every authorization where the wallet is the payer or the merchant, with its
/// current on-chain state. This is what the Authorizations page renders.
export async function authorizationsByWallet(wallet: Hex): Promise<Authorization[]> {
  if (!isBillingConfigured()) return [];
  await syncEvents();
  const target = wallet.toLowerCase();

  const mine = [...authorizationIds.values()].filter(
    (a) => a.payer.toLowerCase() === target || a.merchant.toLowerCase() === target,
  );
  const records = await Promise.all(mine.map((a) => authorizationById(a.id)));
  return records.filter((a): a is Authorization => a !== null);
}

/// Headroom under each cap, as the contract reports it after any pending period
/// rollover. `null` means that cap is not set.
export async function authorizationRemaining(
  id: Hex,
): Promise<{ perCharge: bigint; thisPeriod: bigint | null; lifetime: bigint | null }> {
  const [perCharge, thisPeriod, lifetime] = await publicClient.readContract({
    address: BILLING.authorizationRegistry,
    abi: registryAbi,
    functionName: "remaining",
    args: [id],
  });
  const MAX = (1n << 256n) - 1n;
  return {
    perCharge,
    thisPeriod: thisPeriod === MAX ? null : thisPeriod,
    lifetime: lifetime === MAX ? null : lifetime,
  };
}

/// Settlements against a wallet's authorizations, newest first.
export async function settlementsByWallet(wallet: Hex): Promise<SettlementRecord[]> {
  if (!isBillingConfigured()) return [];
  await syncEvents();
  const target = wallet.toLowerCase();

  const owned = new Set(
    [...authorizationIds.values()]
      .filter((a) => a.payer.toLowerCase() === target || a.merchant.toLowerCase() === target)
      .map((a) => a.id.toLowerCase()),
  );
  return settlements
    .filter((s) => owned.has(s.authorizationId.toLowerCase()))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/// Meters a merchant has published.
export async function metersByMerchant(merchant: Hex): Promise<MeterRecord[]> {
  if (!isBillingConfigured()) return [];
  await syncEvents();
  const target = merchant.toLowerCase();

  const records = await Promise.all(
    [...meterIds.values()].map(async (id) => {
      const m = await publicClient.readContract({
        address: BILLING.meteredBilling,
        abi: meteredAbi,
        functionName: "getMeter",
        args: [id],
      });
      return { id, ...m } as MeterRecord;
    }),
  );
  return records.filter((m) => m.merchant.toLowerCase() === target);
}

/// Merchant-scoped aggregates, summed from settled events only.
export async function billingStats(merchant: Hex): Promise<BillingStats> {
  const empty: BillingStats = {
    settledVolume: 0n,
    merchantRevenue: 0n,
    feesPaid: 0n,
    settlementCount: 0,
    activeAuthorizations: 0,
    recurringAuthorizations: 0,
    meteredAuthorizations: 0,
    hybridAuthorizations: 0,
  };
  if (!isBillingConfigured()) return empty;

  const authorizations = await authorizationsByWallet(merchant);
  const mine = authorizations.filter((a) => a.merchant.toLowerCase() === merchant.toLowerCase());
  const owned = new Set(mine.map((a) => a.id.toLowerCase()));

  const stats = { ...empty };
  for (const settlement of settlements) {
    if (!owned.has(settlement.authorizationId.toLowerCase())) continue;
    stats.settledVolume += settlement.gross;
    stats.merchantRevenue += settlement.merchantAmount;
    stats.feesPaid += settlement.executorFee + settlement.protocolFee;
    stats.settlementCount += 1;
  }
  for (const authorization of mine) {
    if (!authorization.active) continue;
    stats.activeAuthorizations += 1;
    if (authorization.billingType === "recurring") stats.recurringAuthorizations += 1;
    if (authorization.billingType === "metered") stats.meteredAuthorizations += 1;
    if (authorization.billingType === "hybrid") stats.hybridAuthorizations += 1;
  }
  return stats;
}

/// Unsettled accrued usage cannot be read from the chain — by design, usage is
/// counted off-chain until a statement settles. The dashboard says so rather
/// than showing a number it cannot substantiate.
export const ACCRUED_USAGE_IS_OFFCHAIN =
  "Accrued usage lives in the merchant's metering service until a settlement statement is submitted. Only settled usage appears on-chain.";
