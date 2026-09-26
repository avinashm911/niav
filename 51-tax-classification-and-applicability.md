# NiavERP — Tax Classification and Applicability (Conceptual Pipeline)

> Phase 4. Deterministic pipeline from explicit inputs. Default-deny on ambiguity; no UI-typed tax as truth; no evasion paths.

## Pipeline (each stage explicit, auditable, versioned)

```
Source facts (lines: item + HSN/SAC hook + tax category + qty/unit/values; parties + registrations; locations; business date; challan refs where converted)
→ supply classification (taxable / exempt / nil-rated / non-GST / zero-rated; RCM flag; composition-eligibility flag)
→ tax applicability (applies? which regime hooks? blocked by status?)
→ place-of-supply / jurisdiction structure (intra-pair incl. UT variant vs inter-single + cess eligibility)
→ taxable-value determination (per 52)
→ component determination (rate-refs from effective configuration)
→ tax lines (immutable, per 53) → sibling consequences via their owners (accounting/inventory/payments)
```

## Rules

1. **Deterministic:** identical inputs + classification + configuration version → identical outcome. No hidden UI state, no locale/time-dependent branching, no silent defaults.
2. **No manual tax as truth:** a typed tax amount may arrive as a *check hint* only; the determination recomputes authoritatively. Any override concept defaults DENY and (if a future phase ever permits a narrow class) would require allowed-case + actor + reason + recomputation + audit + preserved inputs — none permitted in Phase 4.
3. **Ambiguity default:** unresolved classification (missing HSN hook, missing jurisdiction input, unknown config coverage, composition/RCM uncertainty) must NOT silently default to a liability outcome. It rejects (or routes to explicit review per later workflow) with reason + audit. Silent nil/non-tax defaults are forbidden (invariant 20).
4. **RCM:** where classified, liability direction flips to recipient; supplier-side document treatment and recipient-side accounting/payment hooks are downstream consequences owned there — the engine outputs applicability + direction + rate-refs only. No universal RCM schedule invented.
5. **Special place-of-supply rules:** only the general goods-movement hook is assumed as configuration surface; all special rules (services, e-commerce, job-work, Bill-to/Ship-to splits, SEZ, etc.) are explicit plug-in points for later configuration — listed as deferred in `62`, never half-implemented here.
6. **Anti-evasion:** no “no-tax” flags, no suppressible lines, no editable posted lines, no dual classification views. Exempt/nil/non-GST/zero each require positive classification evidence, never the absence of data.
