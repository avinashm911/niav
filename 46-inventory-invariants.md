# NiavERP — Inventory Invariants (Locked)

> Phase 3. Must-hold statements. Each maps to `47` matrix cases.

1. Posted movements immutable: never edited, deleted, or reordered.
2. Source lineage: every posted movement links exactly one Source (+ posting + line intent where multi-line).
3. Company scope: every movement belongs to exactly one Company.
4. Item identity: every movement references exactly one stock-tracked Item active-at-post in its Company; non-stock items rejected.
5. Location context: every movement carries an unambiguous location context (1 location; transfers carry from→to across the paired rows, each row naming its own location).
6. Representation: every movement carries direction IN/OUT + strictly positive quantity in the movement’s stock unit; zero/negative/signed-ambiguous rows never post.
7. Derived balances: on-hand per (company, item, location) is exactly the IN−OUT fold over posted movements; no stored-balance truth, no drift.
8. Idempotency: resubmitting the same source ID yields original movement refs, never a second movement set.
9. Transfer conservation: per transfer line, OUT qty = IN qty (same item/unit); company-net quantity unchanged by the transfer itself.
10. Reversal neutralisation: every reversal is an opposite-direction equal-quantity movement with `reversal_of` link; original retained; double reversal rejected.
11. Correction history: every correction is reversal + replacement under shared action ID with `corrects/corrected_by` links; originals retained.
12. Opening separability: openings flagged `is_opening`, batch-linked, opening-context-bound, excludable from operational views; correctable only via new linked openings.
13. Adjustment governance: every adjustment carries reason + actor/role-at-time + audit; anonymous/silent adjustments rejected.
14. Engine boundary: no movement posts except via Engine-orchestrated posting fan-out (adapters/imports submit sources; never write movements directly).
15. No money ownership: inventory rows carry no accounts/debits/credits/values; inventory never writes accounting truth.
16. No quantity ownership by Accounting: no journal/entry/report path writes, edits, or voids movements.
17. Location unambiguity: no movement with missing, retired-at-post, cross-company, or same-location-transfer context posts.
18. Eligibility: movements on retired items/locations or non-stock items rejected with reasons.
19. Replay safety: offline/sync replays produce at most one movement set per source; then-current eligibility governs with explicit rejection paths.
20. Append-only concurrency: concurrent transactions append rows under server authority; none silently overwrites posted history.
