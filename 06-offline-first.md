# NiavERP — Offline-First (Conceptual)

> Phase 0. No library selected, no sync algorithm locked. Principles only.

## 1. Goal

The shop must bill, challan, and collect payments with zero connectivity, then sync without duplicates, loss, or silent overwrites — with two billers on two devices.

## 2. Local Persistence

- Mobile holds a durable local store (SQLite role): masters cache, transaction outbox, posted-cache, audit buffer, sync cursors.
- Local store is a **queue + cache**, not an independent ledger. Server Postgres is authoritative truth.
- All local writes that matter carry durable IDs at creation (UUID v4 or equivalent) and idempotency keys.

## 3. SQLite Role (Conceptual)

- Cache frequently used masters (parties, items) for fast billing.
- Durably queue every created transaction until server acknowledgement.
- Buffer audit events created offline.
- Track sync state (cursors, pending, conflicts). Exact schema/libraries deferred.

## 4. Transaction Queue

- Outbox pattern: create → validate locally (UX pre-check) → enqueue → retry with backoff → acknowledged → mark posted with final server number.
- UI distinguishes `pending_sync` from `posted`; reports label pending separately.
- Retries are safe by construction (idempotent submits).

## 5. Synchronisation

- **Push:** idempotent submit of outbox entries (same durable ID → same result). Server re-validates, assigns final numbers, posts consequences.
- **Pull:** fetch new/updated masters, consequences, statuses, conflicts since cursor.
- No specific algorithm selected in Phase 0 (e.g., delta vs snapshot, CRDT vs last-write-wins are NOT decided). Requirement is: idempotent, ordered per causality where needed, resumable.

## 6. Retry

- Exponential backoff with jitter (conceptual); user can continue working offline during retries.
- Poison (repeatedly rejected) entries are surfaced with plain-language reasons, never silently dropped.

## 7. Idempotency

- Durable transaction ID + action keys (especially conversion, payment application) enforced by server unique constraints.
- Double-tap, retry, or multi-device resubmit of the same action yields one effect.

## 8. Conflict Categories

1. **Numbering:** provisional local number vs final server number — resolved by server assignment.
2. **Remaining-quantity race:** two devices converting same challan — first valid wins; second gets explicit rejection + refresh.
3. **Master divergence:** party/item edited on two devices — server authority + conflict record.
4. **Permission/period change:** offline action invalid by sync time (period closed, permission revoked) — rejected with reason, queued for correction.
5. All conflicts produce auditable conflict records; no silent merge of financial facts.

## 9. Server Authority

- Server re-validates everything: permissions, period, series, stock policy, Kacha/Pakka rules, tax.
- Client pre-validation is UX convenience only and never trusted for correctness.

## 10. Offline Permissions

- Permissions are cached grants reflecting last-known server truth with expiry/refresh policy (details deferred).
- Sensitive actions attempted offline outside grant are blocked locally with explanation; borderline cases are held for server decision, never auto-approved.

## 11. Connectivity State

- Explicit states: online / offline / degraded, plus per-batch sync status. UI shows queue depth and last successful sync in owner-understandable terms.

## 12. Data Lineage

- Local UUID → server transaction ID → consequence IDs → audit events form one traceable chain across devices.
- Device/session recorded on every offline action for later audit.
