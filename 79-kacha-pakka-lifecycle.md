# NiavERP — Kacha → Pakka Lifecycle (Conceptual)

> Phase 6. Three axes preserved (`17`); conversion is additive. No workflows beyond conversion.

## Kacha lifecycle (Axis A: draft → pending_sync → posted + overlays cancelled/reversed/corrected)

- Created (durable ID) → queued → posted (numbered, consequences per §85, audited). Pre-post cancel: reason + audit, no consequences, ID retired. Post-post changes only via reversal/correction chains.

## Conversion state (Axis B, challans only: not_converted → partially_converted → fully_converted)

- Derived per line (`remaining = delivered − converted`) then rolled up: all-zero remaining = fully; some-converted-some-open = partial; none = not. Updated only by accepted conversions/reversals/corrections through the Engine; never manual flag edits.

## Correction linkage (Axis C)

- `converted_from/converted_to`, `reverses/reversed_by`, `corrects/corrected_by`, shared conversion/correction action IDs. Links explain axes; never replace history.

## Pakka target lifecycle

- The Pakka invoice is an ordinary posted transaction (draft → pending_sync → posted + overlays) whose lines carry Kacha source refs. Its own reversal/correction follows `69` + domain sibling rules; convertibility restoration on the Kacha side happens only via engine-mediated state recalculation (§86), never direct edits.

##kk Constitutional guard (locked)

Kacha existence/lineage/audit can never be hidden, deleted, or “moved into” the Pakka. Any reading of Kacha as “not yet recorded / not in accounts / safe to hide” is a design violation. Kacha’s downstream money/tax effects differ by document type and phase policy (§85), but its record is complete and permanent from posting.
