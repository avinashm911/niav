# NiavERP — Journal and Posting Model (Conceptual)

> Phase 2. Balance rule, leg policy, posting flow, atomicity, timestamps. No code, no schema.

## 1. Debit / credit model

- **Leg:** one account + exactly one of (debit amount | credit amount), never both, never neither. Amounts are non-negative; zero-amount legs forbidden on posted entries (dust legs are rejected at validation).
- **Negative amounts:** forbidden on posted legs. Reductions are expressed by opposite-side legs or reversal entries, never negative values.
- **Currency:** single functional currency (INR) assumed for V1 postings; multi-currency presentation/settlement deferred (see `36`). No FX gains/losses modelled in Phase 2.
- **Precision:** amounts are exact decimal money (no binary float). Scale/rounding policy deferred to implementation guidance, but conceptually: validation compares exact sums; rounding, if ever required by statute, is an explicit audited leg, never silent truncation.
- **Balance rule:** per Journal Entry, `SUM(debits) = SUM(credits)` exactly. Unbalanced intents are rejected pre-post with owner-understandable reason; nothing posts partially.

## 2. Posting flow (conceptual)

```
Source Transaction (durable ID + business date + company + actor/device + lines-as-intended)
→ validation (masters, grants, series, period, balance rule on proposed legs, remaining/policy where relevant)
→ posting request (idempotency key = source ID; batch ID where grouped)
→ accounting consequence (balanced Journal Entry + Legs, period resolved from business date)
→ audit (posting + entry + leg refs + actor + client/server/business timestamps + reason where required)
```

- **Posting identity:** stable per source (1↔1 base model). **Batch** groups members; each member still balances independently.
- **Business date** (owner’s transaction date; drives period + reports) vs **system timestamp** (server commit time; drives ordering/audit) vs **client/offline timestamp** (device creation time; drives sync/UX). All three retained; never conflated (see §3).
- **Actor/Company/Period** bound at posting and frozen in lineage; later grant/period/chart changes do not rewrite them.

## 3. Timestamp semantics

| Stamp | Set by | Meaning | Used for |
|---|---|---|---|
| Business date | Owner (transaction) | Commercial date of the sale/payment | Period resolution, reports, ageing |
| Client timestamp | Device | Local creation moment (offline-safe) | Sync ordering, UX queue, conflict explanation |
| System timestamp | Server | Commit moment of Posting | Audit order, idempotent replay dedupe, conflict authority |

Backdated business dates allowed only into open periods per `28`; system/client stamps never determine period.

## 4. Posting atomicity (conceptual behaviour)

- **Success:** validated + balanced + period-open + idempotency-new → exactly one Entry + Legs + audit, final voucher number assigned.
- **Failure:** any check fails → no Entry, no Legs, no number consumed as final (provisional displays discarded), rejection with reason + audit where consequential (e.g., closed-period attempts).
- **Retry:** same source ID resubmitted → same outcome, no second Entry (idempotent replay returns original refs).
- **Duplicate request:** concurrent same-ID posts converge to one winner via server authority; losers receive original refs, never new entries.
- **Offline sync:** queued intents post on arrival under then-current validation (period/grants may have changed) — rejection surfaces with correction path, never silent posting into a wrong period.
- **Reversal/correction:** new postings with links (see `31`); originals untouched; atomicity applies per new posting identically.
