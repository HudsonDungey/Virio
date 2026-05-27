import { NextResponse } from "next/server";
import { ensureSchedulerStarted } from "@/lib/scheduler";
import { reportEntriesByWallet } from "@/lib/chain-reads";
import { payrollReportEntriesByWallet } from "@/lib/payroll-reads";
import type { Hex } from "viem";
import type { TaxReport, TaxReportEntry, ReportRange } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGE_SECONDS: Record<ReportRange, number | null> = {
  "1m":       30 * 24 * 3600,
  "6m":      182 * 24 * 3600,
  "1y":      365 * 24 * 3600,
  "lifetime": null,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(req: Request) {
  ensureSchedulerStarted();
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");
  const rangeParam = url.searchParams.get("range");

  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  const range: ReportRange =
    rangeParam && rangeParam in RANGE_SECONDS ? (rangeParam as ReportRange) : "1m";

  const nowUnix = Math.floor(Date.now() / 1000);
  const rangeSec = RANGE_SECONDS[range];
  const sinceUnix = rangeSec !== null ? nowUnix - rangeSec : 0;

  const [subEntries, payrollEntries] = await Promise.all([
    reportEntriesByWallet(wallet as Hex, sinceUnix),
    payrollReportEntriesByWallet(wallet, sinceUnix),
  ]);

  const entries: TaxReportEntry[] = [...subEntries, ...payrollEntries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  let grossIn = 0, netIn = 0, grossOut = 0, feesOnInflows = 0;
  for (const e of entries) {
    if (e.direction === "in") {
      grossIn += e.gross;
      netIn += e.netAmount;
      feesOnInflows += e.protocolFee + e.executorFee;
    } else {
      grossOut += e.gross;
    }
  }

  const report: TaxReport = {
    wallet,
    range,
    periodStart: new Date(sinceUnix * 1000).toISOString(),
    periodEnd: new Date(nowUnix * 1000).toISOString(),
    grossIn: round2(grossIn),
    netIn: round2(netIn),
    grossOut: round2(grossOut),
    feesOnInflows: round2(feesOnInflows),
    totalTx: entries.length,
    entries,
  };

  return NextResponse.json(report);
}
