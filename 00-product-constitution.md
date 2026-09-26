# NiavERP — Product Constitution

> Phase 0 — Product Constitution & Architecture Foundation
> Status: Foundation only. No implementation.

## 1. Product Mission

NiavERP (Bharat ERP) is a mobile-first, offline-first ERP for Indian retailers and small businesses that keeps everyday sales, stock, money, and GST records continuously correct, understandable, and reconcilable — without requiring accounting-software expertise from the business owner.

Mission statement:

> Keep the dukaan's books, stock, and compliance continuously true — even offline, even in Hindi, even with multiple billers — with every rupee, item, and tax traceable to its source.

## 2. Target Users

Primary:

- Indian retail shop owners (kirana, garments, mobile/electronics, pharmacy-adjacent retail, general trade).
- Shop staff / billers operating concurrently on multiple devices.
- Low literacy / low accounting-software familiarity users who need guided, forgiving UX in their own language.

Secondary:

- Accountants / CAs who review the books periodically.
- Migration users coming from Tally, BUSY, spreadsheets, or paper bahi-khata.
- Future: distributors / small wholesalers with challan-led sales flows.

Non-users (V1):

- Large enterprises with complex manufacturing, multi-branch consolidation, payroll/HRMS needs.
- Users seeking a tool to conceal sales, suppress invoices, or manipulate tax liability. Such use is explicitly out of scope and prohibited by design.

## 3. Product Identity

- **Name:** NiavERP
- **Positioning:** Bharat ERP — Indian retailer-first, not a generic SMB ERP translated to Hindi.
- **Form factor:** Mobile-first (Expo / React Native / TypeScript), works offline in the shop.
- **Backend:** Supabase / PostgreSQL / Supabase Auth, with server-side enforcement for money, stock, tax, and permissions.
- **Character:** Simple on the surface, strict underneath. Forgiving UX; unforgiving ledger.

## 4. Three Core USPs

1. **Bharat UX — mobile-first, Hindi-first, low-literacy-ready.**
   Big-touch billing, voice/number-led flows where appropriate, Hindi + Indian-language UI, guided corrections instead of jargon. Language is presentation only.

2. **Kacha → Pakka, controlled and auditable.**
   Sales can lawfully begin as Delivery Challans (configurable Kacha / Pakka series) and convert — individually, in bulk, partially, or many-to-one — into GST invoices with full lineage, stock continuity, and audit history. Source documents are never destroyed.

3. **Self-Service Compliance — always-ready books.**
   Accounting, inventory, GST data, and reconciliations are maintained continuously by the central transaction engine so routine compliance and CA review are fast and understandable. The product automates routine bookkeeping; it does not replace professional CA / tax-advisor review.

## 5. Strategic Pillars

1. Bharat ERP (mobile-first, Indian-language UX for low-familiarity users).
2. Kacha → Pakka lawful challan-to-invoice lifecycle.
3. Self-Service Compliance (continuously reconciled, understandable).
4. Mobile-first / offline-first operation.
5. Multi-user / multi-device concurrency without corruption.
6. GST-aware accounting from a central tax engine.
7. Inventory and stock control derived from transactions.
8. Tally interoperability via adapter.
9. BUSY interoperability via adapter.
10. Migration / onboarding capability (import, validate, go-live).

## 6. Engineering Principles

1. No business feature bypasses the central transaction engine.
2. Financial truth is stored as immutable transaction events, never only as mutable balances.
3. Stock is derived from stock-affecting transactions/events.
4. GST comes only from a central tax engine; UI never computes tax.
5. Kacha/Pakka remains controlled, numbered, and auditable.
6. Conversion never destroys the source document.
7. Language never enters business logic (keys/codes in English; display strings localised).
8. Every offline transaction gets a durable client-generated identifier (UUID v4 or equivalent) at creation.
9. Sync is idempotent; retries never create duplicates.
10. Accounting, inventory, and tax consequences of one transaction remain linked.
11. Statutory calculations are deterministic and auditable (same input → same output + rule version).
12. Tally/BUSY mappings live in adapters; core never imports external formats.
13. Important modifications create audit history (who/when/before/after/reason).
14. Security-sensitive permissions are enforced server-side, never only in the app.
15. Concurrent billers must not produce duplicate or corrupt transactions (idempotency + server constraints).
16. No fake production functionality, no placeholder logic presented as real.
17. No duplicated business logic between frontend and backend; single authority per rule.
18. No hardcoded GST rules or integration mappings in UI components.
19. Preserve lineage: source → accounting → inventory → tax → reports.
20. Prefer correctness and auditability over premature optimisation.

## 7. Data Integrity Principles

- Single transaction engine is the only writer of accounting/inventory/tax consequences.
- Balances and stock-on-hand are derived views; the event log is the truth.
- Every consequential record carries `source_transaction_id` + lineage chain.
- Reversal/correction create new linked events; they never edit history in place.
- Document identity is stable across offline creation, sync, conversion, and reporting.
- Server is authoritative on conflicts; client never silently overwrites server truth.

## 8. Compliance Principles

- The system maintains GST-relevant facts continuously (supplies, parties, taxes, values) so returns and reconciliations are derivations, not month-end reconstruction.
- Routine bookkeeping/reconciliation/reporting is automated where the rule is deterministic.
- The product explains compliance in owner-understandable language.
- The product **does not claim** that CA / tax-advisor review is universally unnecessary. Complex cases, notices, and filing decisions still require professional review.
- The design must never facilitate tax evasion, fabricated transactions, false records, concealment, or manipulation of tax liability. Kacha/Pakka controls exist to prevent this.
- Statutory logic is versioned; historical transactions reference the rule version used.

## 9. Security Principles

- Supabase Auth for identity; tenant (company) isolation on every query.
- Role-based access (owner / accountant / biller / viewer minimum model; exact roles deferred to Phase 1).
- Server-side (PostgreSQL RLS / RPC / Edge Function) enforcement for financial writes, permission checks, and company isolation.
- Offline permissions are cached grants, not new rights; server re-validates on sync.
- Devices/sessions are identifiable for audit; sensitive operations record actor + device + time.
- Secrets and keys never live in the mobile bundle as authorisation.

## 10. Auditability Principles

- Append-only audit trail for: create, post, convert, reverse, cancel, correct, permission change, sync conflict resolution.
- Audit event captures: actor, role, device/session, timestamp (client + server), before/after, reason, lineage links.
- Source documents remain retrievable after conversion/cancellation.
- Reports are reproducible from the event log + rule version.
- No silent overwrites of source transactions.

## 11. What This Constitution Forbids

- Shadow / untracked sales paths outside the transaction engine.
- Deleting or overwriting a challan/invoice to hide a sale.
- Dual books (one for tax, one for owner).
- UI-computed GST, discounts-as-tax-adjustments, or hardcoded HSN/slab logic in screens.
- Core code that parses Tally/BUSY formats directly.
- Claiming the software replaces a CA.

## 12. Constitution Authority

This document is the tie-breaker. If a later design, shortcut, or feature request conflicts with it, the constitution wins. Amendments require explicit review and a Phase 0–level update, not a silent edit.
