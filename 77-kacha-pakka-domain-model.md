# NiavERP — Kacha → Pakka Domain Model (Conceptual)

> Phase 6. Controlled lawful conversion. Kacha = first-class numbered auditable document, never off-book. No code/SQL/UI/integrations. Authority: Phase 0–5 gated decisions, esp. `05`,`19`,`73`.

## Terms (definition / owner / NOT-synonyms)

- **Kacha:** a controlled challan-series classification for provisional/estimate-led movements. First-class, numbered, posted, stock-visible, auditable — identical machinery to Pakka. NOT: draft, cancelled, unposted, unrecorded, informal, temporary, off-books, tax-free.
- **Pakka:** a controlled challan-series classification for formal movements intended for GST invoices, plus (by extension) the resulting GST invoice created through conversion. Same controls + conversion linkage. NOT: the invoice alone; Pakka challan precedes it.
- **Kacha Document:** a posted source transaction on a Kacha series (identity + number + lines + conversion state). NOT: an estimate slip, a draft.
- **Pakka Document:** a posted source on a Pakka series OR the Pakka invoice produced by conversion (context disambiguates; lineage always names both sides). NOT: an edited Kacha.
- **Delivery Challan:** the primary Kacha business document: goods-movement source recording party/items/quantities/series. Tracked, numbered, preserved; convertibility tracked. NOT: invoice, off-books slip.
- **Kacha/Pakka Series:** per-company numbered sequences (`CH-KACHA-*`, `CH-PAKKA-*` abstractly; formats not hardcoded). Company configures; Voucher executes; server assigns finals.
- **Source Document:** the business-meaningful origin (here: the Kacha challan) preserved verbatim for audit.
- **Conversion:** the additive action creating a new Pakka invoice transaction from Kacha source(s) with full refs. Patterns: 1→1, 1→many (partial), many→1 (compatible). No fifth shape.
- **Conversion Action:** the durable, idempotent, audited execution unit of one conversion (shared action ID across bulk members where grouped).
- **Source Reference:** a (Kacha source, line) pointer carried onto invoice lines + conversion record. Bulk/many-to-one carry full sets.
- **Converted Quantity:** per Kacha line, the fold over accepted conversion quantities referencing it.
- **Remaining Quantity:** per Kacha line, `delivered − converted` (derived read, never stored truth, never directly editable). Invariants: converted ≤ delivered; remaining ≥ 0.
- **Fully/Partially Converted:** conversion-state outcomes (remaining = 0 on all lines vs > 0 on some line). Derived, not lifecycle.
- **Conversion Compatibility:** the same-company/same-party/context/tax-jurisdiction/item-unit/state/availability predicate gating many→1 (fail-closed; §81).
- **Rate Snapshot:** the Kacha line values-as-recorded, preserved forever. **Rate Edit:** any target rate differing from snapshot at conversion (default DENY; §84). **Recomputed Tax:** GST re-determination on the Pakka target by the GST engine (never hand-computed).
- **Conversion Reversal/Correction:** additive neutralisation (reversal) or reversal + replacement (correction) of a conversion action with lineage + remaining recalculation; originals retained (§86).
