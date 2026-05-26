import type { ReactNode } from "react";
import type { Address, Hex } from "viem";
import { decodeEventLog, formatGwei, formatEther } from "viem";
import { notFound } from "next/navigation";
import {
  publicClient,
  managerAbi,
  payrollAbi,
  MANAGER_ADDRESS,
  PAYROLL_ADDRESS,
  usdcDisplay,
  CHAIN,
} from "@/lib/chain";
import { listSubscriptions } from "@/lib/chain-reads";
import { listPayrollPlans } from "@/lib/payroll-reads";
import { fmt$, fmtAddr, fmtNextCharge } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// ─── types ────────────────────────────────────────────────────────────────

type ChargeArgs = {
  subscriptionId: Hex;
  executor: Address;
  customer: Address;
  gross: bigint;
  merchantAmount: bigint;
  executorFee: bigint;
  protocolFee: bigint;
  nextChargeAt: bigint;
};

type PayrollArgs = {
  planId: Hex;
  recipientId: Hex;
  executor: Address;
  recipient: Address;
  grossAmount: bigint;
  recipientAmount: bigint;
  executorFee: bigint;
  protocolFee: bigint;
  nextPayAt: bigint;
};

type SubState = {
  customer: Address;
  merchant: Address;
  token: Address;
  amount: bigint;
  period: bigint;
  nextChargeAt: bigint;
  totalSpendCap: bigint;
  totalSpent: bigint;
  active: boolean;
};

// ─── helpers ──────────────────────────────────────────────────────────────

function periodLabel(seconds: number): string {
  if (seconds === 2592000) return "Monthly (30 days)";
  if (seconds === 604800) return "Weekly";
  if (seconds === 86400) return "Daily";
  if (seconds === 3600) return "Hourly";
  if (seconds % 86400 === 0) return `Every ${seconds / 86400} days`;
  if (seconds % 3600 === 0) return `Every ${seconds / 3600} hours`;
  if (seconds % 60 === 0) return `Every ${seconds / 60} minutes`;
  return `${seconds}s`;
}

function pct(part: bigint, whole: bigint): string {
  if (whole === 0n) return "0.0";
  return ((Number(part) / Number(whole)) * 100).toFixed(1);
}

const explorerBase = CHAIN.blockExplorers?.default.url ?? "";

// ─── data fetching ────────────────────────────────────────────────────────

async function fetchDetail(hash: Hex) {
  const [tx, receipt] = await Promise.all([
    publicClient.getTransaction({ hash }).catch(() => null),
    publicClient.getTransactionReceipt({ hash }).catch(() => null),
  ]);
  if (!tx || !receipt) return null;

  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });

  let chargeArgs: ChargeArgs | null = null;
  let payrollArgs: PayrollArgs | null = null;

  for (const log of receipt.logs) {
    const addr = log.address.toLowerCase();
    if (!chargeArgs && addr === MANAGER_ADDRESS.toLowerCase()) {
      try {
        const d = decodeEventLog({ abi: managerAbi, data: log.data, topics: log.topics });
        if (d.eventName === "ChargeExecuted") chargeArgs = d.args as unknown as ChargeArgs;
      } catch { /* not a manager event */ }
    }
    if (!payrollArgs && addr === PAYROLL_ADDRESS.toLowerCase()) {
      try {
        const d = decodeEventLog({ abi: payrollAbi, data: log.data, topics: log.topics });
        if (d.eventName === "PayrollExecuted") payrollArgs = d.args as unknown as PayrollArgs;
      } catch { /* not a payroll event */ }
    }
  }

  let subState: SubState | null = null;
  let subContext: {
    planId: string;
    planName: string;
    chargeCount: number;
    totalPaid: number;
    spendCap: number | null;
    status: string;
  } | null = null;
  let payrollPlan: { intervalLabel: string } | null = null;

  if (chargeArgs) {
    const [state, subs] = await Promise.all([
      publicClient.readContract({
        address: MANAGER_ADDRESS,
        abi: managerAbi,
        functionName: "getSubscription",
        args: [chargeArgs.subscriptionId],
      }),
      listSubscriptions(),
    ]);
    subState = state as unknown as SubState;
    const sub = subs.find(
      (s) => s.id.toLowerCase() === chargeArgs!.subscriptionId.toLowerCase(),
    );
    if (sub) {
      subContext = {
        planId: sub.planId,
        planName: sub.planName,
        chargeCount: sub.chargeCount,
        totalPaid: sub.totalPaid,
        spendCap: sub.spendCap,
        status: sub.status,
      };
    }
  }

  if (payrollArgs) {
    const plans = await listPayrollPlans();
    const plan = plans.find(
      (p) => p.id.toLowerCase() === payrollArgs!.planId.toLowerCase(),
    );
    payrollPlan = plan ?? null;
  }

  return { tx, receipt, block, chargeArgs, payrollArgs, subState, subContext, payrollPlan };
}

// ─── sub-components ───────────────────────────────────────────────────────

function Row({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`break-all text-right ${mono ? "font-mono text-xs" : ""}`}>
        {children}
      </span>
    </div>
  );
}

function AddrLink({ addr }: { addr: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-xs">{addr}</span>
      {explorerBase && (
        <a
          href={`${explorerBase}/address/${addr}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          ↗
        </a>
      )}
    </span>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────

export default async function TxDetailPage({
  params,
}: {
  params: Promise<{ txhash: string }>;
}) {
  const { txhash } = await params;

  if (!/^0x[0-9a-fA-F]{64}$/.test(txhash)) notFound();

  const detail = await fetchDetail(txhash as Hex);
  if (!detail) notFound();

  const { tx, receipt, block, chargeArgs, payrollArgs, subState, subContext, payrollPlan } = detail;

  const isCharge = chargeArgs !== null;
  const isPayroll = payrollArgs !== null;
  const typeLabel = isCharge
    ? "Subscription Charge"
    : isPayroll
      ? "Payroll Payment"
      : "Protocol Transaction";
  const typeBadge = isCharge ? "active" : isPayroll ? "completed" : ("inactive" as const);

  const timestamp = new Date(Number(block.timestamp) * 1000);
  const gasUsed = Number(receipt.gasUsed);
  const gasLimit = Number(tx.gas);
  const gasPct = ((gasUsed / gasLimit) * 100).toFixed(1);
  const txFeeWei = receipt.gasUsed * receipt.effectiveGasPrice;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6 sm:py-12">
        <a
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Dashboard
        </a>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Card className="mb-5">
          <CardContent className="pb-4 pt-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant={typeBadge}>{typeLabel}</Badge>
              <Badge variant={receipt.status === "success" ? "success" : "failed"}>
                {receipt.status === "success" ? "Success" : "Reverted"}
              </Badge>
            </div>
            <div className="mb-2 flex items-start gap-2">
              <span className="break-all font-mono text-xs text-muted-foreground">
                {txhash}
              </span>
              {explorerBase && (
                <a
                  href={`${explorerBase}/tx/${txhash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  ↗
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Block{" "}
              {explorerBase ? (
                <a
                  href={`${explorerBase}/block/${receipt.blockNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  #{receipt.blockNumber.toString()}
                </a>
              ) : (
                `#${receipt.blockNumber.toString()}`
              )}
              {" · "}
              {timestamp.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "UTC",
                timeZoneName: "short",
              })}
              {" · "}
              {gasUsed.toLocaleString()} gas used
            </p>
          </CardContent>
        </Card>

        {/* ── Payment + context grid ──────────────────────────────────────── */}
        {(isCharge || isPayroll) && (
          <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Payment breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent>
                {isCharge && chargeArgs && (
                  <>
                    <Row label="Gross charged">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {fmt$(usdcDisplay(chargeArgs.gross))}
                      </span>
                    </Row>
                    <Row label="To merchant">
                      <span>
                        {fmt$(usdcDisplay(chargeArgs.merchantAmount))}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({pct(chargeArgs.merchantAmount, chargeArgs.gross)}%)
                        </span>
                      </span>
                    </Row>
                    <Row label="Executor fee">
                      <span>
                        {fmt$(usdcDisplay(chargeArgs.executorFee))}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({pct(chargeArgs.executorFee, chargeArgs.gross)}%)
                        </span>
                      </span>
                    </Row>
                    <Row label="Protocol fee">
                      <span>
                        {fmt$(usdcDisplay(chargeArgs.protocolFee))}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({pct(chargeArgs.protocolFee, chargeArgs.gross)}%)
                        </span>
                      </span>
                    </Row>
                    <Row label="Token">USDC</Row>
                  </>
                )}
                {isPayroll && payrollArgs && (
                  <>
                    <Row label="Gross payment">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {fmt$(usdcDisplay(payrollArgs.grossAmount))}
                      </span>
                    </Row>
                    <Row label="To recipient">
                      <span>
                        {fmt$(usdcDisplay(payrollArgs.recipientAmount))}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({pct(payrollArgs.recipientAmount, payrollArgs.grossAmount)}%)
                        </span>
                      </span>
                    </Row>
                    <Row label="Executor fee">
                      <span>
                        {fmt$(usdcDisplay(payrollArgs.executorFee))}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({pct(payrollArgs.executorFee, payrollArgs.grossAmount)}%)
                        </span>
                      </span>
                    </Row>
                    <Row label="Protocol fee">
                      <span>
                        {fmt$(usdcDisplay(payrollArgs.protocolFee))}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({pct(payrollArgs.protocolFee, payrollArgs.grossAmount)}%)
                        </span>
                      </span>
                    </Row>
                    <Row label="Token">USDC</Row>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Subscription detail */}
            {isCharge && chargeArgs && subState && (
              <Card>
                <CardHeader>
                  <CardTitle>Subscription</CardTitle>
                </CardHeader>
                <CardContent>
                  <Row label="Subscription ID" mono>
                    {fmtAddr(chargeArgs.subscriptionId)}
                  </Row>
                  {subContext && (
                    <>
                      <Row label="Plan">{subContext.planName}</Row>
                      <Row label="Plan ID" mono>{fmtAddr(subContext.planId)}</Row>
                    </>
                  )}
                  <Row label="Period">{periodLabel(Number(subState.period))}</Row>
                  <Row label="Next charge">
                    {fmtNextCharge(Number(subState.nextChargeAt)).text}
                  </Row>
                  <Row label="Amount per charge">{fmt$(usdcDisplay(subState.amount))}</Row>
                  {subContext && (
                    <>
                      <Row label="Charges to date">
                        {subContext.chargeCount.toLocaleString()}
                      </Row>
                      <Row label="Total spent">{fmt$(subContext.totalPaid)}</Row>
                      <Row label="Spend cap">
                        {subContext.spendCap ? fmt$(subContext.spendCap) : "Unlimited"}
                      </Row>
                      <Row label="Status">
                        <StatusBadge status={subContext.status} />
                      </Row>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payroll detail */}
            {isPayroll && payrollArgs && (
              <Card>
                <CardHeader>
                  <CardTitle>Payroll</CardTitle>
                </CardHeader>
                <CardContent>
                  <Row label="Plan ID" mono>{fmtAddr(payrollArgs.planId)}</Row>
                  {payrollPlan && (
                    <Row label="Interval">{payrollPlan.intervalLabel}</Row>
                  )}
                  <Row label="Recipient ID" mono>{fmtAddr(payrollArgs.recipientId)}</Row>
                  <Row label="Next payment">
                    {fmtNextCharge(Number(payrollArgs.nextPayAt)).text}
                  </Row>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Parties ────────────────────────────────────────────────────── */}
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Parties</CardTitle>
          </CardHeader>
          <CardContent>
            {isCharge && chargeArgs && subState && (
              <>
                <Row label="Customer">
                  <AddrLink addr={chargeArgs.customer} />
                </Row>
                <Row label="Merchant">
                  <AddrLink addr={subState.merchant} />
                </Row>
                <Row label="Executor">
                  <AddrLink addr={chargeArgs.executor} />
                </Row>
              </>
            )}
            {isPayroll && payrollArgs && (
              <>
                <Row label="Recipient">
                  <AddrLink addr={payrollArgs.recipient} />
                </Row>
                <Row label="Executor">
                  <AddrLink addr={payrollArgs.executor} />
                </Row>
              </>
            )}
            {!isCharge && !isPayroll && (
              <Row label="From">
                <AddrLink addr={tx.from} />
              </Row>
            )}
            {tx.to && (
              <Row label={isCharge || isPayroll ? "Contract" : "To"}>
                <AddrLink addr={tx.to} />
              </Row>
            )}
          </CardContent>
        </Card>

        {/* ── Chain details ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Chain</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Block">
              {explorerBase ? (
                <a
                  href={`${explorerBase}/block/${receipt.blockNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  #{receipt.blockNumber.toString()}
                </a>
              ) : (
                `#${receipt.blockNumber.toString()}`
              )}
            </Row>
            <Row label="Block hash" mono>{receipt.blockHash}</Row>
            <Row label="Timestamp">
              {timestamp.toISOString().replace("T", " ").replace(".000Z", " UTC")}
              <span className="ml-1.5 text-xs text-muted-foreground">
                (unix {Number(block.timestamp).toLocaleString()})
              </span>
            </Row>
            <Row label="Transaction index">{receipt.transactionIndex}</Row>
            <Row label="Nonce">{tx.nonce}</Row>
            <Row label="Gas used">
              {gasUsed.toLocaleString()} / {gasLimit.toLocaleString()}
              <span className="ml-1.5 text-xs text-muted-foreground">({gasPct}%)</span>
            </Row>
            <Row label="Effective gas price">
              {formatGwei(receipt.effectiveGasPrice)} Gwei
            </Row>
            {tx.maxFeePerGas !== undefined && tx.maxFeePerGas !== null && (
              <Row label="Max fee per gas">{formatGwei(tx.maxFeePerGas)} Gwei</Row>
            )}
            {tx.maxPriorityFeePerGas !== undefined && tx.maxPriorityFeePerGas !== null && (
              <Row label="Priority fee">{formatGwei(tx.maxPriorityFeePerGas)} Gwei</Row>
            )}
            <Row label="Transaction fee">{formatEther(txFeeWei)} ETH</Row>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
