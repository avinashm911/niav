# NiavERP — Transaction Audit and Lineage (Engine Additions)

> Phase 5. References Phase 1 audit (`22`); adds transaction-orchestration records. No duplication of domain audit semantics.

## Engine-assembled record (per posting attempt + per transition)

Source ID + transaction/voucher IDs (+ batch/action IDs where grouped) + company + actor/role-at-time/device + client/server timestamps + business date + lifecycle transition (validate/post/reject/cancel/reverse/correct/replay-dedupe/conflict) + series + final number (on post) + sibling consequence refs (entry ID, movement IDs, determination ID, payment/application IDs) + reversal/correction links + reason (where required) + error category (on rejection per `70`) + sync/replay identity (attempt IDs, winner refs on dedupe).

## Guarantees

- Every committed posting has exactly one post-audit binding all siblings; every consequential rejection/conflict/dedupe has an audit entry; pre-post UX pre-checks do not.
- Full explainability: source → validation outcomes → posting → every sibling → derived reads → sync/conflict outcomes, traversable both directions. History immutable; corrections add chains.
