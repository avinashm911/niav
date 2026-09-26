# NiavERP — Transaction Boundary with Kacha → Pakka (Infrastructure Only)

> Phase 5. Primitives for Phase 6; zero business rules for conversion. Phase 6 owns all challan/conversion semantics.

## Provided primitives (locked)

1. **Source linkage:** N-source → 1-target reference sets on new postings (individual/bulk/many-to-one shapes transportable) with per-ref (source, line) granularity + shared action ID.
2. **Voucher lineage:** converted-from/to links across voucher identities preserved through posting + audit.
3. **Partial lineage capability:** line-quantity split tracking transport (delivered vs applied vs remaining reads) — Engine carries the refs; Phase 6 defines remaining-state derivation + over-conversion rejection.
4. **Correction/reversal transport:** linked neutralising/replacement chains across converted graphs (invoice reversal restoring convertibility only via Phase 6 state transitions, never flag edits — mechanism deferred to Phase 6).
5. **Remaining-quantity reads:** Engine exposes conversion-state reads for validation coordination; Kacha/Pakka owns the state machine.
6. **Audit continuity:** every linkage/reversal/correction across the challan→invoice graph emits linked audit with action IDs.

## Explicitly not decided here

Conversion eligibility, compatibility (same-party etc.), completion semantics, rate-edit gates (default DENY carried), stock/tax timing, series policies, bulk atomicity scope. Any Phase 5 consumer attempting conversion-shaped postings without Phase 6 policy fails closed (unknown conversion policy = `INVALID_SOURCE`-class rejection per `70`).
