# NiavERP — GST Components and Tax Lines (Conceptual)

> Phase 4. Structural roles + posted-line discipline. No rates hardcoded.

## 1. Component roles

- Intra-state: exactly `CGST + SGST`, except where jurisdiction is a no-legislature UT → exactly `CGST + UTGST`. Inter-state: exactly `IGST` alone. Cess-role (where configured) may append to either structure as additional line(s) on its own base; never as a substitute for a missing main component.
- Rate-refs and bases resolve per line from effective configuration; amounts follow the `52` trace with explicit rounding refs.

## 2. Tax Line (posted, immutable)

- One row per (source line × component role): component identity, rate-ref (+ config version), taxable basis, calculated amount, rounding ref, jurisdiction + registration refs, determination ID. Posted once via Engine fan-out alongside accounting/inventory siblings; never edited/deleted; corrections via new lines (`56`).
- Structural validation rejects: both intra-pair and IGST on one determination; SGST+UTGST together; duplicate component roles per source line; cess without a main structure; components on non-taxable classifications (exempt/nil/non-GST carry classification, no amount lines; zero-rated carries zero-amount lines with classification evidence — distinction locked here, mechanics of credit/refund deferred).

## 3. Why this prevents contradictions

Structure is chosen once per determination from jurisdiction inputs (`50§4`); line-level validation enforces the chosen structure’s exact shape. Mixed-structure submissions fail closed with reasons, satisfying invariant 10 without knowing any rate.
