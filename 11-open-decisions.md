# NiavERP — Open Decisions (Deferred, Not Decided)

> Phase 0 records what is NOT settled. Do not treat these as decided.

## 1. Domain & Engine

- Exact entity schemas and field lists (Phase 1).
- Accounting posting model details (Phase 2): ledger table shapes, cost-of-stock hooks.
- Voucher numbering model: per-series counters, concurrency approach, provisional display format (Phase 5).
- Period-lock and fiscal-year mechanics (Phase 2/16).

## 2. GST / Statutory

- GST rule implementation details: rate tables, HSN handling, place-of-supply matrix, return formats (Phase 4).
- E-invoice / e-way bill scope beyond export-ready data (post-V1).
- No statutory values are fixed in Phase 0.

## 3. Offline / Sync

- SQLite library for Expo/React Native (e.g., evaluation deferred to Phase 11).
- Sync conflict strategy details beyond server-authority principle (delta vs snapshot, cursor shapes).
- Sync transport (Supabase realtime vs polling vs RPC batching) — Phase 11.
- Offline grant expiry/refresh durations — Phase 12/16.

## 4. UX / Localisation

- Supported Indian languages beyond Hindi + English baseline.
- Input methods (voice, barcode hardware), print formats, UPI-intent UX — Phase 10.
- Exact role matrix and Hindi terminology glossary — Phases 1/10.

## 5. Integrations / Migration

- Tally integration mechanism (file/API/version coverage) — Phase 17.
- BUSY integration mechanism — Phase 18.
- Migration formats accepted (CSV columns, Excel templates) — Phase 19.
- Hosting/deployment details, environments, backup/restore mechanics — Phase 20.

## 6. Non-decisions (Must Stay Open)

- Any premature choice of sync algorithm, tax rates, XML tags, or library versions in Phase 0 would be a deviation. None are made here.

## 7. Decision Log (Append-only going forward)

| Date | Decision | Phase | Status |
|------|----------|-------|--------|
| 2026-09-26 | Phase 0 locks principles only; all above deferred | 0 | Open |
