# NiavERP — Transaction Engine Domain Model (Conceptual)

> Phase 5. Orchestrator, not consequence owner. No SQL, code, UI, integrations.
> Authority: Phase 1 ownership/lineage/lifecycle (`14`,`16`,`17`,`21`) + Phase 2/3/4 posting discipline.

## Core concepts (never collapsed)

- **Source:** the durable business intent with source durable ID (client-generated at creation, stable across offline/sync/conversion/reporting). Data owned by originating operational domain; identity + lifecycle owned by Engine. Immutable after post.
- **Transaction:** the Engine-managed lifecycle wrapper around a Source (validation → posting decision → fan-out coordination → audit). 1 Source ↔ 1 Transaction in the base model; reversal/correction create new Sources/Transactions linked to predecessors.
- **Voucher:** the numbered document identity for a Transaction (series intent + final number assigned at server post). Identity owned by Voucher concept, numbering executed under Engine coordination with server authority (`64`).
- **Posting:** the atomic commit event. Engine-owned orchestration; consequence rows owned by Accounting/Inventory/GST/Payments. 1 Posting ↔ 1 Source (base model); batches group postings without sharing balance/state.
- **Consequence:** a domain-owned effect of a Posting (accounting entry, stock movements, tax determination+lines, payment + application links). Created only through Engine fan-out; never directly by UI/adapters.
- **Audit event:** append-only record of every transition/decision (post/reject/reverse/cancel/correct/conflict/replay-dedupe). Owned by Audit; emitted via Engine coordination with domain refs.
- **Correction / Reversal:** new Sources/Transactions with bidirectional links (`reverses/reversed_by`, `corrects/corrected_by`, `reversal_of` at row level). Mechanics per domain (`31`,`41`,`56`); orchestration here (`69`).
- **Derived read:** any balance/register/position/ageing/summary computed over posted consequences. Owned by deriving domains (Receivables/Payables, Inventory views, Reports); never written by Engine.

## Engine ownership (locked)

Owns: source↔voucher↔posting identity binding, validation sequencing, atomic commit boundary, idempotency keys, concurrency coordination order, fan-out coordination, cross-domain linkage assembly, transaction-level audit assembly, reversal/correction orchestration, deterministic error taxonomy (`70`).
Never owns: accounts/legs/balances, quantities/movements/locations, classification/rates/components, payment facts/application semantics, party/item masters, series configuration content, report derivations, adapter formats.

## Failure semantics (summary; full taxonomy `70`)

Validation failure → no posting, no consequences, reason + audit where consequential. Commit-time failure → all-or-none rollback of the business posting (no partial consequence survives). Replay → convergence to original refs. Conflict → deterministic reject + audit + retry path. Lifecycle violation → reject. Engine never fabricates domain math to “complete” a posting.
