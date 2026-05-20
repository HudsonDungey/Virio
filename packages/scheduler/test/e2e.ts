/**
 * E2E integration test — Task A
 *
 * What it validates:
 *   1. Contracts compile and deploy via hardhat's in-process EVM
 *   2. SDK createPlan / approveToken / subscribe roundtrip
 *   3. scheduler.tick() finds the due subscription and calls charge()
 *   4. Webhook is dispatched with a valid HMAC-SHA256 signature
 *   5. verifyWebhook() passes on the received payload
 *   6. Merchant and fee-recipient balance deltas match expectations
 *   7. nextChargeAt advances by exactly one period
 *   8. A second tick() before the period elapses does NOT double-charge
 *
 * Run from repo root:
 *   npm run test:e2e
 *
 * Requirements:
 *   hardhat + tsx installed (npm install at root)
 *   Node ≥ 18 (uses node:test, node:http, node:crypto — all built-in)
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer }  from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

// hre must be imported AFTER the cwd is the repo root (hardhat.config.ts is there)
// The test:e2e script uses `cd ../..` to achieve this.
import hre from "hardhat";

import {
  createWalletClient,
  createPublicClient,
  custom,
  parseEventLogs,
  keccak256,
  encodePacked,
  type Hex,
  type Address,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { hardhat as hardhatChain } from "viem/chains";

import {
  VirioClient,
  VIRIO_ABI,
  ERC20_ABI,
  verifyWebhook,
  computeSubscriptionId,
  usdc,
  PERIOD,
} from "@virio/sdk";
import { Scheduler } from "../src/Scheduler.js";
import { MemoryStorage } from "../src/MemoryStorage.js";
import type { StoredSubscription } from "../src/storage.js";

// ─── Hardhat default accounts (mnemonic + derivation path) ───────────────────

const MNEMONIC = "test test test test test test test test test test test junk";
const deployer  = mnemonicToAccount(MNEMONIC, { addressIndex: 0 });
const merchant  = mnemonicToAccount(MNEMONIC, { addressIndex: 1 });
const customer  = mnemonicToAccount(MNEMONIC, { addressIndex: 2 });
const feeRecip  = mnemonicToAccount(MNEMONIC, { addressIndex: 3 });
const scheduler = mnemonicToAccount(MNEMONIC, { addressIndex: 4 });

// ─── viem clients backed by hardhat's in-process EIP-1193 provider ───────────

// hre.network.provider implements EIP-1193 — no external process needed.
const provider = hre.network.provider;

function makeWallet(account: ReturnType<typeof mnemonicToAccount>) {
  return createWalletClient({
    account,
    chain:     hardhatChain,
    transport: custom(provider),
  });
}

const pubClient = createPublicClient({
  chain:     hardhatChain,
  transport: custom(provider),
});

// ─── Helper: read ERC-20 balance ──────────────────────────────────────────────

async function balanceOf(token: Address, who: Address): Promise<bigint> {
  return pubClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [who] }) as Promise<bigint>;
}

// ─── Helper: advance hardhat time ─────────────────────────────────────────────

async function increaseTime(seconds: number): Promise<void> {
  await provider.request({ method: "evm_increaseTime", params: [seconds] });
  await provider.request({ method: "evm_mine", params: [] });
}

// ─── Helper: deploy a contract and return its address ────────────────────────

async function deployContract(
  walletClient: ReturnType<typeof makeWallet>,
  artifact: { abi: readonly object[]; bytecode: string },
  args: readonly unknown[] = [],
): Promise<Address> {
  const hash = await walletClient.deployContract({
    abi:      artifact.abi as never,
    bytecode: artifact.bytecode as `0x${string}`,
    args:     args as never,
  });
  const receipt = await pubClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("Deploy failed — no contractAddress in receipt");
  return receipt.contractAddress;
}

// ─── Webhook capture server ────────────────────────────────────────────────────

interface WebhookCapture {
  payload:   string;
  signature: string;
}

function startWebhookServer(port: number): {
  captured: () => Promise<WebhookCapture>;
  close: () => void;
} {
  let resolve: (v: WebhookCapture) => void;
  let reject: (e: Error) => void;
  const promise = new Promise<WebhookCapture>((res, rej) => {
    resolve = res;
    reject  = rej;
  });

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      const sig = (req.headers["x-virio-signature"] ?? "") as string;
      res.writeHead(200);
      res.end();
      resolve({ payload: body, signature: sig });
    });
    req.on("error", (err: Error) => reject(err));
  });

  server.listen(port);
  return {
    captured: () => Promise.race([
      promise,
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Webhook timeout after 10 s")), 10_000)
      ),
    ]),
    close: () => server.close(),
  };
}

// ─── Test state ───────────────────────────────────────────────────────────────

let usdcAddress:     Address;
let managerAddress:  Address;
let planId:          Hex;
let subscriptionId:  Hex;
let virioClient:     VirioClient;
let schedulerClient: VirioClient;
let storage:         MemoryStorage;
let sched:           Scheduler;

const WEBHOOK_PORT   = 19_876;
const WEBHOOK_SECRET = "test-webhook-secret-abc123";
const WEBHOOK_URL    = `http://127.0.0.1:${WEBHOOK_PORT}`;

const AMOUNT  = usdc(10);    // 10 USDC
const PERIOD_S = 30 * 24 * 3600; // 30 days in seconds

// VirioSubscriptionManager default fees (see the contract constructor/state):
const EXECUTOR_FEE_BPS  = 10n;        // 0.1%
const PROTOCOL_FEE_BPS  = 25n;        // 0.25%
const PROTOCOL_FLAT_FEE = 1_000_000n; // 1 USDC

const EXECUTOR_FEE = (AMOUNT * EXECUTOR_FEE_BPS) / 10_000n;
const PROTOCOL_FEE = (AMOUNT * PROTOCOL_FEE_BPS) / 10_000n + PROTOCOL_FLAT_FEE;
const MERCHANT_AMT = AMOUNT - EXECUTOR_FEE - PROTOCOL_FEE;

// ─── Suite setup ─────────────────────────────────────────────────────────────

before(async () => {
  // Compile contracts (uses hardhat.config.ts at repo root)
  console.log("  ⛏  Compiling contracts…");
  await hre.run("compile", { quiet: true });

  // Read compiled artifacts
  const managerArtifact = await hre.artifacts.readArtifact("VirioSubscriptionManager");
  const usdcArtifact    = await hre.artifacts.readArtifact("MockUSDC");

  const deployerWallet  = makeWallet(deployer);
  const merchantWallet  = makeWallet(merchant);

  // Deploy MockUSDC
  console.log("  🚀 Deploying MockUSDC…");
  usdcAddress = await deployContract(deployerWallet, usdcArtifact);

  // Deploy VirioSubscriptionManager(feeRecipient)
  console.log("  🚀 Deploying VirioSubscriptionManager…");
  managerAddress = await deployContract(deployerWallet, managerArtifact, [feeRecip.address]);

  // Build SDK clients
  virioClient = new VirioClient({
    contractAddress: managerAddress,
    chain: hardhatChain,
    walletClient: merchantWallet as never,
    publicClient: pubClient as never,
  });

  schedulerClient = new VirioClient({
    contractAddress: managerAddress,
    chain: hardhatChain,
    walletClient: makeWallet(scheduler) as never,
    publicClient: pubClient as never,
  });

  // Mint 1 000 USDC to customer
  const deployerWalletRaw = makeWallet(deployer);
  await deployerWalletRaw.writeContract({
    address:      usdcAddress,
    abi:          [{ type: "function", name: "mint", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" }],
    functionName: "mint",
    args:         [customer.address, usdc(1000)],
    account:      deployer,
  });

  console.log("  ✓  Setup complete\n");
});

after(() => {
  // nothing to tear down — hardhat resets between test files
});

// ─── Tests ────────────────────────────────────────────────────────────────────

test("1. merchant creates a plan", async () => {
  const result = await virioClient.createPlan({
    token:  usdcAddress,
    amount: AMOUNT,
    period: BigInt(PERIOD_S),
  });

  planId = result.planId;

  assert.ok(planId.startsWith("0x"),    "planId should be a hex string");
  assert.notEqual(planId, "0x" + "0".repeat(64), "planId should not be zero bytes");

  const plan = await virioClient.getPlan(planId);
  assert.equal(plan.merchant, merchant.address,                "merchant mismatch");
  assert.equal(plan.token,    usdcAddress,                     "token mismatch");
  assert.equal(plan.amount,   AMOUNT,                          "amount mismatch");
  assert.equal(plan.period,   BigInt(PERIOD_S),                "period mismatch");
  assert.ok(plan.active,                                       "plan should be active");

  console.log("  planId:", planId);
});

test("2. customer approves USDC and subscribes", async () => {
  const customerVirio = new VirioClient({
    contractAddress: managerAddress,
    chain:           hardhatChain,
    walletClient:    makeWallet(customer) as never,
    publicClient:    pubClient as never,
  });

  // Cap the approval to 5 charges worth
  const cap = AMOUNT * 5n;
  await customerVirio.approveToken(usdcAddress, cap);

  const result = await customerVirio.subscribe({
    planId,
    totalSpendCap: cap,
  });

  subscriptionId = result.subscriptionId;

  // Verify deterministic id
  const expected = computeSubscriptionId(planId, customer.address);
  assert.equal(subscriptionId, expected, "subscriptionId should be keccak256(planId, customer)");

  const sub = await customerVirio.getSubscription(subscriptionId);
  assert.ok(sub.active,                        "subscription should be active");
  assert.equal(sub.customer, customer.address, "customer mismatch");
  assert.equal(sub.merchant, merchant.address, "merchant mismatch");
  assert.equal(sub.amount,   AMOUNT,           "amount mismatch");
  assert.equal(sub.totalSpendCap, cap,         "totalSpendCap mismatch");

  console.log("  subscriptionId:", subscriptionId);
});

test("3. scheduler.tick() charges the subscription", async () => {
  storage = new MemoryStorage();
  const sub: StoredSubscription = {
    subscriptionId,
    planId,
    customer:      customer.address,
    merchant:      merchant.address,
    token:         usdcAddress,
    chainId:       hardhatChain.id,
    amount:        AMOUNT.toString(),
    webhookUrl:    WEBHOOK_URL,
    webhookSecret: WEBHOOK_SECRET,
    nextChargeAt:  0, // immediately due
    active:        true,
  };
  await storage.upsertSubscription(sub);

  // Capture the webhook before ticking
  const webhookServer = startWebhookServer(WEBHOOK_PORT);

  const merchantBefore  = await balanceOf(usdcAddress, merchant.address);
  const feeBefore       = await balanceOf(usdcAddress, feeRecip.address);
  const executorBefore  = await balanceOf(usdcAddress, scheduler.address);
  const customerBefore  = await balanceOf(usdcAddress, customer.address);

  sched = new Scheduler({
    storage,
    clients: { [hardhatChain.id]: schedulerClient },
  });

  await sched.tick();

  // Wait for the webhook to arrive
  const { payload, signature } = await webhookServer.captured();
  webhookServer.close();

  // ── Webhook signature roundtrip ──────────────────────────────────────────
  assert.ok(
    verifyWebhook(payload, signature, WEBHOOK_SECRET),
    "webhook signature verification failed"
  );

  const event = JSON.parse(payload) as { type: string; data: { subscriptionId: string } };
  assert.equal(event.type, "subscription.charged", "wrong event type");
  assert.equal(event.data.subscriptionId, subscriptionId, "subscriptionId in webhook mismatch");

  // ── Balance deltas ────────────────────────────────────────────────────────
  // The contract splits the gross AMOUNT three ways: merchant, executor (the
  // address that called charge — here the scheduler), and the protocol fee
  // recipient.
  const merchantAfter = await balanceOf(usdcAddress, merchant.address);
  const feeAfter      = await balanceOf(usdcAddress, feeRecip.address);
  const executorAfter = await balanceOf(usdcAddress, scheduler.address);
  const customerAfter = await balanceOf(usdcAddress, customer.address);

  assert.equal(merchantAfter - merchantBefore,  MERCHANT_AMT,  "merchant balance delta");
  assert.equal(feeAfter      - feeBefore,       PROTOCOL_FEE,  "protocol fee recipient delta");
  assert.equal(executorAfter - executorBefore,  EXECUTOR_FEE,  "executor fee delta");
  assert.equal(customerBefore - customerAfter,  AMOUNT,        "customer balance delta");

  console.log("  ✓  merchant received", MERCHANT_AMT, "units");
  console.log("  ✓  feeRecipient received", PROTOCOL_FEE, "units");
  console.log("  ✓  executor received", EXECUTOR_FEE, "units");
});

test("4. nextChargeAt advances by exactly one period", async () => {
  const sub = await schedulerClient.getSubscription(subscriptionId);
  // nextChargeAt should be roughly now + PERIOD_S
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(sub.nextChargeAt) - now;

  // Allow ±30 s slack for test execution time
  assert.ok(diff > PERIOD_S - 30, `nextChargeAt too early: diff=${diff}`);
  assert.ok(diff < PERIOD_S + 30, `nextChargeAt too late:  diff=${diff}`);
});

test("5. second tick before period elapses does NOT double-charge", async () => {
  // Refresh storage: nextChargeAt is in the past again to simulate a retry
  // We deliberately do NOT advance time — so contract will revert TooEarlyToCharge
  const snap = storage.snapshot();
  const stored = snap.get(subscriptionId)!;

  // Trick storage into thinking it's due again (simulates a scheduler restart
  // with stale nextChargeAt), but the contract will gate it
  stored.nextChargeAt = 0;
  await storage.upsertSubscription(stored);

  const customerBefore = await balanceOf(usdcAddress, customer.address);

  // tick() should call charge(), contract reverts, scheduler swallows error
  await sched.tick();

  const customerAfter = await balanceOf(usdcAddress, customer.address);
  assert.equal(customerAfter, customerBefore, "customer balance must not change on double-charge attempt");
  console.log("  ✓  double-charge correctly blocked by contract");
});

test("6. cancellation prevents future charges", async () => {
  // Advance time to make a charge valid again
  await increaseTime(PERIOD_S + 1);

  const customerVirio = new VirioClient({
    contractAddress: managerAddress,
    chain:           hardhatChain,
    walletClient:    makeWallet(customer) as never,
    publicClient:    pubClient as never,
  });

  await customerVirio.cancel(subscriptionId);

  const sub = await customerVirio.getSubscription(subscriptionId);
  assert.ok(!sub.active, "subscription should be inactive after cancel");

  // Force scheduler to try (storage still shows it due)
  const snap = storage.snapshot().get(subscriptionId)!;
  snap.nextChargeAt = 0;
  await storage.upsertSubscription(snap);

  const customerBefore = await balanceOf(usdcAddress, customer.address);
  await sched.tick();
  const customerAfter  = await balanceOf(usdcAddress, customer.address);

  assert.equal(customerAfter, customerBefore, "cancelled subscription must not be charged");
  console.log("  ✓  cancelled subscription correctly blocked");
});

test("7. spend cap enforcement — auto-cancel at contract level", async () => {
  // Create a fresh customer with a 1-charge cap
  const customer2 = mnemonicToAccount(MNEMONIC, { addressIndex: 5 });
  const c2Wallet  = makeWallet(customer2);

  // Fund customer2
  const deployerWallet = makeWallet(deployer);
  await deployerWallet.writeContract({
    address: usdcAddress,
    abi: [{ type: "function", name: "mint", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" }],
    functionName: "mint",
    args: [customer2.address, usdc(100)],
    account: deployer,
  });

  const c2Virio = new VirioClient({
    contractAddress: managerAddress,
    chain: hardhatChain,
    walletClient: c2Wallet as never,
    publicClient: pubClient as never,
  });

  // Approve and subscribe with cap = exactly 1 charge
  await c2Virio.approveToken(usdcAddress, AMOUNT * 2n);
  const { subscriptionId: sub2Id } = await c2Virio.subscribe({
    planId,
    totalSpendCap: AMOUNT, // cap = exactly one charge
  });

  // First charge works and transfers the gross AMOUNT.
  const balBefore1 = await balanceOf(usdcAddress, customer2.address);
  await schedulerClient.charge(sub2Id);
  const balAfter1 = await balanceOf(usdcAddress, customer2.address);
  assert.equal(balBefore1 - balAfter1, AMOUNT, "first charge should pull the gross amount");

  // Second charge after the period would exceed the cap. The contract does NOT
  // revert — it auto-cancels the subscription and moves no funds.
  await increaseTime(PERIOD_S + 1);
  await schedulerClient.charge(sub2Id); // resolves (no throw)

  const balAfter2 = await balanceOf(usdcAddress, customer2.address);
  assert.equal(balAfter2, balAfter1, "cap-exceeding charge must not move funds");

  const sub2 = await c2Virio.getSubscription(sub2Id);
  assert.ok(!sub2.active, "subscription should auto-cancel once the cap is exceeded");

  console.log("  ✓  spend cap auto-cancels the subscription at contract level");
});

test("8. webhook signature: tampered payload fails verification", async () => {
  const payload   = JSON.stringify({ type: "subscription.charged", id: "evt_1" });
  const signature = "deadbeefdeadbeef"; // wrong

  assert.ok(
    !verifyWebhook(payload, signature, WEBHOOK_SECRET),
    "tampered signature should fail verification"
  );

  const realSig = (await import("@virio/sdk")).signWebhook(payload, WEBHOOK_SECRET);
  assert.ok(
    verifyWebhook(payload, realSig, WEBHOOK_SECRET),
    "correct signature should verify"
  );

  // Tampered payload
  assert.ok(
    !verifyWebhook(payload + " ", realSig, WEBHOOK_SECRET),
    "tampered payload should fail verification"
  );

  console.log("  ✓  webhook HMAC roundtrip verified");
});
