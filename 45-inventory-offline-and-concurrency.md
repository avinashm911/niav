# NiavERP — Inventory Offline and Concurrency (Conceptual)

> Phase 3. Durable IDs + idempotent replay + server-authoritative validation. No SQLite details, no sync implementation.

## 1. Offline creation

- Every stock-affecting intent is created offline with the Phase 1/2 durable source ID (+ line intent IDs) + client timestamp + device ID, queued in the outbox. Final numbering/period anchoring happens at server post alongside the local ID (never replacing it). Pre-post availability hints shown offline are estimates only.

## 2. Replay / duplicate rules

- Same source ID resubmitted (retry, double-tap, ack loss, second device with same queued intent): exactly one posting → one movement set. Replays return original movement/posting refs + audit the deduplication where consequential.
- Distinct sources (two billers, two IDs) post independently, each validated against then-current state.

## 3. Concurrency behaviour (server-authoritative)

- **Simultaneous receipts/issues/transfers/adjustments:** each validated + posted serially under server authority; no lost updates because rows are append-only (no read-modify-write on a balance field). Ordering differences may change derived balances but never corrupt history.
- **Transfer races:** same transfer ID twice → one paired posting (idempotent). Two transfers overlapping same stock: both evaluated against availability policy at their commit order; the second fails or partially scopes only per the locked negative-stock rule (`48`), with explicit rejection + refresh — never silent overwrite.
- **Adjustment races:** append-only adjustments cannot overwrite each other; conflicting corrections resolve by additive chains + audit, newest explaining net reality without editing predecessors.
- **Availability races:** offline-estimated availability may be stale; server validation at post-time is authoritative. Rejected issues surface owner-understandable reasons + correction path (split qty, transfer in, adjust with reason) — never auto-negative beyond policy.

## 4. Conflict stance

- No silent merges of quantity facts. Numbering/period/grant/eligibility conflicts follow `06`/`22` + Phase 2 discipline: reject with reason + conflict audit, or post winner + inform loser. Quantity rows themselves are never merged field-wise.
