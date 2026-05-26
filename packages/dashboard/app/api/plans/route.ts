import { NextResponse } from "next/server";
import { ensureSchedulerStarted } from "@/lib/scheduler";
import { plansByMerchant, planById } from "@/lib/chain-reads";
import type { Hex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Plans are scoped to a merchant address. Merchants only see what they created;
/// passing no merchant returns an empty list (UI prompts for wallet connection).
export async function GET(req: Request) {
  ensureSchedulerStarted();
  const params = new URL(req.url).searchParams;

  const id = params.get("id");
  if (id) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) {
      return NextResponse.json({ error: "invalid plan id" }, { status: 400 });
    }
    const plan = await planById(id as Hex);
    return plan ? NextResponse.json(plan) : NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const merchant = params.get("merchant");
  if (!merchant || !/^0x[0-9a-fA-F]{40}$/.test(merchant)) {
    return NextResponse.json([]);
  }
  const plans = await plansByMerchant(merchant as Hex);
  return NextResponse.json(plans);
}

/// POST /api/plans previously signed `manager.createPlan` from the deployer's
/// private key (anvil flow). On Sepolia, plan creation must be signed by the
/// connected merchant wallet — see `lib/api-write.ts` + `usePlanWrite()`.
/// This endpoint now only accepts the off-chain metadata (name, description,
/// intervalLabel) AFTER the on-chain tx has confirmed, so we can show readable
/// names instead of `Plan 0x12345…` in the UI.
export async function POST(req: Request) {
  ensureSchedulerStarted();
  const { getStore } = await import("@/lib/store");
  const store = getStore();
  const b = (await req.json().catch(() => ({}))) as {
    planId?: string;
    name?: string;
    description?: string;
    intervalLabel?: string;
    intervalSeconds?: number;
    cancelAfterCharges?: number | null;
  };
  if (!b.planId || !/^0x[0-9a-fA-F]{64}$/.test(b.planId)) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }
  store.planMeta.set(b.planId.toLowerCase(), {
    name: String(b.name ?? ""),
    description: String(b.description ?? ""),
    intervalLabel: String(b.intervalLabel ?? `${b.intervalSeconds ?? 0}s`),
    cancelAfterCharges: b.cancelAfterCharges ? Number(b.cancelAfterCharges) : null,
    isTestInterval: Number(b.intervalSeconds ?? 0) < 300,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
