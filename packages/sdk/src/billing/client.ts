import {
  encodeFunctionData,
  keccak256,
  parseEventLogs,
  toHex,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";

import { METERED_ABI, RECURRING_ABI, REGISTRY_ABI } from "./abi.js";
import {
  BILLING_TYPE_VALUES,
  type Authorization,
  type AuthorizationRecord,
  type AuthorizationRemaining,
  type BillingLimits,
  type BillingResult,
  type BillingType,
  type CreateBillingParams,
  type Interval,
  type Meter,
  type MeterStatement,
  type RecurringPlan,
  type RecurringSubscription,
  type Settlement,
  type SignedMeterStatement,
} from "./types.js";
import { EventNotFoundError, MissingAccountError, MissingWalletError, VirioError } from "../errors.js";
import { intervalToPeriod, parseUnits } from "../helpers.js";
import type { ListOptions, PreparedTransaction } from "../types.js";
import { scanLogs, type IndexerOptions } from "../indexer.js";

/** Addresses of the deployed billing stack. All three are required together. */
export interface BillingAddresses {
  authorizationRegistry: Address;
  recurringBilling: Address;
  meteredBilling: Address;
}

export interface BillingClientOptions {
  addresses: BillingAddresses;
  publicClient: PublicClient;
  walletClient?: WalletClient<Transport, Chain>;
  chain: Chain;
  /** Default payment token; the chain's USDC when known. */
  token?: Address;
  /** First block scanned by list helpers. */
  deploymentBlock?: bigint;
  /** Decimals of the default token. Read from the chain when omitted. */
  decimals?: number;
}

/** EIP-712 domain for meter statements. Must match VirioMeteredBilling. */
const METER_STATEMENT_TYPES = {
  MeterStatement: [
    { name: "meterId", type: "bytes32" },
    { name: "authorizationId", type: "bytes32" },
    { name: "periodStart", type: "uint64" },
    { name: "periodEnd", type: "uint64" },
    { name: "units", type: "uint128" },
    { name: "unitPrice", type: "uint128" },
    { name: "amount", type: "uint128" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

/**
 * The programmable billing surface: `virio.billing`.
 *
 * `create()` is the high-level path — one call produces the authorization plus
 * whatever plan or meter the billing type needs. Everything underneath it is
 * also public (`authorizations`, `plans`, `meters`, `subscriptions`) so an
 * integrator who needs direct protocol access is never forced through it.
 */
export class BillingClient {
  readonly addresses: BillingAddresses;
  readonly chain: Chain;
  readonly deploymentBlock: bigint;

  private readonly pub: PublicClient;
  private readonly wal: WalletClient<Transport, Chain> | undefined;
  private readonly defaultToken: Address | undefined;
  private decimals: number | undefined;

  constructor(options: BillingClientOptions) {
    this.addresses = options.addresses;
    this.chain = options.chain;
    this.pub = options.publicClient;
    this.wal = options.walletClient;
    this.defaultToken = options.token;
    this.deploymentBlock = options.deploymentBlock ?? 0n;
    this.decimals = options.decimals;
  }

  // ─── High-level: one call per billing relationship ────────────────────────

  /**
   * Create a billing relationship. Signs as the payer.
   *
   * Recurring creates (or reuses) a plan, authorizes, and subscribes.
   * Metered creates (or reuses) a meter and authorizes.
   * Hybrid does both against a single authorization, so the base charge and
   * usage overage share one set of spend caps.
   *
   * The merchant must have created the plan or meter, or be the signer here.
   * Every limit the payer agrees to is passed explicitly — nothing is implied.
   */
  async create(params: CreateBillingParams): Promise<BillingResult> {
    const decimals = await this.tokenDecimals();
    const token = params.token ?? this.requireToken();
    const merchant = params.merchant ?? (await this.signerAddress());
    const transactions: Hash[] = [];

    const plan = await this.resolvePlan(params, token, decimals, transactions);
    const meter = await this.resolveMeter(params, token, decimals, transactions);

    const limits = this.resolveLimits(params, decimals);
    const { txHash, authorizationId } = await this.authorize({
      merchant,
      token,
      billingType: params.type,
      ...limits,
    });
    transactions.push(txHash);

    let subscriptionId: Hex | undefined;
    if (plan) {
      const sub = await this.subscribe(plan, authorizationId);
      transactions.push(sub.txHash);
      subscriptionId = sub.subscriptionId;
    }

    return {
      type: params.type,
      authorizationId,
      planId: plan,
      subscriptionId,
      meterId: meter,
      transactions,
    };
  }

  // ─── Authorizations ───────────────────────────────────────────────────────

  /** Grant a merchant permission to pull payments within fixed limits. */
  async authorize(params: {
    merchant: Address;
    token: Address;
    billingType: BillingType;
    maxPerCharge: bigint;
    periodSpendCap?: bigint;
    totalSpendCap?: bigint;
    periodDuration?: bigint;
    validAfter?: bigint;
    validUntil?: bigint;
  }): Promise<{ txHash: Hash; authorizationId: Hex }> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.addresses.authorizationRegistry,
      abi: REGISTRY_ABI,
      functionName: "authorize",
      args: [this.encodeAuthorizationParams(params)],
      account,
      chain: this.chain,
    });
    const receipt = await this.pub.waitForTransactionReceipt({ hash: txHash });
    const logs = parseEventLogs({ abi: REGISTRY_ABI, logs: receipt.logs });
    const created = logs.find((l) => l.eventName === "AuthorizationCreated");
    if (!created) throw new EventNotFoundError("AuthorizationCreated");
    return {
      txHash,
      authorizationId: (created.args as unknown as { authorizationId: Hex }).authorizationId,
    };
  }

  async getAuthorization(authorizationId: Hex): Promise<Authorization> {
    const raw = (await this.pub.readContract({
      address: this.addresses.authorizationRegistry,
      abi: REGISTRY_ABI,
      functionName: "getAuthorization",
      args: [authorizationId],
    })) as Record<string, unknown>;
    return decodeAuthorization(raw);
  }

  /** Headroom under each cap right now, after any pending period rollover. */
  async remaining(authorizationId: Hex): Promise<AuthorizationRemaining> {
    const [perCharge, thisPeriod, lifetime] = (await this.pub.readContract({
      address: this.addresses.authorizationRegistry,
      abi: REGISTRY_ABI,
      functionName: "remaining",
      args: [authorizationId],
    })) as [bigint, bigint, bigint];
    // The contract reports an unset cap as uint256 max; surface that as null so
    // callers don't render "115792089237316195423570985008687907853269984665640564039457584007913129639935 USDC left".
    const unlimited = (v: bigint) => (v === MAX_UINT256 ? null : v);
    return { perCharge, thisPeriod: unlimited(thisPeriod), lifetime: unlimited(lifetime) };
  }

  /** Tighten an authorization. Limits can only move in the payer's favour. */
  async restrict(
    authorizationId: Hex,
    limits: {
      maxPerCharge?: bigint;
      periodSpendCap?: bigint;
      totalSpendCap?: bigint;
      validUntil?: bigint;
    },
  ): Promise<Hash> {
    return this.write(this.addresses.authorizationRegistry, REGISTRY_ABI, "restrict", [
      authorizationId,
      limits.maxPerCharge ?? 0n,
      limits.periodSpendCap ?? 0n,
      limits.totalSpendCap ?? 0n,
      limits.validUntil ?? 0n,
    ]);
  }

  /** Revoke an authorization. Callable by the payer or the merchant. */
  async revoke(authorizationId: Hex): Promise<Hash> {
    return this.write(this.addresses.authorizationRegistry, REGISTRY_ABI, "revoke", [
      authorizationId,
    ]);
  }

  /** Every authorization where `address` is the payer or the merchant. */
  async listAuthorizations(
    address: Address,
    role: "payer" | "merchant" | "any" = "any",
    options?: ListOptions,
  ): Promise<AuthorizationRecord[]> {
    const ids = new Set<Hex>();
    const opts = this.indexerOpts(options);

    if (role === "payer" || role === "any") {
      for (const log of await this.scanRegistry("AuthorizationCreated", { payer: address }, opts)) {
        ids.add(log.args.authorizationId as Hex);
      }
    }
    if (role === "merchant" || role === "any") {
      for (const log of await this.scanRegistry(
        "AuthorizationCreated",
        { merchant: address },
        opts,
      )) {
        ids.add(log.args.authorizationId as Hex);
      }
    }

    return Promise.all(
      [...ids].map(async (id) => ({ ...(await this.getAuthorization(id)), id })),
    );
  }

  /** Settlement history, reconstructed from registry `Settled` logs. */
  async listSettlements(
    filter: { authorizationId?: Hex; executor?: Address } = {},
    options?: ListOptions,
  ): Promise<Settlement[]> {
    const logs = await this.scanRegistry("Settled", filter, this.indexerOpts(options));
    return logs.map((log) => {
      const a = log.args as Record<string, unknown>;
      return {
        authorizationId: a.authorizationId as Hex,
        module: a.module as Address,
        executor: a.executor as Address,
        gross: a.gross as bigint,
        merchantAmount: a.merchantAmount as bigint,
        executorFee: a.executorFee as bigint,
        protocolFee: a.protocolFee as bigint,
        periodStart: a.periodStart as bigint,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    });
  }

  // ─── Recurring ────────────────────────────────────────────────────────────

  async createPlan(params: {
    token?: Address;
    amount: bigint;
    period: bigint;
  }): Promise<{ txHash: Hash; planId: Hex }> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.addresses.recurringBilling,
      abi: RECURRING_ABI,
      functionName: "createPlan",
      args: [params.token ?? this.requireToken(), params.amount, params.period],
      account,
      chain: this.chain,
    });
    const receipt = await this.pub.waitForTransactionReceipt({ hash: txHash });
    const logs = parseEventLogs({ abi: RECURRING_ABI, logs: receipt.logs });
    const created = logs.find((l) => l.eventName === "PlanCreated");
    if (!created) throw new EventNotFoundError("PlanCreated");
    return { txHash, planId: (created.args as unknown as { planId: Hex }).planId };
  }

  async getPlan(planId: Hex): Promise<RecurringPlan> {
    return (await this.pub.readContract({
      address: this.addresses.recurringBilling,
      abi: RECURRING_ABI,
      functionName: "getPlan",
      args: [planId],
    })) as RecurringPlan;
  }

  async deactivatePlan(planId: Hex): Promise<Hash> {
    return this.write(this.addresses.recurringBilling, RECURRING_ABI, "deactivatePlan", [planId]);
  }

  /** Bind an authorization the signer owns to a plan. */
  async subscribe(
    planId: Hex,
    authorizationId: Hex,
  ): Promise<{ txHash: Hash; subscriptionId: Hex }> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.addresses.recurringBilling,
      abi: RECURRING_ABI,
      functionName: "subscribe",
      args: [planId, authorizationId],
      account,
      chain: this.chain,
    });
    const receipt = await this.pub.waitForTransactionReceipt({ hash: txHash });
    const logs = parseEventLogs({ abi: RECURRING_ABI, logs: receipt.logs });
    const sub = logs.find((l) => l.eventName === "Subscribed");
    if (!sub) throw new EventNotFoundError("Subscribed");
    return { txHash, subscriptionId: (sub.args as unknown as { subscriptionId: Hex }).subscriptionId };
  }

  async getSubscription(subscriptionId: Hex): Promise<RecurringSubscription> {
    return (await this.pub.readContract({
      address: this.addresses.recurringBilling,
      abi: RECURRING_ABI,
      functionName: "getSubscription",
      args: [subscriptionId],
    })) as RecurringSubscription;
  }

  async cancel(subscriptionId: Hex): Promise<Hash> {
    return this.write(this.addresses.recurringBilling, RECURRING_ABI, "cancel", [subscriptionId]);
  }

  /** Charge a due subscription. Permissionless — the caller earns the fee. */
  async charge(subscriptionId: Hex): Promise<Hash> {
    return this.write(this.addresses.recurringBilling, RECURRING_ABI, "charge", [subscriptionId]);
  }

  /**
   * Whether a charge would succeed right now, and the error selector saying why
   * not. One eth_call, so an executor can filter candidates cheaply.
   */
  async chargeable(subscriptionId: Hex): Promise<{ ok: boolean; reason: Hex }> {
    const [ok, reason] = (await this.pub.readContract({
      address: this.addresses.recurringBilling,
      abi: RECURRING_ABI,
      functionName: "chargeable",
      args: [subscriptionId],
    })) as [boolean, Hex];
    return { ok, reason };
  }

  // ─── Metered ──────────────────────────────────────────────────────────────

  async createMeter(params: {
    token?: Address;
    unit: string;
    unitPrice: bigint;
    includedUnitsPerPeriod?: bigint;
    settlementInterval: bigint;
  }): Promise<{ txHash: Hash; meterId: Hex }> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.addresses.meteredBilling,
      abi: METERED_ABI,
      functionName: "createMeter",
      args: [
        params.token ?? this.requireToken(),
        hashUnit(params.unit),
        params.unitPrice,
        params.includedUnitsPerPeriod ?? 0n,
        params.settlementInterval,
      ],
      account,
      chain: this.chain,
    });
    const receipt = await this.pub.waitForTransactionReceipt({ hash: txHash });
    const logs = parseEventLogs({ abi: METERED_ABI, logs: receipt.logs });
    const created = logs.find((l) => l.eventName === "MeterCreated");
    if (!created) throw new EventNotFoundError("MeterCreated");
    return { txHash, meterId: (created.args as unknown as { meterId: Hex }).meterId };
  }

  async getMeter(meterId: Hex): Promise<Meter> {
    return (await this.pub.readContract({
      address: this.addresses.meteredBilling,
      abi: METERED_ABI,
      functionName: "getMeter",
      args: [meterId],
    })) as Meter;
  }

  async disableMeter(meterId: Hex): Promise<Hash> {
    return this.write(this.addresses.meteredBilling, METERED_ABI, "disableMeter", [meterId]);
  }

  /**
   * Sign a usage statement as the merchant.
   *
   * This attests to usage; it does not prove it. The payer's protection is the
   * meter's fixed price plus the authorization's caps, expiry and revocation.
   */
  async signStatement(statement: MeterStatement): Promise<SignedMeterStatement> {
    const { wal, account } = await this.signer();
    const signature = await wal.signTypedData({
      account,
      domain: {
        name: "VirioMeteredBilling",
        version: "1",
        chainId: this.chain.id,
        verifyingContract: this.addresses.meteredBilling,
      },
      types: METER_STATEMENT_TYPES,
      primaryType: "MeterStatement",
      message: statement,
    });
    return { statement, signature };
  }

  /** Submit a signed statement. Permissionless — the caller earns the fee. */
  async settleStatement(signed: SignedMeterStatement): Promise<Hash> {
    return this.write(this.addresses.meteredBilling, METERED_ABI, "settle", [
      signed.statement,
      signed.signature,
    ]);
  }

  /** Whether a statement would settle now, ignoring its signature. */
  async settleable(statement: MeterStatement): Promise<{ ok: boolean; reason: Hex }> {
    const [ok, reason] = (await this.pub.readContract({
      address: this.addresses.meteredBilling,
      abi: METERED_ABI,
      functionName: "settleable",
      args: [statement],
    })) as [boolean, Hex];
    return { ok, reason };
  }

  /** End of the last settled window for a (meter, authorization) pair. */
  async lastSettledEnd(meterId: Hex, authorizationId: Hex): Promise<bigint> {
    return (await this.pub.readContract({
      address: this.addresses.meteredBilling,
      abi: METERED_ABI,
      functionName: "lastSettledEnd",
      args: [meterId, authorizationId],
    })) as bigint;
  }

  // ─── Prepare (no signing, no writes) ──────────────────────────────────────

  /** Calldata for `authorize`, for wallets and agents that inspect first. */
  prepareAuthorize(params: {
    merchant: Address;
    token: Address;
    billingType: BillingType;
    maxPerCharge: bigint;
    periodSpendCap?: bigint;
    totalSpendCap?: bigint;
    periodDuration?: bigint;
    validAfter?: bigint;
    validUntil?: bigint;
  }): PreparedTransaction {
    const args = [this.encodeAuthorizationParams(params)] as const;
    return {
      to: this.addresses.authorizationRegistry,
      data: encodeFunctionData({ abi: REGISTRY_ABI, functionName: "authorize", args }),
      value: 0n,
      label: "Authorize spending",
      functionName: "authorize",
      args,
    };
  }

  prepareRevoke(authorizationId: Hex): PreparedTransaction {
    return {
      to: this.addresses.authorizationRegistry,
      data: encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: "revoke",
        args: [authorizationId],
      }),
      value: 0n,
      label: "Revoke authorization",
      functionName: "revoke",
      args: [authorizationId],
    };
  }

  /** Decimals of the default token, read once and cached. */
  async tokenDecimals(): Promise<number> {
    if (this.decimals !== undefined) return this.decimals;
    this.decimals = Number(
      await this.pub.readContract({
        address: this.requireToken(),
        abi: [
          {
            type: "function",
            name: "decimals",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "uint8" }],
          },
        ] as const,
        functionName: "decimals",
      }),
    );
    return this.decimals;
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /** Create the plan a recurring or hybrid billing needs, unless reused. */
  private async resolvePlan(
    params: CreateBillingParams,
    token: Address,
    decimals: number,
    transactions: Hash[],
  ): Promise<Hex | undefined> {
    if (params.type === "metered") return undefined;
    if (params.planId) return params.planId;

    const amount = params.type === "recurring" ? params.amount : params.base.amount;
    const interval = params.type === "recurring" ? params.interval : params.base.interval;
    const created = await this.createPlan({
      token,
      amount: parseUnits(amount, decimals),
      period: intervalToPeriod(interval),
    });
    transactions.push(created.txHash);
    return created.planId;
  }

  /** Create the meter a metered or hybrid billing needs, unless reused. */
  private async resolveMeter(
    params: CreateBillingParams,
    token: Address,
    decimals: number,
    transactions: Hash[],
  ): Promise<Hex | undefined> {
    if (params.type === "recurring") return undefined;
    if (params.meterId) return params.meterId;

    const terms = params.type === "metered" ? params.meter : params.usage;
    const settlementInterval =
      params.type === "metered"
        ? intervalToPeriod(params.settlement?.interval ?? "day")
        : intervalToPeriod("day");

    const created = await this.createMeter({
      token,
      unit: terms.unit,
      unitPrice: parseUnits(terms.pricePerUnit, decimals),
      includedUnitsPerPeriod: BigInt(terms.includedUnits ?? 0),
      settlementInterval,
    });
    transactions.push(created.txHash);
    return created.meterId;
  }

  /**
   * Turn human-readable limits into the authorization's on-chain fields.
   *
   * `maxPerCharge` is mandatory on-chain, so when the caller does not state one
   * the SDK derives the tightest value the billing terms can actually need —
   * never an open-ended default.
   */
  private resolveLimits(
    params: CreateBillingParams,
    decimals: number,
  ): {
    maxPerCharge: bigint;
    periodSpendCap: bigint;
    totalSpendCap: bigint;
    periodDuration: bigint;
    validAfter: bigint;
    validUntil: bigint;
  } {
    const limits: BillingLimits = params.limits ?? {};
    const periodCapText = limits.periodCap ?? limits.monthlyCap;
    const capPeriod: Interval =
      limits.period ?? (limits.monthlyCap ? "month" : defaultPeriodFor(params));

    const periodSpendCap = periodCapText ? parseUnits(periodCapText, decimals) : 0n;
    const totalSpendCap = limits.totalCap ? parseUnits(limits.totalCap, decimals) : 0n;

    const maxPerCharge = limits.maxPerCharge
      ? parseUnits(limits.maxPerCharge, decimals)
      : this.deriveMaxPerCharge(params, decimals, periodSpendCap);

    if (maxPerCharge === 0n) {
      throw new VirioError(
        "CONFIG_INVALID",
        "Virio: a per-charge limit is required. Pass limits.maxPerCharge, or a periodCap the SDK can derive it from.",
      );
    }

    return {
      maxPerCharge,
      periodSpendCap,
      totalSpendCap,
      // A period cap needs a period to measure over; otherwise leave period
      // accounting off rather than inventing a window the payer never chose.
      periodDuration: periodSpendCap > 0n ? intervalToPeriod(capPeriod) : 0n,
      validAfter: limits.startsAt ? toUnix(limits.startsAt) : 0n,
      validUntil: limits.expiresAt ? toUnix(limits.expiresAt) : 0n,
    };
  }

  /**
   * The smallest per-charge limit that still lets the billing work:
   *   recurring — exactly the base amount, so one charge and no more;
   *   metered   — the period cap, since any single settlement may be that large;
   *   hybrid    — the period cap for the same reason (it must also clear base).
   */
  private deriveMaxPerCharge(
    params: CreateBillingParams,
    decimals: number,
    periodSpendCap: bigint,
  ): bigint {
    if (params.type === "recurring") return parseUnits(params.amount, decimals);
    return periodSpendCap;
  }

  private encodeAuthorizationParams(params: {
    merchant: Address;
    token: Address;
    billingType: BillingType;
    maxPerCharge: bigint;
    periodSpendCap?: bigint;
    totalSpendCap?: bigint;
    periodDuration?: bigint;
    validAfter?: bigint;
    validUntil?: bigint;
  }) {
    return {
      merchant: params.merchant,
      token: params.token,
      billingType: BILLING_TYPE_VALUES.indexOf(params.billingType),
      maxPerCharge: params.maxPerCharge,
      periodSpendCap: params.periodSpendCap ?? 0n,
      totalSpendCap: params.totalSpendCap ?? 0n,
      periodDuration: params.periodDuration ?? 0n,
      validAfter: params.validAfter ?? 0n,
      validUntil: params.validUntil ?? 0n,
    };
  }

  private async scanRegistry(
    eventName: string,
    args: Record<string, unknown>,
    opts: IndexerOptions,
  ) {
    return scanLogs(this.pub, this.addresses.authorizationRegistry, REGISTRY_ABI, eventName, args, opts);
  }

  private async write(
    address: Address,
    abi: readonly unknown[],
    functionName: string,
    args: readonly unknown[],
  ): Promise<Hash> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address,
      abi,
      functionName,
      args,
      account,
      chain: this.chain,
    } as never);
    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  private async signer(): Promise<{ wal: WalletClient<Transport, Chain>; account: Address }> {
    if (!this.wal) throw new MissingWalletError();
    const account = this.wal.account?.address ?? (await this.wal.getAddresses())[0];
    if (!account) throw new MissingAccountError();
    return { wal: this.wal, account };
  }

  private async signerAddress(): Promise<Address> {
    const { account } = await this.signer();
    return account;
  }

  private requireToken(): Address {
    if (!this.defaultToken) {
      throw new VirioError(
        "MISSING_TOKEN",
        "Virio: no payment token. Configure `usdcAddress`, or pass `token` explicitly.",
      );
    }
    return this.defaultToken;
  }

  private indexerOpts(options?: ListOptions): IndexerOptions {
    return {
      fromBlock: options?.fromBlock ?? this.deploymentBlock,
      toBlock: options?.toBlock,
      maxRange: options?.maxRange,
      limit: options?.limit,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_UINT256 = (1n << 256n) - 1n;

/** The on-chain form of a unit label. Readable labels stay off-chain. */
export function hashUnit(unit: string): Hex {
  return keccak256(toHex(unit));
}

function toUnix(date: Date): bigint {
  return BigInt(Math.floor(date.getTime() / 1000));
}

/** Cap period to assume when the caller states a cap but not a window. */
function defaultPeriodFor(params: CreateBillingParams): Interval {
  if (params.type === "recurring") return params.interval;
  if (params.type === "hybrid") return params.base.interval;
  return "month";
}

/** Map the contract's numeric billing type onto the SDK's string union. */
function decodeAuthorization(raw: Record<string, unknown>): Authorization {
  return {
    payer: raw.payer as Address,
    merchant: raw.merchant as Address,
    token: raw.token as Address,
    billingType: BILLING_TYPE_VALUES[Number(raw.billingType)] ?? "recurring",
    maxPerCharge: raw.maxPerCharge as bigint,
    periodSpendCap: raw.periodSpendCap as bigint,
    totalSpendCap: raw.totalSpendCap as bigint,
    spentThisPeriod: raw.spentThisPeriod as bigint,
    totalSpent: raw.totalSpent as bigint,
    periodStart: raw.periodStart as bigint,
    periodDuration: raw.periodDuration as bigint,
    validAfter: raw.validAfter as bigint,
    validUntil: raw.validUntil as bigint,
    active: raw.active as boolean,
  };
}
