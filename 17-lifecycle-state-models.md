# NiavERP — Lifecycle / State Models (Conceptual)

> Phase 1. Three independent axes. Do not collapse into one status field. No enum code.
> Axes: (A) Document/Lifecycle Status, (B) Conversion State (challans only), (C) Correction/Reversal Linkage.

## A. Document / Lifecycle Status (all transaction documents)

```
draft → pending_sync → posted → (terminal overlays, additive)
```

- `draft`: local intent, editable, no consequences, no number, not reportable as books.
- `pending_sync`: queued with durable ID; UX pre-validated; server has not posted. Reportable only as “pending”, never as books.
- `posted`: validated + atomically committed with consequences + final number + audit. Immutable thereafter.
- Overlays (appended, never replacing `posted`):
  - `reversed`: a linked Reversal Source exists and posted. Original stays `posted + reversed`.
  - `cancelled`: voided per policy with reason + audit (pre-consequence) or via reversal (post-consequence). Source retained.
  - `corrected`: superseded by a linked corrective chain (`corrected_by`). Original retained.
- Payment-derived substates (`unpaid / partially_paid / paid`) are **derived read-model flags** on invoices, not lifecycle states. They change as Payment Applications append; they never mutate the invoice lifecycle.

Allowed transitions: `draft → pending_sync → posted`; `posted → reversed / cancelled-via-reversal / corrected`; `draft|pending_sync → cancelled (pre-post, per policy)`. No backward transitions. No `posted → draft`.

## B. Conversion State (Delivery Challans only; independent axis)

```
not_converted → partially_converted → fully_converted
```

- Derived as fold over Conversion records vs delivered quantity per line, then rolled up per challan.
- `not_converted`: posted challan, zero invoiced.
- `partially_converted`: some but not all line quantity invoiced; remainder open.
- `fully_converted`: remaining = 0 on all lines.
- Orthogonal to (A): a challan is `posted` + one of the above. Cancellation of an unconverted challan keeps history; cancellation never deletes the axis value, it appends lifecycle overlay.
- Over-conversion is rejected by Engine validation reading this state.

## C. Correction / Reversal Linkage (independent links, not states)

- `reverses / reversed_by`, `corrects / corrected_by`, `converted_from / converted_to`, `applied_by (payments)`, `migrated_from (imports)`.
- Links are additive, bidirectional, audited. They explain derived statuses but never replace history.

## Per-type notes

- **Generic transaction / Voucher:** follows (A) + (C). (B) not applicable.
- **Invoice (sale/purchase):** (A) + (C) + payment-derived flags. Conversion sources attached via (C) `converted_from` where applicable.
- **Payment:** (A) + (C) + application links. `applied / partially_applied / advance_held` are derived, not lifecycle.
- **Delivery Challan (Kacha and Pakka identical lifecycle):** (A) + (B) + (C). Kacha vs Pakka differ only in classification + conversion policy, never in state machinery.
- **Conversion action:** itself a posted transaction event with idempotency key + audit; bulk = one action ID over N conversions; many-to-one = one invoice with N refs.
- **Correction:** new chain with `corrects`; original gains `corrected` overlay + link.
- **Reversal:** new chain with `reverses`; original gains `reversed` overlay + consequence-level `reversal_of` links.
- **Cancellation:** pre-post void (overlay + reason) or post-post reversal (two overlays: `cancelled` + `reversed` semantics via links). Never deletion.
