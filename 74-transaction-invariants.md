# NiavERP — Transaction Invariants (Locked)

> Phase 5. Must-hold statements. Each maps to `75` matrix cases.

1. One durable source identity per posted transaction; no posted transaction without it.
2. One successful source yields exactly one transaction identity and one intended consequence set (no duplicates).
3. Voucher numbers unique per (company, series), assigned at commit, never recycled, replay-stable.
4. Posted history immutable (sources, postings, consequences, audits never edited/deleted in place).
5. Required siblings post atomically (all declared consequences or none).
6. Failed posts leave no surviving partial business consequence.
7. Accounting owns money semantics; Engine never computes legs/balances.
8. Inventory owns quantity semantics; Engine never computes movements/availability.
9. GST owns tax semantics; Engine never classifies/rates/components.
10. Payments owns payment facts; Receivables/Payables own derived balances; Engine never auto-applies advances.
11. Engine owns orchestration only (identity, sequencing, boundary, idempotency, linkage, error taxonomy).
12. Every consequence links the canonical source/transaction/posting/voucher.
13. Reversals preserve originals with bidirectional links; double reversal rejected; reversal-of-reversal rejected.
14. Corrections preserve originals (reversal + replacement, shared action ID, `corrected` overlay).
15. Offline replay idempotent (same ID → originals; retries reuse IDs unconditionally).
16. Concurrency never silently overwrites truth (winner + deterministic loser path + audit).
17. Invalid lifecycle transitions rejected (no backward moves; pre-post cancel vs post-post reversal distinguished).
18. Pre-post cancellation creates zero posted consequences; IDs never recycled.
19. Post-post reversal strictly additive (neutralising siblings + links, originals retained).
20. Errors deterministic + categorised per `70` with retry/correct/complete guidance; no stack-trace semantics.
21. Audit/lineage complete and undeletable for every commit + consequential rejection/conflict/dedupe.
22. Single-company scope per posting; cross-company refs rejected.
23. Voucher identity never duplicated across sources.
24. Domain validation never bypassed (orchestrator cannot force-commit over a sibling veto).
25. UI/adapters/imports create no business truth except via Engine-posted sources.
