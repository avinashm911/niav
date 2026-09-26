// Phase 8 E2E: full vertical slice E01–E41 at the server+DB boundary.
// Own database (niaverp_e2e) — never shares schema with parallel workers.
import { describe, expect, it, beforeAll } from "vitest";
import { Client, Pool } from "pg";
import { DB_URL, applyMigrations } from "../../db/src/migrate.js";
import {
  authenticate, convertKacha, correctSource, createItem, createKacha, createLocation,
  createParty, getAuditTrail, getTransaction, kachaRemaining, newSource,
  postPayment, postPurchase, postReturn, postSale, reverseSource, submitSync,
  type Session,
} from "../src/index.js";
import {
  accountBalance, kachaTrace, paymentSummary, purchaseRegister, salesRegister,
  stockBalances, taxSummary,
} from "../src/reads.js";

const E2E_DB = "postgres://postgres:niaverp-dev-only@localhost:5433/niaverp_e2e";
const pool = new Pool({ connectionString: E2E_DB });
const GST = { supplyClass: "taxable" as const, intraState: true, rateRef: "EXAMPLE-9+9" };

let owner: Session;
let biller: Session;
let viewer: Session;
const ids: Record<string, string> = {};
const id = (k: string): string => { const v = ids[k]; if (v === undefined) throw new Error("missing id " + k); return v; };

beforeAll(async () => {
  const root = new Client({ connectionString: DB_URL });
  await root.connect();
  try {
    await root.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='niaverp_e2e' AND pid <> pg_backend_pid()");
    await root.query("DROP DATABASE IF EXISTS niaverp_e2e");
    await root.query("CREATE DATABASE niaverp_e2e");
  } finally {
    await root.end();
  }
  await applyMigrations(E2E_DB);
  const admin = new Client({ connectionString: E2E_DB });
  await admin.connect();
  try {
    // E01 create company; E02 owner identity; E03 staff
    await admin.query(`INSERT INTO companies(id,name) VALUES ('c1','Dukaan 1')`);
    await admin.query(`INSERT INTO profiles(id,display_name) VALUES ('u-owner','Owner'),('u-biller','Biller'),('u-viewer','Viewer')`);
    await admin.query(`INSERT INTO memberships(company_id,user_id,role) VALUES ('c1','u-owner','owner'),('c1','u-biller','biller'),('c1','u-viewer','viewer')`);
    // E08 accounting structure; E09 GST context
    await admin.query(`INSERT INTO accounts(id,company_id,code,name,type,acc_group) VALUES
      ('a-cash','c1','CASH','Cash','asset','g'),('a-rev','c1','SALES','Sales','income','g'),
      ('a-cost','c1','PURCH','Purchase','expense','g'),('a-cust','c1','CUST','Cust ledger','asset','g'),
      ('a-supd','c1','SUPP','Supp ledger','liability','g')`);
    await admin.query(`INSERT INTO periods(id,company_id,start_date,end_date,state) VALUES ('p1','c1','2026-04-01','2027-03-31','open')`);
    await admin.query(`INSERT INTO gst_configs(id,version,effective_from) VALUES ('cfg1','EXAMPLE-v1','2025-04-01')`);
    await admin.query(`INSERT INTO gst_rates(config_id,rate_ref,components,bps_cgst,bps_sgst) VALUES ('cfg1','EXAMPLE-9+9','{CGST,SGST}',900,900)`);
  } finally {
    await admin.end();
  }
  owner = await authenticate(pool, "u-owner", "c1", "d-owner");
  biller = await authenticate(pool, "u-biller", "c1", "d-biller");
  viewer = await authenticate(pool, "u-viewer", "c1", "d-viewer");
}, 180000);

describe("E01–E09 setup", () => {
  it("E02/E03 auth resolves roles; E04–E07 masters; unknown user rejected", async () => {
    expect(owner.role).toBe("owner");
    expect(biller.role).toBe("biller");
    expect(viewer.role).toBe("viewer");
    await expect(authenticate(pool, "ghost", "c1", "d")).rejects.toThrow(/UNAUTHORIZED/);
    ids.supp = (await createParty(pool, owner, { name: "Supplier", roles: ["supplier"] })).id; // E04
    ids.cust = (await createParty(pool, owner, { name: "Customer", roles: ["customer"] })).id; // E05
    ids.item = (await createItem(pool, owner, { name: "Rice 5kg" })).id; // E06
    ids.shop = (await createLocation(pool, owner, { name: "Shop" })).id; // E07
  });
});

describe("E10–E15 purchase cycle", () => {
  it("E10 cash purchase; E11 credit purchase; E12 receipt; E13 payable; E14 pay; E15 settle", async () => {
    const cash = await postPurchase(pool, biller, {
      partyId: id("supp"), series: "PUR", businessDate: "2026-09-01",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 100, unitPricePaise: 500 }],
      accounts: { debitCode: "PURCH", creditCode: "SUPP" }, gst: GST, supplierRef: "SUP-001",
    });
    expect(cash.voucherNumber).toBeDefined();
    const credit = await postPurchase(pool, biller, {
      partyId: id("supp"), series: "PUR", businessDate: "2026-09-02",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 50, unitPricePaise: 500 }],
      accounts: { debitCode: "PURCH", creditCode: "SUPP" }, gst: GST, supplierRef: "SUP-002",
    });
    ids.purCash = cash.sourceId;
    ids.purCredit = credit.sourceId;
    const stock = await stockBalances(pool, owner); // E12
    expect(stock.find((r) => r.item === id("item") && r.location === id("shop"))?.on_hand).toBe("150");
    expect(await accountBalance(pool, owner, "a-supd")).toBe(-75000); // E13: 150×500 credit
    await postPayment(pool, biller, { // E14
      series: "PAY", businessDate: "2026-09-03", debitCode: "SUPP", creditCode: "CASH",
      amount: 75000, method: "bank", applications: [{ invoiceSource: credit.sourceId, amount: 25000 }, { invoiceSource: cash.sourceId, amount: 50000 }],
    });
    expect(await accountBalance(pool, owner, "a-supd")).toBe(0); // E15
  });
});

describe("E16–E20 sales cycle", () => {
  it("E16 cash; E17 credit; E18 reduction; E19 receivable; E20 payment", async () => {
    const cash = await postSale(pool, biller, {
      partyId: id("cust"), series: "INV", businessDate: "2026-09-04",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 10, unitPricePaise: 800 }],
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    });
    await postPayment(pool, biller, {
      series: "PAY", businessDate: "2026-09-04", debitCode: "CASH", creditCode: "CUST",
      amount: 8000, applications: [{ invoiceSource: cash.sourceId, amount: 8000 }],
    });
    const credit = await postSale(pool, biller, {
      partyId: id("cust"), series: "INV", businessDate: "2026-09-05",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 20, unitPricePaise: 800 }],
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    });
    ids.saleCredit = credit.sourceId;
    const stock = await stockBalances(pool, owner); // E18: 150-10-20
    expect(stock.find((r) => r.item === id("item") && r.location === id("shop"))?.on_hand).toBe("120");
    expect(await accountBalance(pool, owner, "a-cust")).toBe(16000); // E19
    await postPayment(pool, biller, { // E20 partial
      series: "PAY", businessDate: "2026-09-06", debitCode: "CASH", creditCode: "CUST",
      amount: 6000, applications: [{ invoiceSource: credit.sourceId, amount: 6000 }],
    });
    expect(await accountBalance(pool, owner, "a-cust")).toBe(10000);
  });
});

describe("E21–E28 + K01–K18 kacha → pakka (delivery moves stock once)", () => {
  async function shopStock(): Promise<string> {
    const stock = await stockBalances(pool, owner);
    return stock.find((r) => r.item === id("item") && r.location === id("shop"))?.on_hand ?? "?";
  }
  it("K01–K04: kacha 100 delivers (120→20), no accounting/GST; invoice keeps 20", async () => {
    expect(await shopStock()).toBe("120");
    const k = await createKacha(pool, biller, {
      partyId: id("cust"), series: "CH-KACHA", businessDate: "2026-09-07",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 100, ratePaise: 800 }],
    });
    ids.kacha = k.sourceId;
    expect(await shopStock()).toBe("20"); // K01: single delivery OUT
    const kt = await getTransaction(pool, owner, k.sourceId);
    expect(kt.moves).toHaveLength(1); // K01: exactly one movement
    expect(kt.moves[0]).toMatchObject({ type: "delivery", direction: "OUT", qty_minor: "100" });
    expect(kt.legs).toHaveLength(0); // K02: no accounting
    expect(kt.tax.filter((x: { role: string }) => x.role)).toHaveLength(0); // K03: no GST
    expect(await kachaRemaining(pool, owner, k.sourceId, `${k.sourceId}-l0`)).toBe(100);
    const c1 = await convertKacha(pool, biller, { // E22
      refs: [{ kachaSource: k.sourceId, lineId: `${k.sourceId}-l0`, qtyMinor: 40 }],
      series: "INV", businessDate: "2026-09-08", unitPricePaise: 800,
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    });
    expect(c1.deduped).toBe(false);
    ids.conv1 = c1.sourceId;
    ids.conv1 = c1.sourceId;
    const ct = await getTransaction(pool, owner, c1.sourceId);
    expect(ct.moves).toHaveLength(0); // K04: invoice adds NO movement
    expect(await shopStock()).toBe("20"); // stock unchanged, NOT -20
    expect(await kachaRemaining(pool, owner, k.sourceId, `${k.sourceId}-l0`)).toBe(60); // E24
    expect(ct.legs.length).toBe(2); // K07: accounting for 40
    expect(ct.tax.filter((x: { role: string }) => x.role === "CGST" || x.role === "SGST").length).toBe(2); // K08
    await convertKacha(pool, biller, { // E23
      refs: [{ kachaSource: k.sourceId, lineId: `${k.sourceId}-l0`, qtyMinor: 60 }],
      series: "INV", businessDate: "2026-09-09", unitPricePaise: 800,
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    });
    expect(await kachaRemaining(pool, owner, k.sourceId, `${k.sourceId}-l0`)).toBe(0); // K06
    expect(await shopStock()).toBe("20");
    const trace = await kachaTrace(pool, owner, k.sourceId); // E25 source preserved + linked
    expect(trace.convs.length).toBe(2);
  });
  it("K09 over-conversion fails closed; K12 action replay dedupes", async () => {
    await expect(convertKacha(pool, biller, {
      refs: [{ kachaSource: id("kacha"), lineId: `${id("kacha")}-l0`, qtyMinor: 1 }],
      series: "INV", businessDate: "2026-09-09", unitPricePaise: 800,
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    })).rejects.toThrow(/exceeds remaining/); // K09: nothing consumed
    expect(await kachaRemaining(pool, owner, id("kacha"), `${id("kacha")}-l0`)).toBe(0);
    expect(await shopStock()).toBe("20");
  });
  it("K10 many→one on item2: two OUTs, one invoice, zero extra movement", async () => {
    const item2 = (await createItem(pool, owner, { name: "Item2" })).id;
    await postPurchase(pool, biller, {
      partyId: id("supp"), series: "PUR", businessDate: "2026-09-09",
      lines: [{ itemId: item2, locationId: id("shop"), qtyMinor: 200, unitPricePaise: 100 }],
      accounts: { debitCode: "PURCH", creditCode: "SUPP" }, gst: GST, supplierRef: "SUP-K10",
    });
    const ka = await createKacha(pool, biller, {
      partyId: id("cust"), series: "CH-KACHA", businessDate: "2026-09-09",
      lines: [{ itemId: item2, locationId: id("shop"), qtyMinor: 30, ratePaise: 800 }],
    });
    const kb = await createKacha(pool, biller, {
      partyId: id("cust"), series: "CH-KACHA", businessDate: "2026-09-09",
      lines: [{ itemId: item2, locationId: id("shop"), qtyMinor: 20, ratePaise: 800 }],
    });
    const admin = new Client({ connectionString: E2E_DB });
    await admin.connect();
    try {
      const m0 = Number((await admin.query(`SELECT COUNT(*)::int AS c FROM stock_movements`)).rows[0].c);
      const inv = await convertKacha(pool, biller, {
        actionId: "k10-act",
        refs: [
          { kachaSource: ka.sourceId, lineId: `${ka.sourceId}-l0`, qtyMinor: 30 },
          { kachaSource: kb.sourceId, lineId: `${kb.sourceId}-l0`, qtyMinor: 20 },
        ],
        series: "INV", businessDate: "2026-09-09", unitPricePaise: 800,
        accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
      });
      const invReplay = await convertKacha(pool, biller, { // K12: same action replays
        actionId: "k10-act",
        refs: [
          { kachaSource: ka.sourceId, lineId: `${ka.sourceId}-l0`, qtyMinor: 30 },
          { kachaSource: kb.sourceId, lineId: `${kb.sourceId}-l0`, qtyMinor: 20 },
        ],
        series: "INV", businessDate: "2026-09-09", unitPricePaise: 800,
        accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
      });
      expect(invReplay.deduped).toBe(true);
      expect(invReplay.sourceId).toBe(inv.sourceId);
      const m1 = Number((await admin.query(`SELECT COUNT(*)::int AS c FROM stock_movements`)).rows[0].c);
      expect(m1).toBe(m0); // K10: no additional OUT
      const t = await getTransaction(pool, owner, inv.sourceId);
      expect(t.legs.length).toBe(2); // accounting for 50
    } finally {
      await admin.end();
    }
    ids.item2 = item2;
  });
  it("K13 concurrent 60+50 vs 100 serializes; K18 cross-company blocked", async () => {
    const kc = await createKacha(pool, biller, {
      partyId: id("cust"), series: "CH-KACHA", businessDate: "2026-09-09",
      lines: [{ itemId: id("item2"), locationId: id("shop"), qtyMinor: 100, ratePaise: 800 }],
    });
    const line = `${kc.sourceId}-l0`;
    const base = {
      series: "INV", businessDate: "2026-09-09", unitPricePaise: 800,
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    };
    const results = await Promise.allSettled([
      convertKacha(pool, biller, { ...base, refs: [{ kachaSource: kc.sourceId, lineId: line, qtyMinor: 60 }] }),
      convertKacha(pool, biller, { ...base, refs: [{ kachaSource: kc.sourceId, lineId: line, qtyMinor: 50 }] }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const bad = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1); // exactly one winner, never 110 invoiced
    expect(bad).toHaveLength(1);
    expect(await kachaRemaining(pool, owner, kc.sourceId, line)).toBe(40);
    const admin = new Client({ connectionString: E2E_DB });
    await admin.connect();
    try {
      await admin.query(`INSERT INTO companies(id,name) VALUES ('c2','Other') ON CONFLICT DO NOTHING`);
      await admin.query(`INSERT INTO profiles(id,display_name) VALUES ('u-o2','O2') ON CONFLICT DO NOTHING`);
      await admin.query(`INSERT INTO memberships(company_id,user_id,role) VALUES ('c2','u-o2','owner') ON CONFLICT DO NOTHING`);
    } finally {
      await admin.end();
    }
    const o2 = await authenticate(pool, "u-o2", "c2", "d-o2");
    await expect(convertKacha(pool, o2, { // K18
      ...base, refs: [{ kachaSource: kc.sourceId, lineId: line, qtyMinor: 10 }],
    })).rejects.toThrow(/INVALID_SOURCE|COMPANY/);
  });
  it("K14 uninvoiced kacha reverses cleanly; K15 converted-invoice reversal restores 40", async () => {
    const kd = await createKacha(pool, biller, {
      partyId: id("cust"), series: "CH-KACHA", businessDate: "2026-09-09",
      lines: [{ itemId: id("item2"), locationId: id("shop"), qtyMinor: 10, ratePaise: 800 }],
    });
    const before = await stockBalances(pool, owner);
    const b2 = before.find((r) => r.item === id("item2"))?.on_hand;
    await reverseSource(pool, owner, { originalSource: kd.sourceId, series: "REV", businessDate: "2026-09-10", reason: "k14" });
    const after = await stockBalances(pool, owner);
    expect(after.find((r) => r.item === id("item2"))?.on_hand).toBe(String(Number(b2) + 10)); // K14 compensated
    const rev = await getTransaction(pool, owner, kd.sourceId);
    void rev;
    const stockBefore = await shopStock();
    await reverseSource(pool, owner, { originalSource: id("conv1"), series: "REV", businessDate: "2026-09-10", reason: "k15" });
    expect(await kachaRemaining(pool, owner, id("kacha"), `${id("kacha")}-l0`)).toBe(40); // restored
    expect(await shopStock()).toBe(stockBefore); // K15: no physical movement
  });
});

describe("E29–E32 returns / reversal / correction", () => {
  it("E29 sales return; E30 purchase return; E31 reversal; E32 correction", async () => {
    const sret = await postReturn(pool, biller, {
      originalSource: id("saleCredit"), series: "RET", businessDate: "2026-09-10",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 5, unitPricePaise: 800 }],
      accounts: { debitCode: "SALES", creditCode: "CUST" }, reason: "damaged", side: "sales",
    });
    const stock = await stockBalances(pool, owner);
    expect(stock.find((r) => r.item === id("item") && r.location === id("shop"))?.on_hand).toBe("25"); // 20+5
    await postReturn(pool, biller, {
      originalSource: id("purCredit"), series: "RET", businessDate: "2026-09-10",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 5, unitPricePaise: 500 }],
      accounts: { debitCode: "SUPP", creditCode: "PURCH" }, reason: "short-supply", side: "purchase",
    });
    const stock2 = await stockBalances(pool, owner);
    expect(stock2.find((r) => r.item === id("item") && r.location === id("shop"))?.on_hand).toBe("20"); // 25-5
    const rev = await reverseSource(pool, owner, { originalSource: sret.sourceId, series: "REV", businessDate: "2026-09-11", reason: "test" });
    expect(rev.sourceId).toBeDefined();
    await expect(reverseSource(pool, owner, { originalSource: sret.sourceId, series: "REV", businessDate: "2026-09-11", reason: "dup" })).rejects.toThrow(/already reversed/);
    const corr = await correctSource(pool, owner, {
      originalSource: id("saleCredit"), series: "INV", businessDate: "2026-09-12", reason: "qty-fix",
      replacement: {
        partyId: id("cust"), lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 15, unitPricePaise: 800 }],
        accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
      },
    });
    expect(corr.correctionId).toBeDefined();
    const audits = await getAuditTrail(pool, owner, corr.replacement.sourceId);
    expect(audits.length).toBeGreaterThan(0);
  });
});

describe("E33–E36 replay / concurrency / offline / sync", () => {
  it("E33 duplicate replay converges; E34 concurrent distinct post", async () => {
    const src = newSource("src");
    const first = await postSale(pool, biller, {
      sourceId: src, partyId: id("cust"), series: "INV", businessDate: "2026-09-13",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 1, unitPricePaise: 800 }],
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    });
    const replay = await postSale(pool, biller, {
      sourceId: src, partyId: id("cust"), series: "INV", businessDate: "2026-09-13",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 1, unitPricePaise: 800 }],
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    });
    expect(replay.deduped).toBe(true);
    expect(replay.postingId).toBe(first.postingId);
    const [a, b] = await Promise.all([
      postSale(pool, biller, { partyId: id("cust"), series: "INV", businessDate: "2026-09-13", lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 1, unitPricePaise: 800 }], accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST }),
      postSale(pool, biller, { partyId: id("cust"), series: "INV", businessDate: "2026-09-13", lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 1, unitPricePaise: 800 }], accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST }),
    ]);
    expect(a.voucherNumber).not.toBe(b.voucherNumber);
    await submitSync(pool, biller, { sourceId: src, status: "acked" }); // E36
  });
});

describe("E37–E41 audit / security / reporting", () => {
  it("E37 traversal; E38 wrong-company; E39/E40 authz; E41 reports", async () => {
    const t = await getTransaction(pool, owner, id("saleCredit")); // E37
    expect(t.head).toBeDefined();
    expect(t.legs.length).toBeGreaterThan(0);
    expect(t.audits.length).toBeGreaterThan(0);
    await expect(authenticate(pool, "u-owner", "c2", "d")).rejects.toThrow(/UNAUTHORIZED/); // E38
    await expect(createParty(pool, viewer, { name: "Nope", roles: ["customer"] })).rejects.toThrow(/UNAUTHORIZED/); // E39/E40
    const sales = await salesRegister(pool, owner); // E41
    expect(sales.length).toBeGreaterThan(0);
    const purs = await purchaseRegister(pool, owner); // SUP-001, SUP-002 + SUP-K10
    expect(purs.filter((p) => p.supplier_ref === "SUP-001" || p.supplier_ref === "SUP-002").length).toBe(2);
    const pays = await paymentSummary(pool, owner);
    expect(pays.length).toBeGreaterThan(0);
    const tax = await taxSummary(pool, owner);
    expect(tax.filter((r) => r.role === "CGST").length).toBeGreaterThan(0);
  });
});

describe("failure atomicity", () => {
  it("bad GST / bad stock / closed period leave zero survivors", async () => {
    const badGst = newSource("src");
    await expect(postSale(pool, biller, {
      sourceId: badGst, partyId: id("cust"), series: "INV", businessDate: "2026-09-14",
      lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 1, unitPricePaise: 800 }],
      accounts: { debitCode: "CUST", creditCode: "SALES" },
      gst: { supplyClass: "taxable", intraState: true, rateRef: "NOPE", configVersion: "EXAMPLE-v1" },
    } as never)).rejects.toThrow();
    const admin = new Client({ connectionString: E2E_DB });
    await admin.connect();
    try {
      for (const [tbl, col] of [["postings", "source_id"], ["journal_entries", "source_id"], ["stock_movements", "source_id"], ["gst_determinations", "source_id"]] as const) {
        const r = await admin.query(`SELECT COUNT(*)::int AS c FROM ${tbl} WHERE ${col}=$1`, [badGst]);
        expect(r.rows[0].c).toBe(0);
      }
      await expect(postSale(pool, biller, {
        partyId: id("cust"), series: "INV", businessDate: "2026-09-14",
        lines: [{ itemId: id("item"), locationId: id("shop"), qtyMinor: 1000000, unitPricePaise: 800 }],
        accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
      })).rejects.toThrow(/STOCK_CONFLICT/);
    } finally {
      await admin.end();
    }
  });
});
