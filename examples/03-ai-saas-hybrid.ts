/// Example 3 — AI SaaS, hybrid
///
///   ExampleAI Pro, $20 USDC per month.
///   10,000 API requests included; $0.001 per request after that.
///   Absolute maximum $50 per month, base and overage combined.
///
/// The point of this example: there is no hybrid contract. A hybrid plan is
/// ONE authorization that both the recurring and metered modules settle
/// against, so the $50 ceiling covers both halves automatically.
///
/// Run:  node --import tsx examples/03-ai-saas-hybrid.ts

import { clientFor, addressOf, approveRegistry, printBudget, TOKEN } from "./shared.js";

const INCLUDED_UNITS = 10_000n;

async function main() {
  const merchant = clientFor("MERCHANT_PRIVATE_KEY");
  const payer = clientFor("PAYER_PRIVATE_KEY");
  const merchantAddress = addressOf("MERCHANT_PRIVATE_KEY");

  // ── 1. Merchant publishes both halves ──────────────────────────────────────
  console.log("merchant: publishing the $20/month base plan…");
  const { planId } = await merchant.billing.createPlan({
    token: TOKEN,
    amount: 20_000_000n,
    period: 2_592_000n,
  });

  console.log("merchant: publishing the overage meter ($0.001, 10,000 included)…");
  const { meterId } = await merchant.billing.createMeter({
    token: TOKEN,
    unit: "api_request",
    unitPrice: 1_000n, // $0.001
    includedUnitsPerPeriod: INCLUDED_UNITS,
    settlementInterval: 86_400n,
  });

  // ── 2. One authorization for both ──────────────────────────────────────────
  // billingType "hybrid" is what lets both modules settle against it, and the
  // $50 monthly cap is shared between them.
  await approveRegistry(payer, 50_000_000n);

  console.log("\npayer: authorizing $50/month across base and overage…");
  const billing = await payer.billing.create({
    type: "hybrid",
    merchant: merchantAddress,
    base: { amount: "20.00", interval: "month" },
    usage: {
      unit: "api_request",
      pricePerUnit: "0.001",
      includedUnits: Number(INCLUDED_UNITS),
    },
    token: TOKEN,
    limits: {
      maxPerCharge: "30.00",
      monthlyCap: "50.00",
    },
    planId,
    meterId,
  });
  const { authorizationId, subscriptionId } = billing;
  console.log(`  authorizationId ${authorizationId}`);
  console.log(`  subscriptionId  ${subscriptionId}`);

  // ── 3. The base charge ─────────────────────────────────────────────────────
  const due = await merchant.billing.chargeable(subscriptionId!);
  if (due.ok) {
    console.log("\nexecutor: charging the $20 base…");
    await merchant.billing.charge(subscriptionId!);
    await printBudget(payer, authorizationId, "after the base charge");
  }

  // ── 4. Usage, including the free allowance ─────────────────────────────────
  // 14,000 requests: the first 10,000 are included, so only 4,000 are billable
  // — $4.00. The SDK applies the allowance; the contract verifies that the
  // signed amount equals billable units x price.
  console.log("\nserving 14,000 API requests (10,000 included)…");
  for (let i = 0; i < 14_000; i++) {
    await merchant.usage.record({
      authorizationId,
      meterId,
      quantity: 1,
      idempotencyKey: `req_${i}`,
    });
  }

  const summary = await merchant.usage.get({ authorizationId, meterId, period: "current" });
  console.log(`  used          : ${summary.units}`);
  console.log(`  billable      : ${summary.billableUnits}  (after the included allowance)`);
  console.log(`  overage       : $${summary.accruedAmount}`);

  // ── 5. Settle the overage against the same authorization ───────────────────
  console.log("\nmerchant: signing the overage statement…");
  const signed = await merchant.usage.signNextStatement({ authorizationId, meterId });
  if (signed) {
    const { ok, reason } = await merchant.billing.settleable(signed.statement);
    console.log(`  settleable: ${ok}${ok ? "" : ` (reason ${reason})`}`);
    if (ok) {
      await merchant.billing.settleStatement(signed);
      await printBudget(payer, authorizationId, "after base + overage");
    }
  }

  // ── 6. The shared ceiling ──────────────────────────────────────────────────
  // Base and overage draw on one $50 budget. Whatever the usage, the payer
  // cannot be charged past it — and the registry, not either module, is what
  // enforces that.
  const remaining = await payer.billing.remaining(authorizationId);
  const decimals = await payer.billing.tokenDecimals();
  const left = remaining.thisPeriod === null ? null : Number(remaining.thisPeriod) / 10 ** decimals;
  console.log(
    `\nremaining this month: ${left === null ? "uncapped" : `$${left.toFixed(2)}`} of the $50 ceiling`,
  );
  console.log("base and overage share it — neither module can spend past it.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
