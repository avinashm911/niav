// In-memory store enforcing Phase 5 orchestration semantics for tests and
// later persistence adapters: company scope, idempotency by source ID,
// atomic fan-out (validate-all-before-commit), server numbering, audit.
import { buildEntry, type Account, type JournalEntry, type Period } from "./accounting.js";
import { DomainError } from "./errors.js";
import { buildMovement, onHand, type MovementType, type StockMovement } from "./inventory.js";
import { determineGst, type GstConfigVersion, type GstDetermination, type SupplyClass } from "./gst.js";
import type { Actor, BusinessDate, CompanyId, ItemId, LocationId, Paise, PartyId, PostingId, SourceId, Timestamp } from "./primitives.js";
import { newId } from "./primitives.js";
import type { Company, Item, Location, Party } from "./masters.js";

export interface PostedBundle {
  postingId: PostingId;
  sourceId: SourceId;
  voucherNo: string;
  entries: JournalEntry[];
  movements: StockMovement[];
  determinations: GstDetermination[];
  audits: AuditEvent[];
}

export interface AuditEvent {
  id: string;
  companyId: CompanyId;
  sourceId: SourceId;
  kind: string;
  actor: Actor;
  createdAt: Timestamp;
  detail: Record<string, unknown>;
}

export interface PostIntent {
  companyId: CompanyId;
  sourceId: SourceId;
  series: string;
  businessDate: BusinessDate;
  actor: Actor;
  now: Timestamp;
  period: Period;
  accountLegs?: Array<{ account: Account; debit: Paise; credit: Paise }>;
  isOpening?: boolean;
  stockIntents?: Array<{
    type: MovementType;
    direction: "IN" | "OUT";
    qtyMinor: number;
    item: Item;
    location: Location;
    reason?: string | null;
    reversalOf?: string | null;
    transferId?: string | null;
    originalDirection?: "IN" | "OUT";
  }>;
  gstIntents?: Array<{
    supplyClass: SupplyClass;
    intraState: boolean;
    utTerritory?: boolean;
    cessBps?: number;
    rateRef: string;
    taxablePaise: number;
    config: GstConfigVersion;
  }>;
  paymentHook?: { kind: string; ref: string } | null;
  kachaRefs?: Array<{ sourceId: SourceId; lineId: string; qtyMinor: number }> | null;
  auditKind?: string;
}

export class Store {
  companies = new Map<CompanyId, Company>();
  parties = new Map<string, Party>();
  items = new Map<string, Item>();
  locations = new Map<string, Location>();
  accounts = new Map<string, Account>();
  periods = new Map<string, Period>();
  entries: JournalEntry[] = [];
  movements: StockMovement[] = [];
  determinations: GstDetermination[] = [];
  audits: AuditEvent[] = [];
  seenSources = new Map<SourceId, PostedBundle>();
  seriesCounters = new Map<string, number>();
  reversed = new Set<string>(); // entry/movement/determination ids already reversed

  reset(): void {
    this.companies.clear(); this.parties.clear(); this.items.clear(); this.locations.clear();
    this.accounts.clear(); this.periods.clear();
    this.entries = []; this.movements = []; this.determinations = []; this.audits = [];
    this.seenSources.clear(); this.seriesCounters.clear(); this.reversed.clear();
  }

  audit(companyId: CompanyId, sourceId: SourceId, kind: string, actor: Actor, now: Timestamp, detail: Record<string, unknown> = {}): AuditEvent {
    const e: AuditEvent = { id: newId("aud"), companyId, sourceId, kind, actor, createdAt: now, detail };
    this.audits.push(e);
    return e;
  }

  /** Atomic post: validate everything, then commit all-or-none. Idempotent by sourceId. */
  post(intent: PostIntent): PostedBundle {
    const existing = this.seenSources.get(intent.sourceId);
    if (existing) {
      this.audit(intent.companyId, intent.sourceId, "replay-dedupe", intent.actor, intent.now, { postingId: existing.postingId });
      return existing;
    }
    const company = this.companies.get(intent.companyId);
    if (!company || !company.active) throw new DomainError("INVALID_COMPANY_CONTEXT", "Unknown/inactive company");
    if (intent.actor.companyId !== intent.companyId) throw new DomainError("INVALID_COMPANY_CONTEXT", "Actor/company mismatch");
    if (intent.actor.role === "viewer") throw new DomainError("UNAUTHORIZED", "Viewers cannot post");
    if (intent.period.companyId !== intent.companyId) throw new DomainError("INVALID_COMPANY_CONTEXT", "Period/company mismatch");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(intent.businessDate)) throw new DomainError("INVALID_DATE", "Business date must be YYYY-MM-DD");

    // Build (validate) all siblings before committing anything.
    const postingId = newId("post");
    const entries: JournalEntry[] = [];
    if (intent.accountLegs?.length) {
      entries.push(
        buildEntry({
          companyId: intent.companyId, sourceId: intent.sourceId, postingId,
          businessDate: intent.businessDate, period: intent.period, legs: intent.accountLegs,
          isOpening: intent.isOpening, actor: intent.actor, now: intent.now,
        }),
      );
    }
    const movements: StockMovement[] = [];
    // Pre-check availability for OUT legs (DENY-negatives) incl. intra-bundle pairing.
    const simulated = [...this.movements];
    for (const s of intent.stockIntents ?? []) {
      if (s.item.companyId !== intent.companyId || s.location.companyId !== intent.companyId) {
        throw new DomainError("INVALID_COMPANY_CONTEXT", "Stock item/location company mismatch");
      }
      const mv = buildMovement(
        {
          companyId: intent.companyId, sourceId: intent.sourceId, postingId,
          type: s.type, direction: s.direction, qtyMinor: s.qtyMinor,
          item: s.item, location: s.location, businessDate: intent.businessDate,
          actor: intent.actor, now: intent.now, reason: s.reason ?? null,
          reversalOf: s.reversalOf ?? null, transferId: s.transferId ?? null,
        },
        s.originalDirection,
      );
      if (mv.direction === "OUT") {
        const avail = onHand(simulated, intent.companyId, mv.itemId, mv.locationId);
        if (avail < mv.qtyMinor) throw new DomainError("STOCK_CONFLICT", `Insufficient stock: have ${avail}, need ${mv.qtyMinor}`);
      }
      simulated.push(mv);
      movements.push(mv);
    }
    // Transfer conservation within bundle: per transferId, OUT == IN per item.
    const byTransfer = new Map<string, { out: number; in: number }>();
    for (const m of movements) {
      if (!m.transferId) continue;
      const e = byTransfer.get(m.transferId) ?? { out: 0, in: 0 };
      if (m.direction === "OUT") e.out += m.qtyMinor; else e.in += m.qtyMinor;
      byTransfer.set(m.transferId, e);
    }
    for (const [tid, t] of byTransfer) {
      if (t.out !== t.in || t.out === 0) throw new DomainError("INVENTORY_VALIDATION_FAILED", `Transfer ${tid} must balance OUT==IN`);
    }
    const determinations: GstDetermination[] = [];
    for (const g of intent.gstIntents ?? []) {
      determinations.push(determineGst({ companyId: intent.companyId, ...g, businessDate: intent.businessDate, config: g.config }, intent.sourceId, intent.actor, intent.now));
    }

    // Commit: number + rows + audit (all-or-none reached here).
    const key = `${intent.companyId}:${intent.series}`;
    const n = (this.seriesCounters.get(key) ?? 0) + 1;
    this.seriesCounters.set(key, n);
    const voucherNo = `${intent.series}-${String(n).padStart(4, "0")}`;
    this.entries.push(...entries);
    this.movements.push(...movements);
    this.determinations.push(...determinations);
    const audits = [
      this.audit(intent.companyId, intent.sourceId, intent.auditKind ?? "post", intent.actor, intent.now, {
        postingId, voucherNo, series: intent.series, entries: entries.map((e) => e.id),
        movements: movements.map((m) => m.id), determinations: determinations.map((d) => d.id),
        kachaRefs: intent.kachaRefs ?? [], paymentHook: intent.paymentHook ?? null,
      }),
    ];
    const bundle: PostedBundle = { postingId, sourceId: intent.sourceId, voucherNo, entries, movements, determinations, audits };
    this.seenSources.set(intent.sourceId, bundle);
    return bundle;
  }

  reverseEntry(entryId: string, actor: Actor, now: Timestamp, period: Period, businessDate: BusinessDate): PostedBundle {
    const orig = this.entries.find((e) => e.id === entryId);
    if (!orig) throw new DomainError("INVALID_SOURCE", "Original entry not found");
    if (this.reversed.has(entryId)) throw new DomainError("INVALID_LIFECYCLE_TRANSITION", "Already reversed");
    const legs = orig.legs.map((l) => ({
      account: this.accounts.get(l.accountId)!,
      debit: l.credit,
      credit: l.debit,
    }));
    const bundle = this.post({
      companyId: orig.companyId, sourceId: newId("src"), series: "REV",
      businessDate, actor, now, period, accountLegs: legs, auditKind: "reverse",
    });
    this.reversed.add(entryId);
    this.audit(orig.companyId, bundle.sourceId, "reverse-link", actor, now, { reverses: entryId, reversalEntry: bundle.entries[0]?.id });
    return bundle;
  }

  balanceOf(accountId: string): number {
    let dr = 0;
    let cr = 0;
    for (const e of this.entries) for (const l of e.legs) if (l.accountId === accountId) { dr += l.debit; cr += l.credit; }
    return dr - cr; // debit-positive convention for tests
  }

  outstandingFor(partyAccountId: string): number {
    return this.balanceOf(partyAccountId);
  }
}

export type { PartyId, ItemId, LocationId };
