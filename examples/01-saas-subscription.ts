/// Example 1 — SaaS subscription
///
///   Virio Pro, $20 USDC per month.
///   Maximum $20 per month, so the merchant can never take more than one
///   month's price in a month even if it tries.
///
/// Run:  node --import tsx examples/01-saas-subscription.ts

import { clientFor, addressOf, approveRegistry, printBudget, TOKEN } from "./shared.js";

async function main() {
  const merchant = clientFor("MERCHANT_PRIVATE_KEY");
  const payer = clientFor("PAYER_PRIVATE_KEY");
  const merchantAddress = addressOf("MERCHANT_PRIVATE_KEY");

  // ── 1. Merchant publishes the price ────────────────────────────────────────
  // A plan is an offer. Creating it grants nothing and moves nothing.
  console.log("merchant: publishing Virio Pro at $20/month…");
  const { planId } = await merchant.billing.createPlan({
    token: TOKEN,
    amount: 20_000_000n, // $20.00 at 6 decimals
    period: 2_592_000n, // 30 days
  });
  console.log(`  planId ${planId}`);

  // ── 2. Payer approves the registry ─────────────────────────────────────────
  // Three months' worth, so the subscription survives a few cycles without
  // another approval. The authorization's caps still bound what can be taken.
  await approveRegistry(payer, 60_000_000n);

  // ── 3. Payer authorizes and subscribes ─────────────────────────────────────
  // billing.create does both: it authorizes with the limits below, then binds
  // that authorization to the plan.
  console.log("\npayer: authorizing $20/month and subscribing…");
  const billing = await payer.billing.create({
    type: "recurring",
    merchant: merchantAddress,
    amount: "20.00",
    interval: "month",
    token: TOKEN,
    limits: {
      maxPerCharge: "20.00",
      monthlyCap: "20.00",
    },
    planId,
  });
  console.log(`  authorizationId ${billing.authorizationId}`);
  console.log(`  subscriptionId  ${billing.subscriptionId}`);

  await printBudget(payer, billing.authorizationId, "after authorizing");

  // ── 4. Anyone charges it ───────────────────────────────────────────────────
  // charge() is permissionless: the caller pays gas and earns the executor fee.
  // In production this is a keeper bot, not the merchant. Here the merchant
  // charges its own subscription, which the protocol allows precisely because
  // it does not care who submits the transaction.
  const { ok, reason } = await merchant.billing.chargeable(billing.subscriptionId!);
  console.log(`\nchargeable now: ${ok}${ok ? "" : ` (reason ${reason})`}`);

  if (ok) {
    console.log("executor: charging…");
    const txHash = await merchant.billing.charge(billing.subscriptionId!);
    console.log(`  tx ${txHash}`);
    await printBudget(payer, billing.authorizationId, "after the first charge");
  }

  // ── 5. The monthly cap is real ─────────────────────────────────────────────
  // A second charge inside the same month would exceed the $20 cap. The
  // subscription's own due date blocks it first, and the registry's cap would
  // block it even if the due date did not.
  const second = await merchant.billing.chargeable(billing.subscriptionId!);
  console.log(`\nsecond charge this month allowed: ${second.ok} (reason ${second.reason})`);

  // ── 6. The payer can always get out ────────────────────────────────────────
  console.log("\npayer: revoking…");
  await payer.billing.revoke(billing.authorizationId);
  await printBudget(payer, billing.authorizationId, "after revoking");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
