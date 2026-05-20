import { createHmac, timingSafeEqual } from "node:crypto";
import type { VirioEvent } from "./types.js";

const SIGNATURE_HEADER = "x-virio-signature";
const ALGORITHM = "sha256";

// ─── Signing ─────────────────────────────────────────────────────────────────

/**
 * Sign a webhook payload (JSON string) with an HMAC-SHA256 secret.
 * Returns the hex digest — attach as the `x-virio-signature` header.
 */
export function signWebhook(payload: string, secret: string): string {
  return createHmac(ALGORITHM, secret).update(payload).digest("hex");
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Verify an incoming webhook request.
 *
 * Uses `timingSafeEqual` to prevent timing-oracle attacks — do not compare
 * signatures with `===` or `.includes()`.
 *
 * @param payload   Raw request body (string, not parsed).
 * @param signature Value of the `x-virio-signature` header.
 * @param secret    Webhook secret shared with the merchant.
 */
export function verifyWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = Buffer.from(signWebhook(payload, secret));
  const actual   = Buffer.from(signature);

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// ─── Construction helper ──────────────────────────────────────────────────────

let _counter = 0;

/** Build a VirioEvent with a unique id. */
export function buildEvent(
  type: VirioEvent["type"],
  data: VirioEvent["data"]
): VirioEvent {
  return {
    id:        `evt_${Date.now()}_${(_counter++).toString(36)}`,
    type,
    createdAt: Math.floor(Date.now() / 1000),
    data,
  };
}
