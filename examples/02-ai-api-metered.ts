/// Example 2 — AI API, usage-based
///
///   ExampleAI, $0.002 per API request.
///   Settled daily, at most $10 per settlement, at most $100 per month.
///
/// Shows the full metered loop: publish a price, authorize, record usage
/// off-chain as requests arrive, then settle one signed statement on chain.
///
/// Run:  node --import tsx examples/02-ai-api-metered.ts

import { clientFor, addressOf, approveRegistry, printBudget, TOKEN } from "./shared.js";
import { hashUnit } from "@virio/sdk";

async function main() {
  const merchant = clientFor("MERCHANT_PRIVATE_KEY");
  const payer = clientFor("PAYER_PRIVATE_KEY");
  const merchantAddress = addressOf("MERCHANT_PRIVATE_KEY");

  // ── 1. Merchant publishes the meter ────────────────────────────────────────
  // The unit price is immutable. Repricing means a new meter, so a customer's
  // authorization can never be re-pointed at a higher price behind their back.
  console.log("merchant: publishing an api_request meter at $0.002…");
  const { meterId } = await merchant.billing.createMeter({
    token: TOKEN,
    unit: "api_request",
    unitPrice: 2_000n, // $0.002 at 6 decimals
    settlementInterval: 86_400n, // daily
  });
  console.log(`  meterId ${meterId}  (unit hash ${hashUnit("api_request")})`);

  // ── 2. Payer authorizes a budget ───────────────────────────────────────────
  await approveRegistry(payer, 100_000_000n);

  console.log("\npayer: authorizing $10 per settlement, $100 per month…");
  const billing = await payer.billing.create({
    type: "metered",
    merchant: merchantAddress,
    meter: { unit: "api_request", pricePerUnit: "0.002" },
    settlement: { interval: "day" },
    token: TOKEN,
    limits: {
      maxPerCharge: "10.00",
      monthlyCap: "100.00",
    },
    meterId,
  });
  const { authorizationId } = billing;
  console.log(`  authorizationId ${authorizationId}`);

  // ── 3. Serve requests, recording usage off-chain ───────────────────────────
  // One on-chain transaction per API call would cost far more than the call is
  // worth, so usage accumulates off-chain and settles in batches.
  //
  // The idempotency key is the request id. A retried request records once.
  console.log("\nserving 1,827 API requests…");
  for (let i = 0; i < 1_827; i++) {
    await merchant.usage.record({
      authorizationId,
      meterId,
      quantity: 1,
      idempotencyKey: `req_${i}`,
    });
  }

  // A retry of a request we already served must not bill again.
  const retry = await merchant.usage.record({
    authorizationId,
    meterId,
    quantity: 1,
    idempotencyKey: "req_0",
  });
  console.log(`  retry of req_0 recorded again: ${retry.recorded}  (expected false)`);

  // ── 4. Read the accrual, with the arithmetic behind it ─────────────────────
  const summary = await merchant.usage.get({ authorizationId, meterId, period: "current" });
  console.log(`\naccrued so far`);
  console.log(`  units         : ${summary.units}`);
  console.log(`  unit price    : ${summary.unitPrice}`);
  console.log(`  accrued       : $${summary.accruedAmount}`);
  console.log(`  monthly cap   : $${summary.periodCap}`);
  console.log(`  remaining cap : $${summary.remainingCap}`);
  console.log(`  events        : ${summary.eventCount}`);

  // ── 5. Merchant signs a statement; anyone settles it ───────────────────────
  // The signature attests to the usage. It does not prove it happened — what
  // protects the payer is the fixed unit price and the caps above, both
  // enforced on chain. See docs/metered-billing for the full trust model.
  console.log("\nmerchant: signing the daily settlement statement…");
  const signed = await merchant.usage.signNextStatement({ authorizationId, meterId });
  if (!signed) {
    console.log("  nothing billable — no statement to settle");
    return;
  }
  console.log(`  ${signed.statement.units} units x ${signed.statement.unitPrice} = ${signed.statement.amount}`);

  const { ok, reason } = await merchant.billing.settleable(signed.statement);
  console.log(`  settleable: ${ok}${ok ? "" : ` (reason ${reason})`}`);

  if (ok) {
    console.log("executor: settling…");
    const txHash = await merchant.billing.settleStatement(signed);
    console.log(`  tx ${txHash}`);
    await printBudget(payer, authorizationId, "after settlement");
  }

  // ── 6. The same statement cannot settle twice ──────────────────────────────
  const replay = await merchant.billing.settleable(signed.statement);
  console.log(`\nreplay allowed: ${replay.ok} (reason ${replay.reason})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
