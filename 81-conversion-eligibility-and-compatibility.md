# NiavERP — Conversion Eligibility and Compatibility (Conceptual, Fail-Closed)

> Phase 6. What may convert and what may combine. Incompatibility never merges silently.

## Eligibility (single source line converts iff ALL hold at commit)

Posted (not draft/cancelled-pending) + company-active + series open at source post-time (history valid regardless) + line has remaining > 0 covering requested qty + requesting actor authorised for conversion + target period open for the Pakka business date + GST classification inputs resolvable for the target (or explicit deferred-timing policy where Phase 7 allows — requirement only, mechanics deferred) + no conflicting terminal overlay (already fully reversed source needs correction path, not conversion).

## Compatibility (many Kacha → one Pakka additionally requires ALL)

Same company + same party (bill-to identity; ship-from variance only where location policy allows — default same-party strict) + compatible document context (all sources posted, none terminally voided for conversion purposes) + compatible currency (single INR V1; any future multi-currency needs new decision) + compatible tax/jurisdiction inputs (one determination structure per target invoice; mixed intra/inter inputs rejected) + compatible item/unit semantics (per-line units resolve to stock units; no silent ratio invention) + compatible source state (each line remaining suffices; no line double-spent across concurrent actions — commit-order serialisation).
- Same-customer membership alone does not imply compatibility; every predicate above is independently evaluated. Any failure → whole conversion action fails closed (`INVALID_SOURCE`-class per `70` + reason identifying the failed predicate), no partial Pakka, no partial consumption. Deferred refinements (Bill-to/Ship-to splits, SEZ, RCM-mixed batches) are explicit later decisions, not silent allowances.
