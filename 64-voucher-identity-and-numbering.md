# NiavERP — Voucher Identity and Numbering (Conceptual)

> Phase 5. Server-authoritative numbering abstraction for later voucher types. No numbering code, no catalogue lock.

## Chain (normative)

`Source durable ID (+ series intent + type + company + business date) → Voucher identity (1↔1 with Source) → final Number (unique per Series, assigned at server post)`.

- Preserved on every transaction: company scope, transaction type, source durable ID, voucher identity, business date + client/server timestamps, series intent, final number, full lineage.
- Client proposes series intent + durable ID only. Server validates (series open, period eligible, grants) and assigns the final number at Posting. Provisional local displays are not numbers and never appear in books.
- Properties: deterministic outcome per (source ID → same number on replay); server-authoritative; unique within (company, series); never recycled (cancelled/posted numbers stay retired with history); idempotent (same source retry returns original number + refs).
- Abstraction for later phases: any new voucher type (sales/purchase/challan/payment/note/adjustment) plugs in as (type + series set + eligibility + consequence-participation declarator per `67`) without changing this chain. Exact catalogue and series-counter mechanics deferred to Phase 6+ per `76` — this doc fixes only the identity/authority contract above.
