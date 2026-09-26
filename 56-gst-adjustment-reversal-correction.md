# NiavERP — GST Adjustment, Reversal, Correction + Credit/Debit Notes (Conceptual)

> Phase 4. Additive lineage only. Document forms distinguished from mechanics.

## 1. Mechanics (follow Phase 2/3 discipline)

- **Pre-post cancel:** no determination/lines posted; identity retained + audit.
- **Reversal:** new determination + compensating tax lines (opposite effect per component) with `reversal_of` line links + `reverses` determination link; originals retained. Double reversal rejected.
- **Correction:** reversal determination + replacement determination under shared correction/action ID with `corrects/corrected_by` links; originals retained. Period treatment follows posting-date discipline (new business date, open contexts); cross-period restatement is reporting concern (Phase 13), never an edit.
- **Adjustments increasing/decreasing liability outside invoice chains** (e.g., later-noted rate applicability fixes) use the same reversal+replacement shape with explicit reason; no direct line edits, no “tax adjustment vouchers” that bypass determination.

## 2. Credit / Debit Notes (document forms, workflows deferred)

- **Credit Note:** reportable document form realising a liability-decreasing correction/reversal chain for a prior invoice (references original deterministically). **Debit Note:** the increasing counterpart. They are *presentations* of the underlying reversal/correction determinations, not alternative mechanics — every credit/debit note maps to posted determination(s) with full links; standalone note-without-lineage is forbidden.
- Sales/purchase issuance, numbering series for notes, and return-linkage workflows belong to Phase 7/8; Phase 4 locks only the lineage equivalence above.
