import type { Address, Hex } from "viem";

import type { BillingClient } from "../billing/client.js";
import type { UsageEvent } from "../billing/types.js";
import type { UsageClient } from "../usage/client.js";
import { VirioError } from "../errors.js";
import type {
  X402PaymentPayload,
  X402PaymentRequired,
  X402PaymentRequirements,
  X402SettlementResponse,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// x402 adapter — EXPERIMENTAL, DISABLED BY DEFAULT
//
// Virio does not replace x402 and does not compete with it. They answer
// different questions:
//
//   x402  — how does a client pay for THIS request, right now, over HTTP?
//   Virio — what is this payer allowed to spend over TIME, and how is a
//           relationship of many requests billed and settled?
//
// The useful composition is: x402 carries the per-request payment event, Virio
// carries the authorization, the budget and the aggregation. This adapter is
// the seam, and it runs in one direction — x402 payment events become Virio
// usage. Nothing in the billing engine imports this file, so the protocol core
// stays agnostic and the adapter can be rewritten when the spec moves.
//
// WHAT IS AND IS NOT IMPLEMENTED
//   Implemented : translating x402 requirements and payment events into Virio
//                 authorizations and usage records, plus quoting a 402 response
//                 from a meter's price.
//   Not implemented : verifying or settling an x402 payment. That needs a
//                 facilitator and EIP-3009 support, and settling somebody
//                 else's payment protocol from here is not something to ship
//                 untested. Production x402 settlement is deferred — see the
//                 deferred-work section of the docs.
// ─────────────────────────────────────────────────────────────────────────────

export interface X402AdapterOptions {
  billing: BillingClient;
  usage: UsageClient;
  /** Off by default. The core protocol never reads this. */
  enabled?: boolean;
  /** x402 network name for this chain, e.g. "base-sepolia". */
  network: string;
}

/** A Virio meter presented as an x402 priced resource. */
export interface X402ResourceQuote {
  meterId: Hex;
  /** The URL or identifier being charged for. */
  resource: string;
  /** Units this resource consumes per request. Defaults to 1. */
  unitsPerRequest?: bigint;
  description?: string;
}

export class X402Adapter {
  readonly enabled: boolean;
  readonly network: string;

  private readonly billing: BillingClient;
  private readonly usage: UsageClient;

  constructor(options: X402AdapterOptions) {
    this.billing = options.billing;
    this.usage = options.usage;
    this.enabled = options.enabled ?? false;
    this.network = options.network;
  }

  /**
   * Build the body of a 402 response from a Virio meter, so an x402 client sees
   * the same price the meter charges on-chain. One source of pricing truth.
   */
  async quote(quote: X402ResourceQuote): Promise<X402PaymentRequired> {
    this.assertEnabled();
    const meter = await this.billing.getMeter(quote.meterId);
    if (!meter.active) {
      throw new VirioError("CONFIG_INVALID", `Virio: meter ${quote.meterId} is not active.`);
    }

    const units = quote.unitsPerRequest ?? 1n;
    const requirements: X402PaymentRequirements = {
      scheme: "exact",
      network: this.network,
      maxAmountRequired: (meter.unitPrice * units).toString(),
      resource: quote.resource,
      description: quote.description,
      payTo: meter.merchant,
      asset: meter.token,
    };
    return { x402Version: 1, accepts: [requirements] };
  }

  /**
   * Record a settled x402 payment as Virio usage.
   *
   * The x402 payment already moved money for that one request; Virio's role
   * here is the ledger — it records the consumption against the payer's
   * authorization so budgets, caps and reporting stay accurate. It does NOT
   * settle the same usage a second time on-chain: that would double-charge.
   * Use this when x402 is the payment rail and Virio is the accounting layer.
   *
   * `requestId` must be stable for a retried request — it is the idempotency
   * key, and without a stable one a retry bills twice.
   */
  async recordPayment(params: {
    authorizationId: Hex;
    meterId: Hex;
    requestId: string;
    units?: bigint;
    payment?: X402PaymentPayload;
    settlement?: X402SettlementResponse;
    metadata?: Record<string, string>;
  }): Promise<UsageEvent> {
    this.assertEnabled();

    if (params.settlement && !params.settlement.success) {
      throw new VirioError(
        "CONFIG_INVALID",
        `Virio: refusing to record usage for a failed x402 settlement (${params.settlement.errorReason ?? "no reason given"}).`,
      );
    }

    const metadata: Record<string, string> = { ...params.metadata, rail: "x402" };
    if (params.settlement?.transaction) metadata.x402Transaction = params.settlement.transaction;
    if (params.payment?.network) metadata.x402Network = params.payment.network;

    const result = await this.usage.record({
      authorizationId: params.authorizationId,
      meterId: params.meterId,
      quantity: params.units ?? 1n,
      idempotencyKey: params.requestId,
      metadata,
    });
    return result.event;
  }

  /**
   * Whether an x402 request fits inside the payer's Virio budget, before the
   * service does the work. This is the point of pairing the two: x402 alone
   * knows nothing about a payer's monthly ceiling.
   */
  async withinBudget(params: {
    authorizationId: Hex;
    amount: bigint;
  }): Promise<{ ok: boolean; reason?: string }> {
    this.assertEnabled();
    const [authorization, remaining] = await Promise.all([
      this.billing.getAuthorization(params.authorizationId),
      this.billing.remaining(params.authorizationId),
    ]);

    if (!authorization.active) return { ok: false, reason: "authorization revoked" };
    if (params.amount > remaining.perCharge) return { ok: false, reason: "exceeds per-charge limit" };
    if (remaining.thisPeriod !== null && params.amount > remaining.thisPeriod) {
      return { ok: false, reason: "exceeds period spend cap" };
    }
    if (remaining.lifetime !== null && params.amount > remaining.lifetime) {
      return { ok: false, reason: "exceeds lifetime spend cap" };
    }
    return { ok: true };
  }

  /**
   * The Virio authorization an x402 payer would need for a resource: same
   * merchant, same token, priced from the same meter.
   */
  async describeAuthorization(requirements: X402PaymentRequirements): Promise<{
    merchant: Address;
    token: Address;
    maxPerCharge: bigint;
  }> {
    this.assertEnabled();
    return {
      merchant: requirements.payTo,
      token: requirements.asset,
      maxPerCharge: BigInt(requirements.maxAmountRequired),
    };
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new VirioError(
        "CONFIG_INVALID",
        "Virio: the x402 adapter is experimental and disabled. Pass `enabled: true` after reviewing the current x402 specification against packages/sdk/src/x402/types.ts.",
      );
    }
  }
}

export type {
  X402PaymentPayload,
  X402PaymentRequired,
  X402PaymentRequirements,
  X402SettlementResponse,
} from "./types.js";
