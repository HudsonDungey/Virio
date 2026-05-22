import { NextResponse } from "next/server";
import { ensureSchedulerStarted } from "@/lib/scheduler";
import { listSubscriptions, plansByMerchant } from "@/lib/chain-reads";
import type { Hex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Returns subscriptions paying the given merchant. With no merchant param,
/// returns an empty list — the UI prompts for a wallet connection.
export async function GET(req: Request) {
  ensureSchedulerStarted();
  const merchant = new URL(req.url).searchParams.get("merchant");
  if (!merchant || !/^0x[0-9a-fA-F]{40}$/.test(merchant)) {
    return NextResponse.json([]);
  }
  const merchantPlans = await plansByMerchant(merchant as Hex);
  if (merchantPlans.length === 0) return NextResponse.json([]);
  const planIds = new Set(merchantPlans.map((p) => p.id.toLowerCase()));
  const allSubs = await listSubscriptions();
  return NextResponse.json(allSubs.filter((s) => planIds.has(s.planId.toLowerCase())));
}

/// On Sepolia, subscribing must be signed by the customer's connected wallet.
/// This endpoint now only records off-chain subscription metadata (createdAt)
/// after the on-chain `Subscribed` event has fired.
export async function POST(req: Request) {
  ensureSchedulerStarted();
  const { getStore } = await import("@/lib/store");
  const store = getStore();
  const b = (await req.json().catch(() => ({}))) as { subscriptionId?: string };
  if (!b.subscriptionId || !/^0x[0-9a-fA-F]{64}$/.test(b.subscriptionId)) {
    return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 });
  }
  store.subMeta.set(b.subscriptionId.toLowerCase(), { createdAt: new Date().toISOString() });
  return NextResponse.json({ ok: true }, { status: 201 });
}
