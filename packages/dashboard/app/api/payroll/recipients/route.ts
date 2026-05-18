import { NextRequest, NextResponse } from "next/server";
import { listPayrollRecipients } from "@/lib/payroll-reads";

export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get("planId");
  if (!planId) {
    return NextResponse.json({ error: "planId required" }, { status: 400 });
  }
  try {
    const recipients = await listPayrollRecipients(planId);
    return NextResponse.json(recipients);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
