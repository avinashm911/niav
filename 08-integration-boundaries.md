# NiavERP — Integration Boundaries

> Phase 0. Adapter pattern only. No XML/API specs invented, no implementation.

## 1. Rule

Core ERP (Transaction Engine, Accounting, Inventory, Tax) must not depend on Tally/BUSY internals. All external formats live in adapters that translate external ↔ canonical submissions. Core exposes stable ports; adapters call them.

```
[Tally] ↔ Tally Adapter ↔ Core Ports (masters, transaction submit, reports-read)
[BUSY]  ↔ BUSY Adapter  ↔ Core Ports
[CSV/XLS] ↔ Migration Adapter ↔ Core Ports
```

## 2. Tally Adapter (Boundary)

- Responsibilities: export (masters, vouchers, ledgers as canonical reads → Tally-compatible output) and bounded import (masters, opening balances, historical vouchers as canonical submissions with validation reports).
- Must NOT: write ledger/stock/tax directly; assign final voucher numbers; bypass validation; embed tax logic.
- Mechanism (file/API/version) explicitly deferred; no undocumented XML/API invented in Phase 0.
- Mappings versioned (Tally version × adapter version × core version) and tested in isolation with fixtures.

## 3. BUSY Adapter (Boundary)

- Same boundary as Tally. Mechanism, field maps, and version support deferred to Phase 18.
- Core sees BUSY only as canonical submissions/reads through the adapter port.

## 4. Migration / Import

- Responsibilities: CSV/Excel onboarding for parties, items, opening stock/balances; row-level validation; dry-run report (valid/invalid with reasons); atomic accept only after review.
- Opening balances enter via engine-mediated opening transactions with audit, never direct table inserts.
- Failed rows never partially post; re-import is idempotent.

## 5. Export

- Responsibilities: CA handoff and backup (canonical CSV/structured exports of masters, transactions, ledgers, tax summaries + audit extracts).
- Exports are reads; they never mutate books. Formats versioned; content traceable to source IDs.

## 6. Testing Boundary

- Adapters tested with golden fixtures and round-trip checks (export → parse → canonical compare) without requiring core rewrites.
- Core transaction/inventory/tax tests never depend on adapter formats.

## 7. Forbidden

- `import tally.*` (or equivalent) inside core domains.
- Hardcoded Tally/BUSY field names, XML tags, or slab mappings in UI or engine.
- Silent data coercion (dropped rows, auto-fixed GSTINs) without validation-report surfacing.
