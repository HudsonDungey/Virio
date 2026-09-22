import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { authorizationsByWallet, authorizationRemaining } from "@/lib/billing-reads";
import { isBillingConfigured } from "@/lib/billing-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Every authorization where the wallet is the payer or the merchant, with the
/// headroom left under each cap. Amounts are returned as strings: these are
/// token base units and JSON has no bigint.
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json([]);
  }
  if (!isBillingConfigured()) {
    return NextResponse.json([]);
  }

  const authorizations = await authorizationsByWallet(wallet as Hex);
  const rows = await Promise.all(
    authorizations.map(async (authorization) => {
      const remaining = await authorizationRemaining(authorization.id);
      return {
        id: authorization.id,
        payer: authorization.payer,
        merchant: authorization.merchant,
        token: authorization.token,
        billingType: authorization.billingType,
        maxPerCharge: authorization.maxPerCharge.toString(),
        periodSpendCap: authorization.periodSpendCap.toString(),
        totalSpendCap: authorization.totalSpendCap.toString(),
        spentThisPeriod: authorization.spentThisPeriod.toString(),
        totalSpent: authorization.totalSpent.toString(),
        periodStart: Number(authorization.periodStart),
        periodDuration: Number(authorization.periodDuration),
        validAfter: Number(authorization.validAfter),
        validUntil: Number(authorization.validUntil),
        active: authorization.active,
        remainingThisPeriod: remaining.thisPeriod?.toString() ?? null,
        remainingLifetime: remaining.lifetime?.toString() ?? null,
      };
    }),
  );
  return NextResponse.json(rows);
}
