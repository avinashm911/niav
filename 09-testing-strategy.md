# NiavERP — Testing Strategy (Phase 0 Definition)

> No tests implemented in Phase 0. This defines layers, invariants, and gates for later phases.

## 1. Layers

- **Domain/unit:** pure validation, status transitions, remaining-quantity math, localisation fallback (no DB).
- **Database:** constraints, RLS isolation, idempotency keys, series uniqueness under concurrency.
- **Transaction:** lifecycle atomicity (all-or-none consequences), idempotent resubmit, provisional→final numbering.
- **Accounting:** balanced postings, reversal restores effects, ledger ↔ source linkage.
- **Inventory:** stock derived only from events; transfers preserve totals; over-conversion rejected.
- **Tax:** deterministic engine output per rule version; tax ↔ source linkage; no UI computation.
- **Integration (adapter):** golden fixtures, round-trip export/import, mapping versioning.
- **Sync:** offline queue → push/pull, retry safety, conflict records, server authority.
- **Multi-user:** concurrent billers, double-submit races, same-challan conversion race.
- **Mobile:** offline flows, queue depth UX, Hindi rendering, low-end device behaviour.
- **E2E:** shop-day scenarios (open → sell/challan → convert → collect → sync → report).
- **UAT:** Hindi-speaking retailer acceptance, CA review acceptance, migration acceptance.

## 2. Critical Invariants (Must-hold, tested from Phase 2 onward)

1. Invoice posting cannot create inconsistent stock (posted invoice ↔ stock event atomic).
2. Reversal restores appropriate stock/accounting effects and preserves lineage (no deletion).
3. Transaction IDs are idempotent (resubmit same ID → single effect).
4. Source documents remain traceable (invoice → challan(s) → audit; report → source).
5. Tax consequences remain linked to source transactions + rule version.
6. Balances/ageing/stock-on-hand equal derivation over consequences (no drift).
7. Company isolation holds (no cross-tenant read/write in any layer).
8. Kacha/Pakka conversions never over-convert (remaining ≥ 0) and never lose lineage.
9. No untracked sale path exists (every revenue/stock decrement has a source transaction).
10. Permission checks hold server-side even with hostile client.

## 3. Test Data & Determinism

- Seeded companies/parties/items; frozen rule-version fixtures for tax tests.
- Concurrent tests use real constraints (unique idempotency, series) not mocks alone.
- Hindi locale fixtures verify presentation-only localisation (logic keys unchanged).

## 4. Gates (Conceptual)

- Phase 2→3: balanced-posting + reversal suites green.
- Phase 5→6: transaction atomicity + idempotency suites green.
- Phase 6: Kacha/Pakka lineage + over-conversion + race suites green.
- Phase 11/12: offline + multi-user suites green under fault injection.
- Phase 20: full E2E + UAT sign-off before production.

## 5. What Phase 0 Does Not Do

No test files, no frameworks installed, no fake passing suites. Strategy only.
