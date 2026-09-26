# NiavERP — GST Domain Model (Conceptual)

> Phase 4. Tax semantics only. No rates hardcoded, no SQL, no APIs, no filing, no workflows.
> Authority: Phase 1 ownership/lineage (`14`,`16`,`21`) + Phase 2/3 posting discipline. GST owns determination + lines; never ledger/stock/payment truth.

## Terms (definition / owner / identity / lifecycle / relationships / mutability / lineage / NOT-synonyms)

### GST
- Definition: India’s goods-and-services tax framework as modelled: applicability, classification, jurisdiction, taxable value, components, lines, and their lineage. Not a ledger, not a workflow.
- Owner: GST / Tax (semantics). Related: all consequence domains (consumers of outputs).
- Identity: n/a (framework, not an entity). Lifecycle: n/a. Mutable: nothing here; configuration versioned separately (`58`).
- NOT: CGST/SGST/IGST individually, GSTIN, a return, an API.

### GST Registration
- Definition: a company’s enrolment in a State/UT jurisdiction authorising taxable activity there, with status + effective dates. See `50`.
- Owner: GST / Tax (registration facts). Identity: stable registration ID per (company, jurisdiction). Lifecycle: applied → active → (suspended/cancelled with effective-to; history retained). Relationships: Company 1→N Registrations; Registration 1→0..1 GSTIN.
- Mutable: status/dates only via governed events + audit. Lineage: every determination links registration-at-time. NOT: Company, GSTIN (the number is an attribute).

### GSTIN
- Definition: the 15-character registration number labelling a Registration. Attribute, never identity, never company identity.
- Owner: GST / Tax (attribute of Registration). Identity: none independent. Lifecycle: issued → active → cancelled (mirrors registration). NOT: Company ID, jurisdiction itself.

### Registered Person / Taxpayer / Supplier / Recipient
- Registered Person: a Party (or own Company via a Registration) holding an active registration in the relevant jurisdiction at the relevant date. Taxpayer: the person liable under the determination (supplier normally; recipient under reverse charge where classified). Supplier: the source-side party of a supply. Recipient: the destination-side party. All are role views over Party/Company+Registration, not separate entities.
- Owner: Party Master (identity) + GST (role interpretation). Lifecycle: per-transaction role evaluation. NOT: each other; a supplier is not automatically the taxpayer under RCM.

### Place of Supply / Location / State-UT jurisdiction
- Place of Supply: the determined jurisdiction attribute answering *where* a supply is treated as made (explicit determination input, not an address copy). Location: Phase 1 place dimension (movement/transaction occurrence). State/UT jurisdiction: the statutory territory a Registration/supply resolves into.
- Owner: GST (determination inputs/outputs); Location master owned by Warehouse/Location. NOT: billing address (= Place of Supply is determined, never auto-copied).

### Supply classes
- Taxable Supply: supply to which GST applies at the configured rate (may compute to an amount, possibly zero by rate, but applicable). Exempt Supply: specifically exempted by notification (no tax, with input-credit consequences deferred to later policy — not decided here). Nil-rated Supply: rate-nil by schedule (no tax, distinct reason from exempt). Non-GST Supply: outside GST scope entirely (no determination beyond classification). Zero-rated Supply: export/SEZ-class supplies entitled to zero rate with credit/refund mechanics deferred (supported as a class; mechanics deferred).
- Owner: GST (classification). Each is a classification outcome, not a voucher type. NOT: each other; never collapse exempt=nil=non-GST=zero.

### Taxable Value / Tax Rate / Tax Component / Tax Line
- Taxable Value: the determined base per line on which rate(s) apply (see `52`). Tax Rate: a governed configuration reference (percentage/amount basis) resolved via statutory configuration version — never a UI literal, never hardcoded here. Tax Component: one structural bucket of the result (CGST/SGST/IGST/UTGST/cess-role) with rate-ref + basis + amount. Tax Line: the posted immutable row realising one component for one source line (see `53`).
- Owner: GST (all). NOT: HSN/SAC (= references, not rates); accounting leg (= money truth, separate owner).

### CGST / SGST / IGST / UTGST / Cess
- CGST: central component; SGST: state component (intra-state pair with CGST); IGST: integrated component (inter-state); UTGST: union-territory component where the intra-state territory is a UT without legislature (structural role; applicability mechanics deferred to configuration); Cess: additional levy role on configured bases (mechanics/rates deferred).
- Owner: GST (structural roles). Each determination uses exactly one valid structure (intra-state pair incl. UT variant, or inter-state single) + optional cess-role — never mixed (see `53`). NOT: rates themselves.

### HSN / SAC / Tax Category / Tax Classification
- HSN: goods nomenclature reference on an item. SAC: services nomenclature reference (placeholder for future service scope; no service workflows in V1). Tax Category: master hook consumed by classification. Tax Classification: the engine’s deterministic outcome (supply class + jurisdiction structure + rate-ref + config version).
- Owner: Item Master (HSN/SAC/category hooks); GST (classification outcome). NOT: rate (HSN≠rate, SAC≠rate, category≠rate).

### Reverse Charge (RCM)
- Definition: a classification dimension where liability shifts to the recipient. Modelled as applicability flag + liability direction + document/accounting treatment hooks owned downstream; no universal rule set invented (see `51`).
- Owner: GST (applicability + direction); Accounting/Payments own their consequence sides. NOT: a separate voucher type.

### Composition Scheme
- Definition: DEFERRED special regime. Recognised as a possible taxpayer status affecting determination eligibility, but no rules, rates, or workflows built in Phase 4. Core model must not make future support impossible (registration-status + classification hook reserved). See `62`.

### Tax Invoice / Credit Note / Debit Note
- Tax Invoice: the GST-relevant bill document (future Phase 7/8 workflow) carrying determination + lines; concept only here. Credit Note: linked document reducing a prior invoice’s taxable/tax effect (correction/return-class semantics; workflow deferred). Debit Note: linked document increasing it. None are synonyms for correction/reversal generically: correction/reversal are lineage mechanics (`31`,`41`); credit/debit notes are document forms that realise them for GST-reportable chains (see `56`). Originals never mutated.
