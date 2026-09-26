# NiavERP — Phase 2 Decisions (Locked / Deferred / Open)

> Close-out. Phase 0/1 untouched. No SQL, no rates, no valuation, no formats invented.

## LOCKED

1. Account ≠ Ledger ≠ Journal ≠ Entry (`26`): Account=definition, Ledger=posted rows, Entry=balanced unit, Journal=derived view. Wording mandatory from here on.
2. Balance rule absolute: unbalanced, zero-leg, and negative-leg intents never post (`27`, invariants 1/15).
3. Single functional currency (INR) assumed for V1 postings; single-sided positive legs only.
4. Posting = atomic per source (1↔1 base model); batches group but never share balance (`24`, `27`).
5. Three timestamps retained and never conflated: business date → period/reports; system → commit/audit order; client → sync/UX (`27§3`).
6. Periods: open→closed→locked with audited transitions; ordinary postings open-only; future-dated rejected in V1 (`28`).
7. Openings flagged `is_opening`, period-bound, batch-linked, excludable, correctable only via new openings (`29`).
8. Reversal = leg-for-leg neutralising entry + links; Correction = reversal + replacement under shared action ID; no in-place edits (`31`).
9. Ownership preserved: Accounting owns rows/policy, Payments owns facts+links, Receivables/Payables own derived balances (`32`); money-account defs under Accounting policy, movements via Payments (`33`); advances = zero-application payments, never auto-applied here.
10. 16 invariants (`34`) + 25-case matrix (`35`) are the Phase 3 entry gate.

## DEFERRED (explicit)

- Exact DB/schema/storage, RLS, function signatures, code formats, scale/rounding implementation notes.
- Chart templates/starter packs, depth limits, code formats, reclassification mechanics, cost centres.
- GST account bindings/rates/treatments/returns (Phase 4); inventory/cost-of-goods bindings and valuation math (Phase 3); discount/round-off/advance-timing policies (Phase 5/7/8/9).
- Voucher catalogue finalisation, split-tender mechanics, cross-role netting, orphaned-application resolution on invoice reversal (Phase 5/9).
- Period-end adjustments, year-end carry-forward, statutory close checklists/calendars.
- Tally/BUSY mappings, report implementations.

## OPEN (carried risks/unknowns)

- Adjustment-posting mechanics into closed periods (authority workflow → Phase 16).
- Replacement-entry shape choice (two-posting vs net-difference single corrective — lineage equivalent required either way).
- Multi-currency future: no model yet; any FX need requires new decision, not silent extension.
- Reporting restatement policy for cross-period corrections (Phase 13).

## Phase 3 boundary

Phase 3 (Inventory Engine) may assume: balanced-entry discipline, period/identity/lineage/audit hooks, money-account and party-ledger concepts, and placeholder stock-role accounts — without reopening ownership. It must define stock-ledger semantics, location/transfer effects, and its own legs on shared postings without touching money-row ownership or inventing valuation prematurely beyond its charter.
