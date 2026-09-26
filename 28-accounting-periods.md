# NiavERP — Accounting Periods (Conceptual)

> Phase 2. Eligibility + close discipline. No statutory year rules implemented.

## 1. Model

- **Identity:** stable period identity per company (e.g., monthly buckets within a fiscal span; exact calendar/span mechanics deferred — see §4).
- **Scope:** every Posting resolves to exactly one Period from its business date. Period state at post-time governs eligibility.
- **States:** `open` (accepts postings) → `closed` (rejects ordinary postings; narrow authorities may post adjustments with reason + audit) → `locked` (rejects all postings; reopen only by Owner-level authority + audit). No direct `locked → open` without passing through an audited reopen event.
- **Eligibility:** ordinary sources post only into `open`. Backdated business dates into `open` periods allowed per grant; into `closed/locked` rejected (or adjustment-only per authority). Future-dated business dates rejected by validation in V1 (deferred exception policy → `36`).
- **Closing:** an explicit audited transition (actor, timestamp, reason, checklist ref for later phases). Closing never edits rows; it only flips eligibility. Period reports remain reproducible after close.
- **Reopening:** explicit authority + reason + audit; applies prospectively to new postings; history untouched. Repeated close/reopen flapping is itself audited.
- **Audit:** every state change + every rejected closed-period attempt (actor, period, source ID, reason) recorded.

## 2. Backdated / future transactions

- Backdated into open period: allowed with posting audit noting business-date vs system-time skew.
- Backdated into closed/locked: rejected (ordinary) or adjustment-path only (authority + reason + separate adjustment lineage; adjustment mechanics deferred to later phases, not invented here).
- Future-dated: rejected in V1 conceptual model; any future exception (e.g., post-dated instruments) deferred.

## 3. What remains deferred (→ `36`)

Fiscal-year span, statutory close checklists, period-end adjustment types, year-end carry-forward mechanics, multi-year comparatives, automated close jobs, notice/tax-calendar bindings.
