# NiavERP — Accounting Invariants (Formal)

> Phase 2. Testable “must-hold” statements. Each maps to `35` matrix cases.

1. **Balance:** every posted Journal Entry satisfies `SUM(debits) = SUM(credits)` exactly; unbalanced intents never post.
2. **Immutability:** posted Entries/Legs are never edited, deleted, or reordered in place.
3. **Source lineage:** every posting links exactly one Source Transaction (+ voucher + batch where grouped); every leg links its entry + account-at-time.
4. **Leg containment:** every accounting leg belongs to exactly one posted Entry in exactly one Posting.
5. **Company scope:** every posting/entry/leg belongs to exactly one Company; no cross-company legs.
6. **Business date:** every posting carries a business date resolving to exactly one Period; period state at post-time is recorded.
7. **Reversal integrity:** every reversal/correction links its original(s) bidirectionally (`reverses/corrects` + `reversal_of` at leg level where needed) with reason + actor; originals remain retrievable.
8. **Idempotency:** resubmitting the same source ID (including retries, double-taps, sync replays, concurrent races) yields the original refs, never a second Entry.
9. **Period enforcement:** `closed` rejects ordinary postings; `locked` rejects all; reopen/adjustment paths require authority + reason + audit.
10. **Account ownership:** every leg references an Account owned by the posting’s Company, active at post-time; retired/foreign accounts rejected.
11. **Determinism:** identical validated posting intents produce identical balanced entries (no UI-dependent, locale-dependent, or time-dependent leg generation).
12. **Replay safety:** offline-created sources replayed via sync produce at most one Entry; then-current period/grants govern, with explicit rejection paths.
13. **Derived-read explainability:** every balance/register/ageing figure is explainable as a fold over posted legs + openings + reversals (openings labelled), never as stored balances.
14. **Audit durability:** every post/reject/reverse/correct/close/reopen/grant-change emits an append-only audit event with actor/device/time/reason/lineage; audit rows are never deleted or rewritten.
15. **No negative/zero legs:** posted legs carry strictly positive amounts on exactly one side; reductions use opposite-side or reversal legs.
16. **Opening separability:** openings are flagged, period-bound, batch-linked, and excludable from operational views; ordinary voucher types can never masquerade as openings.
