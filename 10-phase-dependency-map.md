# NiavERP — Phase Dependency Map

> Roadmap from Phase 0 (this foundation) through production. Objective / prerequisites / outputs / downstream / gate per phase.

## Phase 0 — Product Constitution & Scope (THIS PHASE)

- Objective: lock mission, scope, architecture principles, domains, lifecycle, Kacha/Pakka controls, offline/security/integration/test foundations.
- Prerequisites: strategy material (provided).
- Outputs: `docs/00–11` + `README.md`.
- Downstream: all phases.
- Gate: consistency review passes; no implementation leaked.

## Phase 1 — ERP Domain Model

- Objective: conceptual entity-relationship per domain (fields at high level), ownership matrix, state diagrams.
- Prerequisites: Phase 0.
- Outputs: domain model doc + glossary.
- Downstream: Phases 2–6.
- Gate: every entity has one owner; lineage fields present.

## Phase 2 — Accounting Engine

- Objective: chart, posting model, balanced-write + reversal/correction semantics + tests.
- Prerequisites: Phase 1.
- Outputs: posting spec + accounting test suites.
- Downstream: 5, 9, 13, 14.
- Gate: balanced-posting + reversal invariants green.

## Phase 3 — Inventory Engine

- Objective: stock-ledger model, location/transfers, negative-stock policy + tests.
- Prerequisites: Phases 1–2.
- Outputs: inventory spec + tests.
- Downstream: 5, 6, 7, 8.
- Gate: stock-continuity invariants green.

## Phase 4 — GST & Indian Statutory Engine

- Objective: central tax engine interface, rule versioning, determination inputs/outputs (no hardcoded UI logic).
- Prerequisites: Phases 1–2.
- Outputs: tax engine contract + deterministic fixtures.
- Downstream: 5, 6, 7, 8, 14.
- Gate: determinism + linkage tests green; no invented statutes beyond scoped contract.

## Phase 5 — Voucher & Transaction Engine

- Objective: validation → posting atomicity, series/numbering authority, idempotency, status machine.
- Prerequisites: Phases 1–4.
- Outputs: engine spec + transaction suites.
- Downstream: 6–9, 11, 12.
- Gate: atomicity + idempotency + concurrency tests green.

## Phase 6 — Kacha → Pakka

- Objective: challan series policy, conversion (single/bulk/partial/many-to-one), remaining-qty, lineage, reversal semantics.
- Prerequisites: Phase 5 (+3, +4 for continuity).
- Outputs: conversion spec + race/lineage suites.
- Downstream: 7, 13, 14.
- Gate: over-conversion impossible; lineage + race suites green; prohibitions verified.

## Phase 7 — Sales Cycle

- Objective: invoice/return flows on the engine (no screens yet beyond test harnesses unless Phase 10 overlaps).
- Prerequisites: Phases 5–6.
- Outputs: sales flows + tests.
- Downstream: 9, 10, 13.
- Gate: sale↔stock↔tax linkage green.

## Phase 8 — Purchase Cycle

- Objective: purchase/return flows on the engine.
- Prerequisites: Phase 5 (+3, +4).
- Outputs: purchase flows + tests.
- Downstream: 9, 13.
- Gate: linkage green.

## Phase 9 — Receivables / Payables / Cash / Bank

- Objective: payment application (full/partial/advance), balances/ageing derivations, cash/bank movements, basic reconciliation.
- Prerequisites: Phases 5, 7, 8.
- Outputs: payment/recon specs + tests.
- Downstream: 13, 14.
- Gate: application + ageing invariants green.

## Phase 10 — Bharat UX

- Objective: mobile-first Hindi-first flows (billing, challan, payments) as thin renderers over engine contracts.
- Prerequisites: Phases 5–9 contracts.
- Outputs: UX specs/prototypes (implementation only when authorised).
- Downstream: 11, 20 (UAT).
- Gate: no business logic in UI; localisation presentation-only verified.

## Phase 11 — Offline-First Architecture

- Objective: SQLite cache/queue, durable IDs, idempotent push/pull, retry, conflict surfacing.
- Prerequisites: Phases 5, 10.
- Outputs: sync protocol + fault-injection suites.
- Downstream: 12, 20.
- Gate: offline + retry + idempotency suites green.

## Phase 12 — Multi-Device & Multi-User ERP

- Objective: concurrency correctness (numbering, conversion races), cached grants, server authority.
- Prerequisites: Phases 5, 11.
- Outputs: concurrency suites + enforcement proofs.
- Downstream: 20.
- Gate: race suites green with real constraints.

## Phase 13 — Reporting Engine

- Objective: read-only derivations (registers, ledgers, stock, day book, GST-ready summaries).
- Prerequisites: Phases 2–9.
- Outputs: report definitions + reproducibility tests.
- Downstream: 14, 15.
- Gate: reports reproduce from event log.

## Phase 14 — Reconciliation / Compliance Centre

- Objective: matching (payments/bank/stock/tax), exceptions, readiness state.
- Prerequisites: Phase 13.
- Outputs: recon specs + tests.
- Downstream: 15.
- Gate: exception-driven flows verified.

## Phase 15 — Compliance Assistant

- Objective: guided owner-understandable compliance help; "needs CA review" surfacing. No filing automation claims.
- Prerequisites: Phase 14.
- Outputs: assistant content + readiness logic.
- Downstream: 20 (UAT).
- Gate: never claims CA unnecessary (content review).

## Phase 16 — Administration & Business Controls

- Objective: roles matrix finalised, period locks, approvals hooks, company settings, device/session admin.
- Prerequisites: Phases 1, 5.
- Outputs: admin specs + enforcement tests.
- Downstream: 20.
- Gate: server-side enforcement suites green.

## Phase 17 — Tally Integration

- Objective: adapter implementation + fixtures (mechanism decided here, not before).
- Prerequisites: Phases 5, 13.
- Outputs: adapter + round-trip suites.
- Downstream: 19, 20.
- Gate: round-trip suites green; core untouched.

## Phase 18 — BUSY Integration

- Objective: adapter implementation + fixtures. Same gates as Phase 17.
- Prerequisites: Phases 5, 13.
- Outputs: adapter + suites.
- Downstream: 19, 20.

## Phase 19 — Migration & Onboarding

- Objective: import validation, dry-run reports, opening-balance via engine, go-live cutover.
- Prerequisites: Phases 1, 5, 17, 18.
- Outputs: migration runbooks + tests.
- Downstream: 20.
- Gate: dry-run + idempotent re-import verified.

## Phase 20 — Production Hardening & UAT

- Objective: performance, backup/restore, observability, retailer UAT, CA acceptance, pilot.
- Prerequisites: all prior gates.
- Outputs: hardening report + UAT sign-off.
- Gate: shop-day E2E + Hindi UAT + CA review pass.
