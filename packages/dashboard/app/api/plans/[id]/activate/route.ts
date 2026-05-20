import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // VirioSubscriptionManager.deactivatePlan is one-way. To re-enable a plan
  // the merchant must call createPlan again (it'll get a new planId).
  return NextResponse.json(
    {
      error:
        "Plans cannot be reactivated on-chain — create a new plan instead. " +
        "(VirioSubscriptionManager.deactivatePlan is one-way by design.)",
    },
    { status: 400 },
  );
}
