import { NextResponse } from "next/server";
import { ensureSchedulerStarted } from "@/lib/scheduler";
import { subscriptionsByWallet } from "@/lib/chain-reads";
import type { Hex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Returns all subscriptions where the wallet is either the merchant (plan creator)
/// or the customer (subscriber). With no wallet param, returns an empty list.
export async function GET(req: Request) {
  ensureSchedulerStarted();
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json([]);
  }
  return NextResponse.json(await subscriptionsByWallet(wallet as Hex));
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
