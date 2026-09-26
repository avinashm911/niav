# NiavERP — Bharat ERP for Indian Retailers

> Mobile-first • Offline-first • Hindi-first • Kacha → Pakka controlled • Self-Service Compliance

NiavERP is a mobile-first, offline-first ERP for Indian retailers that keeps sales, stock, money, and GST records continuously true — with every number traceable to its source transaction.

**Phase 0 status:** Foundation only. Product constitution, scope, architecture principles, domains, lifecycle, and roadmaps are defined. No application implementation exists.

## Product Principles

- Simple on the surface, strict underneath.
- One transaction engine; no bypasses. Balances and stock are derived, never the truth.
- Kacha → Pakka is lawful, numbered, and auditable. Sources are never destroyed. Tax evasion, fabrication, concealment, and manipulation are prohibited by design.
- Language is presentation only (Hindi-first UX, English-logic core).
- Self-service compliance keeps books always-ready but never claims CA review is unnecessary.
- Offline works; sync is idempotent; server is authoritative; concurrent billers never corrupt books.
- Tally/BUSY live in adapters; core never depends on external formats.

## Architecture Direction

- Mobile: Expo + React Native + TypeScript (direction, nothing installed).
- Backend: Supabase / PostgreSQL / Supabase Auth / RPC-Edge Functions where appropriate.
- Offline: SQLite local queue + durable UUIDs + idempotent push/pull + explicit conflicts.
- Testing: unit → DB → transaction/accounting/inventory/tax → sync/multi-user → mobile → e2e/UAT with first-class invariants.

## Roadmap

- Phase 0 Product Constitution & Scope (this repo state)
- Phase 1 ERP Domain Model
- Phase 2 Accounting Engine
- Phase 3 Inventory Engine
- Phase 4 GST & Indian Statutory Engine
- Phase 5 Voucher & Transaction Engine
- Phase 6 Kacha → Pakka
- Phase 7 Sales Cycle
- Phase 8 Purchase Cycle
- Phase 9 Receivables / Payables / Cash / Bank
- Phase 10 Bharat UX
- Phase 11 Offline-First Architecture
- Phase 12 Multi-Device & Multi-User ERP
- Phase 13 Reporting Engine
- Phase 14 Reconciliation / Compliance Centre
- Phase 15 Compliance Assistant
- Phase 16 Administration & Business Controls
- Phase 17 Tally Integration
- Phase 18 BUSY Integration
- Phase 19 Migration & Onboarding
- Phase 20 Production Hardening & UAT

See `docs/10-phase-dependency-map.md` for objectives, prerequisites, and gates.

## Documentation Index

- `docs/00-product-constitution.md` — mission, USPs, pillars, principles.
- `docs/01-product-scope.md` — V1 boundaries, deferred, non-goals.
- `docs/02-architecture-principles.md` — modular, transaction-centric, engine rules.
- `docs/03-domain-map.md` — domain ownership and non-ownership.
- `docs/04-transaction-lifecycle.md` — source → validation → posting → consequences → audit → sync.
- `docs/05-kacha-pakka.md` — lawful challan-to-invoice lifecycle + prohibitions.
- `docs/06-offline-first.md` — queue, idempotency, conflicts, server authority.
- `docs/07-security-and-audit.md` — auth, RBAC, isolation, audit events.
- `docs/08-integration-boundaries.md` — Tally/BUSY/migration adapter walls.
- `docs/09-testing-strategy.md` — layers, invariants, gates.
- `docs/10-phase-dependency-map.md` — Phase 0–20 dependencies.
- `docs/11-open-decisions.md` — deferred decisions log.

## Development Philosophy

Correctness and auditability over premature optimisation. No fake functionality, no duplicated logic, no hardcoded tax/mappings in UI, no silent overwrites. If it affects money, stock, or tax, it goes through the engine with lineage and audit — or it does not ship.
