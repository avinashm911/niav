# NiavERP — Domain Map (Proposed Boundaries)

> Phase 0. Responsibilities and non-ownership. No fields, no implementation.

Conventions per domain: Responsibility / Key entities (conceptual) / Depends on / Must NOT own.

## 1. Company / Organisation

- Responsibility: tenant root; fiscal settings, numbering series config, locations, preferences.
- Entities: Company, Location reference, Series config, Preferences.
- Depends on: Users (membership), Audit.
- Must NOT own: transactions, ledger entries, tax rules.

## 2. Users / Roles / Permissions

- Responsibility: identity binding, company membership, roles, grants.
- Entities: User, Membership, Role, Permission grant, Device/Session reference.
- Depends on: Company, Audit.
- Must NOT own: financial consequences, stock, tax.

## 3. Party Master

- Responsibility: single identity for customers/suppliers; contact + GSTIN + addresses; dedupe/merge discipline.
- Entities: Party, Party address/identity, Merge link.
- Depends on: Company, Audit.
- Must NOT own: balances (derived), invoices, tax computation.

## 4. Item Master

- Responsibility: goods identity; units, barcodes, sale/purchase flags, tax-class hooks.
- Entities: Item, Unit, Barcode, Tax class ref.
- Depends on: Company, Audit.
- Must NOT own: stock quantities, prices as truth (price lists are separate), tax rates.

## 5. Accounting (Chart + Policy)

- Responsibility: chart of accounts, posting policies, period controls.
- Entities: Account, Period control.
- Depends on: Company, Transaction Engine (execution).
- Must NOT own: source documents, inventory quantities.

## 6. Ledger

- Responsibility: immutable posted debit/credit consequences.
- Entities: Ledger entry (account, debit/credit, source link).
- Depends on: Accounting, Transaction Engine.
- Must NOT own: validation, source data entry.

## 7. Voucher

- Responsibility: numbering, series, document identity and status for all voucher types.
- Entities: Voucher series, Voucher document (type, number, status).
- Depends on: Company, Transaction Engine.
- Must NOT own: accounting/inventory/tax effects.

## 8. Transaction Engine (Central)

- Responsibility: sole gateway for validation → posting → accounting/inventory/tax/audit fan-out; idempotency; status transitions.
- Entities: Source transaction, Posting batch, Consequence links, Idempotency key.
- Depends on: all consequence domains; Audit, Sync.
- Must NOT own: UI, adapter formats, tax tables (calls Tax), master data.

## 9. Sales

- Responsibility: sales invoices, sale returns, sales adjustments as source transactions.
- Entities: Sale invoice, Sale return (source refs).
- Depends on: Transaction Engine, Party, Item, Voucher, Tax, Inventory, Receivables.
- Must NOT own: ledger entries, stock ledger, tax math.

## 10. Purchase

- Responsibility: purchase invoices, purchase returns as source transactions.
- Entities: Purchase invoice, Purchase return.
- Depends on: same as Sales + Payables.
- Must NOT own: consequences.

## 11. Delivery Challan

- Responsibility: goods-movement documents that may precede invoices; quantity tracking, remaining-to-convert.
- Entities: Challan, Challan line, Conversion link.
- Depends on: Transaction Engine, Voucher, Inventory, Sales.
- Must NOT own: tax liability creation (only per Tax Engine rules), final sale accounting.

## 12. Kacha / Pakka

- Responsibility: controlled classification of challan series + lawful conversion policy enforcement.
- Entities: Series classification (Kacha/Pakka), Conversion record.
- Depends on: Challan, Voucher, Sales, Audit, Tax.
- Must NOT own: a parallel hidden sales book; must never allow untracked sales.

## 13. Inventory

- Responsibility: stock ledger derivation, availability signals.
- Entities: Stock event/ledger, Reservation concept (deferred detail).
- Depends on: Transaction Engine, Item, Warehouse/Location.
- Must NOT own: item definitions, accounting values (costing policy comes from Accounting + engine).

## 14. Warehouse / Location

- Responsibility: stock locations, transfers.
- Entities: Warehouse/Location, Transfer.
- Depends on: Company, Inventory, Transaction Engine.
- Must NOT own: stock truth (ledger owns).

## 15. Receivables

- Responsibility: customer balance derivation, ageing, receipts linkage view.
- Entities: (derived) Receivable, Ageing view.
- Depends on: Sales, Payments, Transaction Engine.
- Must NOT own: payments entry, invoice creation.

## 16. Payables

- Responsibility: supplier balance derivation, ageing, payments linkage view. Mirror of Receivables.
- Depends on: Purchase, Payments, Transaction Engine.
- Must NOT own: source entry.

## 17. Cash

- Responsibility: cash accounts, cash in/out via transactions.
- Entities: Cash account, Cash movement (via engine).
- Depends on: Transaction Engine, Accounting, Audit.
- Must NOT own: bank reconciliation, invoice logic.

## 18. Bank

- Responsibility: bank accounts, receipts/payments/transfers, reconciliation support.
- Entities: Bank account, Bank movement, Reconciliation link.
- Depends on: Transaction Engine, Accounting.
- Must NOT own: invoice logic.

## 19. GST / Tax

- Responsibility: central deterministic tax consequences + rule versioning.
- Entities: Tax consequence, Rule version ref.
- Depends on: Transaction Engine (caller), Item/Party facts.
- Must NOT own: source documents, ledger posting mechanics.

## 20. Payments

- Responsibility: receipts/payments/advances and their application to invoices (full/partial).
- Entities: Payment, Application link.
- Depends on: Transaction Engine, Receivables/Payables, Cash/Bank.
- Must NOT own: invoice creation, tax math.

## 21. Reconciliation

- Responsibility: matching (payments↔invoices, bank↔books, stock↔transactions, tax↔sources), exception lists.
- Entities: Match link, Exception.
- Depends on: Ledger, Inventory, Tax, Payments, Reports.
- Must NOT own: original entries; it only links/flags.

## 22. Reports

- Responsibility: read-only derivations (registers, ledgers, stock summaries, GST-ready summaries, day book).
- Entities: (views; no new truth).
- Depends on: Ledger, Inventory, Tax, Reconciliation.
- Must NOT own: any write, any tax computation.

## 23. Compliance

- Responsibility: readiness state (what is complete / missing / needs CA review), checklists, reviewable summaries.
- Entities: Readiness state, Checklist.
- Depends on: Reports, Reconciliation, Tax, Audit.
- Must NOT own: filing, professional judgement; must surface "needs CA review".

## 24. Audit

- Responsibility: append-only event log for consequential actions.
- Entities: Audit event.
- Depends on: (cross-cutting; everyone emits).
- Must NOT own: business execution.

## 25. Sync

- Responsibility: durable IDs, outbox/inbox, idempotent push/pull, conflict surfacing, server authority.
- Entities: Outbox entry, Sync cursor, Conflict record.
- Depends on: Transaction Engine, Audit.
- Must NOT own: business validation (server engine re-validates).

## 26. Licensing

- Responsibility (future boundary): plan/entitlement gates. Deferred; must not entangle with ledger logic.
- Depends on: Company, Users.
- Must NOT own: transaction truth, audit.

## 27. Integrations (Tally / BUSY)

- Responsibility: external ↔ canonical translation only.
- Entities: Adapter mapping, Import/Export batch.
- Depends on: Transaction Engine (submit), Masters (lookup).
- Must NOT own: ledger/stock/tax writes, numbering authority.

## 28. Migration

- Responsibility: onboarding import (parties/items/openings), validation reports, go-live cutover.
- Entities: Import batch, Validation report.
- Depends on: Masters, Transaction Engine, Audit.
- Must NOT own: live transaction editing after go-live except via engine.

## 29. Localisation

- Responsibility: display strings, Hindi + future languages, formatting (numbers/dates/currency display).
- Entities: Locale bundle, Format policy.
- Depends on: (presentation only).
- Must NOT own: business logic, codes, tax rules, voucher semantics. Language never enters the engine.
