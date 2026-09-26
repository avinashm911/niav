# NiavERP — Accounting Consequences (Conceptual Examples)

> Phase 2. Intent → affected account *concepts* → balanced entry shape. No final GST/inventory mappings, no statutory treatment, no amounts-as-spec.

## Reading pattern per example

`Source → accounting intent → affected concepts → entry shape (Dr/Cr roles, no rates)`.

## 1. Sale (direct invoice, no challan)

- Source: Sale Invoice (party=customer, lines with values-as-intended).
- Intent: recognise revenue + customer obligation.
- Concepts: Customer party-ledger (Asset-type), Revenue (Income-type). Tax/stock legs explicitly excluded here (Phase 3/4 bind them later as additional balanced legs on the same Posting).
- Shape: `Dr Customer party-ledger / Cr Revenue` (balanced; tax/stock legs append in later phases on the same entry, preserving balance).

## 2. Purchase (direct bill)

- Source: Purchase Invoice (party=supplier).
- Intent: recognise cost/expense + supplier obligation.
- Concepts: Purchase/Cost (Expense-type), Supplier party-ledger (Liability-type).
- Shape: `Dr Purchase/Cost / Cr Supplier party-ledger`.

## 3. Receipt (customer pays)

- Source: Receipt/Payment with application(s) to sale invoice(s).
- Intent: settle receivable in cash/bank; application links record which invoices.
- Concepts: Cash/Bank account, Customer party-ledger.
- Shape: `Dr Cash/Bank / Cr Customer party-ledger`. Application links (invoice refs, full/partial) ride alongside, not as extra legs.

## 4. Payment (to supplier)

- Source: Payment with application(s) to purchase invoice(s).
- Intent: settle payable.
- Concepts: Supplier party-ledger, Cash/Bank.
- Shape: `Dr Supplier party-ledger / Cr Cash/Bank`.

## 5. Expense (cash)

- Source: Expense/payment (e.g., shop rent paid cash; exact voucher catalogue Phase 5).
- Intent: recognise expense + reduce cash.
- Concepts: Expense account, Cash account.
- Shape: `Dr Expense / Cr Cash`.

## 6. Cash movement / Bank movement / Transfer

- Source: Cash↔Cash, Bank↔Bank, Cash↔Bank transfer (no party P&L effect).
- Intent: relocate money between money accounts.
- Concepts: two money accounts (Cash/Bank instances).
- Shape: `Dr Destination money account / Cr Source money account`.

## 7. What is explicitly not fixed here

Which revenue/cost accounts per voucher type, tax legs/splits, stock/cost-of-goods legs, discounts/round-offs treatment, advances vs income timing, TDS/TCS, return/credit-note mappings — all deferred to Phase 3/4/5/7/8/9 with balanced-entry discipline inherited from this doc.
