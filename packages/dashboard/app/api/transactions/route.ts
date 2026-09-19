import { NextResponse } from "next/server";
import { ensureSchedulerStarted } from "@/lib/scheduler";
import { transactionsByWallet } from "@/lib/chain-reads";
import { payrollTransactionsByWallet } from "@/lib/payroll-reads";
import type { Hex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Returns all transactions (subscription charges + payroll executions) where the
/// wallet is involved, as either payer (out) or payee (in). No wallet param → empty list.
export async function GET(req: Request) {
  ensureSchedulerStarted();
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json([]);
  }
  // One source being unavailable must not hide valid history from the other.
  const [subResult, payrollResult] = await Promise.allSettled([
    transactionsByWallet(wallet as Hex),
    payrollTransactionsByWallet(wallet),
  ]);
  const subTxns = subResult.status === "fulfilled" ? subResult.value : [];
  const payrollTxns = payrollResult.status === "fulfilled" ? payrollResult.value : [];
  const merged = [...subTxns, ...payrollTxns].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return NextResponse.json(merged);
}
