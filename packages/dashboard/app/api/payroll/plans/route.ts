import { NextRequest, NextResponse } from "next/server";
import { listPayrollPlans } from "@/lib/payroll-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const employer = req.nextUrl.searchParams.get("employer") ?? undefined;
  try {
    const plans = await listPayrollPlans(employer);
    return NextResponse.json(plans);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
