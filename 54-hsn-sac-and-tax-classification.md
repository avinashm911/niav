# NiavERP — HSN / SAC and Tax Classification References (Conceptual)

> Phase 4. References, not rates. History-preserving updates. Zero-cost: free/public authoritative sources only; no paid APIs/databases.

## 1. Separation (normative)

`Item → HSN (goods) / SAC (services placeholder) + Tax Category hook → Tax Classification → Rate-ref (configuration) → Amount`. HSN/SAC/category never equal a rate and never compute amounts; they are lookup inputs into versioned configuration.

## 2. Lifecycle

- HSN/SAC/category assignments are master attributes with effective dating (prospective changes; history keeps assignment-at-time). Statutory nomenclature updates arrive as new configuration versions; historical determinations keep their version ref and are never re-resolved.
- Items without usable HSN/SAC/category coverage for a taxable-class claim fail classification as ambiguous (per `51§3`) — they never silently fall to nil/non-GST.
- Service/SAC scope: recognised as reference shape only; service workflows, SAC schedules, and service-specific place-of-supply rules deferred (no service postings modelled here).

## 3. Sourcing

- No external database downloaded or embedded in Phase 4. Future statutory data must come from free/public authoritative (government) sources via a versioned import boundary owned outside the core engine (adapter-class concern, mechanism deferred to later integration planning — not Tally/BUSY, a new statutory-data boundary noted in `62`). Commercial calculators are never authoritative truth.
