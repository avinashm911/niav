# NiavERP — Accounting Domain Model (Conceptual)

> Phase 2. Conceptual only. No SQL, no code, no GST rates, no inventory math.
> Authority: Phase 0 constitution + Phase 1 ownership/lineage (`14`, `16`, `21`). Engine orchestrates; Accounting owns semantics.

## Concepts (purpose / owner / identity / lifecycle / relationships / mutability / lineage / dependencies)

### Account
- Purpose: chart node that classifies debit/credit effects (cash, bank, sales, purchase, party ledger, placeholders for tax/stock).
- Owner: Accounting (policy) — see `26` for Account vs Ledger decision.
- Identity: stable account identity per company (code is human ref, not identity).
- Lifecycle: created → active → retired (no new lines; history retained). Merges/splits only via governed, audited reclassification (deferred detail).
- Relationships: Account ← N Journal Lines; Account → Account Group/Type; Party/Item link by policy (party ledgers), not by ownership.
- Mutable: name/group/active flag (audited). Immutable: identity, posted-line refs.
- Lineage: every line links account-at-time + posting + source.
- Dependencies: Company scope, Chart, Period (posting eligibility).

### Chart of Accounts
- Purpose: the company-scoped catalogue of Accounts + hierarchy + groups + reporting classes.
- Owner: Accounting.
- Identity: chart version per company (edits versioned conceptually; exact versioning deferred).
- Lifecycle: defined → active → amended (audited) → (period-locked application prospectively).
- Relationships: Chart → N Accounts/Groups.
- Mutable: structure (governed). Immutable: applied history (past postings keep account-at-time).
- Lineage: postings reference chart-version-at-time (conceptual; storage deferred).
- Dependencies: Company.

### Account Group
- Purpose: browsing/aggregation bucket (e.g., Current Assets, Sundry Debtors). Never drives debit/credit behaviour.
- Owner: Accounting.
- Identity: stable group identity per company.
- Lifecycle: defined → active → retired.
- Relationships: Group → N Accounts; distinct from Account Type and reporting class.
- Mutable: membership (audited). Immutable: past derivations.
- Lineage: reports resolve group-at-report-time over posted lines; postings never store group.
- Dependencies: Chart.

### Ledger
- Purpose: the immutable posted debit/credit record (rows). Truth for money; balances derived.
- Owner: Ledger conceptually = posted-row store under Accounting ownership (see `26`: Account = definition, Ledger = posted rows).
- Identity: stable row identity per posting line.
- Lifecycle: posted (immutable) → (neutralised by reversal rows, linked).
- Relationships: Ledger row → 1 Posting + 1 Source + 1 Account + 1 Journal Entry.
- Mutable: none.
- Lineage: source + posting + account-at-time on every row.
- Dependencies: Engine posting, Accounting policy, Period.

### Journal
- Purpose: chronological view over posted Journal Entries (day-book concept). A read-model over Ledger rows, not a second truth.
- Owner: Accounting (derived view).
- Identity: none independent (derived ordering over entries + business date).
- Lifecycle: derived continuously.
- Relationships: Journal → N Journal Entries → N Lines.
- Mutable: none (recomputed).
- Lineage: traceable to entries → postings → sources.
- Dependencies: Ledger rows.

### Journal Entry
- Purpose: the balanced unit of posting (TOTAL DEBITS = TOTAL CREDITS). One entry per Posting in the base model; batching deferred (see Posting Batch).
- Owner: Accounting (semantics); created only via Engine posting.
- Identity: stable entry identity per posting (1↔1 in base model).
- Lifecycle: validated → posted (balanced, immutable) → (reversed/corrected via new entries).
- Relationships: Entry → 2..N Lines; Entry ↔ 1 Posting ↔ 1 Source.
- Mutable: none once posted.
- Lineage: entry carries source + posting + period + business date + actor + company.
- Dependencies: Source validation, Period open, Chart.

### Journal Line / Accounting Leg
- Purpose: single debit-or-credit leg (account + one-sided amount + lineage).
- Owner: Accounting (row semantics under Ledger).
- Identity: stable leg identity within its entry.
- Lifecycle: posted immutable.
- Relationships: Leg → 1 Account; Leg → 1 Entry.
- Mutable: none.
- Lineage: account-at-time + source + posting + entry.
- Dependencies: Account active, amount policy (`27`: no zero/negative posted legs; corrections via new legs).

### Posting
- Purpose: atomic commit event binding a validated Source to its balanced Entry + audit (see `27`).
- Owner: Transaction Engine (orchestration); Accounting owns balance/content rules.
- Identity: stable posting identity per source (1↔1 base model; retries share it).
- Lifecycle: requested → validated → posted | rejected (with reason). Posted never edited.
- Relationships: Posting ↔ Source, Voucher, Entry, Audit.
- Mutable: none once posted.
- Lineage: the lineage hinge (see `16`).
- Dependencies: validation reads (masters, grants, series, period, remaining), idempotency key (= source ID).

### Posting Batch
- Purpose: grouping of postings for operational convenience (bulk conversion, import accept, day close). Never a balance boundary — each Entry balances independently.
- Owner: Transaction Engine (grouping) + Audit (record).
- Identity: stable batch/action identity (e.g., bulk-conversion action ID).
- Lifecycle: opened → posted per member (each atomic) → closed with report.
- Relationships: Batch → N Postings (each independent).
- Mutable: member outcomes only during execution; closed batches immutable.
- Lineage: members link batch ID + individual sources.
- Dependencies: Engine idempotency per member.

### Accounting Period
- Purpose: time boundary controlling posting eligibility + close discipline. See `28`.
- Owner: Accounting (policy); Company owns calendar scope.
- Identity: stable period identity per company.
- Lifecycle: open → closed → locked (reopen only by authority + audit).
- Relationships: Posting → 1 Period (resolved from business date).
- Mutable: state transitions only (audited). Immutable: history.
- Lineage: every posting links period-at-post + business date.
- Dependencies: Company calendar.

### Opening Balance
- Purpose: migration/go-live starting position per account, distinguishable from operations. See `29`.
- Owner: Accounting (semantics); Migration (batch) submits via Engine.
- Identity: stable opening-balance posting identity per (company, account).
- Lifecycle: drafted → validated → posted (in opening period) → (corrected only via new corrective openings + audit).
- Relationships: Opening → Account; Opening → Import Batch (where migrated).
- Mutable: none once posted.
- Lineage: flagged `is_opening`, links batch/source, never mixed with operational voucher types.
- Dependencies: Period (opening), Chart, Audit.

### Accounting Consequence
- Purpose: the posted Entry + Legs resulting from one Posting (the money effect).
- Owner: Accounting/Ledger; orchestrated by Engine.
- Identity: = Entry identity (+ leg IDs).
- Lifecycle: posted immutable → (neutralised by reversal consequences).
- Relationships: Consequence ↔ Posting ↔ Source; Legs → Accounts.
- Mutable: none.
- Lineage: full chain per `16`.
- Dependencies: validation + period + chart.

### Reversal / Correction
- Purpose: additive neutralisation (Reversal) or neutralise-plus-replace (Correction) of a posted Entry. See `31`.
- Owner: Engine (transition) + Accounting (balance rules); effects owned as new Ledger rows.
- Identity: new posting/entry identities with `reverses/corrects` links.
- Lifecycle: requested (reason + permission) → posted (balanced, linked) → audited.
- Relationships: New Entry → Old Entry (`reversal_of` at leg level where needed).
- Mutable: none once posted.
- Lineage: bidirectional links; originals untouched.
- Dependencies: original posting exists + posted; period eligibility for new posting date.
