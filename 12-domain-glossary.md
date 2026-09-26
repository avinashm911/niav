# NiavERP — Domain Glossary (Canonical Vocabulary)

> Phase 1. Conceptual definitions only. No implementation.
> Authority: Phase 0 constitution/scope. If conflict, Phase 0 wins; record in `23-phase-1-decisions.md`.

## How to read

Each term: Definition / Owning domain / Related terms / NOT synonyms (confusable terms explicitly distinguished).

## Organisation / Company / Business / Branch / Location / Warehouse

### Company
- Definition: The legal/accounting tenant. The isolation boundary for all books, stock, tax, and audit. One physical business may operate one or more companies; each company's ledger is separate.
- Owner: Company / Organisation.
- Related: Organisation, Business, Location.
- NOT: Branch, Location, Warehouse. A company is the tenant; locations exist inside it.

### Organisation
- Definition: Conceptual grouping used only where a user belongs to multiple companies (e.g., login scope, membership list). It owns no books.
- Owner: Company / Organisation (membership view only).
- Related: Company, User.
- NOT: Company. Organisation never holds ledger/stock/tax facts.

### Business
- Definition: Informal synonym for Company in owner-facing language. In modelling, always resolve to Company.
- Owner: Company / Organisation (display alias only).
- Related: Company.
- NOT: A separate entity. Do not model Business as distinct from Company.

### Branch
- Definition: Deferred operational grouping of Locations (e.g., Shop 1 / Shop 2). In V1, use Location; do not introduce Branch as a separate accounting entity unless Phase 1 decisions explicitly open it.
- Owner: Company / Organisation (if used, as grouping only).
- Related: Location.
- NOT: Company, Warehouse. A branch never owns its own ledger in V1.

### Location
- Definition: A named place where stock can sit and transactions can occur (shop floor, godown counter). Every stock event references one Location.
- Owner: Warehouse / Location (definition); Inventory consumes it for stock events.
- Related: Warehouse, Stock Movement.
- NOT: Warehouse as stock truth. Location is the dimension; the stock ledger is the truth.

### Warehouse
- Definition: A Location with storage semantics (godown). Conceptually a subtype of Location, not a separate stock system.
- Owner: Warehouse / Location.
- Related: Location, Transfer.
- NOT: Inventory ledger. Warehouse never stores quantity-on-hand as truth.

## Identity / Access

### User
- Definition: A human identity authenticated via Supabase Auth. May belong to multiple companies via Memberships.
- Owner: Users / Roles / Permissions.
- Related: Role, Permission, Membership, Actor.
- NOT: Role, Party, Customer. A user is never a commercial party.

### Role
- Definition: A named bundle of permissions within one Company (Owner, Accountant, Biller, Viewer baseline; exact matrix deferred).
- Owner: Users / Roles / Permissions.
- Related: Permission, Membership.
- NOT: Permission (single grant), User.

### Permission
- Definition: A single grant (e.g., `sale.create`, `challan.convert`, `reversal.request`) evaluated server-side in company scope.
- Owner: Users / Roles / Permissions.
- Related: Role.
- NOT: Role, UI visibility. Hiding a button is not permission.

## Commercial Masters

### Party
- Definition: The single canonical identity for any external counterparty (customer and/or supplier). Contact, addresses, GSTIN, roles attach here.
- Owner: Party Master.
- Related: Customer, Supplier.
- NOT: User, Account. Balances are derived, not stored on Party.

### Customer
- Definition: A role of a Party acting as buyer in a sale. Not a separate table conceptually; a Party with customer role.
- Owner: Party Master (role view).
- Related: Party, Receivable.
- NOT: Party itself, User.

### Supplier
- Definition: A role of a Party acting as seller in a purchase. Same identity pattern as Customer.
- Owner: Party Master.
- Related: Party, Payable.
- NOT: Party itself.

### Item
- Definition: A saleable/purchasable good. Identity plus units, barcodes, sale/purchase flags, and a tax-class reference (rates resolved by Tax Engine).
- Owner: Item Master.
- Related: Item Group, Unit, Tax Category.
- NOT: Stock Position. Item defines what; stock ledger defines how much where.

### Item Group
- Definition: A classification of Items for browsing/reports (e.g., Kirana / Personal Care). Never drives tax or stock truth.
- Owner: Item Master.
- Related: Item.
- NOT: Tax Category, Warehouse.

### Unit
- Definition: A unit of measure (pcs, kg, litre) with conversion discipline defined per Item. Conversions are master facts, not per-transaction inventions.
- Owner: Item Master.
- Related: Item.
- NOT: Quantity. Unit is the measure; quantity is the amount.

### Tax Category
- Definition: A classification hook on an Item (or transaction context) consumed by the Tax Engine to determine tax treatment. Holds no rates itself in Phase 1.
- Owner: Item Master (hook) + GST/Tax (interpretation). Rates/rules deferred to Phase 4.
- Related: Item, Tax Consequence.
- NOT: A rate/slab. Never treat category as a computed tax.

## Transaction Vocabulary

### Voucher
- Definition: The numbered business document wrapper (invoice, challan, payment, receipt, journal). Carries series + number + status; references a Source Transaction.
- Owner: Voucher.
- Related: Transaction, Document, Series.
- NOT: Posting, Ledger entry. Voucher is identity; consequences are effects.

### Transaction
- Definition: The submitted business intent processed by the Transaction Engine (sale, challan, payment, conversion, reversal). Source Transaction is the immutable root; consequences fan out from its Posting.
- Owner: Transaction Engine (lifecycle); consequence domains own their effects.
- Related: Source Transaction, Document, Posting.
- NOT: Ledger entry, Stock Movement, Tax Consequence individually. Transaction is the cause; those are effects.

### Document
- Definition: Owner-facing rendering of a Transaction/Voucher (the printable invoice/challan). Never the system of record by itself.
- Owner: Voucher (identity); presentation owned by Localisation/UX.
- Related: Voucher, Source Document.
- NOT: Source Transaction. A reprint is not a new transaction.

### Source Transaction
- Definition: The immutable root intent with durable identity (client UUID at creation). All consequences, conversions, reversals, and audit link to it. Never edited in place.
- Owner: Transaction Engine (identity + lifecycle).
- Related: Source Document, Posting, Lineage.
- NOT: A consequence, a report row, a sync copy.

### Source Document
- Definition: The business-meaningful source (challan, invoice, payment instruction) that the Source Transaction carries. Preserved verbatim for audit.
- Owner: Owning operational domain (Sales/Purchase/Challan/Payments) as data; Engine owns lifecycle.
- Related: Source Transaction.
- NOT: A derived report, a reprint.

### Posting
- Definition: The atomic commit event where a validated Source Transaction fans out to accounting + inventory + tax consequences plus audit links. All-or-none.
- Owner: Transaction Engine (orchestration); consequence domains own their rows.
- Related: Transaction, Accounting/Inventory/Tax Consequence.
- NOT: Draft, queue entry. Only posted transactions have consequences.

### Reversal
- Definition: A new linked transaction that neutralises the effects of a posted transaction. Source remains; both directions linked; reason required.
- Owner: Transaction Engine (transition) + originating domain (business reason); effects owned by consequence domains.
- Related: Correction, Cancellation.
- NOT: Deletion, edit-in-place, Cancellation. Reversal is additive.

### Cancellation
- Definition: A lifecycle transition that voids future effect of a document per policy (drafts, unconverted challans, tightly scoped unpaid drafts). If consequences already posted, implemented as Reversal, not deletion.
- Owner: Transaction Engine + owning domain policy.
- Related: Reversal, Correction.
- NOT: Deletion. Cancelled sources remain retrievable.

### Correction
- Definition: Reversal + re-issue (or corrective linked transaction). Never an in-place edit of posted consequences.
- Owner: Transaction Engine + owning domain.
- Related: Reversal, Cancellation.
- NOT: Edit. Correction is a new chain, not a mutation.

## Sales Flow

### Delivery Challan
- Definition: A source transaction recording goods movement/delivery with party, items, quantities, series. Tracked, numbered, preserved; convertibility tracked via Conversion State.
- Owner: Delivery Challan (data) + Voucher (numbering) + Engine (lifecycle).
- Related: Kacha, Pakka, Conversion, Invoice.
- NOT: Invoice, estimate, off-books slip. A challan is a first-class controlled record.

### Kacha
- Definition: A challan series classification for provisional/estimate-led movements per business process. Numbered, preserved, visible in stock/audit exactly like Pakka; convertibility governed by Conversion policy.
- Owner: Kacha/Pakka (classification + conversion policy).
- Related: Delivery Challan, Pakka, Conversion.
- NOT: Off-books, untracked, deletable, tax-free sale. Kacha is configuration, not concealment.

### Pakka
- Definition: A challan series classification for formal movements intended for GST invoices. Same controls as Kacha plus conversion linkage.
- Owner: Kacha/Pakka.
- Related: Delivery Challan, Kacha, Conversion, Invoice.
- NOT: Invoice itself. Pakka challan precedes the invoice; conversion creates the invoice.

### Invoice
- Definition: The GST-relevant sale/purchase bill created directly or via Conversion. Carries source refs (challans where applicable), taxable values, and tax-consequence links.
- Owner: Sales / Purchase (business data); Voucher (numbering); Engine (posting).
- Related: Delivery Challan, Conversion, Payment, Receivable/Payable.
- NOT: Challan, Payment, Ledger entry.

### Payment
- Definition: A receipt/payment/advance/transfer instruction and its application to invoices (full/partial/advance). Mode (UPI/cash/bank) is metadata; no gateway processing in V1.
- Owner: Payments (payment fact + application link).
- Related: Receipt, Receivable, Payable.
- NOT: Invoice, bank reconciliation itself, gateway settlement.

### Receipt
- Definition: A Payment subtype where money is received (vs paid). Same ownership as Payment.
- Owner: Payments.
- Related: Payment.
- NOT: Invoice, revenue. Receipt settles a receivable; it does not create sale revenue.

## Books / Positions

### Ledger
- Definition: The immutable posted debit/credit record. Truth for money; balances are derivations.
- Owner: Ledger (rows); Accounting (policy/chart).
- Related: Account, Accounting Consequence.
- NOT: Voucher, report, bank statement.

### Account
- Definition: A chart-of-accounts node (cash, bank, sales, purchase, stock, GST ledgers, party ledgers). Policy-owned; entries reference it.
- Owner: Accounting.
- Related: Ledger.
- NOT: Party, Item, bank account credential.

### Stock Movement
- Definition: A single stock-ledger event (in/out/transfer) with item/location/quantity + source link. Truth for stock.
- Owner: Inventory.
- Related: Stock Position, Transfer.
- NOT: Stock Position, Item master quantity field.

### Stock Position
- Definition: A derived sum over Stock Movements for an item/location (quantity-on-hand). Never stored as truth.
- Owner: Inventory (derived view).
- Related: Stock Movement.
- NOT: A master field, an editable count.

### Receivable
- Definition: A derived customer balance + ageing view over invoices, payments, adjustments. No independent truth.
- Owner: Receivables (derivation).
- Related: Invoice, Payment, Customer.
- NOT: Payment, invoice. Receivable is the outstanding; payments settle it.

### Payable
- Definition: Mirror of Receivable for suppliers.
- Owner: Payables.
- Related: Invoice (purchase), Payment, Supplier.
- NOT: Payment.

## Consequences / Events

### Accounting Consequence
- Definition: The balanced debit/credit effects of one Posting, each linked to its Source Transaction. Owned as rows by Ledger; policy by Accounting.
- Owner: Ledger (rows) / Accounting (policy); orchestrated by Engine.
- Related: Posting, Source Transaction.
- NOT: The voucher, the report, the bank movement.

### Inventory Consequence
- Definition: The stock-ledger effects of one Posting. Owned by Inventory.
- Owner: Inventory; orchestrated by Engine.
- Related: Stock Movement, Posting.
- NOT: Item definition, Stock Position edit.

### Tax Consequence
- Definition: The Tax Engine output for one Posting (amounts + rule version + source-line links). Deterministic and reproducible.
- Owner: GST/Tax; orchestrated by Engine.
- Related: Tax Category, Posting.
- NOT: UI computation, hardcoded slab, report total.

### Audit Event
- Definition: An append-only record of a consequential transition (create/post/convert/reverse/cancel/correct, permission/period change, conflict resolution, import decision) with actor/device/time/before-after/reason/lineage.
- Owner: Audit (log); emitted by all domains.
- Related: Source Transaction, Actor, Sync Event.
- NOT: Business execution itself, editable history.

### Sync Event
- Definition: A record of push/pull/acknowledgement/conflict for a transaction or master (cursor, outcome, conflict ref). Does not change business truth; only transport state.
- Owner: Sync.
- Related: Audit Event, Source Transaction.
- NOT: Posting, validation. Sync never validates business rules; Engine re-validates.

### Conversion
- Definition: The action creating a new Invoice from one or more Challans, with full source refs, remaining-quantity update, and audit. Patterns: individual, bulk, partial, many-to-one.
- Owner: Kacha/Pakka (policy) + Engine (execution); refs owned by Challan/Sales.
- Related: Partial/Full Conversion, Conversion State.
- NOT: Edit, deletion, reprint. Conversion is additive.

### Partial Conversion
- Definition: A Conversion covering part of a challan line quantity; remainder stays open (`remaining > 0`).
- Owner: Kacha/Pakka + Engine.
- Related: Conversion, Full Conversion, Conversion State.
- NOT: Full Conversion, split-sale invention. Partial is tracked, not informal.

### Full Conversion
- Definition: A Conversion completing all remaining quantity on the referenced challan lines (`remaining = 0`).
- Owner: Kacha/Pakka + Engine.
- Related: Conversion, Partial Conversion.
- NOT: Deletion of the challan. Full challans remain retrievable.

### Document Status
- Definition: The lifecycle state of a document/transaction (draft → pending_sync → posted, plus terminal overlays reversed/cancelled/corrected). Derived from posted events, never a free-text flag. See `17-lifecycle-state-models.md`.
- Owner: Transaction Engine (derivation) + Voucher (identity).
- Related: Conversion State, Correction linkage.
- NOT: Conversion State, correction link. Do not collapse into one field.

### Conversion State
- Definition: Convertibility of a challan (not_converted / partially_converted / fully_converted), derived from Conversion records vs delivered quantity. Independent axis from Document Status.
- Owner: Kacha/Pakka (derivation); Engine executes transitions.
- Related: Document Status, Conversion.
- NOT: Document Status. A posted challan can be unconverted, partial, or full.
