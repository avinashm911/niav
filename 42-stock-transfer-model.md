# NiavERP — Stock Transfer Model (Conceptual)

> Phase 3. Canonical choice (A): one transfer source identity with paired movement consequences. No transit bucket, no logistics.

## 1. Canonical model (A) — locked

- One Transfer Source (durable ID, from ≠ to, one item per line intent; multi-item doc = one source, N line intents) → exactly **two** posted movements per line: `OUT at source location` + `IN at destination location`, same item/quantity/unit, shared transfer/source ID + line intent ID, same posting atomicity.
- Atomicity: both legs post or neither (transfer posting is all-or-none per line; multi-line sources are all-or-none per source in the base model — partial-line success deferred as explicit policy only if a later phase justifies it, default all-or-none).
- Why not (B) two independent sources: independent sources would allow half-transfers (OUT without IN), destroy conservation auditability, and double the idempotency/conflict surface. Model A gives one idempotency key, one lineage spine, and a single conservation check. Validated against `14` (Warehouse owns intent, Inventory owns paired rows, Engine executes) and `27§4` (atomic fan-out): consistent.

## 2. Conservation

- Per transfer line: `OUT qty = IN qty` (same unit). Net stock across the company for that item is unchanged by the transfer itself (only its location distribution changes). Validation rejects mismatched pairs; reversal/correction preserve conservation symmetrically.

## 3. Lineage

- Transfer Source ID → OUT movement + IN movement (+ posting ID + audit). Multi-line: source → per-line OUT/IN pairs. Reversal: paired compensating movements (IN at source-location… precisely opposite of each original leg) sharing a reversal action ID + `reversal_of` per leg. Correction: paired reversal + paired replacement under shared correction ID.

## 4. No transit, no logistics

- No in-transit state/bucket/claim/timeout in Phase 3. Dispatch and receipt are the same atomic posting event. Transport tracking, vehicle/route, proof-of-delivery, and split dispatch→receive across time are explicitly out of scope (future need would add transit identity + lifecycle via new decision, not silent extension).
- Same-location, cross-company, and non-stock-item transfers rejected at validation with reasons.
