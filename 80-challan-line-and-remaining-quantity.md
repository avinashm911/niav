# NiavERP — Challan Line and Remaining Quantity (Conceptual)

> Phase 6. Line identity stable; remaining derived; over-conversion structurally impossible.

## Model

- Each Kacha line has stable line identity within its source (item + delivered quantity + unit + rate snapshot). Conversions reference (source, line) with accepted quantities.
- Per line: `converted = SUM(accepted conversion qtys for that line over non-reversed chains)`; `remaining = delivered − converted`. Per challan roll-up gives Axis-B state. Both are derived reads recomputed from authoritative conversion lineage (conversion records + reversal/correction links); no stored counter, no editable field.
- Invariants (locked): converted ≤ delivered always; remaining ≥ 0 always; every accepted conversion checks remaining at commit order under server authority; concurrent commits serialise (second sees first’s effect or fails closed). Reversal of a conversion subtracts its quantity from `converted` (via compensating lineage, not counter-decrement); correction = reversal-link + replacement-link, net recomputed.
- Source line identity survives partial splits (40 then 60 of 100 reference the same line ID twice), bulk groupings (shared action ID), and many-to-one merges (N lines → 1 invoice line set with full ref sets). Lines never disappear, split into new identities, or merge silently.
