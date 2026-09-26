# NiavERP — Stock Adjustment and Correction (Conceptual)

> Phase 3. Adjustments are governed movements, never silent edits. Reversal/correction additive per Phase 2 discipline.

## 1. Adjustment (quantity-only, governed)

- **Purpose:** reconcile modelled quantity with reality (count variance, damage, spoilage write-off as quantity, found stock) where no sale/purchase/transfer source applies.
- **Shape:** single IN (increase) or OUT (decrease) movement with `is_adjustment`, mandatory reason (+ optional count evidence refs deferred to later UX), actor + role-at-time + device + business date + audit.
- **Initiation:** conceptually governed actors only; exact roles/permissions deferred to Phase 16 — but the invariant is locked here: anonymous/ungoverned adjustments must fail validation in every later implementation.
- **No approval workflow invented** in Phase 3 beyond reason + audit + (where policy demands) second-actor hook carried from `07§6`; mechanics deferred.
- **Before/after explainability:** the adjustment links no “old balance field”; instead readers explain `balance_before → movement → balance_after` as folds over the ledger slice. Counts-as-evidence attach as references, never as truth.

## 2. Opening stock (distinct, separable)

- Flagged `is_opening` movements per (item, location) from go-live/migration batch; posts only in designated opening context; excludable from operational views; correctable only via new linked openings (originals retained). No valuation coupled here; accounting-opening linkage is lineage/boundary only (`44`).

## 3. Reversal (post-post)

- Compensating movement: same item/location, equal quantity, opposite direction, `reversal_of` → original movement ID + `reverses` → original source. Original retained. Reason + audit required. One active reversal per movement (second rejected).

## 4. Correction

- Reversal + replacement under shared correction/action ID (e.g., wrong location: OUT-reversal at wrong location… precisely: compensating IN at wrong location if original was OUT there, plus correct OUT/IN pair at right location), with `corrects/corrected_by` links. Originals retained. Period treatment follows `28`-analogous posting-date discipline: corrections post at their own business date into open contexts, never by editing history.

## 5. Pre-post cancellation

- Draft/pending_sync intents cancelled per policy: no movement posted, identity retained + audit, IDs never recycled.
