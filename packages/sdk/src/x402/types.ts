import type { Address, Hex } from "viem";

// ─── x402 wire types ─────────────────────────────────────────────────────────
//
// x402 is an HTTP-native payment standard: a server answers 402 with what it
// wants paid, the client retries carrying a signed payment, and a facilitator
// verifies and settles it. Its "exact" scheme on EVM uses EIP-3009
// transferWithAuthorization, so the payer signs rather than sending a tx.
//
// These types describe that wire format as Virio consumes it. They are a local
// copy on purpose: the adapter must not drag an x402 SDK into @virio/sdk's
// dependency list, and the core billing engine must stay protocol-agnostic.
//
// STATUS: the field names below follow the published x402 specification as of
// this writing. They have NOT been verified against a live facilitator from
// this repository, which is why the adapter is feature-flagged off by default
// and why nothing in the billing engine imports it. Re-check them against the
// current spec before enabling this in production.

/** What a 402 response says it wants paid. */
export interface X402PaymentRequirements {
  /** Payment scheme; only "exact" is specified today. */
  scheme: string;
  /** Chain identifier, e.g. "base-sepolia". */
  network: string;
  /** Largest amount the client may authorize, in the asset's smallest unit. */
  maxAmountRequired: string;
  /** The resource being paid for — typically the request URL. */
  resource: string;
  description?: string;
  mimeType?: string;
  /** Address the payment is made out to. */
  payTo: Address;
  maxTimeoutSeconds?: number;
  /** ERC-20 contract address of the payment asset. */
  asset: Address;
  /** Scheme-specific extras (EIP-712 domain fields for "exact"). */
  extra?: Record<string, unknown>;
}

/** The body of a 402 response. */
export interface X402PaymentRequired {
  x402Version: number;
  accepts: X402PaymentRequirements[];
  error?: string;
}

/** The decoded X-PAYMENT header the client sends on the retry. */
export interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: Hex;
    authorization: {
      from: Address;
      to: Address;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: Hex;
    };
  };
}

/** The decoded X-PAYMENT-RESPONSE header a server returns after settling. */
export interface X402SettlementResponse {
  success: boolean;
  transaction?: Hex;
  network?: string;
  payer?: Address;
  errorReason?: string;
}
