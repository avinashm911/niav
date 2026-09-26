// Kacha → Pakka conversion over the Store (Phase 6 rules + global correction).
// LOCKED RULE: Kacha / Delivery Challan is physical delivery — creation posts
// ONE inventory OUT movement per line and NO accounting/GST. A later invoice
// consumes Kacha quantity and posts accounting/GST with NO further movement.
// Remaining is derived (delivered − accepted converted). DENY rate edits.
import { DomainError } from "./errors.js";
import type { Store } from "./store.js";
import type { Actor, BusinessDate, CompanyId, SourceId, Timestamp } from "./primitives.js";
import { newId } from "./primitives.js";
import type { GstConfigVersion } from "./gst.js";
import type { Period } from "./accounting.js";
import type { Item, Location } from "./masters.js";

export interface KachaLine {
  id: string;
  itemId: string;
  locationId: string;
  qtyMinor: number;
  ratePaise: number; // snapshot
}

export interface KachaDoc {
  sourceId: SourceId;
  companyId: CompanyId;
  partyId: string;
  lines: KachaLine[];
}

export interface ConversionRequest {
  companyId: CompanyId;
  sources: Array<{ kacha: KachaDoc; lineId: string; qtyMinor: number }>;
  actionId: string; // idempotency key for the conversion action
  actor: Actor;
  now: Timestamp;
  businessDate: BusinessDate;
  period: Period;
  series: string; // invoice series
  accounts: { debitId: string; creditId: string };
  unitPricePaise: number; // must equal snapshot (DENY edits)
  gst: { rateRef: string; config: GstConfigVersion; intraState: boolean };
  locationId: string;
}

export class KachaRegistry {
  docs = new Map<SourceId, KachaDoc>();
  // accepted converted qty per (source,line), minus reversals, maintained additively
  converted = new Map<string, number>();
  reversedActions = new Set<string>();
  actionToRefs = new Map<string, Array<{ sourceId: SourceId; lineId: string; qtyMinor: number }>>();

  register(doc: KachaDoc): void {
    this.docs.set(doc.sourceId, doc);
  }

  /** Kacha creation: physical delivery. Posts ONE inventory OUT movement per
   *  line (type `delivery`) plus audit — and NO accounting/GST legs. The
   *  returned bundle's movements are the single physical stock effect; the
   *  later invoice must not duplicate them. */
  createDelivery(
    store: Store,
    input: {
      companyId: CompanyId;
      sourceId: SourceId;
      partyId: string;
      businessDate: BusinessDate;
      series: string;
      lines: Array<{ id?: string; item: Item; location: Location; qtyMinor: number; ratePaise: number }>;
      actor: Actor;
      now: Timestamp;
      period: Period;
    },
  ) {
    if (!input.lines.length) throw new DomainError("INVALID_SOURCE", "Kacha needs lines");
    const doc: KachaDoc = {
      sourceId: input.sourceId,
      companyId: input.companyId,
      partyId: input.partyId,
      lines: input.lines.map((l, i) => {
        if (!Number.isInteger(l.qtyMinor) || l.qtyMinor <= 0) throw new DomainError("INVALID_SOURCE", "Bad Kacha quantity");
        return { id: l.id ?? `${input.sourceId}-l${i}`, itemId: l.item.id, locationId: l.location.id, qtyMinor: l.qtyMinor, ratePaise: l.ratePaise };
      }),
    };
    const bundle = store.post({
      companyId: input.companyId,
      sourceId: input.sourceId,
      series: input.series,
      businessDate: input.businessDate,
      actor: input.actor,
      now: input.now,
      period: input.period,
      stockIntents: input.lines.map((l) => ({
        type: "delivery" as const,
        direction: "OUT" as const,
        qtyMinor: l.qtyMinor,
        item: l.item,
        location: l.location,
      })),
      auditKind: "kacha-create",
    });
    this.register(doc);
    return { doc, bundle };
  }

  remaining(sourceId: SourceId, lineId: string): number {
    const doc = this.docs.get(sourceId);
    if (!doc) throw new DomainError("INVALID_SOURCE", "Unknown Kacha source");
    const line = doc.lines.find((l) => l.id === lineId);
    if (!line) throw new DomainError("INVALID_SOURCE", "Unknown Kacha line");
    return line.qtyMinor - (this.converted.get(`${sourceId}:${lineId}`) ?? 0);
  }

  convert(store: Store, req: ConversionRequest) {
    if (this.actionToRefs.has(req.actionId)) {
      return { deduped: true as const, refs: this.actionToRefs.get(req.actionId)! };
    }
    // Eligibility + compatibility (fail closed).
    if (!req.sources.length) throw new DomainError("INVALID_SOURCE", "Empty conversion");
    const party0 = this.docs.get(req.sources[0]!.kacha.sourceId)?.partyId;
    for (const s of req.sources) {
      const doc = this.docs.get(s.kacha.sourceId);
      if (!doc || doc.companyId !== req.companyId) throw new DomainError("INVALID_COMPANY_CONTEXT", "Kacha/company mismatch");
      if (doc.partyId !== party0) throw new DomainError("INVALID_SOURCE", "Incompatible parties in many→one");
      const line = doc.lines.find((l) => l.id === s.lineId);
      if (!line) throw new DomainError("INVALID_SOURCE", "Unknown line");
      if (s.qtyMinor <= 0 || !Number.isInteger(s.qtyMinor)) throw new DomainError("INVALID_SOURCE", "Bad conversion qty");
      if (req.unitPricePaise !== line.ratePaise) throw new DomainError("INVALID_SOURCE", "Rate edit DENY: target must equal snapshot");
      if (this.remaining(s.kacha.sourceId, s.lineId) < s.qtyMinor) {
        throw new DomainError("STOCK_CONFLICT", "Over-conversion: exceeds remaining");
      }
    }
    // Post Pakka invoice through the Engine (atomic siblings).
    const totalQty = req.sources.reduce((a, s) => a + s.qtyMinor, 0);
    const taxable = totalQty * req.unitPricePaise;
    const debit = store.accounts.get(req.accounts.debitId);
    const credit = store.accounts.get(req.accounts.creditId);
    if (!debit || !credit) throw new DomainError("INVALID_MASTER_REFERENCE", "Unknown accounts");
    const bundle = store.post({
      companyId: req.companyId,
      sourceId: newId("src"),
      series: req.series,
      businessDate: req.businessDate,
      actor: req.actor,
      now: req.now,
      period: req.period,
      accountLegs: [{ account: debit, debit: taxable, credit: 0 }, { account: credit, debit: 0, credit: taxable }],
      gstIntents: [{ supplyClass: "taxable", intraState: req.gst.intraState, rateRef: req.gst.rateRef, taxablePaise: taxable, config: req.gst.config }],
      kachaRefs: req.sources.map((s) => ({ sourceId: s.kacha.sourceId, lineId: s.lineId, qtyMinor: s.qtyMinor })),
      auditKind: "convert",
    });
    const refs = req.sources.map((s) => ({ sourceId: s.kacha.sourceId, lineId: s.lineId, qtyMinor: s.qtyMinor }));
    for (const r of refs) {
      const k = `${r.sourceId}:${r.lineId}`;
      this.converted.set(k, (this.converted.get(k) ?? 0) + r.qtyMinor);
    }
    this.actionToRefs.set(req.actionId, refs);
    return { deduped: false as const, bundle, refs };
  }

  reverseAction(actionId: string): void {
    if (this.reversedActions.has(actionId)) throw new DomainError("INVALID_LIFECYCLE_TRANSITION", "Conversion already reversed");
    const refs = this.actionToRefs.get(actionId);
    if (!refs) throw new DomainError("INVALID_SOURCE", "Unknown conversion action");
    for (const r of refs) {
      const k = `${r.sourceId}:${r.lineId}`;
      this.converted.set(k, (this.converted.get(k) ?? 0) - r.qtyMinor);
    }
    this.reversedActions.add(actionId);
  }
}
