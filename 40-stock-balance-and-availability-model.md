# NiavERP — Stock Balance and Availability Model (Conceptual)

> Phase 3. Derived reads only. No stored balances. No reservations/in-transit in V1.

## 1. Derivation (normative)

- `on_hand(company, item, location) = SUM(IN posted) − SUM(OUT posted)` over the ledger slice, including openings, receipts, issues, transfer legs, adjustments, reversals/corrections (which are ordinary IN/OUT rows with links).
- Company/item/location balances roll up by summation (location → company-item; item → location totals) as pure folds. No cached truth; any materialised display must reconcile exactly or it is a defect (no drift).

## 2. Quantity vocabulary (V1)

- **On-hand:** defined above. The only guaranteed quantity.
- **Available:** aliases On-hand in V1 (no reservation lifecycle). Screens may label “available” but must compute it as on-hand; no separate bucket, no hold/release semantics.
- **Reserved:** DEFERRED — no hold/allocate/release states, no reserved bucket, no availability-check-against-reserved. Rationale: no Phase 0/1 requirement justifies the added identity/lifecycle/expiry/race surface in V1; sales-phase availability policy will be expressed against on-hand + negative-stock rule (`48`), not phantom reservations.
- **In-transit:** DEFERRED — transfers are atomic paired movements with no lingering transit bucket (see `42`). A future dispatch→receive-across-time need would require new transit states + identity + timeout/claim lifecycle; not invented here.

## 3. Item eligibility

- **Stock-tracked:** items flagged stock-tracked participate in movements and balances.
- **Non-stock / service:** validation rejects any movement referencing them; they may still appear on invoice/payment/accounting paths per later phases, but never generate quantity effects. Flag changes are prospective master edits (audited); history keeps flag-at-time.

## 4. Drift prohibition

- No write path may set a balance directly (no `set_quantity`, no count-import-as-balance). Physical counts enter as Adjustment movements (before/after explainable via `41`), preserving the fold invariant.
