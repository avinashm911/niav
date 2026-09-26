// Checkpoint 2 database tests DB01–DB15. Real PostgreSQL (docker niaverp-pg).
// Run: npx vitest run packages/db/tests
import { describe, expect, it, beforeAll } from "vitest";
import { Client } from "pg";
import { DB_URL, freshDb } from "../src/migrate.js";

let admin: Client;
async function q(text: string, params: unknown[] = []) {
  return admin.query(text, params as never[]);
}

beforeAll(async () => {
  await freshDb();
  admin = new Client({ connectionString: DB_URL });
  await admin.connect();
  // Seed identity roots.
  await q(`INSERT INTO companies(id,name) VALUES ('c1','Dukaan 1'),('c2','Other')`);
  await q(`INSERT INTO profiles(id,display_name) VALUES ('u1','Owner'),('u2','Other')`);
  await q(`INSERT INTO memberships(company_id,user_id,role) VALUES ('c1','u1','owner'),('c2','u2','owner')`);
  return async () => { await admin.end(); };
}, 120000);

async function seedBasics() {
  await q(`INSERT INTO parties(id,company_id,name) VALUES ('cust1','c1','Cust'),('supp1','c1','Supp') ON CONFLICT DO NOTHING`);
  await q(`INSERT INTO party_roles(company_id,party_id,role) VALUES ('c1','cust1','customer'),('c1','supp1','supplier') ON CONFLICT DO NOTHING`);
  await q(`INSERT INTO items(id,company_id,name,unit,tax_category) VALUES ('item1','c1','Item','pcs','std') ON CONFLICT DO NOTHING`);
  await q(`INSERT INTO locations(id,company_id,name) VALUES ('shop','c1','Shop') ON CONFLICT DO NOTHING`);
  await q(`INSERT INTO accounts(id,company_id,code,name,type,acc_group) VALUES
    ('a-cash','c1','CASH','Cash','asset','g'),('a-rev','c1','SALES','Sales','income','g'),
    ('a-cust','c1','CUST','Cust ledger','asset','g'),('a-supp','c1','SUPP','Supp ledger','liability','g')
    ON CONFLICT DO NOTHING`);
  await q(`INSERT INTO periods(id,company_id,start_date,end_date,state) VALUES ('p1','c1','2026-04-01','2027-03-31','open') ON CONFLICT DO NOTHING`);
  await q(`INSERT INTO gst_configs(id,version,effective_from) VALUES ('cfg1','EXAMPLE-v1','2025-04-01') ON CONFLICT DO NOTHING`);
  await q(`INSERT INTO gst_rates(config_id,rate_ref,components,bps_cgst,bps_sgst) VALUES ('cfg1','EXAMPLE-9+9','{CGST,SGST}',900,900) ON CONFLICT DO NOTHING`);
}

async function postBundle(sourceId: string, series: string, extra?: { badLeg?: boolean; closedPeriod?: boolean }) {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      `INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts)
       VALUES ($1,'c1','sale',$2,'2026-09-01','u1','owner','d1',now())`, [sourceId, series]);
    const period = extra?.closedPeriod ? "p-closed" : "p1";
    if (extra?.closedPeriod) {
      await c.query(`INSERT INTO periods(id,company_id,start_date,end_date,state) VALUES ('p-closed','c1','2025-04-01','2026-03-31','closed') ON CONFLICT DO NOTHING`);
    }
    const num = (await c.query(`SELECT next_voucher_number('c1',$1) AS n`, [series])).rows[0].n as number;
    await c.query(`INSERT INTO vouchers(id,source_id,company_id,series,number) VALUES ($1,$2,'c1',$3,$4)`, [`v-${sourceId}`, sourceId, series, num]);
    await c.query(`INSERT INTO postings(id,source_id,voucher_id,company_id,period_id) VALUES ($1,$2,$3,'c1',$4)`, [`p-${sourceId}`, sourceId, `v-${sourceId}`, period]);
    await c.query(`INSERT INTO journal_entries(id,posting_id,source_id,company_id,business_date,period_id) VALUES ($1,$2,$3,'c1','2026-09-01',$4)`, [`e-${sourceId}`, `p-${sourceId}`, sourceId, period]);
    const legs = extra?.badLeg
      ? [[`l1-${sourceId}`, "a-cash", 100, 0], [`l2-${sourceId}`, "a-rev", 0, 50]]
      : [[`l1-${sourceId}`, "a-cash", 100, 0], [`l2-${sourceId}`, "a-rev", 0, 100]];
    for (const [id, acc, dr, cr] of legs as Array<[string, string, number, number]>) {
      await c.query(`INSERT INTO journal_legs(id,entry_id,company_id,account_id,debit,credit) VALUES ($1,$2,'c1',$3,$4,$5)`, [id, `e-${sourceId}`, acc, dr, cr]);
    }
    await c.query(`INSERT INTO stock_movements(id,posting_id,source_id,company_id,item_id,location_id,type,direction,qty_minor,business_date,actor_user)
      VALUES ($1,$2,$3,'c1','item1','shop','issue','OUT',1,'2026-09-01','u1')`, [`m-${sourceId}`, `p-${sourceId}`, sourceId]);
    await c.query(`INSERT INTO gst_determinations(id,posting_id,source_id,company_id,supply_class,rate_ref,config_version,taxable_paise)
      VALUES ($1,$2,$3,'c1','taxable','EXAMPLE-9+9','EXAMPLE-v1',100)`, [`d-${sourceId}`, `p-${sourceId}`, sourceId]);
    await c.query(`INSERT INTO audit_events(id,company_id,source_id,kind,actor_user,actor_role,device_id) VALUES ($1,'c1',$2,'post','u1','owner','d1')`, [`a-${sourceId}`, sourceId]);
    await c.query("COMMIT");
    return num;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}

describe("DB01 schema creation", () => {
  it("all migrations applied with core tables", async () => {
    const r = await q(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`);
    const names = r.rows.map((x: { tablename: string }) => x.tablename);
    for (const t of ["companies","sources","vouchers","postings","series_counters","accounts","periods","journal_entries","journal_legs","stock_movements","gst_configs","gst_rates","gst_determinations","gst_tax_lines","kacha_docs","kacha_lines","conversion_actions","conversion_refs","sales_docs","sales_lines","purchase_docs","purchase_lines","payments","payment_applications","audit_events","sync_outbox"]) {
      expect(names).toContain(t);
    }
  });
});

describe("DB02 FK integrity + DB12/13/14/15 persistence", () => {
  it("masters + commercial rows persist with enforced references", async () => {
    await seedBasics();
    await q(`INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts) VALUES ('k1','c1','challan','CH-KACHA','2026-09-01','u1','owner','d1',now())`);
    await q(`INSERT INTO kacha_docs(source_id,company_id,party_id,series,number) VALUES ('k1','c1','cust1','CH-KACHA',1)`);
    await q(`INSERT INTO kacha_lines(id,kacha_source,company_id,item_id,location_id,qty_minor,rate_paise) VALUES ('l1','k1','c1','item1','shop',100,100)`);
    await q(`INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts) VALUES ('inv1','c1','invoice','INV','2026-09-02','u1','owner','d1',now())`);
    await q(`INSERT INTO sales_docs(source_id,company_id,party_id,series,number) VALUES ('inv1','c1','cust1','INV',1)`);
    await q(`INSERT INTO conversion_actions(id,company_id,target_source,actor_user) VALUES ('conv1','c1','inv1','u1')`);
    await q(`INSERT INTO conversion_refs(action_id,kacha_source,kacha_line,qty_minor,company_id) VALUES ('conv1','k1','l1',100,'c1')`);
    await q(`INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts) VALUES ('pur1','c1','purchase','PUR','2026-09-02','u1','owner','d1',now())`);
    await q(`INSERT INTO purchase_docs(source_id,company_id,party_id,series,number,supplier_ref) VALUES ('pur1','c1','supp1','PUR',1,'SUP-001')`);
    await q(`INSERT INTO purchase_lines(id,purchase_source,company_id,item_id,location_id,qty_minor,unit_price_paise) VALUES ('pl1','pur1','c1','item1','shop',10,500)`);
    await q(`INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts) VALUES ('pay1','c1','payment','PAY','2026-09-03','u1','owner','d1',now())`);
    await q(`INSERT INTO payments(source_id,company_id,series,number,amount_paise) VALUES ('pay1','c1','PAY',1,2000)`);
    await q(`INSERT INTO payment_applications(id,company_id,payment_source,invoice_source,amount_paise) VALUES ('app1','c1','pay1','inv1',2000)`);
    // FK violation: unknown item
    await expect(q(`INSERT INTO kacha_lines(id,kacha_source,company_id,item_id,location_id,qty_minor,rate_paise) VALUES ('lx','k1','c1','nope','shop',1,1)`)).rejects.toThrow();
    // Duplicate supplier ref
    await q(`INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts) VALUES ('pur2','c1','purchase','PUR','2026-09-02','u1','owner','d1',now())`);
    await expect(q(`INSERT INTO purchase_docs(source_id,company_id,party_id,series,number,supplier_ref) VALUES ('pur2','c1','supp1','PUR',2,'SUP-001')`)).rejects.toThrow();
  });
});

describe("DB03 company isolation", () => {
  it("cross-company references rejected; RLS blocks cross-tenant reads", async () => {
    await seedBasics();
    // Cross-company FK: c2 party referenced from c1 composite key fails
    await q(`INSERT INTO parties(id,company_id,name) VALUES ('p-c2','c2','Other Party') ON CONFLICT DO NOTHING`);
    await expect(
      q(`INSERT INTO sales_docs(source_id,company_id,party_id,series,number) VALUES ('xs1','c1','p-c2','INV',99)`),
    ).rejects.toThrow();
    // RLS as app_user scoped to c1
    const u = new Client({ connectionString: DB_URL });
    await u.connect();
    try {
      await u.query(`SET ROLE app_user; SET app.company_id = 'c1'`);
      const r = await u.query(`SELECT id FROM parties WHERE company_id='c2'`);
      expect(r.rows).toHaveLength(0);
      await expect(u.query(`INSERT INTO parties(id,company_id,name) VALUES ('evil','c2','Evil')`)).rejects.toThrow();
      await u.query(`RESET ROLE`);
    } finally {
      await u.end();
    }
  });
});

describe("DB04/DB05 idempotent replay", () => {
  it("same source twice (incl. concurrent) commits once", async () => {
    await seedBasics();
    await postBundle("idem-1", "INV");
    await expect(postBundle("idem-1", "INV")).rejects.toThrow(); // PK on sources
    const n = await q(`SELECT COUNT(*)::int AS c FROM postings WHERE source_id='idem-1'`);
    expect(n.rows[0].c).toBe(1);
    // Concurrent same-ID: one wins, other fails on PK
    const results = await Promise.allSettled([postBundle("race-1", "INV"), postBundle("race-1", "INV")]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1);
    const c2 = await q(`SELECT COUNT(*)::int AS c FROM postings WHERE source_id='race-1'`);
    expect(c2.rows[0].c).toBe(1);
  });
});

describe("DB06/DB07 numbering uniqueness + concurrency", () => {
  it("concurrent claims on one series are distinct and gapless-ish", async () => {
    await seedBasics();
    const calls = Array.from({ length: 10 }, (_, i) => postBundle(`num-${i}`, "INVSEQ"));
    const nums = (await Promise.all(calls)).map(Number).sort((a, b) => a - b);
    expect(new Set(nums).size).toBe(10);
    const db = await q(`SELECT number FROM vouchers WHERE series='INVSEQ' ORDER BY 1`);
    expect(db.rows.map((r: { number: string }) => Number(r.number))).toEqual(nums);
  });
});

describe("DB08 period restrictions", () => {
  it("closed period rejects postings and entries", async () => {
    await seedBasics();
    await expect(postBundle("per-1", "INV", { closedPeriod: true })).rejects.toThrow(/PERIOD_CLOSED/);
    const c = await q(`SELECT COUNT(*)::int AS c FROM postings WHERE source_id='per-1'`);
    expect(c.rows[0].c).toBe(0);
  });
});

describe("DB09 posted-record protection", () => {
  it("UPDATE/DELETE of posted truth rejected", async () => {
    await seedBasics();
    await postBundle("imm-1", "INV");
    await expect(q(`UPDATE journal_legs SET debit=999 WHERE id='l1-imm-1'`)).rejects.toThrow(/POSTED_IMMUTABLE/);
    await expect(q(`DELETE FROM stock_movements WHERE id='m-imm-1'`)).rejects.toThrow(/POSTED_IMMUTABLE/);
    await expect(q(`DELETE FROM audit_events WHERE id='a-imm-1'`)).rejects.toThrow(/POSTED_IMMUTABLE/);
    await expect(q(`UPDATE sources SET status='draft' WHERE id='imm-1'`)).rejects.toThrow(/POSTED_IMMUTABLE/);
  });
});

describe("DB10 atomicity + DB11 audit linkage", () => {
  it("unbalanced legs roll back the whole bundle incl. stock/gst/audit", async () => {
    await seedBasics();
    await expect(postBundle("atom-1", "INV", { badLeg: true })).rejects.toThrow(/UNBALANCED_ENTRY/);
    for (const t of ["postings", "vouchers", "journal_entries", "journal_legs", "stock_movements", "gst_determinations", "audit_events"]) {
      const col = t === "audit_events" ? "source_id" : t.startsWith("journal_legs") ? "id" : "source_id";
      const val = t.startsWith("journal_legs") ? "l1-atom-1" : "atom-1";
      const r = await q(`SELECT COUNT(*)::int AS c FROM ${t} WHERE ${col}='${val}'`);
      expect(r.rows[0].c).toBe(0);
    }
  });
  it("posted bundle links entry+movement+determination+audit to one source", async () => {
    await seedBasics();
    await postBundle("link-1", "INV");
    const e = await q(`SELECT source_id,posting_id FROM journal_entries WHERE source_id='link-1'`);
    const m = await q(`SELECT source_id,posting_id FROM stock_movements WHERE source_id='link-1'`);
    const d = await q(`SELECT source_id,posting_id FROM gst_determinations WHERE source_id='link-1'`);
    const a = await q(`SELECT source_id FROM audit_events WHERE source_id='link-1'`);
    expect(e.rows[0].posting_id).toBe(m.rows[0].posting_id);
    expect(m.rows[0].posting_id).toBe(d.rows[0].posting_id);
    expect(a.rows.length).toBeGreaterThan(0);
  });
});

describe("K-DB double-issue guard + delivery type", () => {
  it("conversion target rejects issue/delivery; reversal rows allowed; delivery maps OUT", async () => {
    await seedBasics();
    await q(`INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts) VALUES ('kd1','c1','challan','CH-KACHA','2026-09-01','u1','owner','d1',now())`);
    await q(`INSERT INTO kacha_docs(source_id,company_id,party_id,series,number) VALUES ('kd1','c1','cust1','CH-KACHA',7)`);
    await q(`INSERT INTO kacha_lines(id,kacha_source,company_id,item_id,location_id,qty_minor,rate_paise) VALUES ('l1','kd1','c1','item1','shop',40,100)`);
    await q(`INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts) VALUES ('invd1','c1','invoice','INV','2026-09-02','u1','owner','d1',now())`);
    await q(`INSERT INTO conversion_actions(id,company_id,target_source,actor_user) VALUES ('convd1','c1','invd1','u1')`);
    await q(`INSERT INTO conversion_refs(action_id,kacha_source,kacha_line,qty_minor,company_id) VALUES ('convd1','kd1','l1',40,'c1')`);
    await q(`INSERT INTO vouchers(id,source_id,company_id,series,number) VALUES ('vd1','invd1','c1','INV',9)`);
    await q(`INSERT INTO postings(id,source_id,voucher_id,company_id,period_id) VALUES ('pd1','invd1','vd1','c1','p1')`);
    // Second physical movement for the converted invoice is forbidden…
    await expect(q(`INSERT INTO stock_movements(id,posting_id,source_id,company_id,item_id,location_id,type,direction,qty_minor,business_date,actor_user) VALUES ('m-double','pd1','invd1','c1','item1','shop','issue','OUT',40,'2026-09-02','u1')`)).rejects.toThrow(/DOUBLE_ISSUE/);
    await expect(q(`INSERT INTO stock_movements(id,posting_id,source_id,company_id,item_id,location_id,type,direction,qty_minor,business_date,actor_user) VALUES ('m-double2','pd1','invd1','c1','item1','shop','delivery','OUT',40,'2026-09-02','u1')`)).rejects.toThrow(/DOUBLE_ISSUE/);
    // …but a compensating reversal row is allowed.
    await q(`INSERT INTO stock_movements(id,posting_id,source_id,company_id,item_id,location_id,type,direction,qty_minor,business_date,actor_user) VALUES ('m-rev','pd1','invd1','c1','item1','shop','reversal','IN',40,'2026-09-02','u1')`);
    // Delivery type maps OUT; wrong direction rejected.
    await expect(q(`INSERT INTO stock_movements(id,posting_id,source_id,company_id,item_id,location_id,type,direction,qty_minor,business_date,actor_user) VALUES ('m-wrong','pd1','invd1','c1','item1','shop','delivery','IN',1,'2026-09-02','u1')`)).rejects.toThrow();
    // Remaining view reflects the conversion.
    const rem = await q(`SELECT remaining FROM kacha_remaining WHERE kacha_source='kd1' AND line_id='l1'`);
    expect(Number(rem.rows[0].remaining)).toBe(0);
  });
});
