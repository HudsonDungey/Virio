import { NextResponse } from "next/server";
import { ensureSchedulerStarted } from "@/lib/scheduler";
import { merchantStats, transactionsByMerchant } from "@/lib/chain-reads";
import { usdcDisplay } from "@/lib/chain";
import { round2 } from "@/lib/store";
import type { Hex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY = {
  totalRevenue: 0,
  totalFees: 0,
  totalCharges: 0,
  activeSubs: 0,
  activePlans: 0,
  recentTransactions: [],
};

export async function GET(req: Request) {
  ensureSchedulerStarted();
  const merchant = new URL(req.url).searchParams.get("merchant");
  if (!merchant || !/^0x[0-9a-fA-F]{40}$/.test(merchant)) {
    return NextResponse.json(EMPTY);
  }

  const [stats, txs] = await Promise.all([
    merchantStats(merchant as Hex),
    transactionsByMerchant(merchant as Hex),
  ]);

  return NextResponse.json({
    totalRevenue: round2(usdcDisplay(stats.totalEarned)),
    totalFees: round2(usdcDisplay(stats.totalFeesPaid)),
    totalCharges: Number(stats.totalCharges),
    activeSubs: Number(stats.activeSubs),
    activePlans: Number(stats.activePlans),
    recentTransactions: txs.slice(0, 8),
  });
}
