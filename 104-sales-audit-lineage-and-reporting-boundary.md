# NiavERP — Sales Audit, Lineage and Reporting Boundary (Conceptual)

> Phase 7. Complete traversability; reports read-only with hooks only.

## Traversal (both directions, locked)

`Sales source → invoice (+lines) → Kacha ancestors + conversion actions (where converted) → transaction/voucher/posting → accounting entry/legs → inventory movements → GST determination/lines → payments/applications → returns/corrections/reversals → audit events → sync/conflict outcomes`. Converted paths additionally traverse Kacha→conversion→Pakka with snapshot-vs-applied + recomputation refs.

## Minimum audit facts (per sales event)

Source/transaction/voucher/action IDs + Kacha refs (where applicable) + company + actor/role-at-time/device + client/server stamps + business date + lifecycle transition + requested/accepted quantities + commercial snapshot refs + sibling consequence IDs (entry/movements/determination/applications) + reversal/correction/return links + reason (return/correct/reverse/rate-gated cases) + error/conflict/replay identity. Consequential rejections/conflicts/dedupes audited; UX pre-checks are not.

## Reporting hooks (requirements only, no implementation, no statutory returns)

Registers (sales/invoice/return), outstanding (customer/ageing surface → Phase 9 buckets), by-item/by-customer/by-date folds, tax-summary hook (from GST lines), payment-summary hook (from applications), Kacha-origin trace (converted vs direct split). All are pure folds over posted siblings + links + versions; no reporting truth, no separate balances, no return-filing logic.
