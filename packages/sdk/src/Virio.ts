import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseEventLogs,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { VIRIO_ABI, ERC20_ABI } from "./abi.js";
import { resolveChain, usdcAddressFor, type ChainName } from "./chains.js";
import { computeSubscriptionId, formatUnits } from "./helpers.js";
import {
  EventNotFoundError,
  MissingAccountError,
  MissingTokenError,
  MissingWalletError,
} from "./errors.js";
import {
  findChargeLogs,
  findPlanCreatedLogs,
  findSubscribedLogs,
  type IndexerOptions,
} from "./indexer.js";
import type {
  Charge,
  CreatePlanParams,
  Fees,
  ListOptions,
  Plan,
  PlanRecord,
  PreparedCheckout,
  PreparedTransaction,
  Subscription,
  SubscribeParams,
  SubscriptionRecord,
  SubscriptionRole,
} from "./types.js";

// ─── Config ─────────────────────────────────────────────────────────────────

/** Fully-resolved config (chain already a viem `Chain`). Returned by `loadConfig`. */
export interface ResolvedVirioConfig {
  contractAddress: Address;
  chain: Chain;
  rpcUrl?: string;
  usdcAddress?: Address;
  account?: Address;
  privateKey?: Hex;
  deploymentBlock?: bigint;
}

/** Options accepted by `new Virio(...)` and `Virio.fromConfig(...)`. */
export interface VirioOptions {
  /** The Virio subscription-manager contract address. */
  contractAddress: Address;
  /** A viem `Chain`, a friendly name ("base", "sepolia", "anvil"…), or a chain id. */
  chain: Chain | ChainName | string | number;
  /** RPC URL used to build the internal public/wallet clients. */
  rpcUrl?: string;
  /** Payment-token address. Defaults to the chain's canonical USDC when known. */
  usdcAddress?: Address;
  /** Default account for reads such as `getBalance()`. */
  account?: Address;
  /** Server-side signing key. Creates a wallet client for write calls. */
  privateKey?: Hex;
  /** Pre-built wallet client (e.g. a browser/wagmi client) for write calls. */
  walletClient?: WalletClient<Transport, Chain>;
  /** Pre-built public client; one is created from `rpcUrl` otherwise. */
  publicClient?: PublicClient;
  /** Block to start event scans from (skips pre-deployment history). */
  deploymentBlock?: bigint | number;
}

// ─── Resource namespaces (Stripe-style grouping) ─────────────────────────────

export interface PlansNamespace {
  create(params: CreatePlanParams): Promise<{ txHash: Hash; planId: Hex }>;
  get(planId: Hex): Promise<Plan>;
  list(merchant?: Address, options?: ListOptions): Promise<PlanRecord[]>;
  deactivate(planId: Hex): Promise<Hash>;
  prepareCreate(params: CreatePlanParams): PreparedTransaction;
  prepareDeactivate(planId: Hex): PreparedTransaction;
}

export interface SubscriptionsNamespace {
  create(params: SubscribeParams): Promise<{ txHash: Hash; subscriptionId: Hex }>;
  subscribe(params: SubscribeParams): Promise<{ txHash: Hash; subscriptionId: Hex }>;
  get(subscriptionId: Hex): Promise<Subscription>;
  list(address: Address, role?: SubscriptionRole, options?: ListOptions): Promise<SubscriptionRecord[]>;
  cancel(subscriptionId: Hex): Promise<Hash>;
  charge(subscriptionId: Hex): Promise<Hash>;
  isDue(subscriptionId: Hex): Promise<boolean>;
  prepareSubscribe(params: SubscribeParams): PreparedTransaction;
  prepareCancel(subscriptionId: Hex): PreparedTransaction;
  prepareCharge(subscriptionId: Hex): PreparedTransaction;
  prepareCheckout(params: SubscribeParams, customer?: Address): Promise<PreparedCheckout>;
}

type ManagerEventName =
  | "PlanCreated"
  | "PlanDeactivated"
  | "Subscribed"
  | "ChargeExecuted"
  | "Cancelled";

interface WatchedLog {
  eventName: string;
  args: Record<string, unknown>;
  transactionHash: Hex;
  blockNumber: bigint;
}

// ─── Virio client ─────────────────────────────────────────────────────────────

/**
 * The Virio SDK client. Construct it directly or from a resolved config object:
 *
 * ```ts
 * import { Virio } from "@virio/sdk";
 *
 * const virio = new Virio({ contractAddress, chain, rpcUrl });
 * const balance = await virio.getBalance();        // configured account's USDC
 * const subs = await virio.getSubscriptions(addr); // all subs for an address
 * ```
 */
export class Virio {
  readonly contractAddress: Address;
  readonly chain: Chain;
  /** Default payment token (USDC) for this chain, if known/configured. */
  readonly usdc: Address | undefined;
  /** Default account used for reads. */
  readonly account: Address | undefined;
  /** First block scanned by list helpers / event watchers. */
  readonly deploymentBlock: bigint;

  private readonly pub: PublicClient;
  private readonly wal: WalletClient<Transport, Chain> | undefined;
  private readonly decimalsCache = new Map<Address, number>();
  private readonly symbolCache = new Map<Address, string>();

  /** Stripe-style resource namespace for plans. */
  readonly plans: PlansNamespace;
  /** Alias of `plans` (Virio "products" === plans). */
  readonly products: PlansNamespace;
  /** Stripe-style resource namespace for subscriptions. */
  readonly subscriptions: SubscriptionsNamespace;

  constructor(options: VirioOptions) {
    this.contractAddress = options.contractAddress;
    this.chain = resolveChain(options.chain);
    this.deploymentBlock =
      options.deploymentBlock === undefined ? 0n : BigInt(options.deploymentBlock);

    this.pub =
      options.publicClient ??
      createPublicClient({ chain: this.chain, transport: http(options.rpcUrl) });

    if (options.walletClient) {
      this.wal = options.walletClient;
    } else if (options.privateKey) {
      this.wal = createWalletClient({
        account: privateKeyToAccount(options.privateKey),
        chain: this.chain,
        transport: http(options.rpcUrl),
      }) as WalletClient<Transport, Chain>;
    } else {
      this.wal = undefined;
    }

    this.account = options.account ?? this.wal?.account?.address;
    this.usdc = options.usdcAddress ?? usdcAddressFor(this.chain.id);

    // ── resource namespaces ──
    this.plans = {
      create: (p) => this.createPlan(p),
      get: (id) => this.getPlan(id),
      list: (merchant, options) => this.getPlans(merchant, options),
      deactivate: (id) => this.deactivatePlan(id),
      prepareCreate: (p) => this.prepareCreatePlan(p),
      prepareDeactivate: (id) => this.prepareDeactivatePlan(id),
    };
    this.products = this.plans;
    this.subscriptions = {
      create: (p) => this.subscribe(p),
      subscribe: (p) => this.subscribe(p),
      get: (id) => this.getSubscription(id),
      list: (address, role, options) => this.getSubscriptions(address, role, options),
      cancel: (id) => this.cancel(id),
      charge: (id) => this.charge(id),
      isDue: (id) => this.isDue(id),
      prepareSubscribe: (p) => this.prepareSubscribe(p),
      prepareCancel: (id) => this.prepareCancel(id),
      prepareCharge: (id) => this.prepareCharge(id),
      prepareCheckout: (p, customer) => this.prepareCheckout(p, customer),
    };
  }

  // ─── Constructors ────────────────────────────────────────────────────────

  /** Build a client from a resolved config object. */
  static fromConfig(config: VirioOptions): Virio {
    return new Virio(config);
  }

  // ─── Reads: point lookups ──────────────────────────────────────────────────

  /** Fetch a plan by id. */
  async getPlan(planId: Hex): Promise<Plan> {
    return (await this.pub.readContract({
      address: this.contractAddress,
      abi: VIRIO_ABI,
      functionName: "getPlan",
      args: [planId],
    })) as Plan;
  }

  /** Fetch a single subscription's current on-chain state by id. */
  async getSubscription(subscriptionId: Hex): Promise<Subscription> {
    return (await this.pub.readContract({
      address: this.contractAddress,
      abi: VIRIO_ABI,
      functionName: "getSubscription",
      args: [subscriptionId],
    })) as Subscription;
  }

  /** True if the subscription is active and chargeable right now. */
  async isDue(subscriptionId: Hex): Promise<boolean> {
    const sub = await this.getSubscription(subscriptionId);
    return sub.active && sub.nextChargeAt <= BigInt(Math.floor(Date.now() / 1000));
  }

  /** Deterministic subscription id for a (plan, customer) pair — computed locally. */
  computeSubscriptionId(planId: Hex, customer: Address): Hex {
    return computeSubscriptionId(planId, customer);
  }

  /** Read the protocol's current fee configuration. */
  async getFees(): Promise<Fees> {
    const [executorFeeBps, protocolFeeBps, protocolFlatFee, feeRecipient] = await Promise.all([
      this.pub.readContract({ address: this.contractAddress, abi: VIRIO_ABI, functionName: "executorFeeBps" }),
      this.pub.readContract({ address: this.contractAddress, abi: VIRIO_ABI, functionName: "protocolFeeBps" }),
      this.pub.readContract({ address: this.contractAddress, abi: VIRIO_ABI, functionName: "protocolFlatFee" }),
      this.pub.readContract({ address: this.contractAddress, abi: VIRIO_ABI, functionName: "feeRecipient" }),
    ]);
    return {
      executorFeeBps: Number(executorFeeBps),
      protocolFeeBps: Number(protocolFeeBps),
      protocolFlatFee: protocolFlatFee as bigint,
      feeRecipient: feeRecipient as Address,
    };
  }

  // ─── Reads: token balances ─────────────────────────────────────────────────

  /**
   * ERC-20 balance of an account. Defaults to the configured account and the
   * chain's USDC token, so `await virio.getBalance()` "just works".
   */
  async getBalance(account?: Address, token?: Address): Promise<bigint> {
    return (await this.pub.readContract({
      address: this.requireToken(token),
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [this.requireAccount(account)],
    })) as bigint;
  }

  /** Same as `getBalance`, formatted as a decimal string using the token's decimals. */
  async getBalanceFormatted(account?: Address, token?: Address): Promise<string> {
    const tok = this.requireToken(token);
    const [raw, decimals] = await Promise.all([
      this.getBalance(account, tok),
      this.getDecimals(tok),
    ]);
    return formatUnits(raw, decimals);
  }

  /** ERC-20 allowance. Defaults owner→configured account, spender→Virio contract. */
  async getAllowance(owner?: Address, spender?: Address, token?: Address): Promise<bigint> {
    return (await this.pub.readContract({
      address: this.requireToken(token),
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [this.requireAccount(owner), spender ?? this.contractAddress],
    })) as bigint;
  }

  /** Read (and cache) an ERC-20 token's decimals. */
  async getDecimals(token?: Address): Promise<number> {
    const tok = this.requireToken(token);
    const cached = this.decimalsCache.get(tok);
    if (cached !== undefined) return cached;
    const decimals = Number(
      await this.pub.readContract({ address: tok, abi: ERC20_ABI, functionName: "decimals" }),
    );
    this.decimalsCache.set(tok, decimals);
    return decimals;
  }

  /** Read (and cache) an ERC-20 token's symbol, e.g. "USDC". */
  async getSymbol(token?: Address): Promise<string> {
    const tok = this.requireToken(token);
    const cached = this.symbolCache.get(tok);
    if (cached !== undefined) return cached;
    const symbol = (await this.pub.readContract({
      address: tok,
      abi: ERC20_ABI,
      functionName: "symbol",
    })) as string;
    this.symbolCache.set(tok, symbol);
    return symbol;
  }

  // ─── Reads: lists (event-indexed) ──────────────────────────────────────────

  /**
   * List all subscriptions involving `address`.
   * `role` selects whether to match the customer side, the merchant side, or
   * both (default). Each record merges the `Subscribed` event with the
   * subscription's current on-chain state.
   */
  async getSubscriptions(
    address: Address,
    role: SubscriptionRole = "any",
    options?: ListOptions,
  ): Promise<SubscriptionRecord[]> {
    const opts = this.indexerOpts(options);
    const found = new Map<string, { subscriptionId: Hex; planId: Hex }>();

    if (role === "customer" || role === "any") {
      for (const s of await findSubscribedLogs(this.pub, this.contractAddress, { customer: address }, opts)) {
        found.set(s.subscriptionId.toLowerCase(), s);
      }
    }
    if (role === "merchant" || role === "any") {
      const plans = await findPlanCreatedLogs(this.pub, this.contractAddress, { merchant: address }, opts);
      const planIds = plans.map((p) => p.planId);
      if (planIds.length > 0) {
        for (const s of await findSubscribedLogs(this.pub, this.contractAddress, { planId: planIds }, opts)) {
          found.set(s.subscriptionId.toLowerCase(), s);
        }
      }
    }

    const records = await Promise.all(
      [...found.values()].map(async ({ subscriptionId, planId }) => {
        const sub = await this.getSubscription(subscriptionId);
        return { ...sub, id: subscriptionId, planId } satisfies SubscriptionRecord;
      }),
    );
    return records;
  }

  /** List plans, optionally filtered to a single merchant. Reflects current on-chain state. */
  async getPlans(merchant?: Address, options?: ListOptions): Promise<PlanRecord[]> {
    const logs = await findPlanCreatedLogs(this.pub, this.contractAddress, { merchant }, this.indexerOpts(options));
    return Promise.all(
      logs.map(async ({ planId }) => {
        const plan = await this.getPlan(planId);
        return { ...plan, id: planId } satisfies PlanRecord;
      }),
    );
  }

  /**
   * Charge (payment) history reconstructed from `ChargeExecuted` logs.
   * Filter by `subscriptionId` and/or `customer`; omit for all charges.
   */
  async getCharges(
    filter: { subscriptionId?: Hex; customer?: Address } = {},
    options?: ListOptions,
  ): Promise<Charge[]> {
    return findChargeLogs(this.pub, this.contractAddress, filter, this.indexerOpts(options));
  }

  // ─── Writes (require a wallet) ──────────────────────────────────────────────

  /** Create a subscription plan. The caller becomes the plan's merchant. */
  async createPlan(params: CreatePlanParams): Promise<{ txHash: Hash; planId: Hex }> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.contractAddress,
      abi: VIRIO_ABI,
      functionName: "createPlan",
      args: [this.requireToken(params.token), params.amount, params.period],
      account,
      chain: this.chain,
    });
    const receipt = await this.pub.waitForTransactionReceipt({ hash: txHash });
    const logs = parseEventLogs({ abi: VIRIO_ABI, logs: receipt.logs });
    const created = logs.find((l) => l.eventName === "PlanCreated");
    if (!created) throw new EventNotFoundError("PlanCreated");
    return { txHash, planId: (created.args as unknown as { planId: Hex }).planId };
  }

  /**
   * Subscribe to a plan. The caller (customer) must have approved the Virio
   * contract for at least `totalSpendCap` (or enough for the charges they
   * expect) — see `approve()`.
   */
  async subscribe(params: SubscribeParams): Promise<{ txHash: Hash; subscriptionId: Hex }> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.contractAddress,
      abi: VIRIO_ABI,
      functionName: "subscribe",
      args: [params.planId, params.totalSpendCap ?? 0n],
      account,
      chain: this.chain,
    });
    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return { txHash, subscriptionId: computeSubscriptionId(params.planId, account) };
  }

  /** Approve the Virio contract (or `spender`) to spend `amount` of the token. */
  async approve(amount: bigint, token?: Address, spender?: Address): Promise<Hash> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.requireToken(token),
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender ?? this.contractAddress, amount],
      account,
      chain: this.chain,
    });
    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /** Backwards-compatible alias of `approve`, with the token first. */
  async approveToken(token: Address, amount: bigint): Promise<Hash> {
    return this.approve(amount, token);
  }

  /** Charge a due subscription. Permissionless — any wallet may call and earns the executor fee. */
  async charge(subscriptionId: Hex): Promise<Hash> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.contractAddress,
      abi: VIRIO_ABI,
      functionName: "charge",
      args: [subscriptionId],
      account,
      chain: this.chain,
    });
    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /** Cancel a subscription. Callable by the customer or the merchant. */
  async cancel(subscriptionId: Hex): Promise<Hash> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.contractAddress,
      abi: VIRIO_ABI,
      functionName: "cancel",
      args: [subscriptionId],
      account,
      chain: this.chain,
    });
    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /** Deactivate a plan. Callable by the plan's merchant. */
  async deactivatePlan(planId: Hex): Promise<Hash> {
    const { wal, account } = await this.signer();
    const txHash = await wal.writeContract({
      address: this.contractAddress,
      abi: VIRIO_ABI,
      functionName: "deactivatePlan",
      args: [planId],
      account,
      chain: this.chain,
    });
    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  // ─── Prepare: deterministic, side-effect-free planning ─────────────────────
  //
  // These build the exact transactions a write would send, without signing or
  // touching the chain (except `prepareCheckout`, which reads allowance + plan).
  // They let agents and tools inspect calldata, fees, and the expected
  // subscription id before committing a signature.

  /** Calldata for `createPlan`. The signer becomes the plan's merchant. */
  prepareCreatePlan(params: CreatePlanParams): PreparedTransaction {
    return this.encodeManagerTx(
      "createPlan",
      [this.requireToken(params.token), params.amount, params.period],
      "Create plan",
    );
  }

  /** Calldata for `deactivatePlan`. Callable by the plan's merchant. */
  prepareDeactivatePlan(planId: Hex): PreparedTransaction {
    return this.encodeManagerTx("deactivatePlan", [planId], "Deactivate plan");
  }

  /** Calldata for `subscribe`. Requires a prior token approval — see `prepareCheckout`. */
  prepareSubscribe(params: SubscribeParams): PreparedTransaction {
    return this.encodeManagerTx(
      "subscribe",
      [params.planId, params.totalSpendCap ?? 0n],
      "Subscribe to plan",
    );
  }

  /** Calldata for `cancel`. Callable by the customer or the merchant. */
  prepareCancel(subscriptionId: Hex): PreparedTransaction {
    return this.encodeManagerTx("cancel", [subscriptionId], "Cancel subscription");
  }

  /** Calldata for `charge`. Permissionless — any wallet may send it. */
  prepareCharge(subscriptionId: Hex): PreparedTransaction {
    return this.encodeManagerTx("charge", [subscriptionId], "Charge subscription");
  }

  /** Calldata for an ERC-20 `approve` of the Virio contract (or `spender`). */
  prepareApprove(amount: bigint, token?: Address, spender?: Address): PreparedTransaction {
    const tok = this.requireToken(token);
    return {
      to: tok,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender ?? this.contractAddress, amount],
      }),
      value: 0n,
      label: "Approve token allowance",
      functionName: "approve",
      args: [spender ?? this.contractAddress, amount],
    };
  }

  /**
   * Plan a full checkout for `customer` (defaults to the configured account):
   * the required allowance, whether an approval is needed, the exact ordered
   * transactions to send, and the subscription id the subscribe will produce.
   * The only side effect is two reads (the plan and the current allowance).
   *
   * `requiredAllowance` is the subscription's spend cap when set, otherwise a
   * single charge — enough to subscribe and cover the first charge. Unlimited
   * subscriptions need a larger allowance for subsequent charges.
   */
  async prepareCheckout(params: SubscribeParams, customer?: Address): Promise<PreparedCheckout> {
    const account = this.requireAccount(customer);
    const plan = await this.getPlan(params.planId);
    const requiredAllowance =
      params.totalSpendCap && params.totalSpendCap > 0n ? params.totalSpendCap : plan.amount;
    const currentAllowance = await this.getAllowance(account, this.contractAddress, plan.token);
    const needsApproval = currentAllowance < requiredAllowance;

    const transactions: PreparedTransaction[] = [];
    if (needsApproval) transactions.push(this.prepareApprove(requiredAllowance, plan.token));
    transactions.push(this.prepareSubscribe(params));

    return {
      planId: params.planId,
      customer: account,
      subscriptionId: computeSubscriptionId(params.planId, account),
      token: plan.token,
      requiredAllowance,
      currentAllowance,
      needsApproval,
      transactions,
    };
  }

  // ─── Event hooks (local listeners over RPC) ────────────────────────────────

  /**
   * Watch a Virio contract event and invoke `onEvent` with decoded logs as they
   * arrive. Returns an unsubscribe function. Useful as a lightweight local
   * alternative to webhooks during development.
   */
  watch(eventName: ManagerEventName, onEvent: (logs: WatchedLog[]) => void): () => void {
    return this.pub.watchContractEvent({
      address: this.contractAddress,
      abi: VIRIO_ABI,
      eventName,
      onLogs: (logs) => onEvent(logs as unknown as WatchedLog[]),
    });
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /** Encode a non-payable manager call into a `PreparedTransaction`. */
  private encodeManagerTx(
    functionName: string,
    args: readonly unknown[],
    label: string,
  ): PreparedTransaction {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({ abi: VIRIO_ABI, functionName, args } as never),
      value: 0n,
      label,
      functionName,
      args,
    };
  }

  private async signer(): Promise<{ wal: WalletClient<Transport, Chain>; account: Address }> {
    if (!this.wal) throw new MissingWalletError();
    const account = this.wal.account?.address ?? (await this.wal.getAddresses())[0];
    if (!account) throw new MissingAccountError();
    return { wal: this.wal, account };
  }

  private requireToken(token?: Address): Address {
    const tok = token ?? this.usdc;
    if (!tok) throw new MissingTokenError();
    return tok;
  }

  private requireAccount(account?: Address): Address {
    const addr = account ?? this.account;
    if (!addr) throw new MissingAccountError();
    return addr;
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
