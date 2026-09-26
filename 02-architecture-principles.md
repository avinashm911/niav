# NiavERP — Architecture Principles

> Phase 0. Foundation constraints. No implementation.

## 1. Modular Architecture

- Domain-modular monolith first: one backend (Supabase/Postgres) with strict domain boundaries, one mobile app (Expo/React Native/TS).
- Modules communicate through the Transaction Engine and explicit domain interfaces, not direct table writes across domains.
- Adapters (Tally, BUSY, migration, export) are Peripheral; core never imports adapter code.
- UI is a thin renderer: no business rules, no GST math, no stock math in components.

## 2. Domain Boundaries (Summary)

Company, Users/Roles, Party, Item, Ledger/Accounting, Voucher, Transaction Engine, Sales, Purchase, Challan/Kacha-Pakka, Inventory/Warehouse, Receivables/Payables, Cash/Bank, GST/Tax, Payments, Reconciliation, Reports, Compliance, Audit, Sync, Licensing (deferred), Integrations, Migration, Localisation. Full map in `03-domain-map.md`.

Rule: each fact has one owner. Others reference by ID.

## 3. Transaction-Centric Design

- Every money/stock/tax effect originates from a source transaction submitted to the Transaction Engine.
- Flow: validate → post → accounting consequence + inventory consequence + tax consequence + audit event. See `04-transaction-lifecycle.md`.
- No screen, import, or adapter writes ledger/stock/tax tables directly.
- Balances, stock-on-hand, ageing, summaries are derived projections; the event/ledger tables are truth.

## 4. Accounting Architecture Principles

- Double-entry consequences produced only by the engine; balanced debits = credits per posting (conceptual; exact posting model deferred to Phase 2).
- Chart of accounts + party ledgers; every entry links to `source_transaction_id`.
- Corrections via reversal/correction entries, never in-place edits of posted effects.
- Fiscal period controls and locking are server-enforced (details Phase 2/16).

## 5. Inventory Architecture Principles

- Stock ledger derived from stock-affecting events (sale, purchase, return, transfer, adjustment, challan movement as defined in Phase 6).
- No mutable `stock` column as truth; quantity-on-hand is a sum over the ledger.
- Item + location is the granularity; transfers preserve lineage.
- Negative-stock policy is explicit and server-enforced (deferred to Phase 3; default: prevent silent negative without audited override).

## 6. Tax Architecture Principles

- Central Tax Engine owns all GST determinations; callers pass facts (items, parties, place, values), engine returns tax consequences + rule version.
- Rates, slabs, HSN mappings, place-of-supply logic live in versioned server tables/functions, never in UI.
- Every tax consequence links to source transaction + rule version for reproducibility.
- No invented statutes in Phase 0; exact rules deferred to Phase 4.

## 7. Offline-First Principles

- Local SQLite is a durable queue + cache, not a second ledger.
- Durable client UUID at creation; idempotent push/pull; server authority on conflict.
- Full detail in `06-offline-first.md`.

## 8. Security Principles

- Supabase Auth identity; company/tenant isolation via RLS on every row.
- RBAC with server-side enforcement; offline grants are cached, re-validated on sync.
- Devices/sessions identified; sensitive ops audited. Full detail in `07-security-and-audit.md`.

## 9. Audit Principles

- Append-only audit events for create/post/convert/reverse/cancel/correct + permission and conflict-resolution events.
- Before/after, actor, device, timestamps, reason, lineage. No silent overwrites.

## 10. Integration Architecture

- Hexagonal: core ports → adapter implementations for Tally/BUSY/import/export.
- Adapters translate external ↔ canonical transaction submissions; they never write consequences directly.
- Mappings versioned, tested in isolation. See `08-integration-boundaries.md`.

## 11. Testing Architecture

- Layers: unit → database → transaction/accounting/inventory/tax → integration → sync/multi-user → mobile → e2e/UAT.
- Invariants (balanced postings, stock continuity, idempotency, lineage) are first-class tests. See `09-testing-strategy.md`.

## 12. Technology Direction (Non-binding for Phase 0)

- Mobile: Expo + React Native + TypeScript.
- Backend: Supabase (Postgres, Auth, RPC/Edge Functions where appropriate).
- Offline: SQLite local store + sync queue.
- No dependencies installed in Phase 0; library choices (SQLite lib, sync algorithm) remain open decisions.
