// Offline-first sync: durable IDs, outbox queue, pending_sync state, retry
// with backoff counters, idempotent replay, server reconciliation, failure
// states, sync status. Storage-agnostic: the mobile app binds it to
// expo-sqlite (apps/mobile/lib/sqlite-outbox.ts); tests bind it to memory.
// Never invents voucher numbers, balances, or tax — server authoritative.
export type OutboxStatus = "pending" | "acked" | "rejected" | "conflicted";

export interface OutboxEntry {
  sourceId: string;
  kind: string;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxStorage {
  enqueue(e: OutboxEntry): Promise<void>;
  listPending(limit?: number): Promise<OutboxEntry[]>;
  mark(e: OutboxEntry): Promise<void>;
  get(sourceId: string): Promise<OutboxEntry | null>;
  countByStatus(): Promise<Record<OutboxStatus, number>>;
}

export class MemoryOutbox implements OutboxStorage {
  private rows = new Map<string, OutboxEntry>();
  async enqueue(e: OutboxEntry): Promise<void> {
    const prior = this.rows.get(e.sourceId);
    this.rows.set(e.sourceId, { ...e, attempts: prior ? prior.attempts : 0 });
  }
  async listPending(limit = 50): Promise<OutboxEntry[]> {
    return [...this.rows.values()].filter((r) => r.status === "pending").slice(0, limit);
  }
  async mark(e: OutboxEntry): Promise<void> {
    this.rows.set(e.sourceId, e);
  }
  async get(sourceId: string): Promise<OutboxEntry | null> {
    return this.rows.get(sourceId) ?? null;
  }
  async countByStatus(): Promise<Record<OutboxStatus, number>> {
    const out: Record<OutboxStatus, number> = { pending: 0, acked: 0, rejected: 0, conflicted: 0 };
    for (const r of this.rows.values()) out[r.status] += 1;
    return out;
  }
}

export type ServerVerdict =
  | { outcome: "acked"; serverRef: unknown }
  | { outcome: "rejected"; code: string; message: string; retryable: boolean }
  | { outcome: "conflicted"; code: string; message: string; winnerRef?: unknown };

export interface SyncServer {
  submit(entry: OutboxEntry): Promise<ServerVerdict>;
}

export interface SyncResult {
  acked: string[];
  rejected: Array<{ source: string; code: string; retryable: boolean }>;
  conflicted: string[];
  pending: number;
}

export function backoffMs(attempts: number): number {
  return Math.min(30000, 1000 * 2 ** Math.min(attempts, 5));
}

/** Flush pending entries in FIFO order. Terminal states stick; retryable
 *  rejections stay pending with incremented attempts (caller schedules the
 *  next flush after backoffMs). Never deletes entries — full audit. */
export async function flushOutbox(store: OutboxStorage, server: SyncServer, limit = 50): Promise<SyncResult> {
  const now = new Date().toISOString();
  const res: SyncResult = { acked: [], rejected: [], conflicted: [], pending: 0 };
  const batch = await store.listPending(limit);
  for (const e of batch) {
    const verdict = await server.submit(e);
    if (verdict.outcome === "acked") {
      await store.mark({ ...e, status: "acked", lastError: null, updatedAt: now });
      res.acked.push(e.sourceId);
    } else if (verdict.outcome === "conflicted") {
      await store.mark({ ...e, status: "conflicted", lastError: `${verdict.code}: ${verdict.message}`, updatedAt: now });
      res.conflicted.push(e.sourceId);
    } else if (verdict.retryable) {
      await store.mark({ ...e, attempts: e.attempts + 1, lastError: `${verdict.code}: ${verdict.message}`, updatedAt: now });
    } else {
      await store.mark({ ...e, status: "rejected", lastError: `${verdict.code}: ${verdict.message}`, updatedAt: now });
      res.rejected.push({ source: e.sourceId, code: verdict.code, retryable: false });
    }
  }
  res.pending = (await store.listPending(limit)).length;
  return res;
}

export async function syncStatus(store: OutboxStorage) {
  const counts = await store.countByStatus();
  return { ...counts, online: undefined as unknown as boolean | undefined };
}
