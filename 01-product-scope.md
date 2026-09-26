# NiavERP — Product Scope (V1 Boundaries)

> Phase 0. Defines what V1 is and is not. No implementation.

## 1. Scope Organisation

Scope is separated into five tracks:

- **ERP core** — masters, transaction engine, vouchers.
- **Operations** — sales, purchase, stock, cash/bank, receivables/payables.
- **Compliance** — accounting correctness, GST readiness, reconciliation, reports, audit.
- **Integrations** — Tally, BUSY, migration/import/export.
- **Advanced capabilities** — explicitly deferred.

## 2. ERP Core — In Scope (V1)

- Company / organisation with multi-company data isolation (single user may belong to multiple companies).
- Users / roles / permissions (owner, accountant, biller, viewer baseline; server-enforced).
- Party master (customers, suppliers; GSTIN-aware identity; dedupe basics).
- Item master (goods; units; GST-relevant classification hooks — rates resolved by tax engine, not UI).
- Central transaction engine: validation → posting → accounting + inventory + tax consequences + audit.
- Voucher system with configurable series (sales, purchase, challan, payment, receipt, journal, etc.).
- Ledger / chart of accounts suitable for Indian retail (cash, bank, sales, purchase, stock, GST ledgers, parties).
- Audit trail for consequential operations.

## 3. Operations — In Scope (V1)

- **Sales:** retail invoices, returns (sale returns linked to source), discounts at line/bill level as defined by engine.
- **Kacha → Pakka:** Delivery Challans with configurable Kacha/Pakka series; conversion to invoice (single, bulk, partial, many-to-one) with lineage and remaining-quantity tracking.
- **Purchase:** purchase invoices, purchase returns, basic landed-cost hooks (detailed costing deferred).
- **Inventory:** stock ledger derived from transactions; warehouse/location support at basic level (one default + N named locations); stock-in/out/transfer via transactions; low-stock signals.
- **Receivables / Payables:** party balances derived from invoices + payments + adjustments; ageing basics.
- **Cash / Bank:** cash and bank accounts, receipts, payments, transfers; bank reconciliation basics.
- **Payments:** linkage of payments to invoices (full/partial, advance); UPI/cash/bank modes as payment metadata (no payment processing in V1).

## 4. Compliance — In Scope (V1)

- GST-aware transactions from day one (intra-state / inter-state determination conceptually; exact rule tables deferred to Phase 4).
- GST data maintained continuously: taxable values, tax amounts, parties, places of supply (conceptual), document links.
- Standard reports: sales register, purchase register, stock summary, party ledger, day book, GST-ready summaries (formats/rates not hardcoded in Phase 0).
- Reconciliation centre basics: payments ↔ invoices, stock ↔ transactions, tax summaries ↔ source transactions.
- Compliance assistant (guided, owner-understandable): what is ready, what is missing, what needs CA review. Never claims CA review is unnecessary.
- Deterministic, versioned statutory logic (rule version stored with consequences).

## 5. Integrations — In Scope (V1 boundaries)

- **Tally adapter:** export (masters + vouchers) and bounded import for onboarding; core never depends on Tally XML internals.
- **BUSY adapter:** same boundary as Tally; mechanism deferred.
- **Migration / onboarding:** CSV/excel import for parties, items, opening balances/stock with validation report; export for backup/CA handoff.
- Adapters live outside the core domain; mappings are versioned and tested separately.

## 6. Bharat UX — In Scope (V1)

- Mobile-first billing optimised for speed and large touch targets.
- Hindi UI + English baseline; architecture supports additional Indian languages (exact list deferred).
- Presentation-only localisation: business logic, codes, tax logic remain language-neutral.
- Guided flows for challan → invoice, returns, payments; plain-language error and compliance messages.

## 7. Offline / Multi-Device — In Scope (V1 architecture; full hardening later)

- Offline create/queue/sync for sales-critical transactions with durable IDs and idempotent push/pull.
- Multi-biller concurrency without duplicates (server constraints + idempotency).
- Explicit conflict handling; server authority.
- Full offline rule coverage and stress hardening occur in Phase 11/12/20, but Phase 0 architecture must not preclude them.

## 8. Explicitly Deferred (Not V1)

- Manufacturing / BOM / job-work.
- Full payroll / HRMS / attendance.
- Multi-branch consolidation, franchise management.
- E-commerce / marketplace sync, delivery-logistics tracking.
- Payment gateway processing, credit, lending, BNPL.
- Advanced offers/promotions engine, loyalty points.
- Full fixed-asset register with depreciation automation.
- TDS/TCS automation beyond data capture hooks, e-way bill / e-invoice direct filing automation (export-ready data only in V1).
- Direct GST portal filing; V1 produces ready, reviewable data for CA/export, not one-click filing claims.

## 9. Future Capabilities (Post-V1)

- Additional Indian languages beyond Hindi + English.
- Distributor/wholesale extensions (route, beat, van-sale hardening).
- Service-business flows (AMC, job cards) if validated.
- Analytics (profitability, demand forecasting) built only on audited transaction data.
- CA portal / accountant collaboration workspace.
- Direct e-invoice / e-way / filing integrations after V1 data correctness is proven.

## 10. Non-Goals

- Concealment, dual books, or any mechanism that suppresses, fabricates, or manipulates sales, stock, or tax.
- Replacing professional CA / legal advice.
- Building a generic accounting engine divorced from Indian retail reality.
- Desktop-first or Tally-clone UX.
- Supporting tax-evading workflows under the guise of "flexibility".

## 11. V1 Exit Criteria (Conceptual)

V1 is done when a Hindi-speaking retailer can, offline, with two billers: create challans, convert them lawfully to invoices, take payments, see correct stock and party balances, and hand a CA a complete, traceable, GST-ready book — imported from Tally/BUSY/Excel where needed — with every number traceable to its source transaction.
