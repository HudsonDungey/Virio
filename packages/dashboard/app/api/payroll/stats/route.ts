import { NextRequest, NextResponse } from "next/server";
import { payrollStats } from "@/lib/payroll-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const employer = req.nextUrl.searchParams.get("employer") ?? undefined;
  try {
    const stats = await payrollStats(employer);
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
