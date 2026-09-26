# NiavERP — Consequence Boundaries

> Phase 1. Who orchestrates vs who owns. Rule: Engine orchestrates transitions; consequence domains own their facts; no cross-mutation. No posting math.

## 1. Canonical flow (all types)

```
validate → post → atomic (accounting + inventory + tax) → payment links → audit → derived reads → sync
```

Payment timing varies (invoice may precede payment), but posted consequences are atomic and traceable regardless of when payment links append later.

## 2. Boundaries

### Transaction Engine
- Owns: source identity, validation outcome, posting atomicity, lifecycle transitions, idempotency, fan-out orchestration.
- Receives: master facts (read), grant/period/series/remaining state (read), tax outputs (returned).
- Sends: validated posting intent to Ledger/Inventory/Tax ports; linkage intents to Payments; event emissions to Audit; ack/conflict outcomes to Sync.
- Must not: own chart, stock truth, tax rules, master data, adapter formats.

### Accounting (policy) / Ledger (rows)
- Owns: chart + policies + period controls (Accounting); posted debit/credit rows (Ledger).
- Receives: posting intent (accounts implied by policy + source facts; exact mapping Phase 2).
- Sends: posted-entry refs + balance derivations to Reconciliation/Reports/Receivables-Payables views.
- Must not: create entries without Engine posting; edit rows; compute tax; write stock.

### Inventory
- Owns: stock events + derived positions/availability.
- Receives: posting intent (item/location/qty).
- Sends: position/availability reads to Sales/Challan UX (pre-checks), stock derivations to Reports/Reconciliation.
- Must not: define items, set prices, compute tax, edit events.

### Tax (GST Engine)
- Owns: tax outputs + rule-version refs.
- Receives: item hooks + party/place/value facts from Engine.
- Sends: outputs + version back to Engine for posting linkage.
- Must not: own sources, post to ledger directly, accept UI-computed values.

### Payments vs Receivables/Payables
- **Payments** owns payment facts + application links. **Receivables/Payables** own derived balances/ageing.
- Flow: Engine posts Payment → Payments stores fact+links (reading balances for validation) → Receivables/Payables re-derive. Readers never write across: Receivables never creates payments; Payments never edits balances directly.

### Reporting / Reconciliation / Compliance
- Own nothing financial. Reconciliation links/flags; Reports derives; Compliance summarises readiness + surfaces needs-CA-review. All read consequences + audit; none command postings.

## 3. Information flows (conceptual, not APIs)

- Masters + grants + series + period + remaining → Engine (validation reads).
- Engine posting intent → Accounting/Ledger, Inventory, Tax (fan-out); Tax → Engine (outputs); Engine → bền vững storage as linked consequences.
- Engine payment intent → Payments (fact + links); Payments ↔ Receivables/Payables (read/derive loop, no cross-write).
- All transitions → Audit (append). Posted truth → Reports/Reconciliation/Compliance (derive). Lifecycle state → Sync (transport).

## 4. Forbidden crossings

Ledger ↔ Inventory ↔ Tax direct writes; Reports/Reconciliation/Sync/Localisation/Adapters writing consequences; UI/adapters assigning final numbers or computing tax; Warehouse adjusting quantities; Party/Item holding balances/quantities.
