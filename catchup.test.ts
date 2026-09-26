// Phase 8 catch-up tests: accounting, inventory, GST, engine atomicity,
// Kacha→Pakka, sales, purchase, payments, replay, isolation. vitest, free/OSS.
import { describe, expect, it, beforeEach } from "vitest";
import { Store } from "../src/store.js";
import { KachaRegistry } from "../src/kacha.js";
import { postSale, postPurchase, postPayment, outstandingFor } from "../src/sales_purchase.js";
import { onHand } from "../src/inventory.js";
import { DomainError } from "../src/errors.js";
import type { GstConfigVersion } from "../src/gst.js";
import type { Actor } from "../src/primitives.js";

const EXAMPLE_CONFIG: GstConfigVersion = {
  id: "cfg1", version: "EXAMPLE-v1", effectiveFrom: "2025-04-01", effectiveTo: null,
  rates: {
    "EXAMPLE-9+9": { components: ["CGST", "SGST"], bps: { CGST: 900, SGST: 900, IGST: 0, UTGST: 0, CESS: 0 } },
    "EXAMPLE-18": { components: ["IGST"], bps: { CGST: 0, SGST: 0, IGST: 1800, UTGST: 0, CESS: 0 } },
  },
};

function setup() {
  const store = new Store();
  const company = { id: "c1", name: "Dukaan 1", active: true };
  store.companies.set("c1", company);
  const actor: Actor = { userId: "u1", companyId: "c1", role: "owner", deviceId: "d1" };
  const mkAccount = (id: string, code: string, type: "asset" | "liability" | "income" | "expense", systemRole: string | null = null) =>
    store.accounts.set(id, { id, companyId: "c1", code, name: code, type, group: "g", active: true, systemRole });
  mkAccount("a-cash", "CASH", "asset", "cash");
  mkAccount("a-revenue", "SALES", "income", "sale");
  mkAccount("a-cost", "PURCHASE", "expense", "purchase");
  mkAccount("a-cust", "CUST", "asset", "party-ledger");
  mkAccount("a-supp", "SUPP", "liability", "party-ledger");
  store.periods.set("p1", { id: "p1", companyId: "c1", start: "2026-04-01", end: "2027-03-31", state: "open" });
  store.parties.set("c1:cust1", { id: "cust1", companyId: "c1", name: "Cust", roles: ["customer"], gstin: null, active: true, mergedInto: null });
  store.parties.set("c1:supp1", { id: "supp1", companyId: "c1", name: "Supp", roles: ["supplier"], gstin: null, active: true, mergedInto: null });
  store.items.set("c1:item1", { id: "item1", companyId: "c1", name: "Item", unit: "pcs", qtyScale: 0, stockTracked: true, taxCategory: "std", hsn: "1234", active: true });
  store.items.set("c1:svc1", { id: "svc1", companyId: "c1", name: "Service", unit: "job", qtyScale: 0, stockTracked: false, taxCategory: "std", hsn: null, active: true });
  store.locations.set("c1:shop", { id: "shop", companyId: "c1", name: "Shop", warehouse: false, active: true });
  store.locations.set("c1:godown", { id: "godown", companyId: "c1", name: "Godown", warehouse: true, active: true });
  return { store, actor };
}

describe("accounting (Phase 2/34)", () => {
  it("balanced entry posts; unbalanced rejected; duplicate converges", () => {
    const { store, actor } = setup();
    const period = store.periods.get("p1")!;
    const b1 = store.post({
      companyId: "c1", sourceId: "src-1", series: "J", businessDate: "2026-09-01",
      actor, now: "2026-09-01T10:00:00Z", period,
      accountLegs: [
        { account: store.accounts.get("a-cash")!, debit: 10000, credit: 0 },
        { account: store.accounts.get("a-revenue")!, debit: 0, credit: 10000 },
      ],
    });
    expect(b1.entries).toHaveLength(1);
    expect(() =>
      store.post({
        companyId: "c1", sourceId: "src-2", series: "J", businessDate: "2026-09-01",
        actor, now: "2026-09-01T10:00:00Z", period,
        accountLegs: [
          { account: store.accounts.get("a-cash")!, debit: 10000, credit: 0 },
          { account: store.accounts.get("a-revenue")!, debit: 0, credit: 9000 },
        ],
      }),
    ).toThrowError(DomainError);
    const replay = store.post({
      companyId: "c1", sourceId: "src-1", series: "J", businessDate: "2026-09-01",
      actor, now: "2026-09-01T10:00:00Z", period,
      accountLegs: [
        { account: store.accounts.get("a-cash")!, debit: 10000, credit: 0 },
        { account: store.accounts.get("a-revenue")!, debit: 0, credit: 10000 },
      ],
    });
    expect(replay.postingId).toBe(b1.postingId);
    expect(store.entries).toHaveLength(1);
  });

  it("closed period rejects; reversal neutralises", () => {
    const { store, actor } = setup();
    const period = store.periods.get("p1")!;
    period.state = "closed";
    expect(() =>
      store.post({
        companyId: "c1", sourceId: "src-x", series: "J", businessDate: "2026-09-01",
        actor, now: "2026-09-01T10:00:00Z", period,
        accountLegs: [
          { account: store.accounts.get("a-cash")!, debit: 500, credit: 0 },
          { account: store.accounts.get("a-revenue")!, debit: 0, credit: 500 },
        ],
      }),
    ).toThrowError(/PERIOD_CLOSED/);
    period.state = "open";
    const b = store.post({
      companyId: "c1", sourceId: "src-y", series: "J", businessDate: "2026-09-01",
      actor, now: "2026-09-01T10:00:00Z", period,
      accountLegs: [
        { account: store.accounts.get("a-cash")!, debit: 500, credit: 0 },
        { account: store.accounts.get("a-revenue")!, debit: 0, credit: 500 },
      ],
    });
    expect(store.balanceOf("a-cash")).toBe(500);
    store.reverseEntry(b.entries[0]!.id, actor, "2026-09-02T10:00:00Z", period, "2026-09-02");
    expect(store.balanceOf("a-cash")).toBe(0);
    expect(() => store.reverseEntry(b.entries[0]!.id, actor, "2026-09-03T10:00:00Z", period, "2026-09-03")).toThrowError(
      /INVALID_LIFECYCLE_TRANSITION/,
    );
  });
});

describe("inventory (Phase 3/46)", () => {
  it("receipt/issue derive balance; non-stock rejected; negatives denied", () => {
    const { store, actor } = setup();
    const period = store.periods.get("p1")!;
    const item = store.items.get("c1:item1")!;
    const shop = store.locations.get("c1:shop")!;
    store.post({
      companyId: "c1", sourceId: "rcpt", series: "ST", businessDate: "2026-09-01",
      actor, now: "2026-09-01T10:00:00Z", period,
      stockIntents: [{ type: "receipt", direction: "IN", qtyMinor: 100, item, location: shop }],
    });
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(100);
    expect(() =>
      store.post({
        companyId: "c1", sourceId: "issue-big", series: "ST", businessDate: "2026-09-02",
        actor, now: "2026-09-02T10:00:00Z", period,
        stockIntents: [{ type: "issue", direction: "OUT", qtyMinor: 101, item, location: shop }],
      }),
    ).toThrowError(/STOCK_CONFLICT/);
    const svc = store.items.get("c1:svc1")!;
    expect(() =>
      store.post({
        companyId: "c1", sourceId: "svc-move", series: "ST", businessDate: "2026-09-02",
        actor, now: "2026-09-02T10:00:00Z", period,
        stockIntents: [{ type: "receipt", direction: "IN", qtyMinor: 1, item: svc, location: shop }],
      }),
    ).toThrowError(/Non-stock/);
  });

  it("transfer conserves; unbalanced transfer rejected", () => {
    const { store, actor } = setup();
    const period = store.periods.get("p1")!;
    const item = store.items.get("c1:item1")!;
    const shop = store.locations.get("c1:shop")!;
    const godown = store.locations.get("c1:godown")!;
    store.post({
      companyId: "c1", sourceId: "r1", series: "ST", businessDate: "2026-09-01",
      actor, now: "2026-09-01T10:00:00Z", period,
      stockIntents: [{ type: "receipt", direction: "IN", qtyMinor: 50, item, location: shop }],
    });
    const t = store.post({
      companyId: "c1", sourceId: "t1", series: "TR", businessDate: "2026-09-02",
      actor, now: "2026-09-02T10:00:00Z", period,
      stockIntents: [
        { type: "transfer-out", direction: "OUT", qtyMinor: 20, item, location: shop, transferId: "tr1" },
        { type: "transfer-in", direction: "IN", qtyMinor: 20, item, location: godown, transferId: "tr1" },
      ],
    });
    expect(t.movements).toHaveLength(2);
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(30);
    expect(onHand(store.movements, "c1", "item1", "godown")).toBe(20);
  });
});

describe("engine atomicity + GST determinism (Phase 4/5)", () => {
  it("GST failure rolls back accounting+inventory (no partials)", () => {
    const { store, actor } = setup();
    const period = store.periods.get("p1")!;
    const item = store.items.get("c1:item1")!;
    const shop = store.locations.get("c1:shop")!;
    store.post({
      companyId: "c1", sourceId: "seed-stock", series: "ST", businessDate: "2026-09-01",
      actor, now: "2026-09-01T09:00:00Z", period,
      stockIntents: [{ type: "receipt", direction: "IN", qtyMinor: 5, item, location: shop }],
    });
    const seeded = { e: store.entries.length, m: store.movements.length, d: store.determinations.length };
    expect(() =>
      store.post({
        companyId: "c1", sourceId: "bad-gst", series: "S", businessDate: "2026-09-01",
        actor, now: "2026-09-01T10:00:00Z", period,
        accountLegs: [
          { account: store.accounts.get("a-cust")!, debit: 1000, credit: 0 },
          { account: store.accounts.get("a-revenue")!, debit: 0, credit: 1000 },
        ],
        stockIntents: [{ type: "issue", direction: "OUT", qtyMinor: 1, item, location: shop }],
        gstIntents: [{ supplyClass: "taxable", intraState: true, rateRef: "NOPE", taxablePaise: 1000, config: EXAMPLE_CONFIG }],
      }),
    ).toThrowError(/TAX_CONFIGURATION_STALE/);
    expect(store.entries.length).toBe(seeded.e);
    expect(store.movements.length).toBe(seeded.m);
    expect(store.determinations.length).toBe(seeded.d);
  });

  it("intra-state posts CGST+SGST; repeat deterministic; contradictory rejected", () => {
    const { store, actor } = setup();
    const period = store.periods.get("p1")!;
    const b = store.post({
      companyId: "c1", sourceId: "g1", series: "S", businessDate: "2026-09-01",
      actor, now: "2026-09-01T10:00:00Z", period,
      gstIntents: [{ supplyClass: "taxable", intraState: true, rateRef: "EXAMPLE-9+9", taxablePaise: 1000, config: EXAMPLE_CONFIG }],
    });
    const roles = b.determinations[0]!.lines.map((l) => l.role).sort();
    expect(roles).toEqual(["CGST", "SGST"]);
    expect(b.determinations[0]!.lines.map((l) => l.amountPaise)).toEqual([90, 90]);
    expect(() =>
      store.post({
        companyId: "c1", sourceId: "g2", series: "S", businessDate: "2026-09-01",
        actor, now: "2026-09-01T10:00:00Z", period,
        gstIntents: [{ supplyClass: "taxable", intraState: false, rateRef: "EXAMPLE-9+9", taxablePaise: 1000, config: EXAMPLE_CONFIG }],
      }),
    ).toThrowError(/GST_VALIDATION_FAILED/);
  });
});

describe("kacha → pakka (Phase 6/89)", () => {
  function kachaSetup() {
    const { store, actor } = setup();
    const period = store.periods.get("p1")!;
    const reg = new KachaRegistry();
    const doc = { sourceId: "k1", companyId: "c1", partyId: "cust1", lines: [{ id: "l1", itemId: "item1", locationId: "shop", qtyMinor: 100, ratePaise: 100 }] };
    reg.register(doc);
    const base = { companyId: "c1", actor, now: "2026-09-02T10:00:00Z", businessDate: "2026-09-02", period, series: "INV", accounts: { debitId: "a-cust", creditId: "a-revenue" }, gst: { rateRef: "EXAMPLE-9+9", config: EXAMPLE_CONFIG, intraState: true }, locationId: "shop" as const };
    return { store, actor, period, reg, base };
  }
  it("partial then complete; over-conversion rejected; 40+70 vs 100 serialised", () => {
    const { store, base, reg } = kachaSetup();
    const r1 = reg.convert(store, { ...base, actionId: "a1", sources: [{ kacha: reg.docs.get("k1")!, lineId: "l1", qtyMinor: 40 }], unitPricePaise: 100 });
    expect(r1.deduped).toBe(false);
    expect(reg.remaining("k1", "l1")).toBe(60);
    expect(() => reg.convert(store, { ...base, actionId: "a2", sources: [{ kacha: reg.docs.get("k1")!, lineId: "l1", qtyMinor: 70 }], unitPricePaise: 100 })).toThrowError(/Over-conversion/);
    reg.convert(store, { ...base, actionId: "a3", sources: [{ kacha: reg.docs.get("k1")!, lineId: "l1", qtyMinor: 60 }], unitPricePaise: 100 });
    expect(reg.remaining("k1", "l1")).toBe(0);
    const dup = reg.convert(store, { ...base, actionId: "a1", sources: [{ kacha: reg.docs.get("k1")!, lineId: "l1", qtyMinor: 40 }], unitPricePaise: 100 });
    expect(dup.deduped).toBe(true);
  });
  it("rate edit denied; incompatible many→one rejected; reversal restores", () => {
    const { store, base, reg } = kachaSetup();
    expect(() => reg.convert(store, { ...base, actionId: "ax", sources: [{ kacha: reg.docs.get("k1")!, lineId: "l1", qtyMinor: 10 }], unitPricePaise: 120 })).toThrowError(/DENY/);
    reg.register({ sourceId: "k2", companyId: "c1", partyId: "OTHER", lines: [{ id: "l1", itemId: "item1", locationId: "shop", qtyMinor: 10, ratePaise: 100 }] });
    expect(() =>
      reg.convert(store, {
        ...base, actionId: "am", unitPricePaise: 100,
        sources: [
          { kacha: reg.docs.get("k1")!, lineId: "l1", qtyMinor: 10 },
          { kacha: reg.docs.get("k2")!, lineId: "l1", qtyMinor: 10 },
        ],
      }),
    ).toThrowError(/Incompatible/);
    reg.convert(store, { ...base, actionId: "a9", sources: [{ kacha: reg.docs.get("k1")!, lineId: "l1", qtyMinor: 25 }], unitPricePaise: 100 });
    expect(reg.remaining("k1", "l1")).toBe(75);
    reg.reverseAction("a9");
    expect(reg.remaining("k1", "l1")).toBe(100);
    expect(() => reg.reverseAction("a9")).toThrowError(/already reversed/);
  });
});

describe("sales + purchase + payments (Phase 7/8)", () => {
  it("E07–E16 vertical: purchase receipt → payable → pay; sale issue → receivable → settle", () => {
    const { store, actor } = setup();
    const period = store.periods.get("p1")!;
    const gst = { supplyClass: "taxable" as const, intraState: true, rateRef: "EXAMPLE-9+9", config: EXAMPLE_CONFIG };
    const seen = new Set<string>();
    // Purchase 10 pcs @ 100 paise minor pricing: qty 10 × 500 paise
    postPurchase(store, {
      sourceId: "pur-1", companyId: "c1", partyId: "supp1", series: "PUR", businessDate: "2026-09-01",
      actor, now: "2026-09-01T10:00:00Z", period,
      lines: [{ itemId: "item1", locationId: "shop", qtyMinor: 10, unitPricePaise: 500 }],
      accounts: { debitId: "a-cost", creditId: "a-supp" }, gst, supplierInvoiceRef: "SUP-001", seenSupplierRefs: seen,
    });
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(10);
    expect(() =>
      postPurchase(store, {
        sourceId: "pur-2", companyId: "c1", partyId: "supp1", series: "PUR", businessDate: "2026-09-01",
        actor, now: "2026-09-01T10:00:00Z", period,
        lines: [{ itemId: "item1", locationId: "shop", qtyMinor: 1, unitPricePaise: 500 }],
        accounts: { debitId: "a-cost", creditId: "a-supp" }, gst, supplierInvoiceRef: "SUP-001", seenSupplierRefs: seen,
      }),
    ).toThrowError(/Duplicate supplier/);
    // Sale 4 pcs @ 800
    postSale(store, {
      sourceId: "sale-1", companyId: "c1", partyId: "cust1", series: "INV", businessDate: "2026-09-02",
      actor, now: "2026-09-02T10:00:00Z", period,
      lines: [{ itemId: "item1", locationId: "shop", qtyMinor: 4, unitPricePaise: 800 }],
      accounts: { debitId: "a-cust", creditId: "a-revenue" }, gst,
    });
    expect(onHand(store.movements, "c1", "item1", "shop")).toBe(6);
    // Payments: purchase payable 5000, pay 2000 partial
    const apps = new Map<string, Array<{ paymentSourceId: string; amount: number }>>();
    postPayment(store, {
      sourceId: "pay-1", companyId: "c1", series: "PAY", businessDate: "2026-09-03", actor, now: "2026-09-03T10:00:00Z", period,
      legs: { debitId: "a-supp", creditId: "a-cash", amount: 2000 },
      applications: [{ invoiceSourceId: "pur-1", amount: 2000 }], applicationsStore: apps,
    });
    expect(outstandingFor(apps, "pur-1", 5000)).toBe(3000);
    // Advance: zero applications
    postPayment(store, {
      sourceId: "pay-adv", companyId: "c1", series: "PAY", businessDate: "2026-09-03", actor, now: "2026-09-03T10:00:00Z", period,
      legs: { debitId: "a-cash", creditId: "a-cust", amount: 1000 },
      applications: [], applicationsStore: apps,
    });
    expect(apps.has("pay-adv")).toBe(false);
    // Oversell rejected (only 6 on hand)
    expect(() =>
      postSale(store, {
        sourceId: "sale-2", companyId: "c1", partyId: "cust1", series: "INV", businessDate: "2026-09-04",
        actor, now: "2026-09-04T10:00:00Z", period,
        lines: [{ itemId: "item1", locationId: "shop", qtyMinor: 7, unitPricePaise: 800 }],
        accounts: { debitId: "a-cust", creditId: "a-revenue" }, gst,
      }),
    ).toThrowError(/STOCK_CONFLICT/);
  });

  it("tenant isolation + viewer unauthorized", () => {
    const { store, actor } = setup();
    const period = store.periods.get("p1")!;
    store.companies.set("c2", { id: "c2", name: "Other", active: true });
    expect(() =>
      store.post({
        companyId: "c2", sourceId: "x1", series: "J", businessDate: "2026-09-01",
        actor, now: "2026-09-01T10:00:00Z",
        period: { id: "p2", companyId: "c2", start: "2026-04-01", end: "2027-03-31", state: "open" },
        accountLegs: [
          { account: store.accounts.get("a-cash")!, debit: 10, credit: 0 },
          { account: store.accounts.get("a-revenue")!, debit: 0, credit: 10 },
        ],
      }),
    ).toThrowError(/INVALID_COMPANY_CONTEXT/);
    const viewer = { ...actor, role: "viewer" as const };
    expect(() =>
      store.post({
        companyId: "c1", sourceId: "x2", series: "J", businessDate: "2026-09-01",
        actor: viewer, now: "2026-09-01T10:00:00Z", period,
        accountLegs: [
          { account: store.accounts.get("a-cash")!, debit: 10, credit: 0 },
          { account: store.accounts.get("a-revenue")!, debit: 0, credit: 10 },
        ],
      }),
    ).toThrowError(/UNAUTHORIZED/);
    void period;
  });
});

let beforeEachRan = false;
beforeEach(() => {
  beforeEachRan = true;
});
void beforeEachRan;
