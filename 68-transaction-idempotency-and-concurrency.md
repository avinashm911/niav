# NiavERP — Transaction Idempotency and Concurrency (Conceptual)

> Phase 5. Source-ID anchor; server authority; no DB-locking design; no UI reliance.

## Idempotency (invariant: 1 successful source = 1 transaction identity = 1 intended consequence set)

- Same source retry (timeout, double-tap, queue retry): return original transaction/voucher/consequence refs; no second posting, no second number.
- Response lost after commit: replay recovers originals (ack recovery, not re-execution).
- Same source from another device (shared queued intent): converges to the single winner; loser receives winner refs + dedupe audit.
- Duplicate voucher/consequence requests against a posted source: rejected-or-converged (return originals), never new rows.
- Different sources (even identical business facts): independent postings with distinct identities/numbers (content dedupe is forbidden — identity, not similarity, governs).

## Concurrency (server-authoritative, append-only history)

- Different transactions simultaneously: validated + committed in server order; final numbers distinct; histories complete. No lost updates (no balance-field read-modify-write anywhere by design).
- Same-source race: one winner posts; losers converge (see above) + conflict audit.
- Voucher-number race: numbers assigned only at commit under authority; no client pre-allocation; retries never consume extra numbers.
- Availability race (stock): commit-order evaluation under DENY-negatives; second fails with refresh path, never silent negative.
- Period-close race: commits landing after close fail closed-period rules; in-flight validations re-checked at commit.
- GST-config race: then-effective version at commit governs; stale provisionals discarded with outcome (not corrections).
- Correction/reversal races: first valid chain posts; duplicates rejected (one active reversal per target; corrections under shared action IDs).
- Unresolvable conflicts: deterministic reject + audit + correction/retry path. Silent overwrites of financial/stock truth are forbidden in every case.
