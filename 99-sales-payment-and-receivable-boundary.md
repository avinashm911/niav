# NiavERP — Sales Payment and Receivable Boundary (Conceptual)

> Phase 7. Preserves Phase 2: advances never auto-apply; balances derived; no gateway.

## Chain (lineage/read model, not entities)

`sale (invoice posting) → receivable (derived outstanding = invoiced − applied per party/invoice) → payment (immutable fact + mode/reference hook for cash/bank/UPI as metadata) → application (payment↔invoice links, full/partial, shared action IDs) → outstanding (re-derived)`.

## Rules (locked)

- Immediate payment (cash/bank/UPI-ref) posts as Payment sibling (+ links) in the same business action; credit posts with zero links. Partial = some applied; multiple payments = N payments + N link sets; advance = payment with zero applications (never auto-applied; later application appends links + audit, original legs untouched).
- Immutable: invoice commercial facts, payment facts, application links as posted. Derived: outstanding, ageing buckets (buckets → Phase 9), paid/partial flags. Reversing a payment voids its links + neutralises legs (receivable re-derives up); reversing an invoice requires application resolution per Phase 9 surface (no orphaned settled-claims). No gateway integration, no settlement engine, no balance writes by Sales/Payments into each other’s truth.
