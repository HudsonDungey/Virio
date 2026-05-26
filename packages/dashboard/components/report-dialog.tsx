"use client";

import * as React from "react";
import { Download, ArrowDownLeft, ArrowUpRight, Landmark, Receipt } from "lucide-react";
import { useAccount } from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { fmt$, fmtAddr } from "@/lib/format";
import type { TaxReport, ReportRange } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const RANGES: { key: ReportRange; label: string }[] = [
  { key: "1m",       label: "1 Month"  },
  { key: "6m",       label: "6 Months" },
  { key: "1y",       label: "1 Year"   },
  { key: "lifetime", label: "Lifetime" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtPeriod(start: string, range: ReportRange): string {
  if (range === "lifetime") return "All time";
  return `${fmtDate(start)} → now`;
}

function toCsv(report: TaxReport): string {
  const header = [
    "Date",
    "Type",
    "Plan",
    "Counterparty",
    "Direction",
    "Gross (USDC)",
    "Net Amount (USDC)",
    "Protocol Fee (USDC)",
    "Executor Fee (USDC)",
    "Tx Hash",
  ].join(",");

  const rows = report.entries.map((e) =>
    [
      new Date(e.timestamp).toISOString(),
      e.type,
      `"${e.planName}"`,
      e.counterparty,
      e.direction,
      e.gross.toFixed(2),
      e.netAmount.toFixed(2),
      e.protocolFee.toFixed(2),
      e.executorFee.toFixed(2),
      e.txHash,
    ].join(","),
  );

  return [header, ...rows].join("\n");
}

function downloadCsv(report: TaxReport): void {
  const csv = toCsv(report);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `virio-report-${report.range}-${report.wallet.slice(2, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportDialog({ open, onOpenChange }: Props) {
  const { address } = useAccount();
  const [range, setRange] = React.useState<ReportRange>("1m");
  const [report, setReport] = React.useState<TaxReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch whenever range or wallet changes while open.
  React.useEffect(() => {
    if (!open || !address) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<TaxReport>("GET", `/api/report?wallet=${address}&range=${range}`)
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, address, range]);

  // Reset on close.
  React.useEffect(() => {
    if (!open) { setReport(null); setError(null); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,960px)]">
        <DialogHeader title="Transaction report" onClose={() => onOpenChange(false)} />

        <DialogBody className="space-y-5">
          {/* Range picker */}
          <div className="flex gap-2">
            {RANGES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={[
                  "rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
                  range === key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && report && (
            <>
              {/* Period label */}
              <p className="text-xs text-muted-foreground">
                {fmtPeriod(report.periodStart, report.range)}
                {" · "}
                {report.totalTx} transaction{report.totalTx !== 1 ? "s" : ""}
                {" · "}
                {address ? fmtAddr(address) : ""}
              </p>

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCard
                  label="Gross in"
                  value={report.grossIn}
                  icon={<ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />}
                />
                <SummaryCard
                  label="Net income"
                  value={report.netIn}
                  icon={<Receipt className="h-3.5 w-3.5 text-emerald-400" />}
                  sub="after fees"
                />
                <SummaryCard
                  label="Total out"
                  value={report.grossOut}
                  icon={<ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />}
                />
                <SummaryCard
                  label="Fees deducted"
                  value={report.feesOnInflows}
                  icon={<Landmark className="h-3.5 w-3.5 text-muted-foreground" />}
                  sub="protocol + executor"
                />
              </div>

              {/* Transaction table */}
              {report.entries.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No protocol interactions in this period.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Counterparty</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Protocol fee</TableHead>
                        <TableHead className="text-right">Executor fee</TableHead>
                        <TableHead>Dir</TableHead>
                        <TableHead>Tx</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.entries.map((e) => (
                        <TableRow key={e.txHash}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {fmtDate(e.timestamp)}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {e.type}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate text-sm font-medium">
                            {e.planName}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {fmtAddr(e.counterparty)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt$(e.gross)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt$(e.netAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {fmt$(e.protocolFee)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {fmt$(e.executorFee)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                e.direction === "in"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-rose-500/10 text-rose-400",
                              ].join(" ")}
                            >
                              {e.direction === "in" ? (
                                <ArrowDownLeft className="h-3 w-3" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3" />
                              )}
                              {e.direction}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {e.txHash.slice(0, 10)}…
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {report && report.entries.length > 0 && (
            <Button variant="brand" onClick={() => downloadCsv(report)}>
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="mt-2 font-display text-xl font-semibold tabular-nums text-foreground">
        {fmt$(value)}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
