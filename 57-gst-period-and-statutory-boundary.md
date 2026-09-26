# NiavERP — GST Period and Statutory Boundary (Conceptual)

> Phase 4. Five clocks kept distinct. No filing, no returns, no portal integration, no reconciliation.

## 1. Distinct identities (never collapsed)

- **Business date** (commercial date on the source; drives accounting period + reports + ageing).
- **Document date** (= business date for GST documents in V1 scope; separately named so future document-vs-supply timing splits don’t require remodelling).
- **Accounting period** (Phase 2 eligibility machine).
- **GST statutory period** (month/quarter bucket tagging determinations for future return compilation; tagging only — no return logic here).
- **Client timestamp** (device creation) vs **Server timestamp** (commit). All retained per `58`; period/tag resolution uses business date, never stamps.

## 2. Statutory-period mechanics (tagging only)

- Each determination tags exactly one statutory period derived from its business date under the effective configuration’s calendar. Late/post-period corrections tag their own period with links back; historical tags never move. Return compilation, set-off, carry-forward, late-fee/interest, and portal schemas are explicitly deferred (→ `62`); this doc creates no filing obligation model and no government touchpoint.
- Filing/e-invoice/e-way bill are future *adapter boundaries* (like Tally/BUSY class, new statutory-filing boundary noted in `62`), never core-engine behaviours. Nothing here submits, signs, or acknowledges with any authority.
