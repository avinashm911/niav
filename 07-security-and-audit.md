# NiavERP — Security and Audit (Conceptual)

> Phase 0. Principles and boundaries. No implementation.

## 1. Authentication

- Supabase Auth as identity provider (conceptual; exact flows deferred).
- Every request bound to authenticated user + active company context.
- Devices/sessions identifiable; offline actions record device + local timestamp, re-anchored with server time on sync.

## 2. Authorisation / RBAC

- Baseline roles (conceptual): Owner (full), Accountant (books/tax/reports, no user admin beyond grant), Biller (sales/challan/payment create, no reversals/corrections alone), Viewer (read-only). Exact matrix deferred to Phase 1/16.
- Least privilege by default; role grants are explicit and auditable.
- Multi-company membership: switching company switches entire permission + data scope.

## 3. Tenant / Company Isolation

- Every business row carries company scope; PostgreSQL RLS (or equivalent server enforcement) guarantees isolation.
- No cross-company reads/writes via app, adapter, import, or report path.
- Export/migration batches are company-scoped.

## 4. Server-Side Enforcement

- Financial writes, stock effects, tax consequences, numbering, period locks, Kacha/Pakka conversions, reversals, and permission checks execute and validate server-side (RLS + RPC/Edge Functions as appropriate).
- Client checks are UX hints only. A hostile or stale client cannot bypass rules by calling the API directly.

## 5. Audit Events

- Append-only log. Emitted for: create/post, conversion (incl. partial/bulk/many-to-one), reversal, cancellation, correction, payment application, master merge, permission/role change, period lock, sync conflict resolution, import batch accept/reject.
- Each event: actor, role, company, device/session, client + server timestamps, entity + IDs, before/after (or links), reason, lineage to source transaction.

## 6. Sensitive Operations (Non-exhaustive)

- Financial record modification (any correction/reversal).
- Reversal / cancellation.
- Kacha/Pakka conversion, especially partial/bulk/many-to-one and rate changes.
- Master merges, opening-balance entry, period close/reopen, permission grants.
- All require: permission + reason + audit + (where policy demands) second-actor approval hook (approval workflow itself deferred).

## 7. Offline Security

- Cached permission grants expire/refresh; no offline privilege escalation.
- Local store encrypted at rest per platform capability (exact mechanism deferred); no secrets that grant server rights stored in plain text.
- Offline-created audit buffer is tamper-evident in design (append-only locally, verified on sync).

## 8. Device / Session Considerations

- Device enrolment per company (conceptual); lost-device revocation; session invalidation on role removal.
- Concurrent sessions supported; conflict and audit trails distinguish actors/devices.

## 9. Licensing Boundaries (Future)

- Licensing/entitlement checks (if any) gate features, never corrupt or fork financial truth. No licence state may create alternate books or bypass audit. Details explicitly deferred; noted here only to prevent future entanglement.

## 10. What Phase 0 Does Not Decide

Exact RLS policies, function signatures, key management, biometric/PIN UX, approval-chain mechanics. Those belong to Phase 1/11/12/16 with tests.
