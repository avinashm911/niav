# NiavERP — Transaction Lineage Model

> Phase 1. Mandatory traceability. Canonical chain: validate → post → atomic acct+inv+tax → payment links → audit → derived reads → sync. No destructive replacement.

## 1. Canonical lineage spine

```
Source Transaction (durable ID)
→ Transaction/Document + Voucher identity (series + final number on post)
→ Posting (atomic commit ref)
→ Accounting Consequence(s) [Ledger rows]
→ Inventory Consequence(s) [Stock events]
→ Tax Consequence(s) [outputs + rule version]
→ Payment Linkage(s) [applications, where applicable; timing varies]
→ Audit Event(s)
→ Reporting / Read models (registers, balances, positions, summaries)
→ Synchronization (ack, cursors, conflicts)
```

- Every node after Source carries the Source ID. Consequence nodes additionally carry Posting ref. Audit carries Source + Posting + consequence refs where relevant.
- Payment timing note: an invoice may post before any payment exists. The lineage slot exists (0..N applications); later payments append links + audit without mutating the invoice chain.

## 2. Behaviour under transitions

- **Correction:** original chain frozen. New corrective Source(s) created with `corrects → / corrected_by` links both ways. Derived reads reflect net effect; both chains remain queryable.
- **Reversal:** new Reversal Source with `reverses →` link; neutralising consequences carry `reversal_of →` links to the original consequence IDs. Original rows untouched.
- **Cancellation:** allowed pre-consequence per policy; records `cancelled` lifecycle + reason + audit, source retained. Post-consequence “cancellation” is executed as Reversal (see above), never deletion.
- **Conversion (incl. bulk/partial/many-to-one):** new Invoice Source with `converted_from →` set of (challan, line) refs. Each referenced challan line updates derived `invoiced/remaining` and Conversion State; Conversion record links all sides + audit. Bulk = N conversions sharing one action ID; many-to-one = 1 invoice with N source refs.
- **Partial conversion:** remainder stays open by construction (`remaining = delivered − invoiced` derived from Conversion records). Over-conversion rejected at validation (Engine reads remaining state).
- **Offline creation:** lineage starts locally with durable ID + local audit buffer. On sync, server anchors (final number, server time, posting ref) appended; local ID never replaced. Reports distinguish `pending_sync` vs `posted`.
- **Synchronisation:** ack/cursor/conflict records reference Source ID + outcome. Conflicts never merge financial facts silently; server decision + conflict audit appended; losing attempt remains traceable.

## 3. Lineage integrity rules

1. No consequence without a Source. No edit-in-place of posted consequences.
2. Every derived read (balance, position, ageing, GST summary) must be explainable as a fold over linked consequences + rule version.
3. Every state derivation (Document Status, Conversion State) must be explainable as a fold over transaction + conversion + reversal links.
4. Deletion of a Source, consequence, or audit event is forbidden in every phase, including adapters and migration.
5. Imported/migrated history enters as new Sources via Engine with `migrated_from →` batch/row refs; original external IDs are attributes, never replacements for lineage.
