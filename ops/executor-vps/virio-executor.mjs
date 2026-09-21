#!/usr/bin/env node
import { createPublicClient, createWalletClient, http, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const required = ["VIRIO_RPC_URL", "VIRIO_MANAGER_ADDRESS", "EXECUTOR_PRIVATE_KEY", "VIRIO_DEPLOYMENT_BLOCK"];
for (const key of required) if (!process.env[key]) throw new Error(key + " is required");

const rpcUrl = process.env.VIRIO_RPC_URL;
const manager = process.env.VIRIO_MANAGER_ADDRESS;
const deploymentBlock = BigInt(process.env.VIRIO_DEPLOYMENT_BLOCK);
const pollMs = Number(process.env.EXECUTOR_POLL_MS ?? "30000");
const confirmations = BigInt(process.env.EXECUTOR_CONFIRMATIONS ?? "2");
const maxRange = BigInt(process.env.EXECUTOR_MAX_LOG_RANGE ?? "2000");
const maxCharges = Number(process.env.EXECUTOR_MAX_CHARGES_PER_TICK ?? "25");
const maxSubscriptions = Number(process.env.EXECUTOR_MAX_SUBSCRIPTIONS_PER_TICK ?? "250");
const statePath = process.env.EXECUTOR_STATE_PATH ?? "/var/lib/virio-executor/state.json";
const healthPort = Number(process.env.EXECUTOR_HEALTH_PORT ?? "9464");

if (!/^0x[0-9a-fA-F]{40}$/.test(manager)) throw new Error("VIRIO_MANAGER_ADDRESS must be an address");
if (!/^0x[0-9a-fA-F]{64}$/.test(process.env.EXECUTOR_PRIVATE_KEY)) throw new Error("EXECUTOR_PRIVATE_KEY must be a 0x-prefixed 32-byte key");
if (!Number.isFinite(pollMs) || pollMs < 1000) throw new Error("EXECUTOR_POLL_MS must be at least 1000");

const account = privateKeyToAccount(process.env.EXECUTOR_PRIVATE_KEY);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
const subscribedEvent = parseAbiItem("event Subscribed(bytes32 indexed subscriptionId, bytes32 indexed planId, address indexed customer, uint256 totalSpendCap)");
const cancelledEvent = parseAbiItem("event Cancelled(bytes32 indexed subscriptionId, address indexed caller)");
const managerAbi = [
  subscribedEvent,
  cancelledEvent,
  { type: "function", name: "getSubscription", stateMutability: "view", inputs: [{ name: "subscriptionId", type: "bytes32" }], outputs: [{ type: "tuple", components: [
    { name: "customer", type: "address" }, { name: "merchant", type: "address" }, { name: "token", type: "address" },
    { name: "amount", type: "uint256" }, { name: "period", type: "uint256" }, { name: "nextChargeAt", type: "uint256" },
    { name: "totalSpendCap", type: "uint256" }, { name: "totalSpent", type: "uint256" }, { name: "active", type: "bool" },
  ] }] },
  { type: "function", name: "charge", stateMutability: "nonpayable", inputs: [{ name: "subscriptionId", type: "bytes32" }], outputs: [] },
];

let state = { lastScannedBlock: (deploymentBlock - 1n).toString(), subscriptions: [], scanOffset: 0 };
let status = { startedAt: new Date().toISOString(), lastTickAt: null, lastSuccessAt: null, lastError: null, lastChargeHash: null, charges: 0 };
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
    const logs = await publicClient.getLogs({ address: manager, events: [subscribedEvent, cancelledEvent], fromBlock: cursor, toBlock });
    logs.sort((a, b) => Number(a.blockNumber - b.blockNumber) || Number((a.logIndex ?? 0) - (b.logIndex ?? 0)));
    for (const log of logs) {
      const id = log.args.subscriptionId?.toLowerCase();
      if (!id) continue;
      if (log.eventName === "Subscribed") active.add(id);
      if (log.eventName === "Cancelled") active.delete(id);
    }
    state.lastScannedBlock = toBlock.toString();
    cursor = toBlock + 1n;
  }
  state.subscriptions = [...active];
}
async function chargeDueSubscriptions() {
  const allIds = state.subscriptions;
  const count = Math.min(allIds.length, maxSubscriptions);
  const offset = Number(state.scanOffset ?? 0) % (allIds.length || 1);
  const ids = Array.from({ length: count }, (_, index) => allIds[(offset + index) % allIds.length]);
  state.scanOffset = (offset + count) % (allIds.length || 1);
  if (ids.length === 0) return;
  const subscriptions = await publicClient.multicall({ allowFailure: true, contracts: ids.map((subscriptionId) => ({
    address: manager, abi: managerAbi, functionName: "getSubscription", args: [subscriptionId],
  })) });
  const now = BigInt(Math.floor(Date.now() / 1000));
  let submitted = 0;
  for (let index = 0; index < subscriptions.length && submitted < maxCharges; index += 1) {
    const result = subscriptions[index];
    if (result.status !== "success") continue;
    const subscription = result.result;
    if (!subscription.active || subscription.nextChargeAt > now) continue;
    const id = ids[index];
    try {
      const hash = await walletClient.writeContract({ address: manager, abi: managerAbi, functionName: "charge", args: [id] });
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      submitted += 1;
      status.lastChargeHash = hash;
      status.charges += 1;
      console.log(JSON.stringify({ level: "info", event: "charged", subscriptionId: id, hash }));
    } catch (error) {
      console.warn(JSON.stringify({ level: "warn", event: "charge_failed", subscriptionId: id, error: String(error).slice(0, 500) }));
    }
  }
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
  response.end(JSON.stringify({ healthy, account: account.address, manager, trackedSubscriptions: state.subscriptions.length, ...status }));
}).listen(healthPort, "127.0.0.1", () => console.log("health server listening on 127.0.0.1:" + healthPort));

await loadState();
console.log(JSON.stringify({ level: "info", event: "started", account: account.address, manager, deploymentBlock: deploymentBlock.toString() }));
await tick();
setInterval(() => { void tick(); }, pollMs);
