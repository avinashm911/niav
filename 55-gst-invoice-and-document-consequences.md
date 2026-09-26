# NiavERP — GST Invoice and Document Consequences (Conceptual Boundary)

> Phase 4. GST attaches to shared lineage; creates no parallel identity. Workflows deferred to Phase 7/8.

## Canonical attachment

```
Source durable ID → transaction/voucher identity → GST determination (ID + inputs + config version)
→ GST tax lines (per source line × component) → sibling consequences (accounting/inventory/payments via their owners) → audit
```

- Determination ID is stable per (source version): redeterminations (reversal/correction path) mint new determination IDs linked to predecessors, never edit posted lines.
- Preserved per consequence set: source + document + determination IDs; classification inputs verbatim; config/version ref; taxable values; components + results; actor/device/company; business date + client/server timestamps + statutory-period tag; correction/reversal links.
- No sales/purchase invoice logic, no challan-conversion tax timing beyond lineage preservation (`19` + `43` row shapes carry the quantity side; tax side binds at the invoice determination per later-phase policy — timing matrix deferred to Phase 6/7, requirement locked: lineage must connect challan refs through to invoice tax lines).
