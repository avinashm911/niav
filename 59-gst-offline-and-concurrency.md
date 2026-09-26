# NiavERP — GST Offline and Concurrency (Conceptual)

> Phase 4. Classify offline only against cached configuration; server authoritative; never silently rewrite posted tax.

## 1. Availability-gated classification

- **Configuration available + fresh enough (freshness policy deferred):** device may compute a *provisional* determination for UX (totals preview, pending_sync labelling). It is not truth until server posts.
- **Missing configuration:** determination blocked offline with owner-understandable reason; source may queue unclassified (no provisional tax shown as final) or wait — never invented locally.
- **Stale configuration:** device provisional (if shown) labelled stale; server re-determines at post-time under then-effective version. If versions differ, server result wins; client provisional discarded with explicit sync outcome + audit (not a “correction” of posted history since nothing posted pre-sync).

## 2. Sync / replay / races

- Same source ID replayed (retry, ack loss, two devices one queued intent): one determination + one line set (idempotent convergence; replays return originals).
- Two devices classifying the same unposted source differently (different cached configs/inputs): first valid server post wins; loser rejected with reason + refreshed inputs, never merged line-wise.
- Statutory configuration changing between offline creation and sync arrival: then-effective version governs the posting; the attempt’s cached version recorded in the attempt log for explainability, but posted lines pin the server version.
- Posted determinations never re-resolved on later syncs or config updates; changes propagate only via new reversal/correction determinations.
