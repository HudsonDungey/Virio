import {
  createPublicClient,
  createWalletClient,
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
import { loadConfig } from "./config.js";
import { resolveChain, usdcAddressFor, type ChainName } from "./chains.js";
import { computeSubscriptionId, formatUnits } from "./helpers.js";
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
  Plan,
  PlanRecord,
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
  list(merchant?: Address): Promise<PlanRecord[]>;
  deactivate(planId: Hex): Promise<Hash>;
}

export interface SubscriptionsNamespace {
  create(params: SubscribeParams): Promise<{ txHash: Hash; subscriptionId: Hex }>;
  subscribe(params: SubscribeParams): Promise<{ txHash: Hash; subscriptionId: Hex }>;
  get(subscriptionId: Hex): Promise<Subscription>;
  list(address: Address, role?: SubscriptionRole): Promise<SubscriptionRecord[]>;
  cancel(subscriptionId: Hex): Promise<Hash>;
  charge(subscriptionId: Hex): Promise<Hash>;
  isDue(subscriptionId: Hex): Promise<boolean>;
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
 * The Virio SDK client. Construct it directly, from a config object, or from a
 * config file:
 *
 * ```ts
 * import { Virio } from "@virio/sdk";
 *
 * const virio = Virio.fromConfigFile();           // reads ./virio.config.json
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
      list: (merchant) => this.getPlans(merchant),
      deactivate: (id) => this.deactivatePlan(id),
    };
    this.products = this.plans;
    this.subscriptions = {
      create: (p) => this.subscribe(p),
      subscribe: (p) => this.subscribe(p),
      get: (id) => this.getSubscription(id),
      list: (address, role) => this.getSubscriptions(address, role),
      cancel: (id) => this.cancel(id),
      charge: (id) => this.charge(id),
      isDue: (id) => this.isDue(id),
    };
  }

  // ─── Constructors ────────────────────────────────────────────────────────

  /** Build a client from a resolved config object. */
  static fromConfig(config: VirioOptions): Virio {
    return new Virio(config);
  }

  /**
   * Build a client from a JSON config file (default: ./virio.config.json).
   * Pass `{ path }` for a custom location or `{ chain }` to select a chain
   * from a multi-chain `chains` map.
   */
  static fromConfigFile(options: { path?: string; chain?: ChainName | string | number } = {}): Virio {
    return new Virio(loadConfig(options));
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

  // ─── Reads: lists (event-indexed) ──────────────────────────────────────────

  /**
   * List all subscriptions involving `address`.
   * `role` selects whether to match the customer side, the merchant side, or
   * both (default). Each record merges the `Subscribed` event with the
   * subscription's current on-chain state.
   */
  async getSubscriptions(address: Address, role: SubscriptionRole = "any"): Promise<SubscriptionRecord[]> {
    const opts = this.indexerOpts();
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
  async getPlans(merchant?: Address): Promise<PlanRecord[]> {
    const logs = await findPlanCreatedLogs(this.pub, this.contractAddress, { merchant }, this.indexerOpts());
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
  async getCharges(filter: { subscriptionId?: Hex; customer?: Address } = {}): Promise<Charge[]> {
    return findChargeLogs(this.pub, this.contractAddress, filter, this.indexerOpts());
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
    if (!created) throw new Error("Virio: PlanCreated event not found in receipt");
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

  private async signer(): Promise<{ wal: WalletClient<Transport, Chain>; account: Address }> {
    if (!this.wal) {
      throw new Error(
        "Virio: a wallet is required for write operations. Pass `privateKey` or `walletClient` " +
          "to the Virio config (or set VIRIO_PRIVATE_KEY).",
      );
    }
    const account = this.wal.account?.address ?? (await this.wal.getAddresses())[0];
    if (!account) throw new Error("Virio: wallet client has no available account.");
    return { wal: this.wal, account };
  }

  private requireToken(token?: Address): Address {
    const tok = token ?? this.usdc;
    if (!tok) {
      throw new Error(
        "Virio: no token address. Configure `usdcAddress` for this chain, or pass a token explicitly.",
      );
    }
    return tok;
  }

  private requireAccount(account?: Address): Address {
    const addr = account ?? this.account;
    if (!addr) {
      throw new Error(
        "Virio: no account to read. Configure `account` (or a wallet), or pass an address explicitly.",
      );
    }
    return addr;
  }

  private indexerOpts(): IndexerOptions {
    return { fromBlock: this.deploymentBlock };
  }
}
