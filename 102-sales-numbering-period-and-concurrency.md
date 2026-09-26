# NiavERP — Sales Numbering, Period and Concurrency (Conceptual)

> Phase 7. Phase 5 guarantees restated for sales; no client-clock authority.

- **Series/numbering:** per-company invoice series; server assigns final numbers at commit; unique per series, never recycled, replay-stable per source ID. Converted invoices number from invoice series (never reuse Kacha numbers); Kacha numbers stay retired-with-history.
- **Period:** business-date → accounting period eligibility (open-only ordinary) + GST statutory tagging; backdated-into-open allowed with skew note; closed/locked fail per `70` (adjustment path authority-gated, mechanics deferred); future-dated rejected V1.
- **Idempotent replay:** same source ID (retry, ack-loss, double-tap, cross-device same intent) converges to originals + dedupe audit; new IDs for retries forbidden.
- **Concurrency (server-ordered, deterministic loser paths):** simultaneous distinct invoices → distinct numbers, both evaluated (availability/period/config at commit order); same-source race → one winner + `CONFLICT` convergence; numbering race → authority-serialised, no client pre-allocation; stock race → DENY-negative commit-order fail with refresh; return-vs-return and conversion-vs-invoice races serialise on remaining/returnable; correction/reversal races first-valid-wins with duplicates rejected. Client clocks never order, never validate, never number.
