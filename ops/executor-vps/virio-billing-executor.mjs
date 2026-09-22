#!/usr/bin/env node
// Executor for the Virio programmable billing stack (recurring + metered).
//
// Deliberately a standalone script with no dependency on the monorepo, matching
// its sibling virio-executor.mjs — a VPS operator should be able to run an
// executor without checking out the whole repo.
// @virio/scheduler's BillingExecutor is the same logic for callers who already
// have the SDK.
//
// What it does each tick:
//   1. index Subscribed / SubscriptionCancelled to learn the candidate set
//   2. ask chargeable() which are due AND still within the payer's limits
//   3. charge those, earning the executor fee
//   4. settle any merchant-signed statements handed to it (see below)
//
// Metered settlement needs a statement only the merchant can sign, so this
// executor fetches pending statements from a merchant-run endpoint when
// VIRIO_STATEMENTS_URL is set. Without it, the executor runs recurring only.
//
// Safety note: none of the checks here protect anyone. Spend caps, replay
// protection and double-charge protection are enforced on chain. These checks
// exist to avoid paying gas for a transaction that would revert.

import { createPublicClient, createWalletClient, http, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const required = ["VIRIO_RPC_URL", "VIRIO_AUTHORIZATION_REGISTRY", "VIRIO_RECURRING_BILLING", "VIRIO_METERED_BILLING", "EXECUTOR_PRIVATE_KEY"];
for (const key of required) if (!process.env[key]) throw new Error(key + " is required");

const rpcUrl = process.env.VIRIO_RPC_URL;
const recurring = process.env.VIRIO_RECURRING_BILLING;
const metered = process.env.VIRIO_METERED_BILLING;
const deploymentBlock = BigInt(process.env.VIRIO_BILLING_DEPLOYMENT_BLOCK ?? "0");
const statementsUrl = process.env.VIRIO_STATEMENTS_URL ?? null;
const pollMs = Number(process.env.EXECUTOR_POLL_MS ?? "30000");
const confirmations = BigInt(process.env.EXECUTOR_CONFIRMATIONS ?? "2");
const maxRange = BigInt(process.env.EXECUTOR_MAX_LOG_RANGE ?? "2000");
const maxCharges = Number(process.env.EXECUTOR_MAX_CHARGES_PER_TICK ?? "25");
const statePath = process.env.EXECUTOR_STATE_PATH ?? "/var/lib/virio-executor/billing-state.json";
const healthPort = Number(process.env.EXECUTOR_HEALTH_PORT ?? "9465");

for (const [name, value] of [["VIRIO_RECURRING_BILLING", recurring], ["VIRIO_METERED_BILLING", metered]]) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(name + " must be an address");
}
if (!/^0x[0-9a-fA-F]{64}$/.test(process.env.EXECUTOR_PRIVATE_KEY)) throw new Error("EXECUTOR_PRIVATE_KEY must be a 0x-prefixed 32-byte key");
if (!Number.isFinite(pollMs) || pollMs < 1000) throw new Error("EXECUTOR_POLL_MS must be at least 1000");

const account = privateKeyToAccount(process.env.EXECUTOR_PRIVATE_KEY);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, transport: http(rpcUrl) });

const subscribedEvent = parseAbiItem("event Subscribed(bytes32 indexed subscriptionId, bytes32 indexed planId, bytes32 indexed authorizationId, address payer, uint128 amount, uint64 period)");
const cancelledEvent = parseAbiItem("event SubscriptionCancelled(bytes32 indexed subscriptionId, address indexed caller)");
const recurringAbi = [
  subscribedEvent,
  cancelledEvent,
  { type: "function", name: "chargeable", stateMutability: "view", inputs: [{ name: "subscriptionId", type: "bytes32" }], outputs: [{ name: "ok", type: "bool" }, { name: "reason", type: "bytes4" }] },
  { type: "function", name: "charge", stateMutability: "nonpayable", inputs: [{ name: "subscriptionId", type: "bytes32" }], outputs: [] },
];
const meteredAbi = [
  { type: "function", name: "settle", stateMutability: "nonpayable", inputs: [
    { name: "statement", type: "tuple", components: [
      { name: "meterId", type: "bytes32" }, { name: "authorizationId", type: "bytes32" },
      { name: "periodStart", type: "uint64" }, { name: "periodEnd", type: "uint64" },
      { name: "units", type: "uint128" }, { name: "unitPrice", type: "uint128" },
      { name: "amount", type: "uint128" }, { name: "nonce", type: "uint256" },
    ] },
    { name: "signature", type: "bytes" },
  ], outputs: [] },
  { type: "function", name: "settleable", stateMutability: "view", inputs: [
    { name: "statement", type: "tuple", components: [
      { name: "meterId", type: "bytes32" }, { name: "authorizationId", type: "bytes32" },
      { name: "periodStart", type: "uint64" }, { name: "periodEnd", type: "uint64" },
      { name: "units", type: "uint128" }, { name: "unitPrice", type: "uint128" },
      { name: "amount", type: "uint128" }, { name: "nonce", type: "uint256" },
    ] },
  ], outputs: [{ name: "ok", type: "bool" }, { name: "reason", type: "bytes4" }] },
];

let state = { lastScannedBlock: (deploymentBlock > 0n ? deploymentBlock - 1n : 0n).toString(), subscriptions: [] };
let status = { startedAt: new Date().toISOString(), lastTickAt: null, lastSuccessAt: null, lastError: null, charges: 0, settlements: 0 };
let ticking = false;

async function loadState() {
  try { state = JSON.parse(await readFile(statePath, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
async function saveState() {
  await mkdir(dirname(statePath), { recursive: true });
  const temporary = statePath + ".tmp";
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
  await rename(temporary, statePath);
}

async function syncSubscriptions(head) {
  let cursor = BigInt(state.lastScannedBlock) + 1n;
  const active = new Set(state.subscriptions.map((id) => id.toLowerCase()));
  while (cursor <= head) {
    const toBlock = cursor + maxRange - 1n < head ? cursor + maxRange - 1n : head;
    const logs = await publicClient.getLogs({ address: recurring, events: [subscribedEvent, cancelledEvent], fromBlock: cursor, toBlock });
    logs.sort((a, b) => Number(a.blockNumber - b.blockNumber) || Number((a.logIndex ?? 0) - (b.logIndex ?? 0)));
    for (const log of logs) {
      const id = log.args.subscriptionId?.toLowerCase();
      if (!id) continue;
      if (log.eventName === "Subscribed") active.add(id);
      if (log.eventName === "SubscriptionCancelled") active.delete(id);
    }
    state.lastScannedBlock = toBlock.toString();
    cursor = toBlock + 1n;
  }
  state.subscriptions = [...active];
}

async function chargeDueSubscriptions() {
  const ids = state.subscriptions;
  if (ids.length === 0) return;

  // One multicall answers "is it due AND still within the payer's limits" for
  // every candidate, so we never pay gas to discover the answer.
  const results = await publicClient.multicall({ allowFailure: true, contracts: ids.map((subscriptionId) => ({
    address: recurring, abi: recurringAbi, functionName: "chargeable", args: [subscriptionId],
  })) });

  let submitted = 0;
  for (let index = 0; index < results.length && submitted < maxCharges; index += 1) {
    const result = results[index];
    if (result.status !== "success" || result.result[0] !== true) continue;
    const id = ids[index];
    try {
      const hash = await walletClient.writeContract({ address: recurring, abi: recurringAbi, functionName: "charge", args: [id] });
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      submitted += 1;
      status.charges += 1;
      console.log(JSON.stringify({ level: "info", event: "charged", subscriptionId: id, hash }));
    } catch (error) {
      // Nearly always a lost race with another executor: it charged first and
      // nextChargeAt moved past now. Nothing to repair.
      console.warn(JSON.stringify({ level: "warn", event: "charge_failed", subscriptionId: id, error: String(error).slice(0, 300) }));
    }
  }
}

async function settlePendingStatements() {
  if (!statementsUrl) return;

  let pending;
  try {
    const response = await fetch(statementsUrl, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    pending = await response.json();
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", event: "statements_fetch_failed", error: String(error).slice(0, 300) }));
    return;
  }
  if (!Array.isArray(pending)) return;

  let submitted = 0;
  for (const entry of pending) {
    if (submitted >= maxCharges) break;
    // Statements come from a merchant-run endpoint — untrusted input. Shape it
    // before use; the contract rejects anything malformed anyway, but a bad
    // entry should not take the tick down.
    const statement = normalizeStatement(entry?.statement);
    if (!statement || typeof entry.signature !== "string") continue;

    try {
      const [ok] = await publicClient.readContract({ address: metered, abi: meteredAbi, functionName: "settleable", args: [statement] });
      if (!ok) continue;
      const hash = await walletClient.writeContract({ address: metered, abi: meteredAbi, functionName: "settle", args: [statement, entry.signature] });
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      submitted += 1;
      status.settlements += 1;
      console.log(JSON.stringify({ level: "info", event: "settled", meterId: statement.meterId, nonce: statement.nonce.toString(), hash }));
    } catch (error) {
      console.warn(JSON.stringify({ level: "warn", event: "settlement_failed", meterId: statement.meterId, error: String(error).slice(0, 300) }));
    }
  }
}

function normalizeStatement(raw) {
  if (!raw || typeof raw !== "object") return null;
  try {
    return {
      meterId: raw.meterId, authorizationId: raw.authorizationId,
      periodStart: BigInt(raw.periodStart), periodEnd: BigInt(raw.periodEnd),
      units: BigInt(raw.units), unitPrice: BigInt(raw.unitPrice),
      amount: BigInt(raw.amount), nonce: BigInt(raw.nonce),
    };
  } catch { return null; }
}

async function tick() {
  if (ticking) return;
  ticking = true;
  status.lastTickAt = new Date().toISOString();
  try {
    const latest = await publicClient.getBlockNumber();
    const finalizedHead = latest > confirmations ? latest - confirmations : 0n;
    if (finalizedHead >= deploymentBlock) await syncSubscriptions(finalizedHead);
    await chargeDueSubscriptions();
    await settlePendingStatements();
    await saveState();
    status.lastSuccessAt = new Date().toISOString();
    status.lastError = null;
  } catch (error) {
    status.lastError = String(error).slice(0, 500);
    console.error(JSON.stringify({ level: "error", event: "tick_failed", error: status.lastError }));
  } finally { ticking = false; }
}

createServer((request, response) => {
  if (request.url !== "/health") return response.writeHead(404).end();
  const healthy = status.lastSuccessAt !== null && !status.lastError;
  response.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify({ healthy, account: account.address, recurring, metered, trackedSubscriptions: state.subscriptions.length, ...status }));
}).listen(healthPort, "127.0.0.1", () => console.log("health server listening on 127.0.0.1:" + healthPort));

await loadState();
console.log(JSON.stringify({ level: "info", event: "started", account: account.address, recurring, metered, meteredSettlement: statementsUrl ? "enabled" : "disabled" }));
await tick();
setInterval(tick, pollMs);
