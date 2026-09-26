# NiavERP — Transaction Reversal and Correction Orchestration (Conceptual)

> Phase 5. Engine coordinates; domains determine their reversal math. Additive, linked, audited.

- **Pre-post cancellation:** Engine validates cancellable state (draft/pending_sync per `17`) → marks cancelled overlay + reason + audit. No consequences exist; nothing to neutralise; IDs never recycled.
- **Post-post reversal:** Engine validates posted + unreversed + grant + period-for-new-date → coordinates sibling reversals (Accounting neutralising entry per `31`, Inventory compensating movement per `41`, GST compensating lines per `56`, payment-application voidance per Phase 9 policy surface) as one atomic reversal posting with `reverses/reversal_of` links → audit. Originals untouched. Duplicate reversal rejected; reversal-of-reversal rejected (correct instead).
- **Correction:** reversal leg + replacement leg under shared correction/action ID (`corrects/corrected_by`), each atomic under the same boundary; originals gain `corrected` overlay. Failed replacement fails the correction action per declared policy (either full-action rollback leaving original merely posted, with reason — policy choice recorded at execution time, lineage equivalent required either way; mechanics choice deferred to implementation guidance, not invented here).
- Engine never computes leg/movement/line reversals itself; it sequences, enforces atomicity/idempotency/links, and rejects lifecycle violations.
