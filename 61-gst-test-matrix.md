# NiavERP — GST Test Matrix (No Code)

> Phase 4. Each case: Setup / Action / Expected / Invariants (→ `60`) / Deterministic? All deterministic except explicitly noted sync-ordering notes (history-deterministic).

## FOUNDATION (5)

1. Single registration resolves. Setup: company + 1 active registration; intra-state facts. Action: determine. Expected: determination pins registration-at-date + structure. Guards: 1,2,3,11. Det: yes.
2. Multiple registrations resolve by jurisdiction/date. Setup: 2 state registrations. Action: determine per supply. Expected: correct registration each; histories independent. Guards: 2,11. Det: yes.
3. Effective-date boundary. Setup: registration cancelled w.e.f. D. Action: determine pre/post D. Expected: pre posts under old, post rejects or resolves to new status with reason. Guards: 2,8,9. Det: yes.
4. GSTIN is attribute. Action: attempt company-identity-by-GSTIN or cross-company registration reuse. Expected: rejected. Guards: 11. Det: yes.
5. Unregistered counterparty classified, not crashed. Setup: recipient without registration. Action: determine. Expected: unregistered-class path with recorded inputs (no silent default). Guards: 3,20. Det: yes.

## CLASSIFICATION (9)

6. Taxable. Expected: applicable + structure + rate-ref + lines. Guards: 1,3,7. Det: yes.
7. Exempt (notified). Expected: classification exempt, no amount lines. Guards: 3,5. Det: yes.
8. Nil-rated. Expected: nil classification, no amount lines, reason distinct from exempt. Guards: 3,5. Det: yes.
9. Non-GST. Expected: out-of-scope classification, no lines. Guards: 3,5. Det: yes.
10. Zero-rated (export/SEZ-class). Expected: zero-amount lines with classification evidence (credit mechanics deferred, noted). Guards: 3,5. Det: yes.
11. Registered vs unregistered recipient divergence recorded. Guards: 3,12. Det: yes.
12. Place-of-supply from inputs, not address copy. Setup: billing ≠ ship/supply evidence. Expected: determined jurisdiction follows inputs with recorded reasoning, not address. Guards: 3,12. Det: yes.
13. Ambiguity denies. Setup: missing HSN hook / jurisdiction input / config coverage. Expected: rejection (or explicit-review route), never silent zero/tax. Guards: 3,20. Det: yes.
14. Manual amount ignored as truth. Setup: hint amount ≠ computed. Expected: authoritative recompute wins; hint preserved as hint only. Guards: 6. Det: yes.

## COMPONENTS (5)

15. Intra pair posts CGST+SGST exactly. Guards: 5,10. Det: yes.
16. Inter posts IGST alone. Guards: 5,10. Det: yes.
17. UT variant posts CGST+UTGST exactly (structure supported; rates from config). Guards: 10. Det: yes.
18. Cess-role appends without substituting. Guards: 10. Det: yes.
19. Contradictory structure rejected (intra-pair + IGST same determination; SGST+UTGST; duplicate role; cess-without-main). Guards: 10. Det: yes.

## CALCULATION (6)

20. Taxable-value trace ordered (value→discount→charges→round-ref→taxable). Guards: 3,7. Det: yes.
21. Rate-ref + version pinned per line. Guards: 8,9. Det: yes.
22. Deterministic repeat identical. Re-run same inputs+version → identical lines. Guards: 7. Det: yes.
23. Rounding explicit. Setup: fractional amounts. Expected: named-rule application in trace, exact-decimal, no float drift. Guards: 7. Det: yes.
24. Missing config rejects. Setup: no effective version covering date/class. Expected: rejection with reason. Guards: 8,20. Det: yes.
25. Stale offline provisional superseded. Setup: cached v1 vs server v2 at sync. Expected: server v2 posts; provisional discarded with outcome + audit. Guards: 9,14. Det: yes (given version pair).

## HSN/SAC (4)

26. HSN is lookup input, not rate. Guards: 13. Det: yes.
27. SAC placeholder recognised, service workflows absent. Guards: 13. Det: yes.
28. HSN change prospective. Setup: reclassify item. Expected: old determinations keep old refs; new use new. Guards: 9. Det: yes.
29. Missing coverage denies (no silent nil). Guards: 13,20. Det: yes.

## DOCUMENTS (6)

30. Lines attach to shared lineage (source→voucher→determination→lines→siblings→audit), no parallel tax identity. Guards: 1,5. Det: yes.
31. Credit-note form maps to decreasing reversal/correction chain with original links. Guards: 4,15. Det: yes.
32. Debit-note form maps to increasing chain. Guards: 4,15. Det: yes.
33. Reversal compensates per component with links; double reversal rejected. Guards: 4,16. Det: yes.
34. Correction replaces via linked pair under action ID; originals retained. Guards: 4,15. Det: yes.
35. Challan-ref lineage preserved through to invoice tax lines (refs carried; timing policy deferred to Phase 6/7). Guards: 1,3. Det: yes.

## OFFLINE (6)

36. Offline with fresh config: provisional allowed, server posts truth. Guards: 9,14. Det: yes.
37. Missing config blocks offline determination (queue unclassified, no invented tax). Guards: 20. Det: yes.
38. Delayed sync applies then-effective version (attempt version logged). Guards: 8,9. Det: yes.
39. Duplicate replay converges. Guards: 14. Det: yes.
40. Cross-device conflicting classification: first valid wins; loser rejected + refreshed. Guards: 14. Det: history-deterministic.
41. Posted lines never re-resolved on later syncs/config updates. Guards: 4,9. Det: yes.

## AUDIT (4)

42. Full trace reproducible (inputs→version→values→components→links→actor/device/stamps). Guards: 3,8. Det: yes.
43. Configuration reference pinned and re-runnable. Guards: 8,9. Det: yes.
44. Actor/device/role-at-time recorded on every posted determination + reversal/correction. Guards: 3. Det: yes.
45. Correction history traversable both directions. Guards: 15,16. Det: yes.

## BOUNDARIES (8)

46. GST writes no ledger rows. Attempt → rejected/no path. Guards: 17. Det: yes.
47. GST writes no stock movements. Guards: 18. Det: yes.
48. GST writes no payments/applications. Guards: 19. Det: yes.
49. No sales workflow created. Guards: scope. Det: yes.
50. No purchase workflow created. Guards: scope. Det: yes.
51. No filing/portal submission. Guards: scope. Det: yes.
52. No government API called. Guards: scope. Det: yes.
53. No Tally/BUSY logic. Guards: scope. Det: yes.
