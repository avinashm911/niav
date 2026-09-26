# NiavERP — Sales Offline and Sync Model (Conceptual)

> Phase 7. Integrates Phase 0/5 offline + Phase 3/4 freshness rules. No new sync architecture; no false statutory certainty.

- **Create offline:** durable source ID + line IDs + client stamp + device queued (`pending_sync`); provisional displays labelled (estimated totals/availability/numbers, never final). Converted-origin intents queue full Kacha ref sets + snapshot-vs-target statement.
- **Sync arrival:** server re-validates everything then-current (masters, grants, series, period, remaining/returnable, GST config version, party/registration contexts). Success → commit with server anchors alongside local ID + outcome audit. Failure classes per `70` (stale master/config, closed period, consumed remaining, auth change, ambiguous tax) reject with actionable correction paths, never silent posting or auto-adjustment.
- **Replay/duplicates:** same-ID replays (retry, ack-loss, double-tap, second device) converge + dedupe audit; distinct intents stay distinct (no content-dedupe).
- **Freshness:** inventory availability re-checked at commit (stale estimates discarded); GST follows `59` (fresh→provisional-ok, stale→supersede-with-outcome, missing→block, never invent). Payments captured offline queue as payment intents with application refs resolved at commit (unresolvable → reject with path, never dangling links).
- **Conflict visibility:** queue depth, per-intent outcome (posted/rejected/conflicted), winner refs, and correction paths surfaced in owner-understandable terms; rejected intents remain correctable-and-resubmittable as new sources (originals retained).
