# NiavERP — Inventory Test Matrix (No Code)

> Phase 3. Each case: Setup / Action / Expected / Invariants (→ `46`) / Deterministic? All deterministic (same posted set → same balances/links) except ordering-dependent balance values under concurrency, which remain history-deterministic (same event order → same result).

## FOUNDATION

1. Stock item posts. Setup: stock-tracked item I, location L. Action: receipt IN 10. Expected: 1 movement, on-hand 10. Guards: 2,3,4,5,6. Det: yes.
2. Non-stock item rejected. Setup: service item S. Action: receipt for S. Expected: rejection + reason, no movement. Guards: 4,18. Det: yes.
3. Retired item/location rejected. Setup: retired I or L. Action: any movement. Expected: rejection. Guards: 4,5,17,18. Det: yes.
4. Zero/negative/signed-ambiguous rejected. Setup: valid I/L. Action: qty 0 / negative / missing direction. Expected: rejection. Guards: 6. Det: yes.
5. Movement carries full lineage. Setup: valid intent. Action: post. Expected: movement links source+posting+item+location+actor/device/timestamps/audit. Guards: 2. Det: yes.

## BALANCES

6. Receipt increases. Receipt IN 10 → on-hand +10. Guards: 7.
7. Issue decreases. On-hand 10, issue OUT 4 → on-hand 6 (subject to `48` negative-stock rule). Guards: 7.
8. Adjustment increase/decrease. Reasoned IN/OUT → balance moves accordingly with `is_adjustment` + audit. Guards: 7,13.
9. Balance derivation exact. Setup: mixed postings. Action: recompute fold. Expected: equals served balance exactly. Guards: 7.
10. Multi-location independence. Same item at L1/L2 → per-location folds independent; company total = sum. Guards: 3,5,7.

## TRANSFERS

11. Transfer posts paired legs. L1→L2 Q. Expected: OUT@L1 + IN@L2, shared transfer ID, atomic. Guards: 5,6,9,14.
12. Conservation holds. After 11: company-net for item unchanged; L1 −Q, L2 +Q. Guards: 7,9.
13. Duplicate transfer retry converges. Resubmit same transfer ID → original pair returned, no second pair. Guards: 8.
14. Transfer reversal is paired. Reverse 11 → compensating IN@L1 + OUT@L2 with per-leg `reversal_of`, shared reversal action. Guards: 10.
15. Transfer correction is paired replace. Wrong destination → paired reversal + paired correct transfer under correction ID; originals retained. Guards: 11.
16. Same-location transfer rejected. From=To → rejection. Guards: 17.

## OPENING STOCK

17. Opening posts flagged. Go-live batch → `IN … is_opening` per (item, location). Guards: 2,12.
18. Opening separable. Operational balance views exclude (or label) openings on demand; registers never mix. Guards: 12.
19. Opening correction is new opening. Error → new linked opening; original retained. Guards: 11,12.

## IMMUTABILITY

20. History edit rejected. Attempt direct edit/delete of posted movement (bypass) → rejected/not possible via allowed paths. Guards: 1.
21. Reversal neutralises. Reverse receipt IN → OUT equal with link; net zero for chain. Guards: 10.
22. Double reversal rejected. Guards: 10.
23. Cancelled pre-post posts nothing. Cancel draft → post attempt rejected; no movement. Guards: 1,2.

## OFFLINE

24. Offline receipt posts once on sync. Durable ID + client stamp → one movement set in then-open context. Guards: 2,8,19.
25. Duplicate replay converges. Ack loss → replay same ID → originals. Guards: 8,19.
26. Delayed sync respects then-current eligibility. Item retired / location retired / period closed at arrival → explicit rejection + correction path. Guards: 18,19.
27. Same source from two devices converges. Identical ID from two devices → one movement set + dedupe audit. Guards: 8,19,20.

## CONCURRENCY

28. Simultaneous issues append, no lost update. Two distinct OUT intents race → both evaluated in commit order under `48` rule; history shows both attempts (one may reject). Guards: 19,20.
29. Simultaneous adjustments append. Two adjustments → both post (or second scoped by policy) with reasons; no overwrite. Guards: 13,20.
30. Simultaneous transfers conserve independently. Overlapping transfers → each pair atomic; conservation per transfer; availability rule per commit order. Guards: 9,20.
31. Availability race explicit. Stale offline estimate vs server truth → authoritative reject + refresh path, never silent negative beyond policy. Guards: 19,20.

## BOUNDARIES

32. Accounting cannot mutate stock. Attempt ledger/report-driven quantity write → rejected; no path exists. Guards: 16.
33. Inventory cannot mutate accounting. Attempt movement carrying accounts/debits/values → rejected. Guards: 15.
34. No GST/valuation ownership. Attempt tax/COGS leg via inventory path → rejected/deferred; lineage preserved for Phase 4+. Guards: 15 (+ boundary `44`).
35. No UI business logic. Attempt client-computed quantity/availability as truth → server re-validates; client values treated as hints. Guards: 14,19.
