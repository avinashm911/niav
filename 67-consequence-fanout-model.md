# NiavERP — Consequence Fan-Out Model (Conceptual)

> Phase 5. Explicit participation; no workflow construction. Canonical order: validation → posting decision → Accounting → Inventory → GST → Payment/application → Audit → derived reads.

## Participation (declared per intent, not assumed)

Each transaction intent declares which siblings participate. Legitimate shapes include (non-exhaustive, workflow-agnostic): accounting-only (e.g., opening-balance-class, expense-class), inventory-only (e.g., governed quantity adjustment with no money/tax), GST-linked (only alongside its host invoice-class intent — never standalone tax), accounting+inventory, accounting+GST, accounting+inventory+GST, payment+accounting (+ applications), transfer inventory-pair without P&L, adjustment with no GST. The Engine enforces the declared set: missing required sibling = failure; unexpected sibling = failure; undeclared extras rejected.

## Ordering and linkage

Fan-out executes under the `66` atomic boundary in canonical order for lineage assembly (Accounting → Inventory → GST → Payment/application), but ordering implies no ownership (each domain writes only its truth). All siblings carry source + posting + voucher refs; payment applications additionally link invoice refs; audit assembles the full cross-domain link set so source→every consequence→reads is traversable. No sales/purchase/challan workflows are defined here — later phases declare their participation sets against this model without altering it.
