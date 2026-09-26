# NiavERP — Cash / Bank Accounting Boundary

> Phase 2. Money-account ownership + entry shapes. No reconciliation, no banking APIs.

## 1. Ownership

- **Cash/Bank account definitions** (which tills/accounts exist per company): Company scope, administered under Accounting policy (governed creation/retire, audited).
- **Money movements** (receipts, payments, transfers): Payments-owned facts posted via Engine as balanced entries (`30§3-4,§6`).
- **Ledger rows** for those movements: Accounting-owned. **Outstanding effects**: none directly (money moves settle party ledgers via §32 links; transfers touch only money accounts).
- Reconciliation (matching books ↔ statements) is a later-phase read/compare concern; it owns no postings and is explicitly not defined here.

## 2. Entry shapes (conceptual, from `30`)

- Receipt: `Dr Cash/Bank / Cr Party ledger` (+ applications).
- Payment: `Dr Party ledger / Cr Cash/Bank` (+ applications).
- Transfer (Cash↔Bank, Cash↔Cash, Bank↔Bank): `Dr Destination / Cr Source` (no party legs, no P&L).
- Expense paid immediately: `Dr Expense / Cr Cash/Bank` (no intermediate payable unless policy creates one — voucher catalogue Phase 5).

## 3. Guardrails

- Every money movement references exactly one source money account and one destination (party ledger, expense, or money account). Split-tender (cash + UPI for one bill) is N legs within one balanced Entry, not N postings — split mechanics deferred to Phase 9, balance rule already covers it.
- Transfers never create revenue/expense or change outstanding; any apparent P&L from a transfer is a policy violation.
- Bank charges/interest, if ever modelled, are separate expense/income postings with their own sources, never silent adjustments to a transfer.
