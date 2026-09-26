# NiavERP — GST Invariants (Locked)

> Phase 4. Must-hold statements. Each maps to `61` matrix cases.

1. Sourced: every posted GST consequence (determination + lines) links exactly one Source (+ transaction/voucher/posting).
2. Company-scoped: every determination/line belongs to exactly one Company.
3. Explicit inputs: every determination is traceable to recorded classification + jurisdiction + registration + HSN/SAC/category + value inputs (no hidden state).
4. Immutability: posted determinations/lines never edited/deleted; change only via new linked determinations.
5. No orphan lines: tax lines never exist without their determination; lines never outlive determination lineage.
6. No UI truth: no posted tax derives from manually typed amounts, locale, or client-side state; hints recomputed authoritatively.
7. Determinism: identical inputs + version + policy → identical lines.
8. Versioned configuration: statutory configuration carries id + version + effective dates; overlapping-effective versions rejected at governance.
9. History pins version: every determination records its configuration reference; later versions never rewrite it.
10. Structural exclusivity: one determination carries exactly one valid component structure (intra-pair incl. UT variant XOR inter-single, + optional cess-role); mixed/duplicate/missing-main structures rejected.
11. Registration ≠ company: GSTIN never serves as company identity; multi-registration supported with at-date resolution.
12. Place-of-supply independence: never auto-equated to billing/shipping address; determined output with recorded inputs.
13. Reference/rate separation: HSN/SAC/category never equal, imply, or compute a rate.
14. Idempotent replay: same source ID → same determination/lines, never duplicates (offline/sync/race).
15. Correction history: corrections are reversal + replacement with bidirectional links; originals retained.
16. Reversal lineage: reversals carry per-line `reversal_of` + determination `reverses` links; double reversal rejected.
17. No accounting writes: GST paths never create/edit ledger rows, accounts, or balances.
18. No inventory writes: GST paths never create/edit stock movements or balances.
19. No payment writes: GST paths never create/edit payments, applications, or outstanding derivations.
20. Ambiguity default-deny: unresolved classification/coverage/version never silently resolves to any liability outcome (including zero/exempt); it rejects or routes to explicit review with reason + audit.
