# NiavERP — Opening Balances (Conceptual)

> Phase 2. Go-live starting positions, distinct from operations. No migration implementation.

## 1. Concept

- An Opening Balance is a specially-flagged Posting that establishes an account’s starting position at go-live. It is the only posting type allowed to assert a starting debit/credit without a preceding operational source chain.
- Flagged `is_opening` in lineage; reported separately; excluded from sales/purchase registers and operational day-books by definition (read-model filters, deferred implementation).

## 2. Rules

- **Identity:** one opening posting per (company, account) per go-live event (corrections are new linked openings, never edits).
- **Orientation:** exactly one side per opening leg set (debit xor credit per account, consistent with Type normal-balance expectations but not constrained by them); balanced overall across the opening batch (total debits = total credits, via offset/capital placeholder per later chart policy — placeholder only, no mapping invented here).
- **Business date:** the go-live/cutover date into the designated opening period. Operational backdating rules do not apply; opening period is explicitly designated at cutover.
- **Source:** migration/import batch (or manual opening declaration) → Engine-mediated posting. Direct ledger inserts forbidden. Batch ID + row refs preserved in lineage.
- **Period:** posts only into the designated opening period while it is open for openings; ordinary periods reject `is_opening` postings.
- **Audit:** actor, batch, reason, business date, account-at-time, cutover note. Corrections require new opening postings + reason + audit; originals retained.
- **Distinguishability:** every read (trial balance, ledger view, registers) must be able to include/exclude openings explicitly; default operational views exclude or label them (presentation deferred, requirement locked here).
