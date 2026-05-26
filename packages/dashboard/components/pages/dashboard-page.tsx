"use client";

import * as React from "react";
import {
  TrendingUp,
  Users,
  Package,
  Landmark,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader, LiveBadge } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { IncomeChart } from "@/components/income-chart";
import { ReportDialog } from "@/components/report-dialog";
import { fmt$, fmtAddr, fmtTime } from "@/lib/format";
import { listContainer, pageVariants } from "@/lib/motion";
import type { PageKey } from "@/components/sidebar";
import type { Stats, Transaction } from "@/lib/types";

interface Props {
  stats: Stats | null;
  newTxIds: Set<string>;
  onNavigate: (p: PageKey) => void;
  onCreateProduct: () => void;
  onCreateSubscription: () => void;
}

export function DashboardPage({
  stats,
  newTxIds: _newTxIds,
  onNavigate: _onNavigate,
  onCreateProduct,
  onCreateSubscription: _onCreateSubscription,
}: Props) {
  const { address } = useAccount();
  const [reportOpen, setReportOpen] = React.useState(false);
  const recent: Transaction[] = stats?.recentTransactions ?? [];
  const revenue = stats?.totalRevenue ?? 0;
  const fees = stats?.totalFees ?? 0;
  const charges = stats?.totalCharges ?? 0;
  const activeSubs = stats?.activeSubs ?? 0;
  const activePlans = stats?.activePlans ?? 0;
  const failedTx = recent.filter((t) => t.status === "failed").length;

  return (
    <motion.section
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12"
    >
      <PageHeader
        title="Overview"
        subtitle={
          address
            ? `Connected as ${fmtAddr(address)} — live from the Virio manager`
            : "Live from the Virio manager"
        }
        action={
          <>
            <LiveBadge />
            {address && (
              <Button variant="ghost" onClick={() => setReportOpen(true)}>
                <FileText className="h-3.5 w-3.5" />
                Report
              </Button>
            )}
            <Button variant="brand" onClick={onCreateProduct}>
              <Plus className="h-3.5 w-3.5" />
              Create product
            </Button>
          </>
        }
      />

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />

      <motion.div
        variants={listContainer}
        initial="initial"
        animate="enter"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <StatCard
          label="Revenue"
          value={revenue}
          format="money"
          sub="Net to merchant (USDC)"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Protocol fees"
          value={fees}
          format="money"
          sub="To fee recipient"
          icon={<Landmark className="h-4 w-4" />}
        />
        <StatCard
          label="Charges"
          value={charges}
          format="int"
          sub="Settled onchain"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Active subscriptions"
          value={activeSubs}
          format="int"
          sub="Recurring customers"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Active plans"
          value={activePlans}
          format="int"
          sub="Accepting subscribers"
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          label="Failed charges"
          value={failedTx}
          format="int"
          sub="In recent window"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </motion.div>

      <div className="mt-8">
        <IncomeChart />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-16 text-center text-sm text-muted-foreground"
                >
                  No transactions yet — create a product and subscribe to start.
                </TableCell>
              </TableRow>
            ) : (
              recent.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {fmtAddr(t.counterparty)}
                  </TableCell>
                  <TableCell className="font-medium">{t.planName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt$(t.merchantAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmt$(t.fee)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtTime(t.timestamp)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </motion.section>
  );
}
