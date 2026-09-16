"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Address } from "viem";

import { Virio } from "../Virio.js";
import { formatInterval } from "../checkout/transaction.js";
import { formatUnits } from "../helpers.js";
import { KEYFRAMES, styles } from "../checkout/styles.js";
import type { SubscriptionRecord, SubscriptionRole } from "../types.js";
import { ViirioCancelButton } from "./ViirioCancelButton.js";
import { useVirio, useVirioConfig } from "./VirioProvider.js";

export interface SubscriptionManagerProps {
  /** Whose subscriptions to show. Defaults to the connected wallet. */
  address?: string;
  /** Match the customer side (default), the merchant side, or both. */
  role?: SubscriptionRole;
  /** Start block for the event scan. Bounds an otherwise from-genesis scan. */
  fromBlock?: bigint;
  className?: string;
  style?: CSSProperties;
  onCancel?: (subscriptionId: string) => void;
  onError?: (error: Error) => void;
}

/** Token display metadata, resolved once per unique token. */
type TokenMeta = Record<string, { decimals: number; symbol: string }>;

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; records: SubscriptionRecord[]; tokens: TokenMeta };

export function SubscriptionManager({
  address,
  role = "customer",
  fromBlock,
  className,
  style,
  onCancel,
  onError,
}: SubscriptionManagerProps): JSX.Element {
  const config = useVirioConfig();
  const { connected, address: connectedAddress, connect } = useVirio();

  // A read-only client is enough — listing subscriptions never signs.
  const client = useMemo(
    () =>
      new Virio({
        contractAddress: config.contractAddress,
        chain: config.chain,
        rpcUrl: config.rpcUrl,
      }),
    [config.contractAddress, config.chain, config.rpcUrl],
  );

  const target = (address ?? connectedAddress) as Address | undefined;
  const [state, setState] = useState<ListState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!target) return;
    setState({ status: "loading" });
    try {
      const records = await client.getSubscriptions(target, role, { fromBlock });
      const tokens: TokenMeta = {};
      await Promise.all(
        [...new Set(records.map((r) => r.token.toLowerCase()))].map(async (tokenKey) => {
          const token = tokenKey as Address;
          const [decimals, symbol] = await Promise.all([
            client.getDecimals(token),
            client.getSymbol(token),
          ]);
          tokens[tokenKey] = { decimals, symbol };
        }),
      );
      setState({ status: "ready", records, tokens });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ status: "error", message: error.message || "Could not load subscriptions." });
      onError?.(error);
    }
  }, [client, target, role, fromBlock, onError]);

  useEffect(() => {
    if (target) void load();
  }, [target, load]);

  const container = { fontFamily: styles.overlay.fontFamily, ...style };

  if (!connected && !address) {
    return (
      <div className={className} style={container}>
        <p style={styles.subtitle}>Connect your wallet to view your subscriptions.</p>
        <button type="button" style={styles.primary} onClick={() => void connect()}>
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className={className} style={container}>
      <style>{KEYFRAMES}</style>
      {renderBody({ state, tokens: state.status === "ready" ? state.tokens : {}, onCancel, refetch: load })}
    </div>
  );
}

// ── Body per state ──

interface BodyArgs {
  state: ListState;
  tokens: TokenMeta;
  onCancel?: (subscriptionId: string) => void;
  refetch: () => Promise<void>;
}

function renderBody({ state, tokens, onCancel, refetch }: BodyArgs): JSX.Element {
  if (state.status === "loading") {
    return (
      <div style={styles.center}>
        <div data-virio-spinner style={styles.spinner} aria-hidden="true" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <p style={styles.subtitle}>{state.message}</p>
        <button type="button" style={styles.primary} onClick={() => void refetch()}>
          Try again
        </button>
      </>
    );
  }

  if (state.records.length === 0) {
    return <p style={styles.subtitle}>No subscriptions yet.</p>;
  }

  return (
    <div style={styles.list}>
      {state.records.map((record) => (
        <Row
          key={record.id}
          record={record}
          meta={tokens[record.token.toLowerCase()]}
          onCancel={onCancel}
          refetch={refetch}
        />
      ))}
    </div>
  );
}

function Row({
  record,
  meta,
  onCancel,
  refetch,
}: {
  record: SubscriptionRecord;
  meta: { decimals: number; symbol: string } | undefined;
  onCancel?: (subscriptionId: string) => void;
  refetch: () => Promise<void>;
}): JSX.Element {
  const amount = meta ? `${formatUnits(record.amount, meta.decimals)} ${meta.symbol}` : "—";
  const nextCharge = new Date(Number(record.nextChargeAt) * 1000).toLocaleDateString();

  return (
    <div style={styles.row}>
      <div>
        <div style={styles.summaryAmount}>{amount}</div>
        <div style={styles.summaryInterval}>{formatInterval(record.period)}</div>
        {record.active && (
          <div style={styles.statusText}>Next charge {nextCharge}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
        <span style={record.active ? styles.badge : { ...styles.badge, ...styles.badgeInactive }}>
          {record.active ? "Active" : "Cancelled"}
        </span>
        {record.active && (
          <ViirioCancelButton
            subscriptionId={record.id}
            style={{ padding: "8px 14px", fontSize: "14px" }}
            onSuccess={() => {
              onCancel?.(record.id);
              void refetch();
            }}
          >
            Cancel
          </ViirioCancelButton>
        )}
      </div>
    </div>
  );
}
