# NiavERP — Phase 4 Decisions (Locked / Deferred / Open)

> Close-out. Phase 0–3 untouched. No rates, APIs, filing, SQL, or code introduced.

## LOCKED

1. GST owns tax semantics only: determination identity + classification + jurisdiction structure + taxable-value/trace + component roles + posted lines; never ledger/stock/payment truth (`49`,`53`,`60§17-19`).
2. Registration separate from company identity; multi-registration + effective-dated history + at-date resolution (`50`).
3. Jurisdiction via explicit inputs with determined (never copied) place-of-supply; intra-pair (CGST+SGST, UT variant CGST+UTGST) XOR inter-single (IGST) + optional cess-role; mixed structures rejected (`50§4`,`53`,`60§10`).
4. Classification pipeline deterministic with default-deny on ambiguity; no UI-typed tax as truth (override concept DENY in Phase 4); anti-evasion guards (positive evidence per class) (`51`).
5. Taxable-value step order + full calculation trace + exact-decimal + explicit rounding refs; commercial completeness deferred per-step (`52`).
6. Tax lines immutable per (source line × component) with rate-ref + config version + basis + amount + jurisdiction/registration refs, posted via Engine fan-out (`53`).
7. HSN/SAC/category are lookup references, never rates; assignment history preserved; service/SAC scope placeholder only (`54`).
8. GST attaches to shared lineage (no parallel identity); challan→invoice tax lineage preserved with timing matrix deferred to Phase 6/7 (`55`).
9. Reversal = compensating lines + links; Correction = reversal + replacement under action ID; credit/debit notes are document *forms* of those chains, workflows deferred to Phase 7/8 (`56`).
10. Five clocks distinct (business/document/accounting-period/statutory-tag/client/server); statutory period is tagging only; filing/e-invoice/e-way are future adapter boundaries, never core behaviours (`57`).
11. Determinism contract + versioned effective-dated configuration with history pinning and additive-only evolution (`58`).
12. Offline availability-gated provisional-only classification; server-authoritative posting; version-supersede + idempotent replay + no post-hoc re-resolution (`59`).
13. 20 invariants + 53-case matrix as Phase 5 entry gate (`60`,`61`).
14. Zero-cost: no paid APIs/databases/SaaS/tooling; no downloads in Phase 4; future data from free/public authoritative sources via versioned boundary; commercial calculators never authoritative.

## DEFERRED (explicit)

Rates/rate schedules; place-of-supply exception catalogue; RCM schedule; composition scheme rules/workflows; discount/freight/valuation inclusion lists; HSN/SAC coverage data + service place-of-supply rules; challan→invoice tax-timing matrix (Phase 6) + invoice workflows (Phase 7/8); return schemas/set-off/carry-forward/interest/late-fee; e-invoice/e-way bill API behaviours; statutory-data import mechanism; filing adapter design; reporting/reconciliation; Tally/BUSY; schema/SQL/RLS/functions; mobile UI; role matrix; period-end tax routines.

## OPEN (risks carried)

- Configuration governance workflow (who publishes versions, overlapping-effective rejection enforcement point) needs Phase 5/16 design.
- Zero-rated credit/refund mechanics deferred — class supported, economics not modelled.
- Composition-holder counterparty handling detail deferred — recognised as input flag only.
- Stale-config freshness thresholds deferred — Phase 11/12 sync policy must set them without weakening default-deny.

## Phase 5 prerequisites

Tax spine (determination ID + explicit inputs + versioned config ref + structural validation + immutable lines + lineage/audit/idempotency) with money/stock/payment unowned. Phase 5 (Universal Transaction Engine) may orchestrate validation→posting fan-out across accounting/inventory/tax siblings and enforce idempotent atomicity + reversal/correction linkage, without redefining tax semantics or introducing workflows, rates, filing, or integrations.
