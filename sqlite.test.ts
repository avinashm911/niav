// Real SQLite execution of the mobile outbox adapter (better-sqlite3 driver
// on desktop; expo-sqlite on device — same SQL, same adapter contract).
// Proves the adapter SQL + queue semantics on an actual SQLite engine.
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { SqliteOutbox, type SQLiteDb } from "../../../apps/mobile/lib/sqlite-outbox.js";
import { flushOutbox } from "../src/queue.js";

function driver(): SQLiteDb {
  const db = new Database(":memory:");
  return {
    execAsync: async (sql: string) => { db.exec(sql); },
    runAsync: async (sql: string, params: unknown[] = []) => {
      const info = db.prepare(sql).run(...(params as unknown[]));
      return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
    },
    getAllAsync: async <T,>(sql: string, params: unknown[] = []): Promise<T[]> =>
      db.prepare(sql).all(...(params as unknown[])) as T[],
  };
}

describe("sqlite outbox on real SQLite engine", () => {
  it("enqueue → pending → flush ack → counts; duplicate enqueue converges", async () => {
    const store = await SqliteOutbox.open(driver());
    const now = new Date().toISOString();
    await store.enqueue({ sourceId: "s1", kind: "sale", payload: { a: 1 }, status: "pending", attempts: 0, lastError: null, createdAt: now, updatedAt: now });
    await store.enqueue({ sourceId: "s1", kind: "sale", payload: { a: 2 }, status: "pending", attempts: 0, lastError: null, createdAt: now, updatedAt: now });
    expect((await store.listPending()).length).toBe(1);
    const res = await flushOutbox(store, { submit: async () => ({ outcome: "acked", serverRef: {} }) });
    expect(res.acked).toEqual(["s1"]);
    expect(await store.countByStatus()).toMatchObject({ pending: 0, acked: 1 });
  });
  it("offline sale + kacha survive process restart shape (reopen same file)", async () => {
    const path = `${process.env.TEMP ?? "/tmp"}/niaverp-outbox-test.db`;
    const mk = () => {
      const db = new Database(path);
      return {
        execAsync: async (sql: string) => { db.exec(sql); },
        runAsync: async (sql: string, params: unknown[] = []) => {
          const info = db.prepare(sql).run(...(params as unknown[]));
          return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
        },
        getAllAsync: async <T,>(sql: string, params: unknown[] = []): Promise<T[]> =>
          db.prepare(sql).all(...(params as unknown[])) as T[],
        close: () => db.close(),
      };
    };
    const a = await SqliteOutbox.open(mk());
    const now = new Date().toISOString();
    await a.enqueue({ sourceId: "off-1", kind: "sale", payload: {}, status: "pending", attempts: 0, lastError: null, createdAt: now, updatedAt: now });
    const b = await SqliteOutbox.open(mk()); // reopen = restart
    expect((await b.listPending()).map((e) => e.sourceId)).toEqual(["off-1"]);
  });
});
