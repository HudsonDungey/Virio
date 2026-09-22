import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { settlementsByWallet } from "@/lib/billing-reads";
import { isBillingConfigured } from "@/lib/billing-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Settlements against a wallet's authorizations, newest first. Every row is a
/// transfer that happened on-chain — nothing here is projected or estimated.
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json([]);
  }
  if (!isBillingConfigured()) {
    return NextResponse.json([]);
  }

  const settlements = await settlementsByWallet(wallet as Hex);
  return NextResponse.json(
    settlements.map((s) => ({
      id: s.id,
      authorizationId: s.authorizationId,
      module: s.module,
      executor: s.executor,
      gross: s.gross.toString(),
      merchantAmount: s.merchantAmount.toString(),
      executorFee: s.executorFee.toString(),
      protocolFee: s.protocolFee.toString(),
      periodStart: Number(s.periodStart),
      txHash: s.txHash,
      blockNumber: s.blockNumber.toString(),
      timestamp: s.timestamp,
    })),
  );
}
