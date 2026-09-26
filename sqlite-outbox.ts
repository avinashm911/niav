// SQLite outbox binding. Structural DB interface — expo-sqlite's Database
// satisfies it, so this file typechecks without native modules installed.
// The queue semantics (retry/backoff/dedupe/conflicts) live in
// @niaverp/sync and are unit-tested there; this is only the persistence seam.
import type { OutboxEntry, OutboxStatus, OutboxStorage } from "../../../packages/sync/src/queue.js";

export interface SQLiteDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS outbox (
  source_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

export class SqliteOutbox implements OutboxStorage {
  constructor(private db: SQLiteDb) {}
  static async open(db: SQLiteDb): Promise<SqliteOutbox> {
    await db.execAsync(SCHEMA);
    return new SqliteOutbox(db);
  }
  async enqueue(e: OutboxEntry): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO outbox(source_id,kind,payload,status,attempts,last_error,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(source_id) DO UPDATE SET kind=excluded.kind, payload=excluded.payload, updated_at=excluded.updated_at`,
      [e.sourceId, e.kind, JSON.stringify(e.payload), e.status, e.attempts, e.lastError, e.createdAt, e.updatedAt],
    );
  }
  async listPending(limit = 50): Promise<OutboxEntry[]> {
    const rows = await this.db.getAllAsync<Record<string, string | number | null>>(
      `SELECT * FROM outbox WHERE status='pending' ORDER BY created_at LIMIT ?`, [limit]);
    return rows.map((r) => ({
      sourceId: r.source_id as string, kind: r.kind as string, payload: JSON.parse(r.payload as string),
      status: r.status as OutboxStatus, attempts: Number(r.attempts), lastError: (r.last_error as string | null) ?? null,
      createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    }));
  }
  async mark(e: OutboxEntry): Promise<void> {
    await this.db.runAsync(
      `UPDATE outbox SET status=?, attempts=?, last_error=?, updated_at=? WHERE source_id=?`,
      [e.status, e.attempts, e.lastError, e.updatedAt, e.sourceId],
    );
  }
  async get(sourceId: string): Promise<OutboxEntry | null> {
    const rows = await this.db.getAllAsync<Record<string, string | number | null>>(
      `SELECT * FROM outbox WHERE source_id=?`, [sourceId]);
    const r = rows[0];
    if (!r) return null;
    return {
      sourceId: r.source_id as string, kind: r.kind as string, payload: JSON.parse(r.payload as string),
      status: r.status as OutboxStatus, attempts: Number(r.attempts), lastError: (r.last_error as string | null) ?? null,
      createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    };
  }
  async countByStatus(): Promise<Record<OutboxStatus, number>> {
    const rows = await this.db.getAllAsync<{ status: OutboxStatus; n: number }>(
      `SELECT status, COUNT(*) AS n FROM outbox GROUP BY status`);
    const out: Record<OutboxStatus, number> = { pending: 0, acked: 0, rejected: 0, conflicted: 0 };
    for (const r of rows) out[r.status] = Number(r.n);
    return out;
  }
}
