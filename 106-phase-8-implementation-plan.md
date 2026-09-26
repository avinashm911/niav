# NiavERP — Phase 8 Implementation Plan (Catch-up + Purchase)

> Working plan. Design docs `docs/00–105` remain authoritative. This file tracks implementation only.

## Baseline (2026-09-27)

- Repo `D:\NiavERP`: 106 markdown files (README + docs/00–105), zero code, zero commits, no package.json.
- Toolchain: Win11, Node v24.19.0 / npm 11.17.0, Java 17, adb + Android SDK present, WSL 2.7 + Docker 29.8 + Compose v5.5, OpenCode v2.0.18, Expo 57 via npx (on-demand), no local tsc/pnpm/yarn/supabase CLI, Flutter SDK present (DO NOT MODIFY).

## Architecture (smallest that satisfies Phase 0–8)

```
packages/
  domain/          # pure TypeScript: ids, money, masters, accounting, inventory,
                   # gst-config, transaction engine, kacha-pakka, sales, purchase,
                   # payments/receivable, audit, errors — zero UI, zero SQL
  domain/tests/    # vitest suites per invariant matrix (34,46,60,74,89 + sales/purchase)
apps/
  mobile/          # Expo + TS + expo-sqlite (deferred until domain green)
supabase/
  migrations/      # PostgreSQL DDL + RLS/RPC (deferred until domain green)
```

## Order (per Phase 8 §28)

1. ✅ Step 1: repo/toolchain inspection (this file).
2. Step 2: minimal TS scaffold + vitest (root package.json, tsconfig, domain package).
3. Steps 3–4: DB/auth deferred — domain-first; migrations after domain green (no live Supabase needed for unit gates).
4. Steps 5–8: masters → accounting → inventory → GST-config boundary.
5. Step 9: Transaction Engine (central priority) + tests.
6. Steps 10–13: payments/receivable → Kacha/Pakka → Sales → Purchase.
7. Steps 14–16: offline/sync + audit/reads + mobile UX.
8. Steps 17–20: E2E scenarios (E01–E36 mapped to domain-level where infra-free) + regression + typecheck/lint + gate.

## Dependencies (zero-rupee, justify each)

- `typescript` (dev): typecheck/build. Required — target stack is TS.
- `vitest` (dev): unit/domain/integration tests. Required — Phase 8 §21 mandates executed tests; vitest is free/OSS, fastest for pure-TS domain.
- No runtime deps for `packages/domain` (pure logic, exact-decimal money via integer paise internally — no library needed).
- Later (deferred, only when needed): `expo`, `expo-sqlite`, `@supabase/supabase-js` (all free tiers/OSS).

## Definition of implemented (per §29)

Real code on the application path + real persistence where required + real auth + enforced invariants + executed tests + cross-domain atomicity + failure + audit behaviour. Docs alone do not count — tracked below per E-scenario.

## E-scenario implementation tracker (domain-level, vitest `packages/domain/tests/catchup.test.ts` — 10/10 green, `tsc --noEmit` clean)

- [x] E01 company, E04 item, E05 location, E06 chart (in-test fixtures; `Store` enforces scope/eligibility)
- [x] E02 supplier, E03 customer (Party roles enforced in `postSale`/`postPurchase`)
- [x] E07–E11 purchase + receipt + payable + payment + settlement (incl. duplicate supplier-ref rejection, partial pay, advance boundary)
- [x] E12–E16 sale + reduction + receivable + payment + settlement (incl. oversell `STOCK_CONFLICT`)
- [x] E17–E24 Kacha → Pakka + preservation + remaining + invoice + siblings (`KachaRegistry` + Engine post; partial/complete/over-conversion/rate-DENY/incompatible/many→one-shape/replay/reversal covered)
- [x] E25–E28 returns pattern (reversal + correction chains via `reverseEntry` + additive postings; returnable-remaining enforced at workflow layer per docs/100), reversal, correction
- [x] E29 replay (idempotent converge + dedupe audit), E30 concurrency (serialised validation; same-ID race converges; 40+70-vs-100 covered in Kacha tests)
- [x] E31–E32 offline pattern (durable IDs + replay converge; SQLite persistence deferred to Step 14)
- [x] E33 audit lineage (post/reverse/convert/payment-apply/supplier-ref/dedupe events), E34 isolation, E35 authz (viewer blocked, cross-company rejected)
- [x] E36 reporting reads (balances via `balanceOf`, stock via `onHand`, outstanding via `outstandingFor`; full report builders deferred to Step 15)

## Remaining (Steps 3–4, 14–20, in order)

- Supabase migrations + RLS/RPC (derive from domain invariants; needs a free-tier project — not created yet)
- Supabase Auth wiring + company membership enforcement (domain actor model ready)
- Expo app shell (masters, sales, Kacha/Pakka, purchase, history, sync status) calling domain services (no screen math)
- expo-sqlite outbox + sync worker (durable IDs + replay already specified; persistence + transport pending)
- Read-model builders (registers/outstanding/tax-summary/audit-trace over domain truth)
- E2E on device/emulator + regression + build verification
