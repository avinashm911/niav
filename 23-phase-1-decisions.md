# NiavERP — Phase 1 Decisions (Made, Deferred, Risks, Phase 2 Gates)

> Phase 1 close-out. Phase 0 docs untouched; wording corrections recorded here, not silently applied.

## 1. Decisions made (Phase 1)

1. Canonical glossary locked (`12`); Business = display alias for Company; Customer/Supplier = role views on Party; Warehouse = Location subtype; Branch not modelled (use Location + deferred grouping label).
2. Entity classes locked: master / transaction / consequence / control-audit / integration (`13`).
3. Single-owner matrix locked (`14`) with rule “dependency ≠ ownership”; Engine = orchestration/gateway, not owner of consequence semantics.
4. Cycles resolved conceptually: Inventory owns stock truth, Warehouse owns location defs + transfer intent; Payments owns facts+links, Receivables/Payables own derived balances; Engine commands consequence writes via ports, consequences never command Engine or each other.
5. Canonical chain adopted everywhere (`16`, `21`): validate → post → atomic acct+inv+tax → payment links → audit → derived reads → sync; payment timing may lag posting without breaking atomicity.
6. Three-axis state model locked (`17`): (A) lifecycle status, (B) conversion state (challans only), (C) correction/reversal linkage. Payment-paid flags are derived reads, not lifecycle.
7. Voucher authority: client proposes series intent + durable ID; server assigns final numbers; same ID → same number (`18`).
8. Kacha = first-class, never off-books; conversion additive with line-level refs; remaining derived + enforced; rate edits default DENY with six-gate hook for Phase 6 (`19`).
9. Identity model: durable source ID (UUID-v4-or-equivalent conceptual) stable across sync; numbers/timestamps anchored alongside, never replacing (`22`).

## 2. Deliberately deferred (not Phase 1)

- Physical schemas/columns/indexes, RLS policies, function signatures (Phase 2+).
- Posting legs/chart, costing, negative-stock policy details (Phase 2/3).
- GST rates/slabs/HSN/place-of-supply/return formats, e-invoice/e-way scope (Phase 4).
- Voucher-type catalogue finalisation, series-counter mechanics, period-lock mechanics (Phase 2/5/16).
- Conversion compatibility rules, rate-edit allow-list, stock-effect timing (Phase 6).
- SQLite library, sync transport/algorithm, grant-expiry durations, device enrolment, biometric/PIN (Phase 11/12/16).
- Languages beyond Hindi+English, print formats, barcode hardware, UPI-intent UX, exact role matrix, Hindi glossary (Phase 10/16).
- Tally/BUSY mechanisms/field maps, migration templates, hosting/backup (Phase 17/18/19/20).

## 3. Unresolved terminology (carried)

- Branch vs Location grouping label (deferred to Phase 10/16 UX/admin).
- Discount/promotion and price-list vocabulary (deferred to Phase 5/7 pricing policy).
- Approval-chain / second-actor mechanics (deferred to Phase 16).

## 4. Phase 0 wording corrections recorded (no silent rewrites)

- `03 §13-14, §15/20, §8`: read Depends as consumes/calls per `14`; ownership per `14` supersedes for Phase 1+ design.
- `02 §3` vs `04 §1`: adopt `16` canonical chain with payment-links slot; treat `02` as summary.
- `04 §5`: `corrected_by/converted` overlays split per `17` axes (A/B/C).
- `01 §5 “Tally XML internals”`: reference only, not a spec; no correction needed beyond `08` boundary.

## 5. Dependencies for Phase 2 (Accounting Engine)

Required from Phase 1: Company/Series/Party/Item/Location identities, source/posting/lineage spine (`16`), lifecycle axes (`17`), ownership matrix (`14`), consequence boundaries (`21`), audit/identity hooks (`22`). Phase 2 may define chart/posting legs/period controls + tests without reopening Phase 1 ownership.

## 6. Risks discovered

- Rate-edit pressure at conversion (shop demands “just change rate”): mitigated by default-DENY + six-gate hook; Phase 6 must hold the line with validation + audit.
- Many-to-one compatibility scope creep: keep narrow (same party + compatible facts); Phase 6 must define rejection cases.
- Payment-before-invoice vs advance confusion: advances are payments with zero applications, not a new entity; Phase 9 must preserve this.
- Branch-as-ledger temptation: enforce Location-only in Phase 1 consumers; multi-ledger-per-company needs explicit constitution amendment.

## 7. Quality-gate pre-check (Phase 1 §CHECK 1-17)

To be verified by gate run after this file: single owner per fact; no circular ownership (resolved per §1.4); Engine orchestration; ledger/inventory/tax ownership; payments vs balances split; status vs conversion split; history-preserving correction; lineage on all consequences; Kacha first-class; durable offline identity; no Phase 2/SQL/GST-rate/Tally-format leakage; Phase 2 boundary clear.
