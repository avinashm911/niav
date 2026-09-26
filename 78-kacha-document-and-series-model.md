# NiavERP — Kacha Document and Series Model (Conceptual)

> Phase 6. Numbered, company-scoped, auditable. No formats hardcoded, no numbering code.

## Series

- Per-company Kacha series + Pakka series (at least one each where the business uses challans). Series identity durable; numbers unique per series, never recycled, server-assigned at post; closed series assign nothing. Kacha/Pakka classification is configuration (which series is which), never concealment: both classes post through the Engine with identical controls.

## Chain

`Company → Kacha/Pakka Series → Kacha Document (source ID + voucher identity + number) → lines → conversion state (derived) → audit`.

## Kacha document fields (conceptual, not columns)

Source ID + voucher identity + Kacha number + company + party + document/business dates + location + item lines (item/qty/unit/values-as-recorded = rate snapshot) + lifecycle status (Axis A per `17`) + conversion state (derived Axis B) + correction links (Axis C) + lineage + audit. Draft/pending_sync editable locally only; posted immutable except via reversal/correction/conversion-state derivation.
- Lifecycle vs conversion strictly separated: a posted Kacha is simultaneously `posted` (Axis A) and one of `not/partially/fully_converted` (Axis B); correction overlays (Axis C) never rewrite either axis.
