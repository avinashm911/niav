# NiavERP — Transaction Offline Replay Model (Conceptual)

> Phase 5. No alternate truth offline; server acceptance authoritative. No SQLite/sync implementation.

## Flow (normative)

`offline create (durable ID + client stamp + device) → pending_sync queue → upload/replay → server validation on then-current state → commit (with server anchors alongside local ID) | deterministic rejection → canonical result + outcome audit`

## Cases

- Same/duplicate replay (retry, ack loss, timeout retry, second device same queued intent): converge to originals + dedupe audit; never second posting/number.
- Stale period (closed/locked at arrival): reject with correction path (re-date into open or seek adjustment authority); never auto-post into wrong period.
- Stale GST config: re-determine under then-effective version; provisional discarded with outcome (not a correction).
- Stock/master/grant changed while offline: re-validate; availability/master/authorization failures reject with actionable reasons + refresh.
- Response lost: replay recovers (ack recovery). Retries after timeout reuse the same ID unconditionally — new IDs for retries are forbidden.
- Offline estimates (availability, totals, numbers) are hints only; server validation at commit is the sole truth-maker.
