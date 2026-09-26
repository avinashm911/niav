# NiavERP — Sales Consequence Orchestration (Boundary Contract)

> Phase 7. Boundary contract only; detailed legs/rates/movements stay in owning phases.

## Map (canonical order; atomic boundary per 66)

`Sales source → Engine (validation per 65 + numbering per 64) → Accounting (revenue/receivable legs on determined values; balance rule; period binding) → Inventory (issue-class movements for direct sales; converted invoices post NO movement — delivery already moved at Kacha time) → GST (determination + lines on commercial + jurisdiction inputs; config version pinned) → Payment/application (fact + links where declared; advances = zero-application) → Audit (post + sibling refs + links) → derived reads (registers/outstanding/summaries)`.

## Per-consequence contract (owner / input / output / timing / atomicity / failure / lineage / reversal / correction)

- Accounting (`24–28`,`30–32` own): input determined values + accounts-by-policy; output balanced entry; timing at post; atomic-required; failure fails whole post; lineage source/posting/entry; reversal neutralising entry, correction reversal + replacement.
- Inventory (`37–43` own): input qty/unit/location + eligibility; output IN/OUT rows (issue-class for direct sales; delivery-class for Kacha) + derived balances; timing at post (converted invoices post no rows — single delivery effect at Kacha); failure fails whole post; reversal compensating rows.
- GST (`49–59` own): input commercial + jurisdiction + config version; output determination + lines; timing at post (fresh per invoice incl. converted targets); failure (ambiguous/stale) fails whole post; reversal compensating lines.
- Payment (`32–33` + `99` own facts/links): input payment intents + application refs; output payment + links; timing at post or appended later (advances allowed); failure of declared payment fails whole post; reversal voids links + neutralises legs.
- Audit (`22`,`71` own log): assembled post + sibling refs + links + error/sync records. Derived reads owned by deriving domains; never written by Sales/Engine.
