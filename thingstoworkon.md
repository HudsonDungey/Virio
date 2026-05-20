Findings

  1. Duplicate plans are almost certainly a dashboard event-cache bug, not the contract storing 4-5 plans.
     The contract stores plans by unique planId in a mapping, and createPlan() increments _planNonce once per successful transaction: contracts/src/
     VirioSubscriptionManager.sol:84. There is no on-chain list that can duplicate itself.
  2. syncEvents() is not concurrency-safe or idempotent.
     In packages/dashboard/lib/chain-reads.ts:53, multiple API requests can enter syncEvents() at the same time, all read the same lastSyncedBlock, all
     fetch the same logs, and all append them into planEvents: packages/dashboard/lib/chain-reads.ts:83.
     Since lastSyncedBlock is only updated after the scan finishes, parallel calls race each other.
  3. The UI creates exactly the kind of parallel reads that trigger this.
     refreshAll() calls fetchStats() and fetchPlans() without awaiting or sequencing them: packages/dashboard/components/dashboard-shell.tsx:109.
     /api/stats then calls listPlans(), listSubscriptions(), and listTransactions() in Promise.all: packages/dashboard/app/api/stats/route.ts:11. Those
     functions themselves call syncEvents() and some call listPlans() again. That can easily turn one PlanCreated log into 4-5 in-memory rows.
  4. Plans are being auto-refreshed today.
     packages/dashboard/components/dashboard-shell.tsx:129 polls refreshAll() every 2s in test mode or 10s otherwise, and refreshAll() includes
     fetchPlans(). So your “don’t auto refresh plans” requirement is currently violated.
  5. The dashboard API is also starting the scheduler from read endpoints.
     /api/plans calls ensureSchedulerStarted() on GET: packages/dashboard/app/api/plans/route.ts:8. Same pattern exists on stats/subscriptions/
     transactions. The scheduler should be a dedicated due-subscription executor, not coupled to plan reads.

  The bot direction is right at the contract level: subscriptions have nextChargeAt, and charge() enforces due timing. But the app should treat the bot

  Concrete Fix

  - Make event ingestion idempotent: store PlanCreated by planId, subscriptions by subId, charges by txHash or txHash + logIndex, instead of append-
    only arrays.
  - Serialize syncEvents() with an in-flight promise/mutex so concurrent API calls share one sync.
  - Stop polling plans. Fetch plans on initial load, after create/deactivate, and on manual refresh only.
  - Do not start the scheduler from /api/plans GET. Start it from one server bootstrap path or a dedicated worker.
  - Keep scheduler logic focused on dueSubscriptions() -> chargeOnce(subId); do not refresh/recreate plans as part of bot behavior.

  I did a static review only and did not mutate files or run tests.