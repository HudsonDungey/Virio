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
  type WalletClient,
  type Transport,
} from "viem";

import { PULSE_ABI, ERC20_ABI, EXECUTOR_ABI } from "./abi.js";
import type {
  Plan,
  Subscription,
  CreatePlanParams,
  SubscribeParams,
} from "./types.js";
import { computeSubscriptionId } from "./helpers.js";

// ─── Client config ────────────────────────────────────────────────────────────

export interface PulseClientConfig {
  contractAddress: Address;
  chain: Chain;
  /** Provide a pre-built walletClient for write operations. */
  walletClient?: WalletClient<Transport, Chain>;
  /** Provide a pre-built publicClient for reads; auto-created otherwise. */
  publicClient?: PublicClient;
  /** RPC URL used when creating clients internally. */
  rpcUrl?: string;
}

// ─── PulseClient ─────────────────────────────────────────────────────────────

export class PulseClient {
  readonly contractAddress: Address;
  readonly chain: Chain;

  private readonly pub: PublicClient;
  private readonly wal: WalletClient<Transport, Chain> | undefined;

  constructor(config: PulseClientConfig) {
    this.contractAddress = config.contractAddress;
    this.chain           = config.chain;
    this.wal             = config.walletClient;

    this.pub = config.publicClient ?? createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  async getPlan(planId: Hex): Promise<Plan> {
    // real viem infers the return type from the ABI; stubs return unknown, so cast.
    const raw = await this.pub.readContract({
      address: this.contractAddress,
      abi: PULSE_ABI,
      functionName: "getPlan",
      args: [planId],
    }) as { merchant: Address; token: Address; amount: bigint; period: bigint; maxAmountPerCharge: bigint; feeBps: number; active: boolean };
    return {
      merchant:           raw.merchant,
      token:              raw.token,
      amount:             raw.amount,
      period:             raw.period,
      maxAmountPerCharge: raw.maxAmountPerCharge,
      feeBps:             raw.feeBps,
      active:             raw.active,
    };
  }

  async getSubscription(subscriptionId: Hex): Promise<Subscription> {
    const raw = await this.pub.readContract({
      address: this.contractAddress,
      abi: PULSE_ABI,
      functionName: "getSubscription",
      args: [subscriptionId],
    }) as { planId: Hex; customer: Address; nextChargeAt: bigint; totalSpent: bigint; totalSpendCap: bigint; active: boolean };
    return {
      planId:        raw.planId,
      customer:      raw.customer,
      nextChargeAt:  raw.nextChargeAt,
      totalSpent:    raw.totalSpent,
      totalSpendCap: raw.totalSpendCap,
      active:        raw.active,
    };
  }

  async getTokenBalance(token: Address, account: Address): Promise<bigint> {
    return this.pub.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account],
    }) as Promise<bigint>;
  }

  async getTokenAllowance(token: Address, owner: Address, spender: Address): Promise<bigint> {
    return this.pub.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [owner, spender],
    }) as Promise<bigint>;
  }

  // ─── Writes (require walletClient) ────────────────────────────────────────

  /** Create a subscription plan.  Caller becomes the plan's merchant. */
  async createPlan(params: CreatePlanParams): Promise<{ txHash: Hash; planId: Hex }> {
    const wal = this.requireWallet();
    const [account] = await wal.getAddresses();

    const txHash = await wal.writeContract({
      address: this.contractAddress,
      abi: PULSE_ABI,
      functionName: "createPlan",
      args: [
        params.token,
        params.amount,
        params.period,
        params.maxAmountPerCharge,
        params.feeBps,
      ],
      account,
      chain: this.chain,
    });

    const receipt = await this.pub.waitForTransactionReceipt({ hash: txHash });
    const logs = parseEventLogs({ abi: PULSE_ABI, logs: receipt.logs });
    const planCreated = logs.find((l) => l.eventName === "PlanCreated");
    if (!planCreated) throw new Error("PlanCreated event not found in receipt");

    return { txHash, planId: (planCreated.args as { planId: Hex }).planId };
  }

  /**
   * Subscribe to a plan.
   * The caller (customer) must have already approved this contract to spend
   * at least `totalSpendCap` of the plan's token.
   */
  async subscribe(params: SubscribeParams): Promise<{ txHash: Hash; subscriptionId: Hex }> {
    const wal = this.requireWallet();
    const [account] = await wal.getAddresses();

    const txHash = await wal.writeContract({
      address: this.contractAddress,
      abi: PULSE_ABI,
      functionName: "subscribe",
      args: [params.planId, params.totalSpendCap],
      account,
      chain: this.chain,
    });

    await this.pub.waitForTransactionReceipt({ hash: txHash });

    const subscriptionId = computeSubscriptionId(params.planId, account);
    return { txHash, subscriptionId };
  }

  /** Approve the Pulse contract to spend the plan's token on behalf of the caller. */
  async approveToken(token: Address, amount: bigint): Promise<Hash> {
    const wal = this.requireWallet();
    const [account] = await wal.getAddresses();

    const txHash = await wal.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [this.contractAddress, amount],
      account,
      chain: this.chain,
    });

    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /**
   * @deprecated The on-chain permissionless `charge()` entrypoint was removed
   * when PulseExecutor became the sole caller of `chargeFor`. Use
   * `executePayment(executorAddress, paymentId)` instead, where
   * `paymentId = computePaymentId(managerAddress, subscriptionId, chainId)`.
   */
  async charge(_subscriptionId: Hex): Promise<Hash> {
    throw new Error(
      "PulseClient.charge() is removed — use executePayment(executorAddress, paymentId). " +
        "Compute paymentId via computePaymentId(managerAddress, subscriptionId, chainId).",
    );
  }

  /**
   * Execute a due payment via PulseExecutor. The wallet acts as both the
   * keeper (msg.sender) and the on-chain payee — it earns the executor fee
   * (minus any penalty per the router's failure-rate ladder).
   *
   * `executorAddress` is the deployed PulseExecutor contract on this chain.
   * Pass the same address for every call; we keep it out of the constructor
   * so callers can construct a single PulseClient and reuse it across
   * subscription + payroll dispatch.
   */
  async executePayment(executorAddress: Address, paymentId: Hex): Promise<Hash> {
    const wal = this.requireWallet();
    const [account] = await wal.getAddresses();

    const txHash = await wal.writeContract({
      address: executorAddress,
      abi: EXECUTOR_ABI,
      functionName: "execute",
      args: [paymentId],
      account,
      chain: this.chain,
    });

    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /**
   * Batch variant. Per-payment failures are absorbed inside the executor
   * contract and reflected via ExecutionFailed events — the tx itself
   * succeeds even with partial failures.
   */
  async executePaymentsBatch(executorAddress: Address, paymentIds: Hex[]): Promise<Hash> {
    if (paymentIds.length === 0) throw new Error("executePaymentsBatch: empty batch");
    const wal = this.requireWallet();
    const [account] = await wal.getAddresses();

    const txHash = await wal.writeContract({
      address: executorAddress,
      abi: EXECUTOR_ABI,
      functionName: "executeBatch",
      args: [paymentIds],
      account,
      chain: this.chain,
    });

    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /** Cancel a subscription.  Must be called by the subscriber. */
  async cancel(subscriptionId: Hex): Promise<Hash> {
    const wal = this.requireWallet();
    const [account] = await wal.getAddresses();

    const txHash = await wal.writeContract({
      address: this.contractAddress,
      abi: PULSE_ABI,
      functionName: "cancel",
      args: [subscriptionId],
      account,
      chain: this.chain,
    });

    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /** Deactivate a plan.  Must be called by the plan's merchant. */
  async deactivatePlan(planId: Hex): Promise<Hash> {
    const wal = this.requireWallet();
    const [account] = await wal.getAddresses();

    const txHash = await wal.writeContract({
      address: this.contractAddress,
      abi: PULSE_ABI,
      functionName: "deactivatePlan",
      args: [planId],
      account,
      chain: this.chain,
    });

    await this.pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private requireWallet(): WalletClient<Transport, Chain> {
    if (!this.wal) throw new Error("PulseClient: walletClient is required for write operations");
    return this.wal;
  }
}
