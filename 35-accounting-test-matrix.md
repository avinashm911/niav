# NiavERP — Accounting Test Matrix (No Code)

> Phase 2. Each case: Setup / Action / Expected / Invariants protected (→ `34`).

## Posting basics

1. **Balanced journal posts.** Setup: open period, active accounts, valid sale source. Action: post. Expected: one Entry, debits=credits, number assigned, audit appended. Guards: 1,3,4,5,6,10,11,14.
2. **Unbalanced journal rejected.** Setup: intent with mismatched leg sums. Action: post. Expected: rejection with reason, no Entry/number/audit-book-effect (rejection audit where consequential). Guards: 1.
3. **Zero/negative leg rejected.** Setup: intent with 0 or negative leg. Action: post. Expected: rejection. Guards: 1,15.
4. **Cancelled draft posts nothing.** Setup: draft cancelled pre-post. Action: attempt post of cancelled ID. Expected: rejection; no Entry. Guards: 2,3,7.

## Idempotency / concurrency / offline

5. **Duplicate posting converges.** Setup: posted source. Action: resubmit same ID. Expected: original refs returned, no second Entry. Guards: 8.
6. **Retry after transport failure safe.** Setup: post request times out ambiguously. Action: client retries same ID. Expected: single Entry either way. Guards: 8,12.
7. **Offline create → sync posts once.** Setup: offline sale with durable ID + client timestamp. Action: reconnect + push. Expected: one Entry in then-open period; `pending_sync` → `posted` with server anchor alongside local ID. Guards: 6,8,12,14.
8. **Sync replay safe.** Setup: ack lost after posting. Action: replay same batch. Expected: no duplicate; ack recovered. Guards: 8,12.
9. **Simultaneous billers, distinct sources.** Setup: two billers, two IDs, same series. Action: concurrent posts. Expected: two Entries with distinct final numbers, both balanced. Guards: 1,5,8,11.
10. **Same-ID race converges.** Setup: two devices submit same ID concurrently. Action: race. Expected: one Entry; loser gets winner refs + conflict audit. Guards: 8,14.

## Reversal / correction

11. **Reversal neutralises.** Setup: posted sale. Action: reverse with reason/permission. Expected: new balanced reversal Entry with `reverses/reversal_of` links; net zero; original retained. Guards: 2,3,7,14.
12. **Double reversal rejected.** Setup: already-reversed entry. Action: second reversal. Expected: rejection. Guards: 7.
13. **Correction replaces via links.** Setup: posted purchase with wrong account. Action: correct (reverse + replace, shared action ID). Expected: two linked entries + `corrected` overlay on original; audit complete. Guards: 2,7,14.

## Periods / dates / openings

14. **Closed period rejects ordinary posting.** Setup: period closed. Action: post backdated into it. Expected: rejection (+ audit); adjustment path only with authority (deferred mechanics). Guards: 9.
15. **Locked period rejects all.** Setup: period locked. Action: any posting into it. Expected: rejection. Guards: 9.
16. **Backdated into open posts with skew note.** Setup: business date < system date, period open. Action: post. Expected: posts into business-date period; audit notes skew. Guards: 6,9,14.
17. **Future-dated rejected (V1).** Setup: business date in future. Action: post. Expected: rejection. Guards: 6,9.
18. **Opening posts distinctly.** Setup: opening period + import batch. Action: post openings. Expected: flagged `is_opening` entries, batch-linked, excludable from operational registers. Guards: 3,6,16.
19. **Opening correction is new opening.** Setup: posted opening with error. Action: correct. Expected: new linked opening; original retained. Guards: 2,7,16.

## Money flows (accounting legs only; allocation deferred)

20. **Payment with no application = advance.** Setup: customer payment, no invoice refs. Action: post. Expected: money legs posted; zero applications; outstanding unchanged except cash; labelled advance. Guards: 1,3.
21. **Payment application settles.** Setup: posted invoice + payment. Action: apply (full/partial). Expected: application links + audit; outstanding re-derives down; legs of originals untouched. Guards: 3,7,13.
22. **Receivable settlement complete.** Setup: invoice fully applied. Action: derive. Expected: outstanding zero; history shows invoice + payment + links. Guards: 13.
23. **Payable settlement complete.** Mirror of 22 on supplier side. Guards: 13.
24. **Cash movement balanced.** Setup: cash receipt/transfer. Action: post. Expected: money-account legs balanced; no P&L legs. Guards: 1,3.
25. **Bank movement balanced.** Mirror of 24 for bank/transfer. Guards: 1,3.
