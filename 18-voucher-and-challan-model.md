# NiavERP — Voucher and Challan Model (Conceptual)

> Phase 1. Identity, series, numbering authority, and challan conversion mechanics. No schema.

## 1. Voucher (all types)

- **Identity:** stable voucher identity per Source Transaction (1↔1). Human reference = Series + final Number (assigned at server post).
- **Type:** sale-invoice, purchase-invoice, delivery-challan, payment, receipt, transfer, journal, credit/debit-note (conceptual set; exact catalogue finalised in Phase 5).
- **Series:** per-company named sequence per type (e.g., `SALE-25`, `CH-KACHA-25`, `CH-PAKKA-25`). Company configures; Voucher executes; server assigns finals (multi-biller safety).
- **Document number:** final, unique per Series, never reused. Provisional local display pre-post is not the number.
- **Source reference:** voucher ↔ source-transaction ID (immutable pair).
- **Transaction date:** business date (owner-facing) vs posting/server timestamps (system). Both retained; reports use business date, audit uses both.
- **Lifecycle:** `17` axis (A). Posting state derived from Engine events, not a writable flag.
- **Audit linkage:** every number assignment, post, reverse, cancel, correct emits an audit event with series/number/actor/reason.

## 2. Delivery Challan (specialisation)

- **Source identity:** source-transaction ID + challan series/number. Preserved forever, including after full conversion.
- **Kacha series:** configured series whose movements follow provisional-process policy but identical controls (numbered, posted, stock-tracked, audited).
- **Pakka series:** configured series intended for invoice conversion; same controls + conversion linkage.
- **Conversion relationship:** via Conversion records: (challan line refs) → (invoice). Supports:
  - individual `1→1`,
  - bulk (one action, N independent `1→1`),
  - partial (line qty split, remainder open),
  - many-to-one (N challans → 1 invoice, same party + compatible facts; exact compatibility deferred to Phase 6).
- **Remaining quantity:** derived per challan line (`delivered − invoiced` over Conversion records). Roll-up gives Conversion State (`17` axis B). Negative remaining is invalid by definition; Engine rejects over-conversion.
- **Reversal/cancellation lineage:** unconverted challans cancel per policy (reason + audit, history kept). Converted quantities un-convert only via invoice reversal/credit + engine-mediated restorability of convertibility — never manual flag edits, never deletion.

## 3. Numbering authority (conceptual)

- Client proposes Series intent + durable ID; server validates Series open + grants + period, then assigns final Number at Posting.
- Retries/resubmits with the same durable ID return the same Number (idempotency), never a second number.
- Closed/retired series assign nothing; attempts rejected with owner-understandable reason.
