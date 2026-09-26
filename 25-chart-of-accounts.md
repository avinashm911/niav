# NiavERP — Chart of Accounts (Conceptual)

> Phase 2. Configurable charts with guarded system semantics. No universal chart hardcoded. No GST accounts beyond placeholders. No SQL.

## 1. Principles

1. One chart per Company. No shared accounts across companies.
2. Configurable hierarchy; guarded system semantics (party ledgers, cash/bank, sale/purchase, placeholders for tax/stock) must exist conceptually for later phases to bind to — exact template deferred.
3. Postings reference account-at-time; chart edits apply prospectively, never rewrite history.
4. Groups aggregate; Types drive behaviour; Reporting classes present. These three are distinct axes (see §4).

## 2. Account identity and refs

- **Identity:** stable account identity per company. **Code** (e.g., human short code) and **Name** are refs/labels, not identity. Codes unique per company; reuse after retire forbidden.
- **Hierarchy:** Account → optional Parent Account (tree for roll-ups). Depth/policy deferred; Phase 2 requires only: acyclic, single parent, company-scoped.
- **Group:** aggregation bucket (Current Assets, Sundry Debtors, Duties & Taxes placeholder, etc.). Group membership mutable (audited); history derivations use group-at-report-time.
- **Type:** behavioural classification from `25§3` (Asset/Liability/Equity/Income/Expense). Exactly one Type per Account; Type changes are reclassification events (audited, prospective; exact mechanics Phase 2-decisions deferred).
- **State:** `active` (accepts new lines) vs `retired` (history retained, no new lines). No deletion.
- **Ownership:** every Account belongs to exactly one Company. Merges across companies forbidden.

## 3. Account types (behavioural; see also 25-chart appendix)

- Asset, Liability, Equity/Capital, Income/Revenue, Expense. No sixth type in Phase 2; if a later phase needs one (e.g., statistical/memo), it requires justification + constitution-compatible amendment, never a silent addition.
- Normal-balance semantics conceptually: Assets/Expenses normally debit; Liabilities/Equity/Income normally credit. Normal balance is a reporting/validation aid, not a posting permission — postings may debit or credit any account where policy allows; balance follows the balanced-entry rule.
- Type ≠ Group ≠ Reporting class. Example: “Sundry Debtors – Retail” (Group) contains party ledger Accounts (Type: Asset) reported under “Trade Receivables” (Reporting class).

## 4. System vs user-created accounts

- **System-semantic accounts:** conceptually required roles the Engine/policy will bind to (cash account instances, bank account instances, sale/purchase policy targets, party-ledger pattern, opening-balance equity placeholder, tax/stock placeholders for Phase 3/4). Phase 2 names the roles, not the final codes/names; templates deferred to `36`.
- **User-created accounts:** owner-defined ledgers under governed creation (unique code, one Type, one Group, active). Creation/retire audited with actor/reason.
- Guardrail: user accounts must not hijack system roles (e.g., a manual “GST Output” replacement); tax/stock bindings resolve only through Engine-owned policy in later phases.

## 5. Reporting classification

- A presentation mapping (Balance Sheet / P&L buckets, day-book grouping) over Accounts. Owned by Reporting (later phase); Chart exposes the hooks. Postings never store reporting classes.

## 6. Placeholders (explicitly not defined now)

- GST input/output/liability accounts: placeholder roles only; rates, treatments, return mappings deferred to Phase 4.
- Stock/inventory valuation accounts: placeholder roles only; valuation math deferred to Phase 3.
- No codes, names, or treatments fixed here.

## 7. What remains deferred (→ `36`)

Chart templates/starter packs, depth limits, code formats, reclassification mechanics, multi-currency presentation, cost-centre analytics, statutory adjustments, Tally/BUSY mappings, report implementations.
