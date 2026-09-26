# NiavERP — Transaction Error and Rejection Model (Conceptual)

> Phase 5. Deterministic business categories; no stack traces; caller-actionable outcomes.

## Canonical categories (locked vocabulary; use exactly these)

- `INVALID_SOURCE` (malformed/unknown type, mutated posted source, line-shape violation) → permanent; fix business facts.
- `UNAUTHORIZED` (no membership/grant at commit) → permanent until grants change; audit where sensitive.
- `INVALID_COMPANY_CONTEXT` (missing/cross-company refs) → permanent.
- `INVALID_DATE` (missing/future-per-V1/misresolved business date) → permanent.
- `PERIOD_CLOSED` / `PERIOD_LOCKED` (ordinary vs all rejected; adjustment path authority-gated, mechanics deferred) → correct date or seek authority.
- `INVALID_MASTER_REFERENCE` (unknown/retired/ineligible party/item/location/series/registration) → permanent until master fixed.
- `STOCK_CONFLICT` (availability DENY, conservation mismatch, same-location transfer, non-stock movement attempt) → correct quantities/locations.
- `TAX_CLASSIFICATION_UNAVAILABLE` (ambiguous inputs) / `TAX_CONFIGURATION_STALE` (no effective coverage / superseded-at-commit) → resolve inputs or await config; never silent-tax.
- `ACCOUNTING_VALIDATION_FAILED` / `INVENTORY_VALIDATION_FAILED` / `GST_VALIDATION_FAILED` / `PAYMENT_VALIDATION_FAILED` (delegated sibling veto with domain reason) → fix per sibling discipline.
- `DUPLICATE_SOURCE` (same ID already posted; idempotent success — returns originals, not an error to the retrying caller) → converge.
- `CONFLICT` (lost race; winner refs provided) → refresh + retry as new source if business intent still stands.
- `INVALID_LIFECYCLE_TRANSITION` (backward/cancel-posted-bypass/double-reverse/reverse-reversal) → permanent.

## Caller contract

Every rejection returns: category + human reason (owner-understandable, localisable presentation) + implicated refs (source/voucher/period/master) + whether retryable / needs-correction / already-complete + attempt/replay IDs for support. Transport failures are transport-level (retry same ID); business rejections above are never retried verbatim. Rejections of consequential attempts (closed-period, auth, conflict) emit audit events.
