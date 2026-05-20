import { NextResponse } from "next/server";
import { getVirioConfig } from "@/lib/config";
import { getStore } from "@/lib/store";
import { ensureSchedulerStarted } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  ensureSchedulerStarted();
  const cfg = getVirioConfig();
  const store = getStore();
  return NextResponse.json({
    testMode: store.state.testMode,
    testIntervals: cfg.testIntervals,
    productionIntervals: cfg.productionIntervals,
  });
}

export async function POST(req: Request) {
  ensureSchedulerStarted();
  const body = (await req.json().catch(() => ({}))) as { testMode?: boolean };
  const store = getStore();
  if (typeof body.testMode === "boolean") store.state.testMode = body.testMode;
  return NextResponse.json({ testMode: store.state.testMode });
}
