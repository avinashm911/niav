# NiavERP — Sales Cancellation, Reversal, Correction (Conceptual)

> Phase 7. Phase 5 additive discipline applied to sales. No statutory windows invented.

## Actions (locked)

- **Pre-post cancellation:** draft/pending_sync invoice intent voided (reason + audit, ID retired, zero consequences). Numbers never consumed finally; provisionals discarded.
- **Post-posting reversal:** new reversal source + atomic compensating siblings (money/quantity/tax neutralised per owners + application voidance surface) with `reverses/reversal_of` links; original retained with `reversed` overlay. Duplicate reversal and reversal-of-reversal rejected (correct instead).
- **Correction:** reversal + replacement under shared correction ID (`corrects/corrected_by`, original `corrected` overlay, replacement carries fixed commercial facts + fresh sibling determinations). Failed replacement fails per `69` action policy with lineage equivalence (original merely posted + reason).
- **Return:** independent additive event per `100` (not a reversal flavour): goods-movement + consequence chain with `returns/returned_by` links; originals retained; returnable-remaining enforced.
- Creates-summary: cancel → nothing; reversal → compensating set; correction → compensating + replacement sets; return → independent return set. All preserve originals + full traversability; statutory cancellation/e-invoice windows explicitly deferred (`105§C`) — no time-bar invented.
