# NiavERP — Transaction Test Matrix (No Code)

> Phase 5. Each case: Setup / Action / Expected / Invariants (→ `74`) / Deterministic? All deterministic except race-order notes (history-deterministic).

## FOUNDATION (5)

1. Source identity binds voucher+posting. Post valid source → 1 transaction + 1 voucher + declared siblings + audit. Guards: 1,12,21. Det: yes.
2. Numbering server-authoritative + unique. Two sources, same series → distinct replay-stable numbers. Guards: 3,23. Det: yes.
3. Lifecycle valid path. draft→pending_sync→posted; overlays via new chains only. Guards: 4,17. Det: yes.
4. Backward transition rejected. Attempt posted→draft → `INVALID_LIFECYCLE_TRANSITION`. Guards: 17. Det: yes.
5. Company scope enforced. Cross-company refs → `INVALID_COMPANY_CONTEXT`. Guards: 22. Det: yes.

## VALIDATION (9)

6. Valid transaction posts. Guards: 5. Det: yes.
7. Invalid source rejected (`INVALID_SOURCE`). Guards: 20. Det: yes.
8. Unauthorized rejected (`UNAUTHORIZED`). Guards: 20. Det: yes.
9. Closed period rejected (`PERIOD_CLOSED`); locked (`PERIOD_LOCKED`). Guards: 20. Det: yes.
10. Invalid master rejected (`INVALID_MASTER_REFERENCE`). Guards: 20,24. Det: yes.
11. GST unavailable/stale → `TAX_CLASSIFICATION_UNAVAILABLE` / `TAX_CONFIGURATION_STALE`. Guards: 9,20. Det: yes.
12. Stock unavailable → `STOCK_CONFLICT`. Guards: 8,20. Det: yes.
13. Accounting sibling veto → `ACCOUNTING_VALIDATION_FAILED`, nothing posts. Guards: 5,6,7. Det: yes.
14. Payment sibling veto → `PAYMENT_VALIDATION_FAILED`. Guards: 5,6,10. Det: yes.

## ATOMICITY (6)

15. All siblings succeed → single commit + linkage + audit. Guards: 5,12,21. Det: yes.
16. Accounting failure → whole post fails, zero survivors. Guards: 5,6. Det: yes.
17. Inventory failure → same. Guards: 5,6. Det: yes.
18. GST failure → same. Guards: 5,6. Det: yes.
19. Payment failure → same (where declared). Guards: 5,6. Det: yes.
20. Undeclared sibling present → rejected (participation enforcement). Guards: 5,24. Det: yes.

## IDEMPOTENCY (4)

21. Retry same source → originals (`DUPLICATE_SOURCE` convergence). Guards: 2,15. Det: yes.
22. Response lost after commit → replay recovers, no second post. Guards: 2,15. Det: yes.
23. Duplicate voucher/consequence request → originals, never new rows. Guards: 2,3. Det: yes.
24. Same source from two devices → one winner + dedupe audit. Guards: 2,15,16. Det: history-deterministic.

## CONCURRENCY (6)

25. Simultaneous different transactions → both post, distinct numbers. Guards: 3,16. Det: history-deterministic.
26. Same-transaction race → one winner, loser `CONFLICT` with winner refs. Guards: 2,16. Det: history-deterministic.
27. Numbering race → distinct numbers, no gaps-as-truth (gaps only from failures, never reused). Guards: 3. Det: history-deterministic.
28. Period-close race → late commits fail closed rules. Guards: 20. Det: history-deterministic.
29. Stock race → commit-order availability, loser `STOCK_CONFLICT`. Guards: 8,16. Det: history-deterministic.
30. GST-config race → then-effective version wins; stale provisional discarded. Guards: 9,16. Det: history-deterministic.

## REVERSAL (5)

31. Pre-post cancel → no consequences, ID retired. Guards: 18. Det: yes.
32. Posted reversal → additive neutralising siblings + links. Guards: 13,19. Det: yes.
33. Duplicate reversal rejected. Guards: 13. Det: yes.
34. Reversal-of-reversal rejected (`INVALID_LIFECYCLE_TRANSITION`). Guards: 13,17. Det: yes.
35. Reversal preserves originals (readable both sides). Guards: 4,13. Det: yes.

## CORRECTION (5)

36. Original retained + `corrected` overlay. Guards: 4,14. Det: yes.
37. Reversal + replacement under shared action ID. Guards: 14. Det: yes.
38. Failed replacement fails per declared action policy with original merely posted + reason. Guards: 6,14. Det: yes.
39. Duplicate correction request converges/rejects deterministically. Guards: 2,14. Det: yes.
40. Cross-period correction posts at own date (no history edit). Guards: 4,14. Det: yes.

## OFFLINE (7)

41. Offline create → delayed sync posts once with server anchors. Guards: 1,15. Det: yes.
42. Delayed sync into stale period → deterministic reject + path. Guards: 20. Det: yes.
43. Stale GST config at arrival → re-determine or reject; provisional discarded. Guards: 9. Det: yes.
44. Stock changed while offline → re-validate; fail or scope per policy. Guards: 8. Det: yes.
45. Auth changed while offline → `UNAUTHORIZED` at commit. Guards: 20. Det: yes.
46. Retry-after-timeout reuses same ID (new-ID retry forbidden). Guards: 15. Det: yes.
47. Offline estimates never bind outcome. Guards: 11,24. Det: yes.

## KACHA/PAKKA BOUNDARY (4)

48. N-source linkage transport available (refs + action ID, no rules). Guards: 12. Det: yes.
49. Partial-lineage refs transportable; remaining-state rules absent (Phase 6). Guards: 12. Det: yes.
50. Conversion-shaped posting without Phase 6 policy fails closed. Guards: 20,24. Det: yes.
51. Engine owns no rate/completion/timing rules. Guards: 9,11. Det: yes.

## BOUNDARIES (6)

52. Accounting ownership preserved (no Engine leg math). Guards: 7. Det: yes.
53. Inventory ownership preserved. Guards: 8. Det: yes.
54. GST ownership preserved. Guards: 9. Det: yes.
55. Payments ownership + no auto-apply advances. Guards: 10. Det: yes.
56. No UI truth (server re-validates all). Guards: 25. Det: yes.
57. No Tally/BUSY/GST-rate/valuation logic in Engine. Guards: 7,8,9. Det: yes.
