# NiavERP — Stock Ledger and Movement Model (Conceptual)

> Phase 3. Immutable movement truth; balances derived. No valuation, no SQL.

## 1. Canonical representation (chosen): direction-enum + strictly positive quantity

- Each Stock Movement carries: `direction ∈ {IN, OUT}` + `quantity > 0` (exact decimal in stock unit) + `movement_type` + `item + location context` + `source/posting/movement IDs` + `business date + client/server timestamps` + `actor/company` + lineage/audit refs.
- Semantics: IN adds to the location balance; OUT subtracts. Net per (item, location) = SUM(IN) − SUM(OUT).
- Why not signed quantity: signed amounts invite ambiguous “negative receipt” / “negative issue” readings and double-negation bugs across offline/transfer/reversal paths. Direction-enum makes receipt vs issue vs reversal-of-receipt explicit at the row level and keeps validation a single rule (`quantity > 0`, direction required, type consistent with direction — e.g., Receipt→IN, Issue→OUT, Transfer-out→OUT, Transfer-in→IN, Adjustment±→matching direction, Reversal→opposite of original).
- Why not debit/credit: those are money semantics owned by Accounting (`26`); reusing them for quantity would blur the Accounting/Inventory boundary. Quantity uses IN/OUT only.

## 2. Movement dimensions (minimum, conceptual — not columns)

company, item, location context (1 location; transfers use paired rows with from/to), quantity (>0), stock unit (see `48` UOM invariant), business date, source durable ID (+ line intent where multi-line), posting identity, movement identity, movement type, direction, lineage links (`reversal_of/corrects/converted_from/migrated_from` where applicable), audit identity (actor, role-at-time, device, client/server time, reason where required).

## 3. Ledger properties

- Append-only; posted movements immutable, never edited/deleted/reordered.
- Every movement belongs to exactly one Company, one Item (stock-tracked at post-time), one Posting/Source.
- Non-stock/service items rejected at validation (see `40`): no movement may reference them.
- Retired items/locations accept no new movements; history retained and still folds into balances.
- Balance for (item, location) is always recomputable from the ledger slice; any cached display must be labelled derived and reconcilable (no drift tolerated; drift = defect).
