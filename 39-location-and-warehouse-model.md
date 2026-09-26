# NiavERP — Location and Warehouse Model (Conceptual)

> Phase 3. Location = canonical dimension; Warehouse = subtype. No Branch ledger. Inventory consumes, never owns, location master data.

## 1. Definitions (locked from `20`, refined)

- **Location:** named place where stock can sit and transactions occur (shop floor, counter, godown). Every movement references its location context. Company-scoped; stable ID; active/retired lifecycle (retired = history retained, no new movements).
- **Warehouse:** a Location flagged for storage semantics. Same identity machinery, same movement rules; the flag is descriptive for UX/reports, never a separate stock system.
- **Branch:** not modelled. Owner language “Shop 2 / Dukaan 2” maps to a Location (+ deferred grouping label → Phase 10/16). No branch-level ledger, no branch-owned quantity.

## 2. What Inventory requires

- Location ID valid + active in the movement’s Company at post-time; otherwise reject with reason.
- Transfer intents reference two distinct active Locations (from ≠ to); same-location “transfers” rejected.
- Retired locations: postings referencing them rejected; existing movements still count in history/folds.

## 3. Ownership recap (from `14`, binding here)

- Warehouse / Location owns location definitions + transfer intent data. Inventory owns posted movement rows + derived balances. Engine validates + executes. No domain edits another’s truth: Inventory never creates/retires locations; Warehouse never adjusts quantities; Accounting never writes movements.
