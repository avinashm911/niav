# NiavERP — Final Implementation Verification (Phase 8)

> Date: 2026-09-27. Backend vertical slice REAL + TESTED. Mobile/device parts scaffolded with explicit blockers. No fake green.

## Commands executed (all verified)

- `npm install -D typescript vitest pg @types/pg better-sqlite3 @types/better-sqlite3 eslint @eslint/js typescript-eslint`
- `docker pull/run postgres:16-alpine` (container `niaverp-pg`, port 5433)
- `npx vitest run` → 7 files, 41/41 PASS
- `npx tsc --noEmit -p tsconfig.json` → clean
- `npx eslint packages apps/mobile/lib` → clean (screens excluded: native modules not installed)

## Software / dependencies installed (all free/OSS dev-only)

typescript@5.9.3, vitest@2.1.9, pg@8.23.0, @types/pg@8.23.1,
better-sqlite3 (+@types, version per lockfile), eslint@10.11.0, @eslint/js, typescript-eslint.
NOT installed (deliberate): Expo/RN toolchain, Supabase CLI, pnpm/yarn, local tsc standalone,
Android SDK components beyond the pre-existing platform install, any paid service.

## Migrations (supabase/migrations, ordered, applied to 4 scratch DBs)

0001 tenancy+masters → 0002 engine (idempotent sources, locked numbering) →
0003 accounting (balance trigger) → 0004 inventory (IN/OUT, `stock_on_hand`) →
0005 GST (versioned config) → 0006 commercial (Kacha/sales/purchase/supplier-ref unique/payments/audit/outbox) →
0007 RLS (app_user tenant isolation) → 0008 immutability triggers →
0009 period guard → 0010 authz (role guards, write revocation, `api_post_bundle` RPC).

## Tests (41/41 PASS)

- Domain 10/10 (accounting, inventory, GST determinism, atomic rollback, Kacha races, sale/purchase/payments, isolation).
- DB 9/9 (schema, FK, isolation+RLS, idempotent/concurrent replay, numbering concurrency, periods, immutability, atomicity, linkage).
- Auth 6/6 (RPC post+audit, anonymous/viewer/wrong-company reject, direct-write revocation, master/owner-only bounds).
- Server E2E 8/8 (E01–E41 at server+DB level: masters, purchase→pay→settle, sale→collect, Kacha 40+60, returns, reversal, correction, replay, concurrency, sync row, audit traversal, authz negatives, reports, atomic-failure zero-survivor check).
- Sync 5/5 (queue/retry/conflict/backoff) + SQLite adapter 2/2 on a REAL SQLite engine incl. reopen-persistence.
- API 1/1 (HTTP round-trip, auth rejection, unknown op).

## E2E results (E01–E41)

All pass at server+DB boundary with exact assertions (150 units received,
payable/supplier and receivable/customer settled to zero, Kacha 100→40→0 with
preserved lineage, CGST+SGST lines, returns/reversal/correction additive,
replay dedupe, concurrent distinct numbers, wrong-company/viewer rejected,
registers/stock/payments/tax/audit reads verified).
E35–E36 offline/sync proven at queue + real-SQLite-adapter level; on-device
expo-sqlite run is NOT executed (no device/emulator in this environment).

## Failure tests

Bad GST rate, 1M-unit oversell, closed period, duplicate supplier ref,
over-conversion, incompatible many→one, rate edit, double reversal — all fail
closed with zero surviving partials (asserted row counts).

## Security results

Tenant isolation (RLS + FK scoping + session-bound commands), viewer/mismatch
rejection, direct ledger/stock/number writes revoked, periods/memberships
owner-only, audit actor from session. Supabase-JWT mapping deferred (dev-trust
documented at packages/api; checks keep their shape).

## Known limitations / deferred / blocked

- DEFERRED: Expo `npm install` + device/emulator run + Android build (scaffold complete: 12 screens, api client, sqlite adapter, sync worker; native toolchain intentionally not downloaded in this checkpoint).
- DEFERRED: Supabase project + Auth JWT + hosted RLS claim mapping.
- DEFERRED: report builders beyond the 8 read hooks; filing; Tally/BUSY; serial/batch; multi-currency; approval workflows.
- SUPERSEDED (global correction, see `docs/109`): the prior line claiming Kacha records intent with no stock movement is withdrawn and replaced by the locked rule below.
- DECISION (LOCKED global correction): **Kacha / Delivery Challan records an actual physical delivery and posts the corresponding inventory movement only. It creates no accounting, revenue, receivable, payment, or GST recognition. Subsequent invoice conversion consumes the already-delivered Kacha quantity and posts accounting/GST consequences without creating another inventory movement.**
- No Flutter changes. No pnpm/yarn/Supabase CLI. No paid anything.

## Phase map

- Phase 0: implemented (engine-only writes, derived balances, controlled Kacha, durable IDs, adapter walls, audit).
- Phase 1: implemented (ownership, identity, lineage, 3-axis lifecycle).
- Phase 2: implemented + tested (balance, periods, openings, reversal).
- Phase 3: implemented + tested (IN/OUT ledger, DENY-negatives, conservation).
- Phase 4: implemented + tested (versioned config, determinism, no hardcoded rates).
- Phase 5: implemented + tested (atomicity, idempotency, numbering, errors, replay).
- Phase 6: implemented + tested (remaining-derived, compatibility, DENY rate, reversal).
- Phase 7: implemented + tested (direct/converted sales, advances, returns, correction).
- Phase 8: purchase + server + API + reads + sync-queue + mobile scaffold implemented + tested; device run blocked as above.
