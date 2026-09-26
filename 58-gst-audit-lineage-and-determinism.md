# NiavERP — GST Audit Lineage and Determinism + Statutory Configuration (Conceptual)

> Phase 4. Reproducibility + versioned configuration. Reuses Phase 1 audit (`22`); no DB decisions.

## 1. Determination trace (minimum, per determination)

Source durable ID + transaction/voucher IDs + company + actor/role-at-time/device + client/server timestamps + business date + statutory-period tag + registration IDs (supplier/recipient at-date) + classification inputs verbatim (supply class, RCM/composition flags, jurisdiction inputs incl. place-of-supply output, HSN/SAC/category refs, qty/unit/values) + configuration reference (config ID + version + effective date) + per-line (taxable value → rate-ref → component → raw → rounding-ref → posted amount) + correction/reversal links + reason where applicable.

## 2. Determinism contract

Identical (source inputs, classification, jurisdiction, configuration version, calculation policy) → identical posted lines, independent of UI, locale, device, or wall-clock. Rounding is an explicit named rule in the trace, never float behaviour. Historical lines immutable; configuration changes are additive new versions; re-running old versions reproduces old results for audit.

## 3. Statutory configuration (versioned, effective-dated)

- A governed dataset: rate-refs per (classification × jurisdiction structure × date range), component-structure rules, HSN/SAC coverage maps, place-of-supply defaults, RCM/composition flags, rounding rules, calendar definitions. Versioned with effective-from/to; determinations pin their version; overlapping-effective versions rejected at governance time (governance workflow itself deferred, invariant locked).
- No rate database downloaded/embedded in Phase 4; no paid sources; future data via free/public authoritative imports through a versioned boundary (see `54§3`, `62`). Commercial calculators never authoritative.
