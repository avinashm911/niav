# NiavERP — Taxable Value and Calculation Model (Conceptual)

> Phase 4. Semantics + determinism + trace; commercial rule completeness explicitly deferred. Example figures below are ILLUSTRATIVE ONLY, never locked rates.

## 1. Separation (normative)

`item/service value | qty | unit → line value → (− discounts → + charges → ± round-off-as-policy) → taxable value → (rate-ref) → component amounts → rounding → posted tax lines`

- Each arrow is an explicit, ordered, auditable step with named policy refs + configuration version. Steps never collapse (e.g., discount must not hide inside quantity; round-off must not hide inside taxable value).
- Unresolved commercial policies are deferred individually (see §3), not silently decided. Where a step has no locked policy, determination requires explicit inputs covering it or rejects as ambiguous (per `51§3`).

## 2. Deterministic calculation trace (minimum, per source line)

`taxable value → rate reference (config id + version + effective date) → component role → raw amount → rounding rule ref → posted amount`, with inputs (qty, unit→stock-unit resolution per Phase 3 UOM invariant, values, discount/charge adjusters as given) preserved verbatim. Re-running the trace on identical inputs + version reproduces identical posted amounts bit-for-bit conceptually; any lawful rounding is an explicit rule application, never float drift (exact decimal semantics inherited from `27`).

## 3. Deferred commercial specifics (→ `62`, not decided here)

Line vs bill-level discount ordering, freight/insurance/packing inclusion, trade vs cash discount treatment, coupon/credit-note netting, quantity-Vs-value precedence, multi-unit conversions beyond stock-unit invariant, and every statutory inclusion/exclusion list. Phase 4 locks only the step order + trace + determinism + ambiguity-default-deny.

## 4. Illustrative example (NOT a rule; rates fictional)

*Example only:* line value 1,000 (qty 10 × 100) − discount 50 + charges 20 → taxable 970; fictional rate-ref `EXAMPLE-9+9` → CGST 87.30 + SGST 87.30 after explicit rounding rule. Real rates/configurations are governed data resolved at determination time, never literals from this doc.
