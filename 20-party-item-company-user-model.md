# NiavERP — Party / Item / Company / User Model (Conceptual)

> Phase 1. Resolves overlapping Phase 0 terminology. Unresolved items → `23-phase-1-decisions.md`.

## 1. Organisation → Company → Location

- **Organisation** is login/membership scope only (a user with two shops sees two Companies). It owns no books.
- **Company** is the tenant: books, series, masters, transactions, audit all scoped here.
- **Location** lives inside a Company (`Company 1 → N Locations`). **Warehouse** is a Location subtype (storage semantics), not a parallel entity.
- **Branch:** do not model as distinct in Phase 1. If owner language says “Branch / Dukaan 2”, represent as Location (+ optional grouping label deferred to Phase 10/16). Rationale: avoids a second accounting boundary contradicting V1 single-ledger-per-company scope. Recorded as deferred terminology in `23`.

## 2. User → Membership → Role → Permission

- **User** is global identity (Supabase Auth). **Membership** binds User ↔ Company with Roles.
- **Role** bundles Permissions; **Permission** is the single evaluable grant, always `(company, action)` scoped, server-enforced.
- Switching Company switches Membership → Roles → data scope atomically. History references grant-at-time, so later revocation never rewrites past audit validity.
- Baseline roles (Owner/Accountant/Biller/Viewer) remain conceptual; exact matrix deferred to Phase 16 (admin) with Phase 1 lineage hooks (actor + role-at-time in every audit).

## 3. Party (Customer / Supplier as roles)

- Single **Party** identity per Company. **Customer** and **Supplier** are role views on Party, not separate entities — a kirana supplier who also buys is one Party with two roles.
- GSTIN, phones, addresses are attributes. Identity is the stable Party ID; dedupe/merge preserves history via `absorbed → surviving` link, postings keep original ref + resolution.
- Balances are never Party fields; Receivables/Payables derive them.

## 4. Item (Group / Unit / Tax hook)

- **Item** is goods identity. **Item Group** is browse/report grouping only (never drives tax/stock). **Unit** is measure with per-Item governed conversions (no per-transaction unit invention).
- **Tax Category** is a hook consumed by the Tax Engine; it carries no rates in Phase 1. Rate tables, HSN handling, place-of-supply matrix deferred to Phase 4 (see `23`).
- Barcodes are aliases to Item, not identity. Price lists are deferred policy (not truth); posted lines freeze values-as-posted.

## 5. Cross-links (conceptual)

- Transaction → Company (scope), → Party (0..1), → Location (occurrence), → Lines → Item (+ unit/qty/value-as-intended).
- Membership/Role checks gate every Engine transition; failures reject with owner-understandable reasons + audit where consequential.
- No direct User → Party or User → Item ownership; users act *in* a company upon masters, they never own master rows personally.
