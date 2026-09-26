# NiavERP — Kacha → Pakka (Lawful Controlled Lifecycle)

> Phase 0. Conceptual only. No implementation, no GST math.

## 1. Purpose

Indian retail sales often begin as goods movement (Delivery Challan) before a formal GST invoice. NiavERP supports this reality with a **controlled, numbered, auditable** challan-to-invoice lifecycle — never as a shadow sales book.

## 2. Core Concepts

- **Delivery Challan:** a source transaction recording goods delivered/moved with party, items, quantities, and series reference. It is tracked, numbered, and preserved.
- **Voucher series:** configurable numbered series per company (e.g., Kacha-Challan series, Pakka-Challan series, Sales-Invoice series). Series define identity and audit order; server assigns final numbers.
- **Kacha:** challan series designated by the business for provisional/estimate-led movements per its internal process. Still numbered, still preserved, still visible in stock and audit.
- **Pakka:** challan series designated for formal movements that will convert to GST invoices. Same controls, plus conversion linkage.
- Classification is configuration, not concealment: both classes are first-class transactions in the engine.

## 3. Conversion (Lawful)

- Conversion creates a **new** sales invoice transaction that references its source challan(s). The challan is marked converted (partial/full) and retained.
- Supported patterns:
  - **Individual:** one challan → one invoice.
  - **Bulk:** many challans → many invoices in one action (each link preserved).
  - **Partial:** part of a challan's quantity converts now; remainder stays open and tracked as remaining quantity.
  - **Many-to-one:** multiple challans (same party, compatible facts) → one invoice with all source refs.
- Price changes at conversion are allowed **only where legitimately permitted** (e.g., corrected rate before invoicing with reason and audit); quantity/tax differences are recomputed by the engine + tax engine, never hand-edited in UI. Exact policy deferred to Phase 6.

## 4. Lineage & Continuity

- **Source references:** every invoice line derived from a challan carries `source_challan_id` + line ref; bulk/many-to-one carry full sets.
- **Remaining quantities:** challan lines track delivered vs invoiced vs remaining; over-conversion is rejected by validation.
- **Stock continuity (LOCKED global correction):** the challan delivery posts the single physical inventory OUT. The later invoice posts NO further stock movement — it consumes Kacha quantity and creates accounting/GST consequences only. Reversal restores appropriate effects through compensating lineage, never a second delivery.
- **Accounting continuity:** invoice creates the sale receivable/revenue; challan itself creates no sale revenue (movement only, per policy).
- **Tax continuity:** tax liability arises per Tax Engine on the invoice (and per statutory trigger), linked to both invoice and originating challans for traceability.
- **Audit history:** create → post → convert (partial/full) → reverse/cancel each emit audit events with actor/reason.

## 5. Reversal / Cancellation

- Unconverted challans may be cancelled per policy with reason and audit (no consequences to unwind beyond movement).
- Converted quantities cannot be "un-converted" by deletion; correction is via invoice reversal/credit (linked) plus challan state restoration through the engine.
- Cancellation of an invoice derived from challans restores challan convertibility only through engine-mediated state transitions, never manual flag edits.

## 6. Offline & Multi-Device Implications

- Challans created offline carry durable UUIDs; final series numbers assigned on server post.
- Bulk/many-to-one conversions validate remaining quantities server-side to prevent two billers converting the same challan twice.
- Idempotency keys on conversion actions; retries never duplicate invoices.
- Conflict (e.g., same challan converted on two devices) resolves by server authority with explicit conflict + audit; loser sees owner-understandable message.

## 7. Explicit Prohibitions

The Kacha → Pakka design must **never** facilitate:

- tax evasion
- fabricated invoices
- fabricated transactions
- concealment of sales
- false records
- manipulation of tax liability

Concretely forbidden: untracked challans, deletable challans, editable posted invoices, dual-book views, "do not show in GST" flags, UI-driven tax suppression, or any conversion path that breaks lineage.

## 8. Deferred to Phase 6

Exact stock-effect timing (challan vs invoice), rate-edit policy matrix, series-numbering model, and GST trigger details. Phase 0 locks only the principles above.
