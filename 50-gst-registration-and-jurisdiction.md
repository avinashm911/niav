# NiavERP — GST Registration and Jurisdiction (Conceptual)

> Phase 4. Registration separate from company; jurisdiction inputs explicit. No verification APIs, no rate data.

## 1. Company → Registrations (1 → 0..N)

- A Company may hold zero (unregistered/small business below threshold-class handling deferred), one, or many Registrations (multi-state operation). Each Registration binds (company, State/UT jurisdiction, status, effective-from/to, GSTIN attribute).
- GSTIN is never company identity; company identity is the tenant (`20`). Two companies never share a Registration; one Registration never spans jurisdictions.
- History: status changes and effective periods retained; determinations reference registration-at-time (business date), so later cancellation never rewrites past tax results.

## 2. Registration lifecycle (conceptual states)

`applied → active → suspended/cancelled (with effective-to)`. Re-application is a new Registration identity linked to its predecessor, never a resurrection edit. Unregistered counterparties are modelled as Parties with no active registration in the relevant jurisdiction at the relevant date (distinct from exempt/nil classes — classification outcome, not identity gap).

## 3. Jurisdiction inputs (explicit, never collapsed)

Each determination consumes, at minimum: supplier Location + supplier Registration (at business date), recipient Location/Party + recipient Registration status (at business date), and a determined Place of Supply (jurisdiction attribute). Recipient classes: registered (with active registration in the relevant jurisdiction), unregistered, and (deferred detail) special persons/ISD/composition holders — recognised as inputs, not rule-built here.
- Place of Supply is determined by engine policy hooks (general goods-movement default deferred to configuration; special rules plug in later per `51`), never auto-equated to billing/shipping address. The addresses are evidence inputs; the jurisdiction attribute is the output.

## 4. Supply-type determination (structural, rate-free)

From the inputs the engine determines the component *structure*: intra-state pair (CGST+SGST, or CGST+UTGST variant where the jurisdiction is a no-legislature UT) vs inter-state single (IGST), plus cess-role eligibility flag. Rate values and exception matrices are configuration (see `58`), not fixed here; contradictory structures (both intra- and inter- components for one determination) are structurally rejected (see `53`,`60`).
