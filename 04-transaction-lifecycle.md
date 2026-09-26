# NiavERP — Transaction Lifecycle (Conceptual)

> Phase 0. No implementation. Defines the only lawful path from intent to books.

## 1. Canonical Stages

```
Source transaction
→ validation
→ transaction posting
→ accounting consequence
→ inventory consequence
→ tax consequence
→ payment consequence (when applicable)
→ audit event
→ reporting (derived)
→ synchronisation
```

Every money/stock/tax effect must traverse this chain. No bypass.

## 2. Source Transaction

- The business intent: sale, purchase, challan, return, payment, adjustment, conversion.
- Carries: durable ID (client UUID at creation, offline-safe), company, type, series/number intent, party/item/quantity/value facts, actor/device, timestamps, idempotency key.
- Immutable identity: the ID never changes across sync, conversion, or reporting. Conversions create new transactions that reference it; they do not rewrite it.

## 3. Validation

- Structural (required facts present), master (party/item/company exist and are active), policy (permissions, period open, series valid, stock policy, Kacha/Pakka rules), and consistency (totals tie, references resolve).
- Validation is server-authoritative. Client pre-checks are UX only.
- Failure → rejection with owner-understandable reason; nothing posts partially.

## 4. Transaction Posting

- Posting is the atomic commit boundary: either all consequences (accounting + inventory + tax + audit links) are created and linked, or none are.
- Assigns final voucher number per series (server authority to prevent multi-biller duplicates).
- Sets document status (see §5). Posted effects are immutable; later changes are new linked events.

## 5. Document Status (Conceptual)

- `draft` (local only, not posted) → `pending_sync` (queued) → `posted` → terminal overlays: `reversed`, `cancelled`, `corrected_by`, `converted (partial/full)`.
- Status is derived from posted events, not a free-text flag. Challan conversion updates conversion state, never deletes the challan.

## 6. Consequences

- **Accounting:** balanced debit/credit entries with `source_transaction_id`. Single writer: engine.
- **Inventory:** stock events (in/out/transfer) with item/location/quantity + source link. Balances derived.
- **Tax:** tax engine output (amounts + rule version) linked to source lines. UI never computes.
- **Payment:** application links (payment ↔ invoice, advance handling) as separate linked transactions.
- All consequences carry the source ID so source → accounting → inventory → tax → reports is traversable.

## 7. Reversal / Cancellation / Correction

- **Reversal:** new transaction that neutralises accounting/inventory/tax effects of a posted transaction; source remains, linked both ways; reason required.
- **Cancellation:** allowed only per policy (e.g., draft, unconverted challan, unpaid draft invoice per future rules); if consequences already posted, cancellation is implemented as reversal, not deletion.
- **Correction:** reversal + re-issue or corrective transaction with link; never in-place edit of posted consequences.
- All three emit audit events with actor/reason/before-after.

## 8. Audit Trail

- Every stage transition that matters (post, convert, reverse, cancel, correct, conflict-resolve) emits an append-only audit event.
- Offline actions are audited locally with durable IDs and re-anchored with server timestamps on sync.

## 9. Offline Creation

- Created offline with durable UUID + queued in outbox; UI marks `pending_sync`.
- Numbering is provisional until server posting assigns final series number (prevents duplicates across billers).
- Server re-validates, enforces idempotency (same ID → same result, no double post).

## 10. Synchronisation

- Push (idempotent submit) → server validate/post → pull (consequences, numbers, statuses).
- Conflicts resolved by server authority with explicit conflict records; client never silently overwrites.
- Reports only reflect posted server truth + acknowledged local queue state shown separately.

## 11. What Is Forbidden

- Posting ledger/stock/tax rows without a source transaction.
- Editing posted consequences in place.
- Deleting a source to hide a sale, suppress tax, or rewrite history.
- Client-assigned final voucher numbers in multi-biller operation.
