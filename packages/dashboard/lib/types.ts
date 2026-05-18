export interface IntervalDef {
  label: string;
  seconds: number;
}

export interface PulseConfig {
  testMode: boolean;
  testIntervals: IntervalDef[];
  productionIntervals: IntervalDef[];
  scheduler: { testTickMs: number; productionTickMs: number };
  defaults: { merchant: string; feeRecipient: string };
  maxTransactions: number;
}

export type Network = "sepolia" | "anvil";

export interface PulseLocalConfig {
  network: Network;
  rpc: { alchemyKey: string | null; fullUrlOverride: string | null };
  walletConnectProjectId: string | null;
  contracts: {
    manager: `0x${string}`;
    usdc: `0x${string}`;
    feeRecipient: `0x${string}`;
    payrollManager: `0x${string}`;
  };
  deploymentBlock: bigint;
  payrollDeploymentBlock: bigint;
  merchant: { address: `0x${string}`; label: string };
  executor: { privateKey: `0x${string}` | null };
  testAddresses: Array<{ label: string; address: `0x${string}` }>;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  intervalLabel: string;
  intervalSeconds: number;
  cancelAfterCharges: number | null;
  active: boolean;
  createdAt: string;
  isTestInterval: boolean;
}

export interface Subscription {
  id: string;
  planId: string;
  planName: string;
  customer: string;
  spendCap: number | null;
  chargeCount: number;
  totalPaid: number;
  nextChargeAt: number;
  status: "active" | "cancelled" | "completed";
  createdAt: string;
}

export interface Transaction {
  id: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  customer: string;
  merchantAmount: number;
  fee: number;
  gross: number;
  direction: "in";
  status: "success" | "failed";
  failReason?: string;
  timestamp: string;
}

export interface Stats {
  totalRevenue: number;
  totalFees: number;
  totalCharges: number;
  activeSubs: number;
  activePlans: number;
  recentTransactions: Transaction[];
}

/// ── Payroll domain types ─────────────────────────────────────────────────

export interface PayrollPlan {
  id: string;
  employer: string;
  token: string;
  intervalSeconds: number;
  intervalLabel: string;
  active: boolean;
  createdAt: string;
  recipientCount: number;
}

export interface PayrollRecipient {
  id: string;
  planId: string;
  wallet: string;
  amount: number;       // display USDC (decimal)
  nextPayAt: number;    // unix seconds
  totalPaid: number;    // display USDC
  spendCap: number;     // 0 = unlimited
  active: boolean;
}

export interface PayrollExecution {
  id: string;           // unique key derived from tx + log index
  planId: string;
  recipientId: string;
  executor: string;
  recipient: string;
  gross: number;
  recipientAmount: number;
  executorFee: number;
  protocolFee: number;
  nextPayAt: number;
  timestamp: number;
}

export interface PayrollStats {
  totalVolume: number;      // sum of gross payments
  totalRecipients: number;  // active recipients across all plans
  activePlans: number;
  failedRecent: number;     // batches with failCount > 0 in recent window
  recentExecutions: PayrollExecution[];
}
