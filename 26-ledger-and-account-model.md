# NiavERP — Ledger / Account / Journal Terminology Decision

> Phase 2 decision. Resolves Phase 1 §4 open wording. Applies from here onward.

## Decision: distinct concepts (not unified)

- **Account:** definition in the Chart (what a bucket means, its Type/Group, active/retired). No amounts live on Account.
- **Ledger:** the immutable store of posted debit/credit rows (the money truth). Rows reference Accounts. Balances are derived folds over Ledger rows.
- **Journal:** chronological derived view over posted Journal Entries (day-book ordering by business date + entry). No independent storage.
- **Journal Entry:** the balanced posting unit (2..N legs, debits = credits) created exactly once per Posting in the base model.

## Why distinct (not unified)

1. Preserves Phase 1 ownership: Accounting owns definitions/policy; Ledger owns posted rows; Reports owns derived views. Unifying Account+Ledger would let master edits masquerade as book edits.
2. Makes lineage explicit: Leg → Account-at-time + Entry + Posting + Source. A unified “ledger account with balance column” would invite mutable-balance drift, forbidden by constitution.
3. Keeps Journal as read-model: prevents a second writable book alongside Ledger.
4. Matches required invariants: “posted rows immutable, balances derived, entries balanced” each attach to a different concept (Ledger / Entry / Account-Type aid).

## Usage rule (mandatory wording)

- Say **Account** for definitions, **Ledger row / Journal Leg** for posted facts, **Journal Entry** for the balanced unit, **Journal** for the chronological view.
- Never say “ledger account balance” as stored truth; say “derived balance over Ledger rows for Account X”.
- Never say “post to the journal”; say “post a Journal Entry via Posting; Journal derives it”.

## Consequences for later phases

- Phase 3/4 bind valuation/tax outputs to Accounts by policy but write only via Engine postings into Ledger rows.
- Migration/adapters create Accounts (masters) and submit Opening/operational Sources; they never insert Ledger rows directly.
- Reports/Reconciliation read Ledger rows + Entries; they never define Accounts.
