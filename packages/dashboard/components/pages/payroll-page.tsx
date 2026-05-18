"use client";

import * as React from "react";
import {
  Wallet,
  Users,
  CalendarClock,
  AlertTriangle,
  Plus,
  Zap,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { useToast } from "@/components/ui/toast";
import { usePayrollActions } from "@/lib/payroll-actions";
import { api } from "@/lib/api";
import { fmt$, fmtAddr, fmtTime, fmtNextCharge } from "@/lib/format";
import { listContainer, pageVariants } from "@/lib/motion";
import { CreatePayrollDialog } from "@/components/dialogs/create-payroll-dialog";
import { AddRecipientDialog } from "@/components/dialogs/add-recipient-dialog";
import type {
  IntervalDef,
  PayrollPlan,
  PayrollRecipient,
  PayrollExecution,
  PayrollStats,
} from "@/lib/types";
import type { Hex } from "viem";

interface PayrollPageProps {
  testMode: boolean;
  testIntervals: IntervalDef[];
  productionIntervals: IntervalDef[];
}

export function PayrollPage({ testIntervals, productionIntervals }: PayrollPageProps) {
  const { address } = useAccount();
  const { toast } = useToast();
  const actions = usePayrollActions();

  const [stats, setStats] = React.useState<PayrollStats | null>(null);
  const [plans, setPlans] = React.useState<PayrollPlan[]>([]);
  const [recipients, setRecipients] = React.useState<Record<string, PayrollRecipient[]>>({});
  const [executions, setExecutions] = React.useState<PayrollExecution[]>([]);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [addRecipientFor, setAddRecipientFor] = React.useState<Hex | null>(null);

  const employer = address?.toLowerCase();

  const refresh = React.useCallback(async () => {
    if (!employer) return;
    try {
      const [s, p, e] = await Promise.all([
        api<PayrollStats>("GET", `/api/payroll/stats?employer=${employer}`),
        api<PayrollPlan[]>("GET", `/api/payroll/plans?employer=${employer}`),
        api<PayrollExecution[]>("GET", `/api/payroll/executions?employer=${employer}`),
      ]);
      setStats(s);
      setPlans(p);
      setExecutions(e);

      const next: Record<string, PayrollRecipient[]> = {};
      for (const pl of p) {
        next[pl.id] = await api<PayrollRecipient[]>(
          "GET",
          `/api/payroll/recipients?planId=${pl.id}`,
        );
      }
      setRecipients(next);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("payroll refresh failed", err);
    }
  }, [employer]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function executePayroll(planId: Hex, recipientId: Hex, label: string) {
    if (!actions.account.address) return toast("Connect your wallet first", "error");
    setPendingAction(recipientId);
    try {
      toast(`Confirm payment to ${label} in your wallet…`, "success");
      await actions.executePayroll(planId, recipientId);
      toast(`Paid ${label}`, "success");
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPendingAction(null);
    }
  }

  async function payAllDue(plan: PayrollPlan) {
    if (!actions.account.address) return toast("Connect your wallet first", "error");
    const due =
      (recipients[plan.id] ?? []).filter(
        (r) => r.active && r.nextPayAt <= Math.floor(Date.now() / 1000),
      ).map((r) => r.id as Hex);
    if (due.length === 0) return toast("No recipients due", "error");

    setPendingAction(`batch-${plan.id}`);
    try {
      toast(`Confirm batch payroll for ${due.length} recipients…`, "success");
      await actions.executePayrollBatch(plan.id as Hex, due);
      toast(`Batch payroll executed (${due.length} recipients)`, "success");
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeRecipient(planId: Hex, recipientId: Hex) {
    setPendingAction(recipientId);
    try {
      toast("Confirm removal in your wallet…", "success");
      await actions.removeRecipient(planId, recipientId);
      toast("Recipient removed", "success");
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPendingAction(null);
    }
  }

  const hasPlans = plans.length > 0;
  const allRecipients = Object.values(recipients).flat();
  const activeRecipients = allRecipients.filter((r) => r.active).length;

  return (
    <motion.section
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12"
    >
      <PageHeader
        title="Payroll"
        subtitle={
          address
            ? `Connected as ${fmtAddr(address)} — recurring onchain distributions`
            : "Recurring onchain distributions to recipient registries"
        }
        action={
          <Button variant="brand" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Create payroll
          </Button>
        }
      />

      <motion.div
        variants={listContainer}
        initial="initial"
        animate="enter"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Payroll volume"
          value={stats?.totalVolume ?? 0}
          format="money"
          sub="Gross paid (USDC)"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Recipients"
          value={activeRecipients}
          format="int"
          sub="Across your plans"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Active plans"
          value={stats?.activePlans ?? 0}
          format="int"
          sub="Accepting recipients"
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          label="Failed batches"
          value={stats?.failedRecent ?? 0}
          format="int"
          sub="Recent partial-fail runs"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </motion.div>

      {!hasPlans ? (
        <Card className="mt-8">
          <EmptyState
            Icon={Users}
            title={address ? "No payroll plans yet" : "Connect a wallet"}
            description={
              address
                ? "Create a payroll plan to start paying employees and contractors on chain."
                : "Once connected, you'll see plans created by your wallet here."
            }
          />
        </Card>
      ) : (
        <div className="mt-8 space-y-6">
          {plans.map((plan) => {
            const planRecipients = recipients[plan.id] ?? [];
            const dueNow = planRecipients.filter(
              (r) => r.active && r.nextPayAt <= Math.floor(Date.now() / 1000),
            );
            return (
              <Card key={plan.id}>
                <CardHeader>
                  <div>
                    <CardTitle>
                      Plan {plan.id.slice(0, 10)}…{" "}
                      <Badge variant={plan.active ? "active" : "inactive"}>
                        {plan.intervalLabel}
                      </Badge>
                    </CardTitle>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {plan.recipientCount} recipient
                      {plan.recipientCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddRecipientFor(plan.id as Hex)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add recipient
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => payAllDue(plan)}
                      disabled={
                        pendingAction === `batch-${plan.id}` || dueNow.length === 0
                      }
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {pendingAction === `batch-${plan.id}`
                        ? "Confirming…"
                        : dueNow.length > 0
                          ? `Pay ${dueNow.length} due`
                          : "Nothing due"}
                    </Button>
                  </div>
                </CardHeader>
                {planRecipients.length === 0 ? (
                  <EmptyState
                    Icon={Users}
                    title="No recipients"
                    description="Add an employee or contractor wallet to this plan."
                    action={
                      <Button
                        size="sm"
                        onClick={() => setAddRecipientFor(plan.id as Hex)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add recipient
                      </Button>
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wallet</TableHead>
                        <TableHead className="text-right">Per cycle</TableHead>
                        <TableHead className="text-right">Total paid</TableHead>
                        <TableHead>Next pay</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {planRecipients.map((r) => {
                        const due = r.nextPayAt <= Math.floor(Date.now() / 1000);
                        const nc = fmtNextCharge(r.nextPayAt);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {fmtAddr(r.wallet)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmt$(r.amount)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmt$(r.totalPaid)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  due
                                    ? "font-medium text-[hsl(var(--warning))]"
                                    : "text-muted-foreground"
                                }
                              >
                                {nc.text}
                              </span>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={r.active ? "active" : "inactive"} />
                            </TableCell>
                            <TableCell className="text-right">
                              {r.active && due && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    executePayroll(
                                      plan.id as Hex,
                                      r.id as Hex,
                                      fmtAddr(r.wallet),
                                    )
                                  }
                                  disabled={pendingAction === r.id}
                                >
                                  <Zap className="h-3 w-3" />
                                  {pendingAction === r.id ? "…" : "Pay"}
                                </Button>
                              )}
                              {r.active && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    removeRecipient(plan.id as Hex, r.id as Hex)
                                  }
                                  disabled={pendingAction === r.id}
                                  className="ml-2"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent executions</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right">Fees</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {executions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No payroll executions yet for this wallet.
                </TableCell>
              </TableRow>
            ) : (
              executions.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {fmtAddr(e.recipient)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.planId.slice(0, 10)}…
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt$(e.gross)}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {fmt$(e.recipientAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmt$(e.executorFee + e.protocolFee)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtTime(new Date(e.timestamp * 1000).toISOString())}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <CreatePayrollDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        testIntervals={testIntervals}
        productionIntervals={productionIntervals}
        onCreated={refresh}
      />
      <AddRecipientDialog
        open={addRecipientFor !== null}
        onOpenChange={(v) => !v && setAddRecipientFor(null)}
        planId={addRecipientFor}
        onAdded={refresh}
      />
    </motion.section>
  );
}
