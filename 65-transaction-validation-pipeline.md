# NiavERP — Transaction Validation Pipeline (Conceptual Sequence)

> Phase 5. Engine sequences; domains validate. No rule duplication in the orchestrator.

## Deterministic sequence (each stage explicit, ordered, auditable)

1. Identity validation (durable ID well-formed + novel-or-replay classification).
2. Company/tenant scoping (single-company binding; cross-scope rejected).
3. Actor/authorization validation (membership + grant-at-time; cached offline grants marked provisional).
4. Source integrity (type known at abstraction level, lines present, refs well-formed, no post-mutation of posted sources).
5. Document/date validation (business date present; client/server stamp handling per `27§3`; future-date V1 rejection).
6. Period validation (business-date → accounting period eligibility; statutory-period tagging for GST sibling).
7. Domain-master validation (party/item/location/series/registration refs exist + active; stockability/eligibility flags read, not owned).
8. Consequence preconditions (participation declarator per `67`: which siblings this type requires; e.g., transfer declares inventory-pair, no P&L).
9. Accounting validation (delegated: chart/policy/period/balance-shape readiness — Engine checks readiness signals, never leg math).
10. Inventory validation (delegated: eligibility, location context, availability policy incl. DENY-negatives, transfer conservation shape).
11. GST validation (delegated: classification inputs complete, configuration coverage effective, structural exclusivity).
12. Payment/application validation where declared (payment fact shape + application refs resolvable; advances allowed as zero-application).
13. Idempotency check (source ID seen? → return original refs as idempotent success, never re-validate into a second posting).
14. Final atomic-post readiness (all required validators green on current server state → commit; else deterministic rejection per `70`).

## Outcome classes (business, not exceptions)

- **Hard rejection** (permanent; business correction required): bad identity, bad refs, unbalanced intent, lifecycle violation, ineligible master, ambiguous tax.
- **Retryable failure** (transient; same intent may succeed later): infrastructure/timeout-class,Repairable without changing business facts (transport view only; Engine never invents business retry semantics).
- **Conflict** (lost race; winner posted): same-ID race, number/availability/period-close race — loser gets winner refs or explicit refresh path + audit.
- **Stale configuration** (re-resolve required): GST config / master / grant / period changed since offline creation → reject with refresh path.
- **Authorization failure / Period failure / Duplicate-idempotent-success / Dependency failure** (one sibling validator down): each maps to `70` categories; Engine surfaces deterministically, never stack traces.
- Pre-validation (UX/offline hints) vs commit-time validation (server authoritative at commit): anything that can change between them (period state, grants, availability, config version, master flags) is re-checked at commit; pre-checks never bind the outcome.
