# NiavERP — Checkpoint 2 Report: Database + Persistence Foundation

> Status: GREEN. Domain regression preserved (10/10). DB tests 9/9 on real PostgreSQL 16.

## 1. Migrations created (`supabase/migrations/`, ordered, pre-deployment)

- `0001_tenancy_masters.sql` — companies, profiles, memberships, parties (+roles), items, locations.
- `0002_engine.sql` — sources (durable-ID PK), series_counters, vouchers (UNIQUE company/series/number), postings, `next_voucher_number()` (row-locked, concurrency-safe).
- `0003_accounting.sql` — accounts, periods, journal_entries, journal_legs (debit-xor-credit, positive paise), deferred balance trigger.
- `0004_inventory.sql` — stock_movements (IN/OUT + positive qty + type/direction coherence), `stock_on_hand()` read helper. No balance table by design.
- `0005_gst.sql` — gst_configs (versioned), gst_rates, registrations, determinations (config-version pin), tax_lines (UNIQUE determination/role).
- `0006_commercial.sql` — kacha_docs/lines, conversion_actions/refs, sales_docs/lines, purchase_docs/lines (UNIQUE company/supplier_ref), payments, payment_applications, audit_events, sync_outbox.
- `0007_rls.sql` — `app_user` role + tenant_isolation policies (session `app.company_id`) on all tenant tables.
- `0008_protections.sql` — conversion_refs tenancy fix; immutability triggers (UPDATE/DELETE rejected) on all posted/commercial/audit tables; series_counters is the sole sanctioned mutable counter.
- `0009_period_guard.sql` — postings + journal_entries rejected unless period is open (closed/locked fail with PERIOD_CLOSED/LOCKED).

## 2. Tables/constraints

36 tables + 2 functions + 1 helper. PKs on durable TEXT ids; composite (company_id, id) tenancy keys with matching FKs; UNIQUEs on (company,series,number), source bindings, supplier_ref, determination/role; CHECKs on roles/types/states/directions/amounts/dates; indexes on source/posting/company/item-loc/invoice/payment/audit paths.

## 3. Indexes

Per-migration: memberships_user, sources_company, legs_entry/account, mv_posting/item-loc/source, taxlines_det, apps_invoice/payment, audit_source/company.

## 4. RLS/security

DONE at PostgreSQL level (testable now): `app_user` + tenant_isolation policies verified (cross-tenant reads return zero rows; cross-tenant writes rejected). NOT YET: Supabase Auth JWT mapping (no Supabase project exists); application role checks remain domain-side (`Store` blocks viewers/cross-company). Master-edit journalling deferred.

## 5. Supabase CLI

NOT installed. Justification: migrations apply cleanly via `node:pg` harness (`packages/db/src/migrate.ts`) against local PostgreSQL; CLI adds nothing until a hosted Supabase project exists. Local engine: Docker `postgres:16-alpine` container `niaverp-pg` (port 5433).

## 6. Other dependencies (all free/OSS, dev-only)

- `pg@8.23.0` — DB driver for migrate + tests (required; no Supabase client until project exists).
- `@types/pg@8.23.1` — TS types for tests.
- Existing: `typescript@5.9.3`, `vitest@2.1.9`.

## 7–10. Tests + fixes + regression

- DB: 9/9 PASS (`packages/db/tests/db.test.ts`: DB01 schema, DB02 FK + DB12–15 commercial persistence incl. duplicate supplier-ref, DB03 isolation incl. RLS, DB04/05 idempotent + concurrent replay, DB06/07 numbering uniqueness + 10-way concurrency, DB08 closed-period, DB09 immutability, DB10 atomic rollback incl. zero survivors, DB11 linkage).
- Fixes during checkpoint (all repo-side, no invariant weakening): composite self-FK on parties.merged_into; conversion_refs RLS ordering (company_id added in 0008, policy moved there); sloppy always-TRUE CHECK replaced with exact equivalence; idempotent `app_user` creation; `reject_posted_mutation()` field-agnostic message; 2 test-ordering/type bugs (kacha insert order, pg BIGINT-as-string).
- Domain regression: 10/10 PASS. Full suite 19/19. `tsc --noEmit` clean.

## 11–12. Phase 8 status / next

Domain + persistence foundations GREEN. Next checkpoint: Expo app shell + masters/sales/Kacha/purchase/history/sync-status screens calling domain services (no screen math), then expo-sqlite outbox + sync worker, then read-model builders, then device E2E + regression + build verification.
