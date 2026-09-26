// Checkpoint 3 authorization tests: session identity, tenant isolation,
// roles, RPC protection, direct-write revocation. Real PostgreSQL.
import { describe, expect, it, beforeAll } from "vitest";
import { Client } from "pg";
import { DB_URL } from "../src/migrate.js";

let admin: Client;
const AUTH_DB = "postgres://postgres:niaverp-dev-only@localhost:5433/niaverp_auth";
async function q(text: string, params: unknown[] = []) {
  return admin.query(text, params as never[]);
}

// Dedicated session client with explicit identity settings.
async function session(user: string | null, company: string | null, role: string | null) {
  const c = new Client({ connectionString: AUTH_DB });
  await c.connect();
  await c.query("SET ROLE app_user");
  if (user !== null) await c.query(`SET app.user_id = '${user}'`);
  if (company !== null) await c.query(`SET app.company_id = '${company}'`);
  if (role !== null) await c.query(`SET app.role = '${role}'`);
  await c.query(`SET app.device_id = 'test-device'`);
  return c;
}

const SALE = (src: string, company = "c1") => ({
  company_id: company,
  kind: "sale",
  series: "INV",
  business_date: "2026-09-01",
  source_id: src,
  legs: [
    { code: "CUST", debit: 1000, credit: 0 },
    { code: "SALES", debit: 0, credit: 1000 },
  ],
  movements: [{ item: "item1", loc: "shop", type: "issue", direction: "OUT", qty: 1 }],
  gst: [{ supply_class: "taxable", intra_state: true, rate_ref: "EXAMPLE-9+9", taxable: 1000 }],
  audit_kind: "sale",
});

beforeAll(async () => {
  // Isolated database: db.test.ts owns `niaverp` (parallel workers must not share a schema).
  const root = new Client({ connectionString: DB_URL });
  await root.connect();
  try {
    await root.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='niaverp_auth' AND pid <> pg_backend_pid()");
    await root.query("DROP DATABASE IF EXISTS niaverp_auth");
    await root.query("CREATE DATABASE niaverp_auth");
  } finally {
    await root.end();
  }
  const { applyMigrations } = await import("../src/migrate.js");
  await applyMigrations(AUTH_DB);
  admin = new Client({ connectionString: AUTH_DB });
  await admin.connect();
  await q(`INSERT INTO companies(id,name) VALUES ('c1','Dukaan 1'),('c2','Other')`);
  await q(`INSERT INTO profiles(id,display_name) VALUES ('u-owner','Owner'),('u-biller','Biller'),('u-viewer','Viewer'),('u-other','Other')`);
  await q(`INSERT INTO memberships(company_id,user_id,role) VALUES
    ('c1','u-owner','owner'),('c1','u-biller','biller'),('c1','u-viewer','viewer'),('c2','u-other','owner')`);
  await q(`INSERT INTO parties(id,company_id,name) VALUES ('cust1','c1','Cust')`);
  await q(`INSERT INTO party_roles(company_id,party_id,role) VALUES ('c1','cust1','customer')`);
  await q(`INSERT INTO items(id,company_id,name,unit,tax_category) VALUES ('item1','c1','Item','pcs','std')`);
  await q(`INSERT INTO locations(id,company_id,name) VALUES ('shop','c1','Shop')`);
  await q(`INSERT INTO accounts(id,company_id,code,name,type,acc_group) VALUES
    ('a-cash','c1','CASH','Cash','asset','g'),('a-rev','c1','SALES','Sales','income','g'),('a-cust','c1','CUST','Cust','asset','g')`);
  await q(`INSERT INTO periods(id,company_id,start_date,end_date,state) VALUES ('p1','c1','2026-04-01','2027-03-31','open')`);
  await q(`INSERT INTO gst_configs(id,version,effective_from) VALUES ('cfg1','EXAMPLE-v1','2025-04-01')`);
  await q(`INSERT INTO gst_rates(config_id,rate_ref,components,bps_cgst,bps_sgst) VALUES ('cfg1','EXAMPLE-9+9','{CGST,SGST}',900,900)`);
  await q(`INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts) VALUES ('seed-s','c1','opening','OP','2026-08-01','u-owner','owner','seed',now())`);
  await q(`INSERT INTO vouchers(id,source_id,company_id,series,number) VALUES ('seed-v','seed-s','c1','OP',1)`);
  await q(`INSERT INTO postings(id,source_id,voucher_id,company_id,period_id) VALUES ('seed-p','seed-s','seed-v','c1','p1')`);
  await q(`INSERT INTO stock_movements(id,posting_id,source_id,company_id,item_id,location_id,type,direction,qty_minor,business_date,actor_user)
    VALUES ('seed-mv','seed-p','seed-s','c1','item1','shop','receipt','IN',50,'2026-08-01','u-owner')
    ON CONFLICT DO NOTHING`);
  return async () => { await admin.end(); };
}, 120000);

describe("AUTH valid-company post + audit", () => {
  it("owner posts via RPC; audit carries session actor; replay dedupes", async () => {
    const c = await session("u-owner", "c1", "owner");
    try {
      const r1 = await c.query(`SELECT api_post_bundle($1) AS r`, [JSON.stringify(SALE("auth-1"))]);
      expect(r1.rows[0].r.deduped).toBe(false);
      expect(Number(r1.rows[0].r.voucher_number)).toBe(1);
      const aud = await c.query(`SELECT actor_user, actor_role FROM audit_events WHERE source_id='auth-1'`);
      expect(aud.rows[0]).toMatchObject({ actor_user: "u-owner", actor_role: "owner" });
      const r2 = await c.query(`SELECT api_post_bundle($1) AS r`, [JSON.stringify(SALE("auth-1"))]);
      expect(r2.rows[0].r.deduped).toBe(true);
      expect(Number(r2.rows[0].r.voucher_number)).toBe(1);
    } finally {
      await c.end();
    }
  });
});

describe("AUTH anonymous / viewer / wrong-company", () => {
  it("anonymous (no identity) rejected", async () => {
    const c = await session(null, null, null);
    try {
      await expect(c.query(`SELECT api_post_bundle($1)`, [JSON.stringify(SALE("anon-1"))])).rejects.toThrow(/UNAUTHORIZED/);
    } finally {
      await c.end();
    }
  });
  it("viewer posting rejected; viewer reads allowed", async () => {
    const c = await session("u-viewer", "c1", "viewer");
    try {
      await expect(c.query(`SELECT api_post_bundle($1)`, [JSON.stringify(SALE("view-1"))])).rejects.toThrow(/UNAUTHORIZED/);
      const r = await c.query(`SELECT COUNT(*)::int AS n FROM parties`);
      expect(r.rows[0].n).toBeGreaterThan(0);
    } finally {
      await c.end();
    }
  });
  it("wrong-company payload and cross-tenant access rejected", async () => {
    const c = await session("u-other", "c2", "owner");
    try {
      await expect(c.query(`SELECT api_post_bundle($1)`, [JSON.stringify(SALE("x-1", "c1"))])).rejects.toThrow(/INVALID_COMPANY_CONTEXT/);
      const r = await c.query(`SELECT id FROM parties WHERE company_id='c1'`);
      expect(r.rows).toHaveLength(0);
      await expect(c.query(`INSERT INTO parties(id,company_id,name) VALUES ('evil','c1','Evil')`)).rejects.toThrow();
    } finally {
      await c.end();
    }
  });
});

describe("AUTH direct-mutation protection", () => {
  it("client cannot write ledger/stock/numbers directly", async () => {
    const c = await session("u-biller", "c1", "biller");
    try {
      await expect(c.query(`INSERT INTO journal_legs(id,entry_id,company_id,account_id,debit,credit) VALUES ('hack','nope','c1','a-cash',1,0)`)).rejects.toThrow(/denied|permission/i);
      await expect(c.query(`INSERT INTO stock_movements(id,posting_id,source_id,company_id,item_id,location_id,type,direction,qty_minor,business_date,actor_user) VALUES ('h','p','s','c1','item1','shop','receipt','IN',1,'2026-09-01','u-biller')`)).rejects.toThrow(/denied|permission/i);
      await expect(c.query(`SELECT next_voucher_number('c1','INV')`)).rejects.toThrow(/denied|permission/i);
      await expect(c.query(`DELETE FROM audit_events WHERE source_id='auth-1'`)).rejects.toThrow(/denied|permission|IMMUTABLE/i);
    } finally {
      await c.end();
    }
  });
});

describe("AUTH master + owner-only boundaries", () => {
  it("viewer master mutation rejected; biller master ok; biller cannot close period", async () => {
    const v = await session("u-viewer", "c1", "viewer");
    try {
      await expect(v.query(`INSERT INTO parties(id,company_id,name) VALUES ('v-party','c1','V')`)).rejects.toThrow(/UNAUTHORIZED/);
    } finally {
      await v.end();
    }
    const b = await session("u-biller", "c1", "biller");
    try {
      await b.query(`INSERT INTO parties(id,company_id,name) VALUES ('b-party','c1','B')`);
      await expect(b.query(`UPDATE periods SET state='closed' WHERE id='p1' AND company_id='c1'`)).rejects.toThrow(/UNAUTHORIZED/);
    } finally {
      await b.end();
    }
    const o = await session("u-owner", "c1", "owner");
    try {
      await o.query(`INSERT INTO periods(id,company_id,start_date,end_date,state) VALUES ('p-own','c1','2025-04-01','2026-03-31','closed')`);
      const r = await o.query(`SELECT state FROM periods WHERE id='p-own'`);
      expect(r.rows[0].state).toBe("closed");
    } finally {
      await o.end();
    }
  });
});
