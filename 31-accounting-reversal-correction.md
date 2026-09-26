# NiavERP — Accounting Reversal / Correction (Conceptual)

> Phase 2. Additive, balanced, linked. No in-place edits. Covers money legs; stock/tax neutralisation owned by their domains on the same Reversal posting.

## 1. Cancellation before posting

- Draft / pending_sync sources may be cancelled per policy (reason + audit, source retained). No Entry exists, so no accounting reversal needed. Cancelled IDs must never be recycled into new postings.

## 2. Reversal after posting

- New Reversal Source → new Posting → new balanced Entry that neutralises the original money effect leg-for-leg (each original Dr matched by a reversal Cr and vice versa), with `reversal_of` leg links + `reverses` entry link.
- Original Entry/Legs untouched. Derived balances reflect net zero for that chain. Reason + permission required; period eligibility evaluated on reversal business date (not original date).
- Duplicate reversal of the same Entry rejected (one active reversal chain per original unless Correction supersedes — see §3).

## 3. Correction after posting

- Pattern: Reversal Entry (neutralise) + Replacement Entry (corrected facts) as two postings in one corrective action (shared action ID), or a single corrective Entry explicitly linked as `corrects` where policy allows net-difference legs — mechanics choice deferred to implementation guidance, but lineage must show both `reverses` and `corrects/corrected_by` links with reasons.
- Corrected originals gain `corrected` overlay; replacements carry full lineage (original source + reason + actor + period). No net-difference edit on the original row.

## 4. Duplicate prevention + source preservation

- Reversal/correction postings share the idempotency discipline of all postings (key = new source ID; replays converge). Attempting to re-post the original source ID after posting returns original refs, never a duplicate Entry.
- Originals remain queryable for audit/history/returns; reports show gross + net where relevant (presentation deferred).

## 5. Period interaction

- Reversals/corrections post into the period of their own business date (usually current open period), never by editing the original period’s rows. Cross-period correction labelling (which period’s reports restate) is a reporting concern deferred to Phase 13, not a posting edit.
