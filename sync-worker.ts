// Sync worker: drains the on-device outbox through POST /command.
// Provisional local displays only; server numbers/balances/config win.
// Retryable failures stay pending (see @niaverp/sync backoffMs); the UI
// surfaces counts + last errors.
import { command, type Auth } from "./api.js";
import { flushOutbox, type OutboxStorage, type SyncResult } from "../../../packages/sync/src/queue.js";

/** Map outbox kinds to /command ops. Unknown kinds are rejected terminally
 *  (fail closed — never guessed). */
export function opForKind(kind: string): string | null {
  switch (kind) {
    case "sale": return "sale.post";
    case "purchase": return "purchase.post";
    case "payment": return "payment.post";
    case "kacha": return "kacha.create";
    case "convert": return "kacha.convert";
    case "return": return "return.post";
    default: return null;
  }
}

export async function syncNow(store: OutboxStorage, baseUrl: string, auth: Auth): Promise<SyncResult> {
  return flushOutbox(store, {
    submit: async (entry) => {
      const op = opForKind(entry.kind);
      if (!op) return { outcome: "rejected", code: "INVALID_SOURCE", message: `unknown outbox kind ${entry.kind}`, retryable: false };
      try {
        const out = await command<{ postingId?: string; voucherNumber?: number | string; deduped?: boolean }>(
          baseUrl, auth, op, { ...(entry.payload as object), sourceId: entry.sourceId },
        );
        return { outcome: "acked", serverRef: out };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const code = message.split(":")[0] ?? "UNKNOWN";
        if (/CONFLICT|DUPLICATE/.test(message)) return { outcome: "conflicted", code, message };
        return { outcome: "rejected", code, message, retryable: /STALE|TIMEOUT|NETWORK/i.test(message) };
      }
    },
  });
}
