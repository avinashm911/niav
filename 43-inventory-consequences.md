# NiavERP — Inventory Consequences (Conceptual Examples)

> Phase 3. Quantity legs only. No money/tax legs, no sale/purchase workflows, no valuation.

## Pattern per example

`Source intent → inventory consequence (IN/OUT rows) → lineage note`.

## 1. Opening stock

- Intent: go-live quantity Q of item I at location L (migration/batch).
- Consequence: `IN Q @ L` flagged `is_opening`, batch-linked. No OUT anywhere.

## 2. Receipt (generic goods-in; sale/purchase workflows deferred)

- Intent: goods-in Q of I at L (e.g., opening-like receipt, adjustment-free intake; purchase-bill workflow itself is Phase 8).
- Consequence: `IN Q @ L`. No accounting/tax legs defined here.

## 3. Issue (generic goods-out)

- Intent: goods-out Q of I at L.
- Consequence: `OUT Q @ L`, subject to negative-stock policy (`48`).

## 4. Transfer (L1 → L2, qty Q)

- Intent: one transfer source (line: I, Q).
- Consequence: `OUT Q @ L1` + `IN Q @ L2` atomically, shared transfer ID. Net company qty unchanged.

## 5. Adjustment increase / decrease

- Intent: governed correction with reason (count/damage/spoilage-as-quantity).
- Consequence: single `IN` (increase) or `OUT` (decrease) flagged `is_adjustment` + reason + audit.

## 6. Reversal / correction illustrations

- Reversal of receipt `IN Q @ L` → new `OUT Q @ L` with `reversal_of` link.
- Correction of mis-located issue (`OUT Q @ wrong`) → compensating `IN Q @ wrong` + correct `OUT Q @ right` under shared correction ID.

## 7. Explicitly not defined here

Sale-issue, purchase-receipt, challan-movement, invoice-linked, or return-linked quantity bindings — those attach quantity consequences to Phase 5/6/7/8 sources on the same atomic posting; this doc fixes only the row shapes above so later phases cannot redefine movement semantics. No COGS, no tax legs, no pricing.
