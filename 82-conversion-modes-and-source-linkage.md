# NiavERP — Conversion Modes and Source Linkage (Conceptual)

> Phase 6. Exactly the Phase 1 shapes; no fifth shape. Atomic under Engine (`66`).

## Modes (locked)

1. **1 Kacha → 1 Pakka (full):** all remaining lines consumed; challan → fully_converted; invoice carries full (source, line) ref set under one conversion action ID.
2. **1 Kacha → many Pakka (partial, sequential):** each action consumes part of line remaining (e.g., 100 → 40 + 60); challan partial until remainder hits zero; each action independently atomic + audited with shared source lineage.
3. **Many compatible Kacha → 1 Pakka:** one action, N sources (each fully or partially consumed per §83), one invoice with the union ref set; compatibility per §81 evaluated for the whole set; any member failure fails the action.
4. No other shape. Bulk “many→many in one click” is an operational grouping of N independent actions under one grouping ID (each with own atomicity/refs/audit), not a distinct semantic shape.

## Per-action record (durable)

Conversion action ID (idempotency key) + source ref set (source + line + accepted qty each) + target Pakka source/voucher IDs + rate-snapshot vs target-rate statement per line (equal unless §84 gates pass) + actor/device/stamps/business date + reason where required + downstream consequence refs (entry/movement/determination IDs) + audit. Replay of the same action ID converges to originals; nunca duplicate Pakka.
