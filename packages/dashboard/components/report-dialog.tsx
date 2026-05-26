"use client";

import * as React from "react";
import { Download, ChevronDown, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { fmtAddr } from "@/lib/format";
import type { TaxReport, ReportRange } from "@/lib/types";

const RANGES: { key: ReportRange; label: string }[] = [
  { key: "1m",       label: "1 Month"  },
  { key: "6m",       label: "6 Months" },
  { key: "1y",       label: "1 Year"   },
  { key: "lifetime", label: "Lifetime" },
];

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
      `"${e.planName.replace(/"/g, '""')}"`,
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
  const blob = new Blob([toCsv(report)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `virio-report-${report.range}-${report.wallet.slice(2, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printPdf(report: TaxReport): void {
  const periodLabel =
    report.range === "lifetime"
      ? "All time"
      : `${new Date(report.periodStart).toLocaleDateString()} – ${new Date(report.periodEnd).toLocaleDateString()}`;

  const rows = report.entries
    .map(
      (e) => `
      <tr>
        <td>${new Date(e.timestamp).toLocaleString()}</td>
        <td>${e.type}</td>
        <td>${e.planName}</td>
        <td class="mono">${e.counterparty}</td>
        <td>${e.direction}</td>
        <td class="num">$${e.gross.toFixed(2)}</td>
        <td class="num">$${e.netAmount.toFixed(2)}</td>
        <td class="num">$${e.protocolFee.toFixed(2)}</td>
        <td class="num">$${e.executorFee.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Virio Report – ${report.wallet}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; font-size: 11px; color: #111; padding: 32px; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .meta { color: #555; font-size: 11px; margin-bottom: 24px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .card-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
  .card-value { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #f8fafc; text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #555; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: monospace; font-size: 9px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<h1>Virio Transaction Report</h1>
<div class="meta">
  Wallet: ${report.wallet} &nbsp;·&nbsp;
  Period: ${periodLabel} &nbsp;·&nbsp;
  Generated: ${new Date().toLocaleString()}
</div>
<div class="summary">
  <div class="card"><div class="card-label">Gross in</div><div class="card-value">$${report.grossIn.toFixed(2)}</div></div>
  <div class="card"><div class="card-label">Net income</div><div class="card-value">$${report.netIn.toFixed(2)}</div></div>
  <div class="card"><div class="card-label">Total out</div><div class="card-value">$${report.grossOut.toFixed(2)}</div></div>
  <div class="card"><div class="card-label">Fees deducted</div><div class="card-value">$${report.feesOnInflows.toFixed(2)}</div></div>
</div>
<table>
  <thead>
    <tr>
      <th>Date</th><th>Type</th><th>Plan</th><th>Counterparty</th>
      <th>Dir</th><th class="num">Gross</th><th class="num">Net</th>
      <th class="num">Protocol fee</th><th class="num">Executor fee</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export function ReportMenu() {
  const { address } = useAccount();
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<ReportRange>("1m");
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function download(format: "csv" | "pdf") {
    if (!address || loading) return;
    setOpen(false);
    setLoading(true);
    try {
      const report = await api<TaxReport>("GET", `/api/report?wallet=${address}&range=${range}`);
      if (format === "csv") downloadCsv(report);
      else printPdf(report);
    } finally {
      setLoading(false);
    }
  }

  if (!address) return null;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {loading ? "Generating…" : "Download report"}
        {!loading && <ChevronDown className="h-3 w-3 opacity-50" />}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-border bg-popover p-3 shadow-xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Period
          </p>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {RANGES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={[
                  "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors duration-150",
                  range === key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Format
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => download("csv")}
              className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-foreground/40 hover:text-foreground"
            >
              CSV
            </button>
            <button
              onClick={() => download("pdf")}
              className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-foreground/40 hover:text-foreground"
            >
              PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Keep alias so nothing else breaks if imported as ReportDialog
export { ReportMenu as ReportDialog };
