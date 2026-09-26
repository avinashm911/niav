# NiavERP — Phase 5 Decisions (Locked / Deferred / Open)

> Close-out. Phase 0–4 untouched. No SQL, code, deps, UI, integrations.

## LOCKED

1. Engine = orchestration only (`63`): identity binding, sequencing, atomic boundary, idempotency, linkage, error taxonomy. Zero consequence semantics duplicated.
2. Source→voucher→number chain with server authority, replay-stable unique never-recycled numbers; type/series abstraction for later vouchers (`64`).
3. Lifecycle axes preserved (A/B/C split per `17`); valid/invalid transitions + cancel-vs-reverse distinction (`63`,`69`).
4. 14-stage validation sequence with delegated domain validators + pre-vs-commit distinction + 8 outcome classes (`65`).
5. Single atomic posting boundary across declared siblings or clean failure (`66`); explicit participation sets, no assumed siblings (`67`).
6. Source-ID idempotency (1 source = 1 identity = 1 consequence set) + server-ordered append-only concurrency with deterministic loser paths (`68`).
7. Canonical error vocabulary (17 categories incl. idempotent `DUPLICATE_SOURCE` convergence) with caller contract (`70`).
8. Reversal (additive neutralising) + correction (reversal + replacement, shared action ID) orchestration; domain math stays in domains; duplicate/reverse-reversal rejected (`69`).
9. Offline replay: durable IDs reused unconditionally, then-current validation governs, estimates never bind (`72`).
10. Audit/lineage assembly per attempt/transition with sibling refs + error/replay/conflict records (`71`).
11. Kacha/Pakka infrastructure primitives only (linkage sets, voucher lineage, partial-ref transport, correction transport, state-read exposure, audit continuity); all conversion rules deferred with fail-closed behaviour (`73`).
12. 25 invariants + 57-case matrix as Phase 6 entry gate (`74`,`75`).

## DEFERRED (explicit)

DB transactions/SQL/RLS/RPC/Edge/API contracts; numbering-series implementation + exact voucher catalogue; sales/purchase workflows + participation bindings per type; Kacha/Pakka rules/timing/matrix; payment UI/collection/allocation algorithms; GST filing/e-invoice/e-way; reports/reconciliation; Tally/BUSY; mobile UI; role matrix; period-end routines; correction-action partial-failure policy choice (lineage equivalence required either way).

## OPEN (risks carried)

- Participation-set authoring per voucher type (Phase 6/7/8 must declare precisely; undeclared extras fail closed by default — catalogue discipline required).
- Correction-action atomic scope on failed replacement (full-rollback vs partial-accept; either must preserve lineage equivalence — decide once in implementation guidance, not per incident).
- High-contention numbering/availability UX under races (Phase 7/10 must make `CONFLICT`/`STOCK_CONFLICT` actionable, not dead-ends).

## Phase 6 prerequisites

Orchestration spine (identity/numbering/validation/atomicity/idempotency/errors/reversal/offline/audit + linkage primitives) with all consequence semantics unowned. Phase 6 may define challan classification, conversion eligibility/compatibility/completion, remaining-state derivation, and rate-gate mechanics on top — without redefining identity, atomicity, numbering, or cross-domain ownership.
