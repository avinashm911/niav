# NiavERP — Audit and Identity Model (Conceptual)

> Phase 1. Identity stability + audit completeness. No DB types, no libraries.

## 1. Identity classes (all stable within company scope unless noted)

- **Entity identity:** Company, Party, Item, Location, Series — stable per company; never reused; merges/retires preserve history via links.
- **Transaction identity:** Source-transaction durable ID created at intent (offline-safe, UUID-v4-or-equivalent conceptual). Never reassigned across sync/conversion/reporting. Final voucher number is a separate human ref.
- **Source identity:** the business source (challan/invoice/payment instruction) paired 1↔1 with its Source Transaction; preserved verbatim + linked through conversions/corrections.
- **Consequence identity:** stable IDs per accounting entry / stock event / tax output, each carrying Source + Posting refs. Immutable.
- **Audit identity:** stable, ordered audit-event IDs per company. Append-only; never edited/deleted.
- **Actor identity:** User + Membership + role-at-time. Every consequential transition records all three.
- **Device/session identity:** stable device/session refs per action (offline actions buffer locally, re-anchored with server time on sync). Lost-device revocation deferred to Phase 16.
- **Offline-created identity:** the same durable Source ID generated offline; doubles as idempotency key. Retries/devices resubmitting it converge to one posting.
- **Synchronisation identity:** outbox key (= Source ID), pull cursor (per device/company), conflict record per (source, attempt) with server decision + audit link. Transport-only.

## 2. Stability across sync

Must remain bit-stable: Source ID, consequence IDs (once posted), audit IDs, merge links, conversion refs, application links.
May be anchored at sync: final voucher number, server timestamp, posting ref, cursor positions.
Never silently remapped: local ID → server ID replacement is forbidden; server anchors append alongside the local ID.

## 3. Audit completeness (conceptual minimum per event)

Actor (user/membership/role-at-time) + device/session + company + entity + IDs + client timestamp + server timestamp + transition (post/convert/reverse/cancel/correct/grant/period/conflict/import) + before/after or bidirectional links + reason (where policy requires) + lineage chain (source → posting → consequences). Pre-post rejections record reason; UX-only pre-checks do not.

## 4. Offline audit

Actions offline append to local audit buffer with durable IDs + device time. On sync, server re-anchors with server time + posting outcome; buffer entries are preserved, never rewritten. Tamper-evidence mechanics deferred to Phase 11/12; append-only discipline required from Phase 1.
