# NiavERP — Sales Invariants, Test Matrix and Phase 7 Decisions (Combined)

> Phase 7 close-out. Design-only. No code/SQL/UI/rates/integrations. Prior phases untouched (see §D).

## A. SALES INVARIANTS (locked, enforceable)

1. Single durable sales source identity per posted invoice; no posted sale without it.
2. Invoice numbers unique per (company, series), server-assigned, never recycled, replay-stable.
3. Line intent IDs stable; posted lines immutable; change only via return/reversal/correction chains.
4. Quantities > 0 exact in stock-unit-resolvable units; no silent ratio invention.
5. Pricing snapshots frozen at intent; representation (exclusive/inclusive) labelled, never silently converted by Sales.
6. Discounts/charges labelled inputs (level + basis); never hidden inside qty/price; unsettled policies fail closed as ambiguous.
7. Taxable-value inputs complete or the invoice fails closed; Sales never computes tax.
8. Party present with customer role (no default anonymous path in Phase 7); registration/jurisdiction/location contexts explicit or fail closed.
9. Stock location valid + active; availability evaluated at commit under DENY-negatives.
10. Inventory owns quantity effects; Sales never writes movements.
11. Accounting owns money effects; Sales never writes legs/balances.
12. GST owns determination/lines; Sales never classifies/rates/rounds.
13. Payments owns payment facts; Receivables owns outstanding derivation; advances never auto-applied; paid-state derived only.
14. Converted invoices carry complete Kacha (source,line,qty) refs + action ID; Kacha sources retained + linked.
15. Remaining/returnable derived (`delivered−converted`, `invoiced−returned−reversed-cover`); over-convert/over-return structurally rejected; remainders never negative.
16. Compatibility required for multi-source invoices; incompatible sets fail whole action.
17. Rate edits DENY by default; any future allowance needs case+actor+reason+recompute+audit+snapshot (none exists in Phase 7).
18. Returns additive with eligibility + links; originals retained; returnable enforced.
19. Reversal additive + linked; duplicates and reversal-of-reversal rejected.
20. Correction = reversal + replacement under shared ID with `corrected` overlay; failed replacement per action policy with lineage equivalence.
21. Pre-post cancel creates zero consequences; IDs never recycled.
22. Offline replays idempotent (same ID → originals; retries reuse IDs).
23. Concurrency serialised server-side with deterministic loser paths; no silent overwrites.
24. Invalid lifecycle transitions rejected; payment/return/correction states never masquerade as lifecycle.
25. Company scope never crossed; cross-company refs rejected.
26. Every sibling links source/transaction/posting/voucher; full chain traversable both directions.
27. Audit complete + undeletable for commits + consequential rejections/conflicts/dedupes.
28. No UI/adapters/imports create sales truth except via Engine-posted sources; no Tally/BUSY/GST-rate/valuation logic in Sales.

## B. TEST MATRIX (substantial; each: ID/scenario/precondition/action/expected/atomicity/lineage; all deterministic except race-order notes history-deterministic)

- T01 direct cash sale (imbalanced → posted siblings + payment + links + audit; atomic all-or-none; lineage full).
- T02 direct credit sale (zero applications; outstanding = full derived).
- T03 partial payment (one invoice, part applied; outstanding re-derived).
- T04 multiple payments (N payments + link sets converge to settled).
- T05 advance (zero-application payment labelled advance; later application appends, legs untouched).
- T06 direct invoice lineage (source→voucher→siblings→audit→reads traversable).
- T07 Kacha→Pakka invoice (full 1→1 with refs + remaining→0 + fresh GST determination).
- T08 partial Kacha conversion (100→40 remainder 60 partial; second 60 completes).
- T09 multi-source compatible conversion (union refs, per-source roll-ups, one Pakka).
- T10 incompatible conversion fails closed whole action (cross-party/mixed-structure).
- T11 duplicate replay converges (retry/ack-loss/double-tap/cross-device same ID → originals + dedupe audit).
- T12 simultaneous billing (distinct sources → distinct numbers, commit-order validation).
- T13 stock conflict (second issue exceeds on-hand → `STOCK_CONFLICT` + refresh, no negative).
- T14 GST ambiguity fails closed (missing jurisdiction/config → reject, never silent-tax).
- T15 stale GST config at sync (provisional superseded, server version posts with outcome).
- T16 sales return partial (returnable enforced, compensating siblings + links).
- T17 multiple returns to full (sequential until returnable zero).
- T18 full return (all lines; outstanding/restock/tax chains linked).
- T19 over-return rejected (request > returnable, nothing consumed).
- T20 reversal (compensating set + links + overlays; originals retained).
- T21 duplicate reversal + reversal-of-reversal rejected.
- T22 correction (reverse + replace, shared ID, `corrected` overlay; failed replacement per policy).
- T23 pre-post cancellation (zero consequences, ID retired, number never consumed).
- T24 invalid period (closed/locked/future per `70` categories).
- T25 authorization failure (`UNAUTHORIZED` at commit incl. changed-while-offline).
- T26 invalid item (unknown/retired/non-stockable for quantity path).
- T27 invalid quantity (zero/negative/unresolvable unit).
- T28 invalid party (missing/wrong-role/cross-company).
- T29 numbering race (same-series concurrent → distinct replay-stable numbers).
- T30 offline invoice replay (durable ID → one commit with server anchors).
- T31 failed replay paths (stale master/period/consumed-remaining → reject + correctable new source).
- T32 audit traversal (both-directions walk incl. Kacha ancestors + sibling IDs + sync outcomes).
- T33 converted-vs-direct convergence (identical downstream sibling discipline; origins differ, engine single).
- T34 rate-edit denial (snapshot≠target without allow-list → rejected; snapshot preserved).
- T35 converted-invoice reversal restores Kacha remaining via lineage (no flag edits).
- T36 payment-after-credit application (later payment links to posted credit invoice; outstanding re-derives).

## C. PHASE 7 DECISIONS

**Locked:** bounded Sales orchestration with dual origins converging on one Engine + consequence owners; commercial-fact capture vs computation split (§94); context capture with fail-closed validation (§95); cash (same-action payment siblings) vs credit (zero-application outstanding) (§96); converted flow preserving all Phase 6 rules (§97); sibling boundary contract (§98); payment/advance/application/read-model split (§99); additive returns with returnable derivation (§100); cancel/reverse/correct/return four-way distinction (§101); server numbering + period + serialised concurrency (§102); offline queue-then-validate with freshness + visibility (§103); bidirectional audit + read-only reporting hooks (§104); 28 invariants + 36 tests as Phase 8 entry gate (this doc).
**Deferred:** discount-level ordering, inclusive↔exclusive conversion, round-off placement, freight/packaging/coupon treatment; Bill-to/Ship-to splits; statutory return windows + credit-treatment detail; cancellation/e-invoice time-bars; ageing buckets + allocation algorithms + dunning (Phase 9); report implementations + filing; Tally/BUSY; schema/SQL/APIs/UI; roles matrix; serial/batch/expiry interplay; multi-currency.
**Phase 8 dependencies:** purchase-side workflows will mirror this contract (supplier roles, receipt-side stock direction, payable derivation, purchase returns); shared correction/period/offline/audit discipline reused unchanged.
**Risks:** commercial-policy ambiguity pressure (shops expect “just adjust price/discount”) held by fail-closed + deferred list; return-vs-correction confusion in UX (Phase 10 must keep intents distinct); converted-invoice tax-timing already lineage-safe but report presentation deferred to Phase 13.
**Assumptions:** single INR V1; anonymous counter-sales require explicit future policy (none granted); advances never auto-apply.
**Unresolved statutory:** return-window/time-bar rules, e-invoice cancellation constraints, SEZ/RCM-mixed sales batches, service/SAC sales scope — all deferred with fail-closed behaviour, none defaulted.

## D. CROSS-PHASE CONSISTENCY + FILES

- Consistency: no contradictions found against Phase 1 (ownership/identity/lineage/axes), Phase 2 (money/receivable/payment/period/reversal), Phase 3 (quantity/movement/availability/concurrency), Phase 4 (tax ownership/classification/determinism/staleness/audit), Phase 5 (orchestration/numbering/atomicity/idempotency/errors/replay), Phase 6 (Kacha lifecycle/remaining/compatibility/modes/DENY/reversal/offline/audit). Two deliberate non-duplications (not contradictions): discount/round-off ordering left deferred (was already deferred in Phase 4 commercial scope); Bill-to/Ship-to left deferred (was already deferred in Phase 6).
- Files changed: none before Phase 7. Files created: docs/92–105 (14). Prior phases untouched.
