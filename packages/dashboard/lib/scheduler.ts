import { getPulseConfig } from "./config";
import { getStore } from "./store";
import {
  duePayments,
  executePayment,
  executePaymentsBatch,
  type DuePayment,
} from "./chain-reads";
import { executorAddress, NETWORK, EXECUTOR_ADDRESS } from "./chain";
import type { Hex } from "viem";

// When the due set is at least this size, the scheduler dispatches a single
// executeBatch tx instead of one execute per payment. Batching saves gas but
// has a higher base cost — only pays off above a small threshold.
const BATCH_THRESHOLD = 3;

let running = false;

function fmtAge(seconds: number): string {
  if (seconds < 60)      return `${seconds}s`;
  if (seconds < 3_600)   return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400)  return `${Math.floor(seconds / 3_600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

async function processOne(item: DuePayment): Promise<void> {
  try {
    const hash = await executePayment(item.paymentId);
    // eslint-disable-next-line no-console
    console.log(
      `[scheduler] executed ${item.paymentId.slice(0, 10)}… (sub=${item.subId.slice(0, 10)}…, age=${fmtAge(item.ageSeconds)}) tx=${hash.slice(0, 10)}…`,
    );
  } catch (err) {
    // Most reverts here mean a contention loss (another keeper already
    // executed it for this period) or the executor was rate-limited
    // server-side. Silently skip the noisy ones; surface the real ones.
    const msg = (err as Error).message ?? String(err);
    if (/TooEarly|NotSubscribed|PaymentNotDue|PaymentNotRegistered/.test(msg)) return;
    // eslint-disable-next-line no-console
    console.warn(
      `[scheduler] execute failed for paymentId=${item.paymentId.slice(0, 10)}…`,
      msg.slice(0, 160),
    );
  }
}

async function processBatch(items: DuePayment[]): Promise<void> {
  const paymentIds: Hex[] = items.map((i) => i.paymentId);
  const oldest = items[0].ageSeconds;
  const newest = items[items.length - 1].ageSeconds;
  try {
    const hash = await executePaymentsBatch(paymentIds);
    // eslint-disable-next-line no-console
    console.log(
      `[scheduler] executed batch of ${items.length} (oldest=${fmtAge(oldest)}, newest=${fmtAge(newest)}) tx=${hash.slice(0, 10)}…`,
    );
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    // eslint-disable-next-line no-console
    console.warn(
      `[scheduler] batch execute failed (${items.length} items)`,
      msg.slice(0, 160),
    );
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const due = await duePayments();
    if (due.length === 0) return;

    // duePayments() returns oldest-first. Process the OLDEST items first —
    // they pay the highest dynamic fee (linear ramp up to 0.30% over 2 days).
    if (due.length >= BATCH_THRESHOLD) {
      await processBatch(due);
    } else {
      // For a small number of items the per-tx overhead is similar; do them
      // sequentially so we don't tie up the same wallet on parallel pending txs.
      for (const item of due) {
        await processOne(item);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[scheduler] tick error:", (err as Error).message);
  } finally {
    running = false;
    const store = getStore();
    const cfg = getPulseConfig();
    const delay = store.state.testMode ? cfg.scheduler.testTickMs : cfg.scheduler.productionTickMs;
    setTimeout(tick, delay);
  }
}

export function ensureSchedulerStarted() {
  const store = getStore();
  if (store.schedulerStarted) return;
  store.schedulerStarted = true;
  const wallet = executorAddress();
  if (!wallet) {
    // eslint-disable-next-line no-console
    console.warn(
      `[scheduler] EXECUTOR_PRIVATE_KEY not configured — automatic execution is OFF on ${NETWORK}. ` +
        "Set EXECUTOR_PRIVATE_KEY in .env.local (a dedicated EOA with a small amount of ETH for gas) to enable.",
    );
    return;
  }
  if (!EXECUTOR_ADDRESS || /^0x0+$/.test(EXECUTOR_ADDRESS)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[scheduler] contracts.executor not configured in pulse.local.json — bot will not run. ` +
        `Deploy PulseExecutor (see contracts/script/DeployExecutorSepolia.s.sol) and paste its address.`,
    );
    return;
  }
  // eslint-disable-next-line no-console
  console.log(
    `[scheduler] starting on ${NETWORK}, wallet=${wallet}, executor=${EXECUTOR_ADDRESS}`,
  );
  tick();
}
