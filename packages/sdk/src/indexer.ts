import type { Address, Hex, PublicClient } from "viem";
import { VIRIO_ABI } from "./abi.js";

// ─── Event log indexer ─────────────────────────────────────────────────────────
//
// Lists are reconstructed from contract logs because the contract only exposes
// point lookups (getPlan / getSubscription by id). We page `eth_getLogs` in
// fixed block ranges so it works on rate-limited public RPCs.

/** Public RPCs cap filtered getLogs ranges; 500 blocks is the safe slice. */
const DEFAULT_MAX_RANGE = 500n;

const EVENT = {
  PlanCreated:    VIRIO_ABI.find((x) => x.type === "event" && x.name === "PlanCreated")!,
  Subscribed:     VIRIO_ABI.find((x) => x.type === "event" && x.name === "Subscribed")!,
  ChargeExecuted: VIRIO_ABI.find((x) => x.type === "event" && x.name === "ChargeExecuted")!,
} as const;

export interface IndexerOptions {
  fromBlock?: bigint;
  toBlock?: bigint;
  /** Largest block span per getLogs call (default 500). */
  maxRange?: bigint;
  /** Stop after this many matching logs. */
  limit?: number;
}

export type DecodedLog = {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  transactionHash: Hex;
};

async function getLogsPaged(
  pub: PublicClient,
  contractAddress: Address,
  event: unknown,
  args: Record<string, unknown> | undefined,
  opts: IndexerOptions,
): Promise<DecodedLog[]> {
  const head = await pub.getBlockNumber();
  const toBlock = opts.toBlock === undefined || opts.toBlock > head ? head : opts.toBlock;
  const maxRange = opts.maxRange ?? DEFAULT_MAX_RANGE;
  let cursor = opts.fromBlock ?? 0n;
  if (cursor < 0n) cursor = 0n;

  const out: DecodedLog[] = [];
  while (cursor <= toBlock) {
    const end = cursor + maxRange - 1n < toBlock ? cursor + maxRange - 1n : toBlock;
    const logs = await pub.getLogs({
      address: contractAddress,
      event: event as never,
      args: args as never,
      fromBlock: cursor,
      toBlock: end,
    });
    out.push(...(logs as unknown as DecodedLog[]));
    if (opts.limit !== undefined && out.length >= opts.limit) return out.slice(0, opts.limit);
    cursor = end + 1n;
  }
  return out;
}

/**
 * Paged logs for one event of any Virio contract, filtered by its indexed args.
 *
 * The helpers below predate the billing stack and stay for the subscription
 * manager's fixed event set. New callers (the billing client) pass their own
 * ABI and event name rather than adding another near-identical helper here.
 */
export async function scanLogs(
  pub: PublicClient,
  contractAddress: Address,
  abi: readonly unknown[],
  eventName: string,
  filter: Record<string, unknown>,
  opts: IndexerOptions,
): Promise<DecodedLog[]> {
  const event = (abi as { type: string; name?: string }[]).find(
    (x) => x.type === "event" && x.name === eventName,
  );
  if (!event) throw new Error(`Virio: no "${eventName}" event in the supplied ABI.`);

  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined) args[key] = value;
  }
  return getLogsPaged(pub, contractAddress, event, args, opts);
}

/** All `Subscribed` logs, optionally filtered by indexed `customer` and/or `planId`. */
export async function findSubscribedLogs(
  pub: PublicClient,
  contractAddress: Address,
  filter: { customer?: Address; planId?: Hex | Hex[] },
  opts: IndexerOptions,
): Promise<{ subscriptionId: Hex; planId: Hex; customer: Address; totalSpendCap: bigint }[]> {
  const args: Record<string, unknown> = {};
  if (filter.customer) args.customer = filter.customer;
  if (filter.planId)   args.planId = filter.planId;

  const logs = await getLogsPaged(pub, contractAddress, EVENT.Subscribed, args, opts);
  return logs.map((l) => ({
    subscriptionId: l.args.subscriptionId as Hex,
    planId:         l.args.planId as Hex,
    customer:       l.args.customer as Address,
    totalSpendCap:  l.args.totalSpendCap as bigint,
  }));
}

/** All `PlanCreated` logs, optionally filtered by indexed `merchant`. */
export async function findPlanCreatedLogs(
  pub: PublicClient,
  contractAddress: Address,
  filter: { merchant?: Address },
  opts: IndexerOptions,
): Promise<{ planId: Hex; merchant: Address; token: Address; amount: bigint; period: bigint }[]> {
  const args: Record<string, unknown> = {};
  if (filter.merchant) args.merchant = filter.merchant;

  const logs = await getLogsPaged(pub, contractAddress, EVENT.PlanCreated, args, opts);
  return logs.map((l) => ({
    planId:   l.args.planId as Hex,
    merchant: l.args.merchant as Address,
    token:    l.args.token as Address,
    amount:   l.args.amount as bigint,
    period:   l.args.period as bigint,
  }));
}

/** All `ChargeExecuted` logs, optionally filtered by indexed `subscriptionId` and/or `customer`. */
export async function findChargeLogs(
  pub: PublicClient,
  contractAddress: Address,
  filter: { subscriptionId?: Hex; customer?: Address },
  opts: IndexerOptions,
): Promise<
  {
    subscriptionId: Hex;
    executor: Address;
    customer: Address;
    gross: bigint;
    merchantAmount: bigint;
    executorFee: bigint;
    protocolFee: bigint;
    nextChargeAt: bigint;
    txHash: Hex;
    blockNumber: bigint;
  }[]
> {
  const args: Record<string, unknown> = {};
  if (filter.subscriptionId) args.subscriptionId = filter.subscriptionId;
  if (filter.customer)       args.customer = filter.customer;

  const logs = await getLogsPaged(pub, contractAddress, EVENT.ChargeExecuted, args, opts);
  return logs.map((l) => ({
    subscriptionId: l.args.subscriptionId as Hex,
    executor:       l.args.executor as Address,
    customer:       l.args.customer as Address,
    gross:          l.args.gross as bigint,
    merchantAmount: l.args.merchantAmount as bigint,
    executorFee:    l.args.executorFee as bigint,
    protocolFee:    l.args.protocolFee as bigint,
    nextChargeAt:   l.args.nextChargeAt as bigint,
    txHash:         l.transactionHash,
    blockNumber:    l.blockNumber,
  }));
}
