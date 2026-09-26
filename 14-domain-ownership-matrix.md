# NiavERP — Domain Ownership Matrix

> Phase 1. One canonical owner per fact. Rule: **Dependency direction does not imply ownership.**
> Reading: Owns (canonical truth) | Reads/Consumes (needs to validate/derive) | Commands/Requests (may ask Engine/policy for a transition) | Must Not Own / Must Not Mutate.

| Domain | Owns | Reads / Consumes | Commands / Requests | Must Not Own / Must Not Mutate |
|---|---|---|---|---|
| Company / Organisation | Company identity, series config, preferences, period policy refs, location definitions list | Memberships (for scoping) | Requests period open/close via Accounting policy; requests numbering via Voucher | Transactions, ledger/stock/tax rows, audit log mechanics |
| Users / Roles / Permissions | User identity binding, Memberships, Roles, Permission grants, grant-at-time | Company scope | Requests grant changes (audited); Engine consumes grants at validation | Financial/stock/tax consequences, voucher numbers |
| Party Master | Party identity, addresses/identities, customer/supplier roles, merge links | Company | Requests merge/retire (audited) | Balances, invoices, tax computation |
| Item Master | Item identity, groups, units/conversions, barcodes, tax-class hooks | Company | Requests retire/reclassify (prospective) | Stock quantities, prices as truth, tax rates |
| Voucher | Voucher identity, series execution, final numbers, document identity/status derivation input | Company config, Engine lifecycle | Requests number assignment from server authority; Engine executes | Accounting/inventory/tax effects |
| Transaction Engine | Source-transaction identity, validation outcome, posting atomicity, lifecycle transitions, idempotency enforcement, consequence fan-out orchestration | Masters, grants, series, period, stock/remaining state (read-only for validation), tax outputs (returned) | Commands consequence creation via owned ports; sole requester of consequence writes | Master data, tax tables, adapter formats, UI; never owns consequence-row semantics beyond orchestration |
| Accounting (policy) | Chart of accounts, posting policies, period controls | Company, Engine posting intent | Requests period lock/unlock (audited) | Source documents, inventory quantities, tax determination |
| Ledger | Posted debit/credit rows (immutable) | Accounting policy, Source/Posting refs | — (writes only via Engine fan-out) | Validation, source entry, numbering |
| Sales | Sale invoice/return business data (lines-as-intended) | Party, Item, Voucher/Series, Tax outputs (read), Receivables state (read) | Requests validate/post/reverse/correct via Engine; requests conversion via Kacha-Pakka | Ledger rows, stock rows, tax math, final numbers |
| Purchase | Purchase invoice/return business data | Same as Sales + Payables state | Same as Sales via Engine | Same as Sales |
| Delivery Challan | Challan movement data + lines | Party, Item, Series, Conversion State (read) | Requests post/cancel via Engine; requests conversion via Kacha-Pakka | Tax liability creation, sale revenue, final numbers |
| Kacha / Pakka | Series classification, conversion policy, Conversion records, Conversion State derivation | Challan, Voucher, Sales/Invoice, remaining quantities | Requests conversion execution via Engine (Engine validates + posts) | A hidden/parallel book; direct ledger/stock/tax writes; manual state-flag edits |
| Inventory | Stock events (ledger), derived positions/availability | Item, Location, Posting/Source refs | — (writes only via Engine fan-out) | Item definitions, accounting values, direct quantity edits |
| Warehouse / Location | Location master facts, transfer intent data (from→to, item, qty as requested) | Company, Inventory positions (read for UX) | Requests transfer execution via Engine | Stock truth (ledger owns); must not adjust quantities directly |
| Receivables | Derived customer balances + ageing views | Sales invoices, Payment Applications | Requests no writes; derives | Payment entry, invoice creation |
| Payables | Derived supplier balances + ageing views | Purchase invoices, Payment Applications | Same as Receivables | Same |
| Payments | Payment facts + Application links (payment↔invoice, advance handling) | Receivables/Payables state (read to validate), Cash/Bank refs | Requests post/apply/reverse via Engine | Invoice creation, tax math, balance truth (derives, not owns) |
| Cash / Bank | Account definitions + movement intent refs (via Payments) | Accounting policy, Engine posting | Requests receipt/payment/transfer via Engine (as Payments) | Reconciliation decisions, invoice logic |
| GST / Tax | Tax consequences + rule-version refs (outputs only in Phase 1) | Item hooks, party/place/value facts passed by Engine | Returns outputs to Engine; no direct writes to ledger/stock | Source documents, posting mechanics, UI rates |
| Reconciliation | Match links + Exception lists | Ledger, Inventory, Tax, Payments, Reports | Requests no business writes; flags exceptions | Original entries; only links/flags |
| Reports | Read-only derivations (registers, summaries) | Ledger, Inventory, Tax, Reconciliation | None | Any write, any tax computation |
| Compliance | Readiness state, checklists, reviewable summaries | Reports, Reconciliation, Tax, Audit | None (surfaces needs-CA-review) | Filing, professional judgement |
| Audit | Append-only event log | All domains (emissions) | None (passive recorder with stable IDs) | Business execution |
| Sync | Outbox/inbox, cursors, conflict records, transport state | Transaction lifecycle state (read) | Requests push/pull; Engine re-validates business truth | Business validation, numbering, consequence writes |
| Integrations (Tally/BUSY) | Adapter mappings, import/export batches (translation scope only) | Masters (lookup), Engine submission ports, read ports for export | Requests canonical submit via Engine; never direct consequence writes | Ledger/stock/tax writes, numbering authority, tax logic |
| Migration | Import batches + validation reports + cutover record | Masters, Engine ports, Audit | Requests batch accept via Engine-mediated openings | Live-transaction editing except via Engine |
| Localisation | Locale bundles, format policies (display only) | None (presentation) | None | Business logic, codes, tax rules, voucher semantics |

## Resolved Phase 0 cycles (conceptual)

- **Inventory ↔ Warehouse:** Inventory owns stock truth (events/positions). Warehouse owns location definitions + transfer *intent data*. Transfers execute only via Engine → Inventory writes events. Warehouse never mutates quantities.
- **Receivables ↔ Payments:** Payments owns payment facts + application links. Receivables/Payables own derived balances/ageing. Payments reads balances to validate; Receivables reads applications to derive. Neither writes the other's truth.
- **Engine ↔ consequences:** Engine owns lifecycle/validation/posting orchestration + idempotency. Consequence domains own their rows. Engine is the sole commander of consequence writes through owned ports; consequences never command the Engine and never write across domains.

## Who may request vs mutate

- Request a transition: Sales/Purchase/Challan/Payments/Kacha-Pakka/Migration/Adapters (via Engine), Admin (period/roles, audited).
- Mutate own truth only: each domain above. Cross-domain mutation is forbidden; e.g., Reports/Reconciliation/Sync/Localisation mutate nothing financial; Adapters mutate nothing except their batch scope.
