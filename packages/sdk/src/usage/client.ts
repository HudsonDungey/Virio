import type { Hex } from "viem";

import type { BillingClient } from "../billing/client.js";
import type {
  MeterStatement,
  RecordUsageParams,
  RecordUsageResult,
  SignedMeterStatement,
  UsageEvent,
  UsageSummary,
} from "../billing/types.js";
import { VirioError } from "../errors.js";
import { formatUnits } from "../helpers.js";
import { MemoryUsageStore } from "./MemoryUsageStore.js";
import type { UsageStore } from "./store.js";

export interface UsageClientOptions {
  billing: BillingClient;
  /** Defaults to an in-memory store; pass a durable one in production. */
  store?: UsageStore;
}

/**
 * The usage surface: `virio.usage`.
 *
 * Records usage off-chain, accumulates it per (authorization, meter, period),
 * and turns a period into a statement the merchant signs and anyone settles.
 *
 * Every number a settlement rests on is kept — units, unit price, window, and
 * the individual events — so a payer can audit how an amount was reached
 * instead of taking a total on trust.
 */
export class UsageClient {
  readonly store: UsageStore;
  private readonly billing: BillingClient;

  constructor(options: UsageClientOptions) {
    this.billing = options.billing;
    this.store = options.store ?? new MemoryUsageStore();
  }

  // ─── Ingestion ────────────────────────────────────────────────────────────

  /**
   * Record one unit of usage. Idempotent on `idempotencyKey` — an API request
   * retried five times produces one billable event, not five.
   *
   * Everything crossing this boundary is validated here: the quantity must be a
   * positive integer, the meter must exist and be active, and the meter and
   * authorization must name the same merchant. Past this point the accumulator
   * trusts its own records.
   */
  async record(params: RecordUsageParams): Promise<RecordUsageResult> {
    const quantity = normalizeQuantity(params.quantity);
    if (!params.idempotencyKey) {
      throw new VirioError(
        "CONFIG_INVALID",
        "Virio: usage.record requires an idempotencyKey — without one a retry bills twice.",
      );
    }

    const meter = await this.billing.getMeter(params.meterId);
    if (!meter.active) {
      throw new VirioError("CONFIG_INVALID", `Virio: meter ${params.meterId} is not active.`);
    }

    const authorization = await this.billing.getAuthorization(params.authorizationId);
    if (!authorization.active) {
      throw new VirioError(
        "CONFIG_INVALID",
        `Virio: authorization ${params.authorizationId} is revoked — stop serving this customer.`,
      );
    }
    if (authorization.merchant.toLowerCase() !== meter.merchant.toLowerCase()) {
      throw new VirioError(
        "CONFIG_INVALID",
        "Virio: this meter and authorization belong to different merchants; the settlement would be rejected on-chain.",
      );
    }

    const event: UsageEvent = {
      meterId: params.meterId,
      authorizationId: params.authorizationId,
      customer: params.customer ?? authorization.payer,
      merchant: params.merchant ?? meter.merchant,
      quantity,
      timestamp: params.timestamp ?? nowSeconds(),
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    };

    return { recorded: await this.store.record(event), event };
  }

  /**
   * Record many events. Each is validated and de-duplicated independently, so
   * one bad or duplicate entry never discards the rest of the batch.
   */
  async recordBatch(events: RecordUsageParams[]): Promise<RecordUsageResult[]> {
    const results: RecordUsageResult[] = [];
    for (const event of events) {
      results.push(await this.record(event));
    }
    return results;
  }

  // ─── Accumulation ─────────────────────────────────────────────────────────

  /**
   * Accrued usage for an authorization, with the inputs that produced the
   * amount. `period: "current"` covers everything since the last on-chain
   * settlement — which is exactly what the next statement would bill.
   */
  async get(params: {
    authorizationId: Hex;
    meterId: Hex;
    period?: "current" | { from: number; to: number };
  }): Promise<UsageSummary> {
    const [meter, authorization, decimals] = await Promise.all([
      this.billing.getMeter(params.meterId),
      this.billing.getAuthorization(params.authorizationId),
      this.billing.tokenDecimals(),
    ]);

    const window =
      params.period && params.period !== "current"
        ? params.period
        : {
            from: Number(
              await this.billing.lastSettledEnd(params.meterId, params.authorizationId),
            ),
            to: nowSeconds(),
          };

    const query = {
      authorizationId: params.authorizationId,
      meterId: params.meterId,
      from: window.from,
      to: window.to,
    };
    const [units, events] = await Promise.all([
      this.store.totalUnits(query),
      this.store.listEvents(query),
    ]);

    const billableUnits = applyIncludedUnits(units, meter.includedUnitsPerPeriod);
    const accrued = billableUnits * meter.unitPrice;
    const remaining = await this.billing.remaining(params.authorizationId);

    return {
      authorizationId: params.authorizationId,
      meterId: params.meterId,
      periodStart: window.from,
      periodEnd: window.to,
      units,
      billableUnits,
      unitPrice: meter.unitPrice,
      accruedAmount: formatUnits(accrued, decimals),
      periodCap:
        authorization.periodSpendCap === 0n
          ? null
          : formatUnits(authorization.periodSpendCap, decimals),
      remainingCap:
        remaining.thisPeriod === null ? null : formatUnits(remaining.thisPeriod, decimals),
      eventCount: events.length,
    };
  }

  /** Individual events behind a summary, for audit and dispute handling. */
  async listEvents(params: {
    authorizationId: Hex;
    meterId: Hex;
    from: number;
    to: number;
  }): Promise<UsageEvent[]> {
    return this.store.listEvents(params);
  }

  // ─── Settlement ───────────────────────────────────────────────────────────

  /**
   * Build the statement for everything accrued since the last settlement.
   * Returns `null` when there is nothing billable — the common case for a
   * quiet period, and the reason no transaction is sent.
   *
   * The window starts at the on-chain watermark so consecutive statements abut
   * exactly: no gap loses usage, no overlap bills it twice.
   */
  async buildStatement(params: {
    authorizationId: Hex;
    meterId: Hex;
    /** Window end, unix seconds. Defaults to now. Never in the future. */
    periodEnd?: number;
  }): Promise<MeterStatement | null> {
    const meter = await this.billing.getMeter(params.meterId);
    const watermark = Number(
      await this.billing.lastSettledEnd(params.meterId, params.authorizationId),
    );
    const periodEnd = params.periodEnd ?? nowSeconds();
    const periodStart = watermark;

    if (periodEnd <= periodStart) return null;

    const units = await this.store.totalUnits({
      authorizationId: params.authorizationId,
      meterId: params.meterId,
      from: periodStart,
      to: periodEnd,
    });
    const billableUnits = applyIncludedUnits(units, meter.includedUnitsPerPeriod);
    if (billableUnits === 0n) return null;

    return {
      meterId: params.meterId,
      authorizationId: params.authorizationId,
      periodStart: BigInt(periodStart),
      periodEnd: BigInt(periodEnd),
      units: billableUnits,
      unitPrice: meter.unitPrice,
      amount: billableUnits * meter.unitPrice,
      nonce: await this.store.nextNonce(meter.merchant),
    };
  }

  /**
   * Build and sign the next statement. Signs as the merchant — this is the
   * merchant's attestation of usage, and only the meter's merchant can produce
   * a signature the contract accepts.
   */
  async signNextStatement(params: {
    authorizationId: Hex;
    meterId: Hex;
    periodEnd?: number;
  }): Promise<SignedMeterStatement | null> {
    const statement = await this.buildStatement(params);
    if (!statement) return null;
    return this.billing.signStatement(statement);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Units billable after a meter's included allowance. Never negative. */
function applyIncludedUnits(units: bigint, included: bigint): bigint {
  return units > included ? units - included : 0n;
}

/**
 * Usage quantities are whole units. A fractional or negative quantity is a bug
 * in the caller's meter, and silently rounding it would bill someone wrongly.
 */
function normalizeQuantity(quantity: number | bigint): bigint {
  if (typeof quantity === "bigint") {
    if (quantity <= 0n) {
      throw new VirioError("CONFIG_INVALID", "Virio: usage quantity must be positive.");
    }
    return quantity;
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new VirioError(
      "CONFIG_INVALID",
      `Virio: usage quantity must be a positive integer, received ${quantity}.`,
    );
  }
  return BigInt(quantity);
}
