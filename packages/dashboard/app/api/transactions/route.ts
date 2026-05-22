import { NextResponse } from "next/server";
import { ensureSchedulerStarted } from "@/lib/scheduler";
import { transactionsByMerchant } from "@/lib/chain-reads";
import type { Hex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Transactions are scoped to the connected merchant. Without a merchant param,
/// returns an empty list so the UI prompts for wallet connection.
export async function GET(req: Request) {
  ensureSchedulerStarted();
  const url = new URL(req.url);
  const merchant = url.searchParams.get("merchant");
  if (!merchant || !/^0x[0-9a-fA-F]{40}$/.test(merchant)) {
    return NextResponse.json([]);
  }
  const planId = url.searchParams.get("planId")?.toLowerCase();
  const customer = url.searchParams.get("customer")?.toLowerCase();
  const status = url.searchParams.get("status");

  let result = await transactionsByMerchant(merchant as Hex);
  if (planId)   result = result.filter((t) => t.planId.toLowerCase() === planId);
  if (customer) result = result.filter((t) => t.customer.toLowerCase().includes(customer));
  if (status)   result = result.filter((t) => t.status === status);
  return NextResponse.json(result);
}
