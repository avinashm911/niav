# NiavERP — Global Correction Record: Kacha Moves Stock Once

> Date: 2026-09-27. Business-model correction, not a test adjustment.
> Supersedes any contrary active guidance in `docs/05`, `docs/19`, `docs/85`,
> `docs/91`, `docs/98`, `docs/108` (all updated in place; this file is the log).

## Original rule (withdrawn)

> Kacha challans record delivery intent with no stock movement; the invoice posts the issue.

Problem discovered: with intent-only Kacha, a converted invoice posted a second
physical OUT for goods already delivered (100 → Kacha 40 → stock 60 →
invoice 40 → stock 20). That double-counts physical reality and contradicts
the Kacha → Pakka USP (delivery first, commercial recognition later).

## Locked replacement rule

> **Kacha / Delivery Challan records an actual physical delivery and posts the
> corresponding inventory movement only. It creates no accounting, revenue,
> receivable, payment, or GST recognition. Subsequent invoice conversion
> consumes the already-delivered Kacha quantity and posts accounting/GST
> consequences without creating another inventory movement.**

## Implementation (files changed)

- Domain: `packages/domain/src/inventory.ts` (`delivery` OUT type),
  `packages/domain/src/kacha.ts` (`createDelivery()` posts one OUT per line,
  no legs/GST; convert unchanged — already stock-free),
  `packages/domain/src/store.ts` (accepts `delivery` intents).
- Database `supabase/migrations/0011_kacha_delivery.sql`: `delivery` in type
  CHECKs, `kacha_lines.location_id` NOT NULL, `conversion_reversals` table
  (append-only convertibility restoration; `conversion_actions.reversed`
  dropped), `kacha_remaining` view, `trg_no_double_issue` (conversion targets
  reject quantity movements except `reversal`).
- Backend `packages/server/src/commands.ts`: `createKacha` posts delivery OUT
  via `api_post_bundle` (no legs/GST) + master eligibility; `convertKacha`
  requires an existing delivery movement, posts legs/GST only, serialises per
  line (`FOR UPDATE`); `reverseSource` blocks invoiced Kacha, records
  conversion reversals, rejects duplicates, reverses movement-only sources;
  `correctSource` posts no-stock replacements for converted invoices;
  `postReturn` takes `side` (sales IN / purchase OUT); master eligibility on
  sale/purchase/return paths.
- Tests: `kacha-correction.test.ts` (K01–K15 domain proofs), E2E K-block
  rewritten (K01–K18 incl. 100→40→60 proof, over-conversion, replay,
  60+50-vs-100 race, cross-company, reversals), DB double-issue trigger test,
  mobile self-test asserts delivery −100 and conversion +0 stock.
- Mobile: `KachaScreen` location field; `selftest.ts` D11b/D12b stock proofs,
  `side` on returns, location on offline Kacha payload.
- Docs: `05`, `19`, `85`, `91`, `98` reworded to single-effect; `108` withdrawn
  line marked SUPERSEDED with the locked rule.

## Preserved (unchanged)

Ownership boundaries; atomicity; idempotency; DENY-negatives; rate-DENY;
compatibility gates; RLS/tenant isolation; immutability; audit shape;
GST engine (no rates touched); direct-sale issue semantics; returns as
independent additive events; offline queue mechanics.

## Known related gap (pre-existing, not introduced)

`reverseSource` mirrors accounting legs and stock movements but posts no GST
compensating lines (GST has no negative-amount representation in this model).
Invoice GST adjustments travel via return/correction chains with fresh
determinations. Recorded here so a future phase can design credit-note GST
linkage without touching this correction.
