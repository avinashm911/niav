# NiavERP — Conceptual Entity Model

> Phase 1. Conceptual only. Purpose / owner / identity / relationships / lifecycle / mutability / lineage per entity. No columns, no SQL, no math.

## Entity classes

- **Master:** long-lived reference data (Company, User/Membership, Party, Item, Location, Series config). Mutable via governed edits; history preserved where consequential (merge links, audit).
- **Transaction:** business intents with durable identity (Source Transaction, lines, challans, invoices, payments, conversions, reversals). Immutable once posted; later changes are new linked transactions.
- **Consequence:** effects owned by Ledger/Inventory/Tax (accounting entries, stock events, tax outputs). Immutable, source-linked, derived-from-posting only.
- **Control/Audit:** numbering, periods, audit events, conflict records. Append-only.
- **Integration:** adapter batches, import batches, export snapshots. Translate/validate only; never write consequences directly.

## 1. Company

- Purpose: tenant root and isolation boundary; holds series config, preferences, period policy refs.
- Owner: Company / Organisation.
- Identity: stable company identity assigned at creation; never reused across tenants.
- Relationships: 1 Company → N Memberships, Parties, Items, Locations, Series, Transactions, Audit Events.
- Lifecycle: created → active → (suspended/closed per future admin policy). Books never merge across companies.
- Mutable: preferences, series config (governed, audited). Immutable: identity, ledger history.
- Lineage: every transaction/consequence/audit carries company scope.

## 2. Membership (User ↔ Company)

- Purpose: binds a User to a Company with Roles.
- Owner: Users / Roles / Permissions.
- Identity: stable membership identity per (user, company).
- Relationships: N:1 User, N:1 Company, N Roles.
- Lifecycle: invited → active → revoked. Revocation never deletes history.
- Mutable: roles (audited). Immutable: past audit actor refs.
- Lineage: permission checks reference membership at posting time + audit.

## 3. Role / Permission grant

- Purpose: named bundles (Role) and single grants (Permission) evaluated server-side per company.
- Owner: Users / Roles / Permissions.
- Identity: stable role/grant identity per company.
- Relationships: Role → N Permissions; Membership → N Roles.
- Lifecycle: defined → assigned → amended (audited) → retired (no reassignment).
- Mutable: assignments (audited). Immutable: past decisions remain valid under grant-at-time.
- Lineage: postings record actor + role-at-time in audit.

## 4. Location (incl. Warehouse subtype)

- Purpose: the place dimension for stock and transaction occurrence. Warehouse = Location with storage semantics.
- Owner: Warehouse / Location (definition).
- Identity: stable location identity per company.
- Relationships: Company → N Locations; Stock Event → 1 Location (or from→to for transfers).
- Lifecycle: created → active → retired (retired locations accept no new movements; history retained).
- Mutable: name/preferences (audited). Immutable: identity, past movement refs.
- Lineage: every stock event links item + location + source transaction.

## 5. Party (Customer / Supplier roles)

- Purpose: single counterparty identity; customer/supplier are roles, not separate entities.
- Owner: Party Master.
- Identity: stable party identity per company; GSTIN/phones are attributes, not identity.
- Relationships: Company → N Parties; Party → N Addresses/Identities; Transaction → 1 Party (or none for internal transfers); Merge: absorbed Party → surviving Party link.
- Lifecycle: created → active → merged/retired (history preserved via merge link; postings keep original ref + resolution).
- Mutable: contact/addresses/roles (governed; merges audited). Immutable: identity, posted refs.
- Lineage: invoices/payments/challans reference party-at-time; merges preserve chain.

## 6. Item (Item Group, Unit, Tax-class hook)

- Purpose: goods identity; group for browsing; unit for measure; tax-class hook consumed by Tax Engine.
- Owner: Item Master (group/unit/tax-hook included).
- Identity: stable item identity per company; barcode is attribute.
- Relationships: Company → N Items; Item → 1 Group (optional), 1 Unit (+ conversions), 1 Tax-class hook; Transaction Line → 1 Item.
- Lifecycle: created → active → retired (no new lines; history retained).
- Mutable: description/group/barcodes (audited). Immutable: identity, posted line refs, tax-hook-at-time (changes apply prospectively).
- Lineage: every line links item-at-time; tax consequences link hook-at-time + rule version.

## 7. Voucher Series

- Purpose: per-company numbered sequences per voucher type (sales, challan-Kacha, challan-Pakka, purchase, payment, etc.).
- Owner: Voucher (execution/numbering); Company owns configuration.
- Identity: stable series identity per (company, voucher type).
- Relationships: Series → N Vouchers; Transaction references intended Series; Posting assigns final Number.
- Lifecycle: defined → active → closed (closed series issues no new numbers).
- Mutable: configuration (audited). Immutable: issued numbers never reused.
- Lineage: every voucher links series + final number + source transaction.

## 8. Source Transaction (+ Lines)

- Purpose: the immutable root intent (sale, challan, payment, conversion, reversal). Lines carry party/item/quantity/value facts.
- Owner: Transaction Engine (identity + lifecycle); business data owned by originating domain (Sales/Purchase/Challan/Payments).
- Identity: durable client-generated identity at creation (UUID-v4-or-equivalent, conceptual); stable across offline/sync/conversion/reporting. Server never reassigns it; final voucher number is separate.
- Relationships: 1 Source → N Lines; 1 Source → 1 Voucher identity; 1 Source → N Consequence links; 1 Source → N Audit Events; Conversion: N Challan Sources → 1 Invoice Source (via Conversion record).
- Lifecycle: draft → pending_sync → posted → (reversed / cancelled / corrected via new links). See `17`.
- Mutable: draft fields only (pre-post). Immutable after post: identity, lines-as-posted, refs.
- Lineage: root of all lineage; every consequence/audit/sync record points here.

## 9. Delivery Challan

- Purpose: goods-movement source transaction with convertibility tracking.
- Owner: Delivery Challan (movement data); Kacha/Pakka (classification + conversion policy); Voucher (numbering); Engine (lifecycle).
- Identity: source-transaction identity + challan series/number.
- Relationships: Challan → N Lines (item/qty); Challan → Conversion State (derived); Challan → N Conversion refs.
- Lifecycle: draft → pending_sync → posted → converting (partial) → converted (full) / cancelled (per policy). Status vs conversion state separated (see `17`).
- Mutable: draft only. Immutable once posted except via conversion-state derivation + reversal/cancellation links.
- Lineage: preserves delivered vs invoiced vs remaining per line; conversions reference line-level sources.

## 10. Invoice (Sale / Purchase)

- Purpose: the GST-relevant bill, created directly or via Conversion.
- Owner: Sales / Purchase (business data); Voucher/Engine as above.
- Identity: source identity + invoice series/number.
- Relationships: Invoice → N Lines; Invoice → N Source Challans (optional, via Conversion); Invoice → N Payment Applications; Invoice → Consequences.
- Lifecycle: draft → pending_sync → posted → (paid/partially-paid derived) → (reversed via credit/corrective). See `17`.
- Mutable: draft only. Immutable once posted.
- Lineage: lines carry source-challan refs where converted; tax links carry rule version.

## 11. Payment (+ Application link)

- Purpose: money movement + its application to invoices (full/partial/advance). Mode is metadata.
- Owner: Payments (payment + application link). Balances derived by Receivables/Payables.
- Identity: stable payment identity + application-link identities.
- Relationships: Payment → N Applications → Invoices; Payment → Cash/Bank account ref.
- Lifecycle: draft → pending_sync → posted → applied (full/partial) → (reversed if voided per policy). See `17`.
- Mutable: draft only. Immutable once posted; re-application is a new link + audit.
- Lineage: every application links payment source ↔ invoice source + actor/reason.

## 12. Accounting Consequence (Ledger entries)

- Purpose: balanced debit/credit effects of one Posting.
- Owner: Ledger (rows); Accounting (chart/policy). Engine orchestrates.
- Identity: stable consequence identity per posting; never edited.
- Relationships: N entries ↔ 1 Posting/Source; each → 1 Account.
- Lifecycle: posted (immutable) → (neutralised by Reversal entries, linked).
- Mutable: none. Immutable: all.
- Lineage: each entry carries source-transaction ID + posting ref.

## 13. Inventory Consequence (Stock events)

- Purpose: stock-ledger events (in/out/transfer) of one Posting.
- Owner: Inventory. Engine orchestrates.
- Identity: stable event identity per posting.
- Relationships: N events ↔ 1 Posting/Source; each → 1 Item + 1 Location (or from→to).
- Lifecycle: posted (immutable) → (neutralised by Reversal events).
- Mutable: none.
- Lineage: each event carries source ID + challan/invoice link.

## 14. Tax Consequence

- Purpose: deterministic Tax Engine output per posting (amounts + rule version + line links). No rates stored here in Phase 1.
- Owner: GST/Tax. Engine orchestrates.
- Identity: stable tax-output identity per posting/line.
- Relationships: N outputs ↔ 1 Posting/Source lines.
- Lifecycle: posted (immutable) → (neutralised per reversal policy via new outputs).
- Mutable: none.
- Lineage: links source lines + rule version for reproducibility.

## 15. Audit Event

- Purpose: append-only record of consequential transitions.
- Owner: Audit (log); emitted by all domains.
- Identity: stable audit identity; ordered per company.
- Relationships: N events ↔ 1 Source Transaction (usually); also permission/period/conflict/import events.
- Lifecycle: appended (immutable).
- Mutable: none.
- Lineage: carries actor/role/device, client+server time, before/after or links, reason, lineage chain.

## 16. Sync Metadata (Outbox, Cursor, Conflict)

- Purpose: transport state only (queue entries, pull cursors, conflict records). Never business truth.
- Owner: Sync.
- Identity: outbox entry per source ID (idempotency key = source ID); cursor per device/company; conflict per (source, attempt).
- Relationships: Outbox → Source Transaction; Conflict → Source + server decision + audit.
- Lifecycle: queued → pushed → acknowledged (posted) / rejected (with reason) / conflicted (resolved by server + audit).
- Mutable: transport state only. Immutable: business facts.
- Lineage: links local UUID → server acknowledgement → final voucher number.

## 17. Integration Batch (Import / Export / Adapter)

- Purpose: bounded validation/translation batches. Import: dry-run report + atomic accept. Export: read-only snapshot. Adapter: external ↔ canonical translation.
- Owner: Migration / Integrations (adapters).
- Identity: stable batch identity per company.
- Relationships: Batch → N rows → (accepted) N Source Transactions or (rejected) N Reasons.
- Lifecycle: created → validated (report) → accepted/rejected → (accepted rows become Sources via Engine).
- Mutable: batch review state only. Immutable once accepted.
- Lineage: accepted rows link batch + resulting source IDs; audit records decision.
