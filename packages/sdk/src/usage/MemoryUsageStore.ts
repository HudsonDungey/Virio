import type { Hex } from "viem";
import type { UsageEvent } from "../billing/types.js";
import type { UsageQuery, UsageStore } from "./store.js";

/**
 * In-memory usage store. The default, and enough for local development, tests
 * and a single-process metering service.
 *
 * It is not durable: a restart loses unsettled usage, which means unbilled
 * revenue rather than an over-charge. Production deployments should back
 * `UsageStore` with a real database — the interface exists for exactly that.
 */
export class MemoryUsageStore implements UsageStore {
  /** Keyed by `${meterId}:${idempotencyKey}` — the uniqueness scope. */
  private readonly seen = new Set<string>();
  private readonly events: UsageEvent[] = [];
  private readonly nonces = new Map<string, bigint>();

  async record(event: UsageEvent): Promise<boolean> {
    const key = `${event.meterId.toLowerCase()}:${event.idempotencyKey}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.events.push(event);
    return true;
  }

  async listEvents(query: UsageQuery): Promise<UsageEvent[]> {
    const meterId = query.meterId.toLowerCase();
    const authorizationId = query.authorizationId.toLowerCase();
    return this.events
      .filter(
        (e) =>
          e.meterId.toLowerCase() === meterId &&
          e.authorizationId.toLowerCase() === authorizationId &&
          e.timestamp >= query.from &&
          e.timestamp < query.to,
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async totalUnits(query: UsageQuery): Promise<bigint> {
    const events = await this.listEvents(query);
    return events.reduce((sum, e) => sum + e.quantity, 0n);
  }

  async nextNonce(merchant: Hex): Promise<bigint> {
    const key = merchant.toLowerCase();
    const next = (this.nonces.get(key) ?? 0n) + 1n;
    this.nonces.set(key, next);
    return next;
  }
}
