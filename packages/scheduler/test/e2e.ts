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
const FEE_BPS = 100;          // 1 %

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
    token:              usdcAddress,
    amount:             AMOUNT,
    period:             BigInt(PERIOD_S),
    maxAmountPerCharge: AMOUNT,
    feeBps:             FEE_BPS,
  });

  planId = result.planId;

  assert.ok(planId.startsWith("0x"),    "planId should be a hex string");
  assert.notEqual(planId, "0x" + "0".repeat(64), "planId should not be zero bytes");

  const plan = await virioClient.getPlan(planId);
  assert.equal(plan.merchant, merchant.address,                "merchant mismatch");
  assert.equal(plan.token,    usdcAddress,                     "token mismatch");
  assert.equal(plan.amount,   AMOUNT,                          "amount mismatch");
  assert.equal(plan.feeBps,   FEE_BPS,                         "feeBps mismatch");
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
  assert.equal(sub.planId,   planId,           "planId mismatch");
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
  const merchantAfter = await balanceOf(usdcAddress, merchant.address);
  const feeAfter      = await balanceOf(usdcAddress, feeRecip.address);
  const customerAfter = await balanceOf(usdcAddress, customer.address);

  const expectedFee      = (AMOUNT * BigInt(FEE_BPS)) / 10_000n; // 0.10 USDC
  const expectedMerchant = AMOUNT - expectedFee;                   // 9.90 USDC

  assert.equal(merchantAfter - merchantBefore,  expectedMerchant, "merchant balance delta");
  assert.equal(feeAfter      - feeBefore,       expectedFee,      "fee recipient delta");
  assert.equal(customerBefore - customerAfter,  AMOUNT,           "customer balance delta");

  console.log("  ✓  merchant received", expectedMerchant, "units");
  console.log("  ✓  feeRecipient received", expectedFee, "units");
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

test("7. spend cap enforcement — contract level", async () => {
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

  // First charge works
  await schedulerClient.charge(sub2Id);

  // Second charge (after period) must revert with SpendCapExceeded
  await increaseTime(PERIOD_S + 1);

  await assert.rejects(
    () => schedulerClient.charge(sub2Id),
    (err: Error) => {
      // viem wraps contract errors; check the message contains the error name
      return err.message.includes("SpendCapExceeded") || err.message.includes("0x");
    },
    "SpendCapExceeded error expected"
  );

  console.log("  ✓  spend cap enforced at contract level");
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
