# NiavERP — Posting Orchestration and Atomicity (Conceptual)

> Phase 5. One canonical commit boundary across domains without shared ownership.

## The boundary (normative)

A successful Posting commits, atomically: required Accounting consequence + required Inventory consequence + required GST consequence + required Payment/application consequence (each only where the type’s participation declarator requires it) + transaction audit/lineage — or the posting fails with **no** surviving partial business consequence.

- “Required” is explicit per transaction intent (see `67` participation); absent siblings are not failures (e.g., transfer posts inventory-pair with no P&L by declaration, not by omission).
- Engine coordinates the boundary; each domain validates + produces its own rows under its own invariants (`34`,`46`,`60`); Engine assembles linkage + assigns voucher number + emits transaction audit only after all required siblings succeed.
- Pre-validation vs commit-time: validators run on current server state at commit; changed conditions (period closed mid-flight, availability consumed, config superseded, grant revoked) fail the commit deterministically per `70` with no partial writes.
- Failure modes: validation failure (nothing written), sibling failure (nothing survives; provisional artefacts discarded, rejection + audit where consequential), transport ambiguity (idempotent replay converges per `68`), reversal/correction (new atomic postings under same discipline, originals untouched).
