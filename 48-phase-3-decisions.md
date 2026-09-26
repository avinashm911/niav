# NiavERP — Phase 3 Decisions (Locked / Deferred / Open)

> Close-out. Phase 0/1/2 untouched. No valuation, GST, SQL, UI invented.

## LOCKED

1. Inventory owns quantity truth; movements append-only; balances derived folds with zero drift (`37`,`38`,`40`, inv 1/7).
2. Canonical row shape: direction-enum (IN/OUT) + strictly positive quantity; no signed quantities, no debit/credit reuse, no zero/negative legs (`38`, inv 6).
3. Location = dimension, Warehouse = subtype; Branch not modelled; transfers require two distinct active locations (`39`, inv 17).
4. V1 quantities: On-hand guaranteed; Available aliases On-hand; Reserved and In-transit explicitly deferred (no buckets, no lifecycles) (`40`).
5. Movement vocabulary locked to: Opening, Receipt, Issue, Transfer Out/In (paired), Adjustment Increase/Decrease, Reversal (+ Correction as reversal+replacement pattern). No sale/purchase/challan bindings invented here (`43`).
6. Transfer = (A) one source with paired atomic movements; conservation OUT=IN per line; no transit/logistics; paired reversal/correction (`42`, inv 9).
7. Adjustments/openings governed: mandatory reason (adjust), `is_adjustment`/`is_opening` flags, batch links, separability, additive correction only (`41`).
8. Reversal = opposite-direction equal movement + links; Correction = reversal + replacement + shared action ID; pre-post cancel posts nothing; double reversal rejected (`41`, inv 10/11).
9. Offline/concurrency: durable source ID = idempotency key; replays converge; append-only under server authority; stale availability estimates never override (`45`, inv 8/19/20).
10. Boundaries: no money/tax/valuation owned or written by Inventory; no quantity written by Accounting; GST lineage preserved without computation (`44`).
11. Negative stock (decision, V1): **DEFAULT DENY** — issues (and OUT legs generally incl. adjustments/transfers-out) that would drive on-hand below zero are rejected at server validation with reason + correction path. Rationale: preserves auditability and billing correctness under offline/concurrency; prevents silent backdated negatives; keeps future valuation (Phase 3+/4) from building on undefined cost basis. Narrow, explicitly-governed exceptions (if any) require a future constitution-compatible decision with reason + actor + audit + bound — none granted in Phase 3. Phase 7 sales may therefore post stock only when on-hand suffices or a governed exception path (defined then, not now) applies.
12. UOM minimum invariant (decision): movement quantity is expressed in the item’s stock unit at post-time; transaction/display units (if any) resolve to stock-unit quantities before posting via governed master conversions only — never silent ratios, never per-transaction invention. Full conversion engine deferred; this invariant prevents corruption (`48§UOM` carried here as lock).
13. Serial/batch/expiry (decision): DEFERRED as future dimensions. No serial/batch/lot/expiry identity, movement attributes, or lifecycle in Phase 3. Adding them later requires revisiting stock identity (finer-grained than item/location) + movement semantics via new decision; forbidden to smuggle them as free-text refs treated as truth.

## DEFERRED

Valuation/costing/COGS/stock-account roles; GST rates/treatment; sale/purchase/challan/Kacha-Pakka quantity bindings (Phase 5/6/7/8); reservations, in-transit/logistics, serial/batch/expiry, advanced UOM engine; price lists, discounts, split mechanics; reports/reconciliation; Tally/BUSY; schema/SQL/RLS/functions; mobile UI; role-permission matrix details (Phase 16); period-end stock routines.

## OPEN (risks carried)

- Availability UX under DENY-negatives for high-volume counters (Phase 7/10 must design split-qty/transfer-in/adjust-with-reason paths so rejections are actionable, not dead-ends).
- Multi-line transfer atomicity scope (base = all-or-none per source; any partial-line policy needs explicit justification later).
- Future dimensions (serial/batch/expiry/reserved/transit) will reshape identity — Phase 3 locks item/location granularity only for V1 scope.

## Phase 4 prerequisites

Quantity spine (immutable IN/OUT ledger + derived balances + paired transfers + governed adjustments/openings + lineage/audit/idempotency hooks) with money/tax unowned. Phase 4 (GST/Tax Engine) may consume item/location/quantity/business-date/party lineage for determination without redefining movement semantics or touching quantity truth.
