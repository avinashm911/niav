# NiavERP — Sales Return and Adjustment Model (Conceptual)

> Phase 7. Additive returns against invoice lineage; no invoice mutation. Statutory return-treatment detail deferred to GST boundary.

## Model

- **Return intent:** new source referencing (original invoice + lines) with return quantities, reason, business date, location (restock site). Eligibility: original posted + unreversed-for-that-qty + returnable remaining (`returnable = invoiced − previously-returned − previously-reversed-covering`) > 0 covering request + actor authorised + period open for return date. Timing constraints beyond eligibility (e.g., statutory windows) explicitly deferred (`105§C`).
- **Effects (via Engine atomic posting):** Inventory compensating rows (restock IN-class per Phase 3 discipline) + Accounting neutralising legs (per Phase 2) + GST redetermination on the return chain (fresh determination linked to original per `56`; rate/credit mechanics deferred to GST boundary — no invention here) + refund/payment hooks where money moves (new payment or application-voidance per `99`, never silent netting) + audit + return-linkage (`returns/returned_by` links both directions).
- **Shapes:** partial (part of a line), multiple (sequential returns until returnable hits zero), full (all lines, all qty). Each independently atomic + audited; over-return (request > returnable) fails closed; lines never disappear; original invoice retained with `returned` derivation (not lifecycle).
- **Return vs correction vs reversal:** return = new commercial event (goods come back) with own consequences; correction = fix wrong facts (reversal + replacement, §101); reversal = void the invoice’s effect without goods movement semantics. Distinct intents, distinct links, never synonyms; credit-note document forms realise return/correction chains for GST-reportable paths per `56` (workflows deferred to Phase 7-sales-ops/Phase 8-purchase analogues).
