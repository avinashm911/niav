# NiavERP — Entity Relationships (Conceptual Cardinality)

> Phase 1. Conceptual multiplicities. No FKs, no SQL. All scoped to one Company unless stated.

## Conventions

- `1 → N`: one-to-many. `1 → 0..N`: optional many. `N ↔ M via X`: many-to-many resolved through link entity X.
- Every relationship crossing into consequences/audit carries source-transaction lineage.

## 1. Company scope

- Company → Users via Membership: `1 → N` Memberships; Membership → User `N → 1`; Membership → Roles `N ↔ M`.
- Company → Parties: `1 → N`.
- Company → Items: `1 → N`. Item → Group `N → 0..1`. Item → Unit `N → 1` (+ conversions per Item).
- Company → Locations: `1 → N`.
- Company → Voucher Series: `1 → N` (one per voucher type at least).
- Company → Source Transactions: `1 → N`. Company → Audit Events: `1 → N`. Company → Sync Cursors: `1 → N per device`.

## 2. Transaction core

- Source Transaction → Lines: `1 → 1..N`.
- Source Transaction → Voucher (identity): `1 → 1`.
- Voucher Series → Vouchers: `1 → N`; final Number unique per Series.
- Transaction → Consequences: `1 → 0..N` each of Accounting entries, Stock events, Tax outputs (0 only pre-post; `1..N` once posted where applicable).
- Transaction → Audit Events: `1 → 0..N` (≥1 once posted).
- Transaction → Sync entries: `1 → 0..N` (outbox/conflicts per attempt).
- Line → Item: `N → 1` (item-at-time). Transaction → Party: `N → 0..1`.

## 3. Challan → Conversion → Invoice

- Delivery Challan → Lines: `1 → 1..N` (item/qty per line).
- Challan → Conversion records: `1 → 0..N`.
- Conversion → Source Challans: `N → 1..N` (individual `1→1`, many-to-one `N→1` invoice side; bulk = N independent `1→1` grouped in one action).
- Conversion → Invoice: `N → 1` per conversion action (bulk = N conversions, each `1→1`).
- Invoice → Source Challans via Conversions: `1 → 0..N` (0 = direct invoice without challan).
- Challan Line → Converted quantity: tracked as `delivered vs invoiced vs remaining` (derived, not a separate entity).

## 4. Payments

- Payment → Applications: `1 → 1..N`.
- Application → Invoice: `N → 1` per application row.
- Invoice → Applications: `1 → 0..N`.
- Payment → Cash/Bank account ref: `N → 1`.
- Advance: Payment with `0` applications initially; later `1 → N` applications. No separate entity.

## 5. Consequences / Books

- Posting → Accounting entries: `1 → 2..N` (balanced; exact legs deferred to Phase 2).
- Posting → Stock events: `1 → 0..N` (non-stock transactions: 0).
- Posting → Tax outputs: `1 → 0..N`.
- Account ← Entries: `1 → N`. Item+Location ← Stock events: `1 → N`.
- Receivable/Payable views ← Invoices + Applications: derived `N+M → view` (no stored FK; derivation defined in Phase 9).

## 6. Audit / Sync / Integration

- Source Transaction → Audit Events: `1 → N` over its life (post/convert/reverse/cancel/correct/conflict).
- Permission/Period/Master events → Audit: standalone `0..1 → N` (not always transaction-bound, but company-bound).
- Source → Outbox: `1 → 1` logical (retries share the same key).
- Source → Conflicts: `1 → 0..N`.
- Import Batch → Rows: `1 → N`; Row → Source Transaction: `0..1 → 1` (only accepted rows).
- Export Snapshot → Sources: `1 → N` (read-only refs).

## 7. What was deliberately not added

No `Branch` entity (use Location grouping; see `23`), no `Discount/Promotion` entity (line/bill attributes of Invoice, engine-defined in Phase 5/7), no `Price List` entity (deferred pricing policy, not truth), no `Tax Rate` entity (rule tables deferred to Phase 4), no `Notification` entity (UX concern, not domain).
