# NiavERP — Receivable / Payable Accounting Boundary

> Phase 2. Preserves Phase 1 ownership: Payments owns facts+links; Receivables/Payables own derived balances; Accounting owns money rows. No allocation algorithms.

## 1. The four linked layers

1. **Invoice posting** (Sales/Purchase via Engine): creates party-ledger legs (`30§1-2`) → outstanding exists as derivation.
2. **Payment posting** (Payments via Engine): creates money-account ↔ party-ledger legs (`30§3-4`).
3. **Application link** (Payments-owned): `payment → invoice(s)` rows with amounts (full/partial), same posting or appended later with audit. Zero applications = **advance** (not settlement).
4. **Outstanding view** (Receivables/Payables-owned): `invoiced − applied` per party/invoice, plus ageing buckets (buckets deferred to Phase 9).

## 2. Settlement vs payment (not synonyms)

- **Payment** = money moved (legs posted). **Application** = which invoices it settles. **Settlement** = derived state when applied = invoiced (full) or part thereof (partial).
- Every payment posts money legs regardless of applications; applications determine settlement, never existence of the payment.
- Advance: posted payment with zero applications. Later applications append links + audit; original payment legs untouched. Advances are never auto-applied by posting discipline (allocation policy deferred to Phase 9).

## 3. Accounting legs vs application links

- Legs move money between accounts (balanced, immutable). Links record intent (which invoice). Reconciliation/ageing read both; neither duplicates the other.
- Reversing a payment reverses its legs (new balanced entry) and voids/neutralises its applications via linked updates + audit; invoice outstanding re-derives upward. Reversing an invoice is symmetric (receivable falls, applications on it require resolution per Phase 9 policy — resolution mechanics deferred, requirement locked: no orphaned application may claim a reversed invoice as settled).

## 4. Customer vs supplier symmetry

- Customer side: `Dr Cash/Bank / Cr Customer ledger` + applications reduce receivables.
- Supplier side: `Dr Supplier ledger / Cr Cash/Bank` + applications reduce payables.
- A Party with both roles keeps separate role-scoped outstanding derivations over shared payment rails; netting across roles is forbidden in Phase 2 (deferred policy → `36`).
