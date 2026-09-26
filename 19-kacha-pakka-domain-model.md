# NiavERP — Kacha → Pakka Domain Model

> Phase 1. Controlled lawful lifecycle. No rate-edit allow-list (default DENY; Phase 6 defines matrix).

## 1. Domain participants

- **Delivery Challan** (movement fact) → **Kacha/Pakka** (classification + conversion policy + Conversion State derivation) → **Conversion** (action + refs) → **Invoice** (GST bill). Engine executes; Tax recomputes; Audit records; Inventory/Account continuity preserved via posting.

## 2. First-class guarantees (conceptual invariants)

1. Kacha is a first-class controlled record: numbered, posted, stock-visible, auditable — identical machinery to Pakka.
2. Kacha is not off-books: no untracked series, no deletable challans, no “hide from GST/tax” flag, no dual-book view.
3. Kacha cannot disappear: conversion marks state, never deletes; full, partial, bulk, many-to-one all preserve sources.
4. Conversion is additive with traceable refs: every invoice line from a challan carries (challan, line) refs; bulk shares action ID; many-to-one carries full set.
5. Sources remain available: challans queryable post-conversion for history/audit/returns.
6. Partial preserves remainder: remaining derived and enforced; over-conversion impossible by validation.
7. Full records completion: remaining = 0 on all lines + `fully_converted` + audit.
8. Reversal preserves lineage: invoice reversal/credit links back; challan convertibility restored only via engine transition + audit.
9. Cancellation preserves history: pre-convert voids with reason; post-convert handled as reversal, never deletion.

## 3. Conversion patterns (conceptual)

| Pattern | Shape | Lineage requirement |
|---|---|---|
| Individual | 1 challan → 1 invoice | Line-level refs, remaining updated |
| Bulk | N challans → N invoices in one action | Each pair linked; shared action ID; per-pair audit |
| Partial | Part of line qty → invoice now | Split tracked; remainder open; later conversions reference same line |
| Many-to-one | N challans → 1 invoice | All source refs on invoice; party/compatibility validated by Engine (rules Phase 6) |

## 4. Continuity (owned, not assumed)

- **Stock (LOCKED global correction):** the challan delivery posts the single inventory OUT; the invoice posts no further movement (it consumes Kacha quantity). Invariants: single physical effect, no silent drop, reversal restores via linked compensating events.
- **Accounting:** challan creates no sale revenue/receivable/cash (delivery only); invoice = sale revenue/receivable. Both via Engine postings.
- **Tax:** liability per Tax Engine on invoice (and per statutory trigger as Phase 4 defines), linked to invoice lines + originating challans for traceability. UI never computes.

## 5. Rate-edit extension point (Phase 6; default DENY)

- Phase 1 forbids price editing entirely.
- Conceptual hook reserved: a future `RateEditPolicy` evaluated at Conversion (allowed-case class, actor permission, reason capture, engine recomputation of values + tax, audit, source preservation).
- No allow-list invented here. Any Phase 6 permission must satisfy all six: classified case + permitted actor + recorded reason + engine recompute + audit record + preserved source. Otherwise DENY.

## 6. Abuse cases that must fail validation (conceptual)

Untracked challan submit; deleted/overwritten challan; invoice without source refs claiming conversion; over-conversion; duplicate conversion under retry/race; manual conversion-state edit; UI-set tax/rate override; cross-party many-to-one; post-post “cancellation by deletion”.
