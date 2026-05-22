import { NextRequest, NextResponse } from "next/server";
import { listPayrollExecutions } from "@/lib/payroll-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const employer = req.nextUrl.searchParams.get("employer") ?? undefined;
  const planId = req.nextUrl.searchParams.get("planId") ?? undefined;
  try {
    const executions = await listPayrollExecutions({ employer, planId });
    return NextResponse.json(executions);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
