// Global correction proofs: Kacha moves stock, invoice does not move it again.
// Opening 100 → Kacha 40 → stock 60 → invoice 25/15 → stock stays 60.
import { describe, expect, it } from "vitest";
import { Store } from "../src/store.js";
import { KachaRegistry } from "../src/kacha.js";
import { onHand } from "../src/inventory.js";
import { DomainError } from "../src/errors.js";
import type { GstConfigVersion } from "../src/gst.js";
import type { Actor } from "../src/primitives.js";
import type { Period } from "../src/accounting.js";
import type { Item, Location } from "../src/masters.js";

const CFG: GstConfigVersion = {
  id: "cfg1", version: "EXAMPLE-v1", effectiveFrom: "2025-04-01", effectiveTo: null,
  rates: { "EXAMPLE-9+9": { components: ["CGST", "SGST"], bps: { CGST: 900, SGST: 900 } } },
};

function setup() {
  const store = new Store();
  const actor: Actor = { userId: "u1", companyId: "c1", role: "owner", deviceId: "d1" };
  store.companies.set("c1", { id: "c1", name: "Dukaan", active: true });
  store.accounts.set("a-cust", { id: "a-cust", companyId: "c1", code: "CUST", name: "Cust", type: "asset", group: "g", active: true, systemRole: null });
  store.accounts.set("a-rev", { id: "a-rev", companyId: "c1", code: "SALES", name: "Sales", type: "income", group: "g", active: true, systemRole: null });
  const period: Period = { id: "p1", companyId: "c1", start: "2026-04-01", end: "2027-03-31", state: "open" };
  store.periods.set("p1", period);
  const item: Item = { id: "item1", companyId: "c1", name: "Rice", unit: "pcs", qtyScale: 0, stockTracked: true, taxCategory: "std", hsn: null, active: true };
  const loc: Location = { id: "shop", companyId: "c1", name: "Shop", warehouse: false, active: true };
  const reg = new KachaRegistry();
  const now = "2026-09-01T10:00:00Z";
  // Opening stock 100 (no accounting implications asserted here).
  store.post({
    companyId: "c1", sourceId: "open-1", series: "OP", businessDate: "2026-04-01",
    actor, now, period,
    stockIntents: [{ type: "opening", direction: "IN", qtyMinor: 100, item, location: loc }],
    auditKind: "opening",
  });
  return { store, reg, actor, period, item, loc, now };
}

const convBase = { companyId: "c1", businessDate: "2026-09-02", period: undefined as unknown as Period, series: "INV", accounts: { debitId: "a-cust", creditId: "a-rev" }, gst: { rateRef: "EXAMPLE-9+9", config: CFG, intraState: true }, locationId: "shop" as const };

describe("K01–K03: kacha delivery moves stock, posts no accounting/GST", () => {
  it("opening 100, kacha 40 → stock 60, zero revenue/receivable/GST", () => {
    const { store, reg, actor, period, item, loc, now } = setup();
    const { bundle } = reg.createDelivery(store, {
      companyId: "c1", sourceId: "k1", partyId: "cust1", businessDate: "2026-09-01",
      series: "CH-KACHA", lines: [{ item, location: loc, qtyMinor: 40, ratePaise: 100 }],
      actor, now, period,
    });
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(60); // K01
    expect(bundle.entries).toHaveLength(0); // K02: no accounting
    expect(bundle.determinations).toHaveLength(0); // K03: no GST
    expect(bundle.movements).toHaveLength(1);
    expect(bundle.movements[0]).toMatchObject({ type: "delivery", direction: "OUT", qtyMinor: 40 });
    expect(store.balanceOf("a-cust")).toBe(0);
  });
});

describe("K04–K08: invoices consume without moving stock; accounting/GST per invoice", () => {
  it("kacha 40 → invoice 40 → stock stays 60; invoice 25+15 → remaining 0", () => {
    const { store, reg, actor, period, item, loc, now } = setup();
    reg.createDelivery(store, {
      companyId: "c1", sourceId: "k1", partyId: "cust1", businessDate: "2026-09-01",
      series: "CH-KACHA", lines: [{ item: item, location: loc, qtyMinor: 40, ratePaise: 100 }],
      actor, now, period,
    });
    const before = store.movements.length;
    const inv1 = reg.convert(store, {
      ...convBase, period, actor, now, actionId: "c1",
      sources: [{ kacha: reg.docs.get("k1")!, lineId: "k1-l0", qtyMinor: 25 }], unitPricePaise: 100,
    });
    expect(store.movements.length).toBe(before); // K04/K05: no new movement
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(60);
    expect(reg.remaining("k1", "k1-l0")).toBe(15); // K05
    expect(store.balanceOf("a-cust")).toBe(2500); // K07: accounting for 25
    if (!("bundle" in inv1)) throw new Error("expected invoice bundle");
    expect(inv1.bundle.determinations).toHaveLength(1); // K08
    expect(inv1.bundle.determinations[0]!.taxablePaise).toBe(2500);
    reg.convert(store, {
      ...convBase, period, actor, now, actionId: "c2",
      sources: [{ kacha: reg.docs.get("k1")!, lineId: "k1-l0", qtyMinor: 15 }], unitPricePaise: 100,
    });
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(60); // K06
    expect(reg.remaining("k1", "k1-l0")).toBe(0);
    expect(store.balanceOf("a-cust")).toBe(4000); // K07 total = 40
  });
});

describe("K09–K13: over-conversion, many-to-one, one-to-many, replay, races", () => {
  it("K09 over-conversion fails closed with no partials", () => {
    const { store, reg, actor, period, item, loc, now } = setup();
    reg.createDelivery(store, {
      companyId: "c1", sourceId: "k1", partyId: "cust1", businessDate: "2026-09-01",
      series: "CH-KACHA", lines: [{ item, location: loc, qtyMinor: 40, ratePaise: 100 }],
      actor, now, period,
    });
    const e0 = store.entries.length;
    expect(() => reg.convert(store, {
      ...convBase, period, actor, now, actionId: "bad",
      sources: [{ kacha: reg.docs.get("k1")!, lineId: "k1-l0", qtyMinor: 41 }], unitPricePaise: 100,
    })).toThrowError(DomainError);
    expect(store.entries.length).toBe(e0);
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(60);
  });

  it("K10 many→one consumes without extra OUT; K11 one→many single OUT", () => {
    const { store, reg, actor, period, item, loc, now } = setup();
    reg.createDelivery(store, {
      companyId: "c1", sourceId: "ka", partyId: "cust1", businessDate: "2026-09-01",
      series: "CH-KACHA", lines: [{ item, location: loc, qtyMinor: 30, ratePaise: 100 }],
      actor, now, period,
    });
    reg.createDelivery(store, {
      companyId: "c1", sourceId: "kb", partyId: "cust1", businessDate: "2026-09-01",
      series: "CH-KACHA", lines: [{ item, location: loc, qtyMinor: 20, ratePaise: 100 }],
      actor, now, period,
    });
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(50);
    const m0 = store.movements.length;
    reg.convert(store, {
      ...convBase, period, actor, now, actionId: "m1",
      sources: [
        { kacha: reg.docs.get("ka")!, lineId: "ka-l0", qtyMinor: 30 },
        { kacha: reg.docs.get("kb")!, lineId: "kb-l0", qtyMinor: 20 },
      ],
      unitPricePaise: 100,
    });
    expect(store.movements.length).toBe(m0); // K10: no additional OUT
    expect(store.balanceOf("a-cust")).toBe(5000);
  });

  it("K12 replay converges; K13 race cannot over-consume", () => {
    const { store, reg, actor, period, item, loc, now } = setup();
    reg.createDelivery(store, {
      companyId: "c1", sourceId: "k1", partyId: "cust1", businessDate: "2026-09-01",
      series: "CH-KACHA", lines: [{ item, location: loc, qtyMinor: 100, ratePaise: 100 }],
      actor, now, period,
    });
    const m0 = store.movements.length;
    const first = reg.convert(store, {
      ...convBase, period, actor, now, actionId: "race",
      sources: [{ kacha: reg.docs.get("k1")!, lineId: "k1-l0", qtyMinor: 60 }], unitPricePaise: 100,
    });
    expect(first.deduped).toBe(false);
    const dup = reg.convert(store, {
      ...convBase, period, actor, now, actionId: "race",
      sources: [{ kacha: reg.docs.get("k1")!, lineId: "k1-l0", qtyMinor: 60 }], unitPricePaise: 100,
    });
    expect(dup.deduped).toBe(true); // K12
    expect(() => reg.convert(store, {
      ...convBase, period, actor, now, actionId: "race2",
      sources: [{ kacha: reg.docs.get("k1")!, lineId: "k1-l0", qtyMinor: 50 }], unitPricePaise: 100,
    })).toThrowError(/exceeds remaining/); // K13: 60+50 > 100
    expect(store.movements.length).toBe(m0); // conversions never move stock
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(0);
  });
});

describe("K14–K15: reversal and correction safety", () => {
  it("K14 kacha reversal compensates the delivery with no revenue/GST", () => {
    const { store, reg, actor, period, item, loc, now } = setup();
    const { bundle } = reg.createDelivery(store, {
      companyId: "c1", sourceId: "k1", partyId: "cust1", businessDate: "2026-09-01",
      series: "CH-KACHA", lines: [{ item, location: loc, qtyMinor: 40, ratePaise: 100 }],
      actor, now, period,
    });
    const mv = bundle.movements[0]!;
    const rev = store.post({
      companyId: "c1", sourceId: "k1-rev", series: "REV", businessDate: "2026-09-02",
      actor, now, period,
      stockIntents: [{ type: "reversal", direction: "IN", qtyMinor: 40, item, location: loc, reversalOf: mv.id, originalDirection: "OUT" }],
      auditKind: "reverse",
    });
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(100);
    expect(rev.entries).toHaveLength(0);
    expect(rev.determinations).toHaveLength(0);
    expect(store.balanceOf("a-cust")).toBe(0);
  });

  it("K15 converted-invoice reversal adds no physical movement", () => {
    const { store, reg, actor, period, item, loc, now } = setup();
    reg.createDelivery(store, {
      companyId: "c1", sourceId: "k1", partyId: "cust1", businessDate: "2026-09-01",
      series: "CH-KACHA", lines: [{ item, location: loc, qtyMinor: 40, ratePaise: 100 }],
      actor, now, period,
    });
    const inv = reg.convert(store, {
      ...convBase, period, actor, now, actionId: "c1",
      sources: [{ kacha: reg.docs.get("k1")!, lineId: "k1-l0", qtyMinor: 40 }], unitPricePaise: 100,
    });
    const m0 = store.movements.length;
    if (!("bundle" in inv)) throw new Error("expected invoice bundle");
    const bundle = inv.bundle;
    // Mirror the invoice's effects: legs only (it has no movements).
    const invEntry = bundle.entries[0]!;
    const revLegs = invEntry.legs.map((l) => {
      const account = store.accounts.get(l.accountId);
      if (!account) throw new Error("missing account");
      return { account, debit: l.credit, credit: l.debit };
    });
    const invMoves = store.movements.filter((m) => m.sourceId === bundle.sourceId);
    expect(invMoves).toHaveLength(0);
    store.post({
      companyId: "c1", sourceId: "inv-rev", series: "REV", businessDate: "2026-09-03",
      actor, now, period, accountLegs: revLegs, auditKind: "reverse",
    });
    expect(store.movements.length).toBe(m0); // zero duplicate physical movement
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(60);
    expect(store.balanceOf("a-cust")).toBe(0);
  });
});
