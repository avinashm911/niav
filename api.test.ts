// API transport test: real HTTP against a scratch database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, Pool } from "pg";
import type { AddressInfo } from "node:net";
import { DB_URL, applyMigrations } from "../../db/src/migrate.js";
import { createApi } from "../src/index.js";

const API_DB = "postgres://postgres:niaverp-dev-only@localhost:5433/niaverp_api";
const pool = new Pool({ connectionString: API_DB });
let base = "";

async function cmd(auth: object, op: string, input: object) {
  const r = await fetch(`${base}/command`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ auth, op, input }),
  });
  return (await r.json()) as { ok: boolean; out?: never; error?: string };
}

beforeAll(async () => {
  const root = new Client({ connectionString: DB_URL });
  await root.connect();
  try {
    await root.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='niaverp_api' AND pid <> pg_backend_pid()");
    await root.query("DROP DATABASE IF EXISTS niaverp_api");
    await root.query("CREATE DATABASE niaverp_api");
  } finally {
    await root.end();
  }
  await applyMigrations(API_DB);
  const admin = new Client({ connectionString: API_DB });
  await admin.connect();
  try {
    await admin.query(`INSERT INTO companies(id,name) VALUES ('c1','Shop')`);
    await admin.query(`INSERT INTO profiles(id,display_name) VALUES ('u1','Owner')`);
    await admin.query(`INSERT INTO memberships(company_id,user_id,role) VALUES ('c1','u1','owner')`);
    await admin.query(`INSERT INTO accounts(id,company_id,code,name,type,acc_group) VALUES ('a1','c1','CASH','Cash','asset','g'),('a2','c1','SALES','Sales','income','g'),('a3','c1','CUST','Cust','asset','g')`);
    await admin.query(`INSERT INTO periods(id,company_id,start_date,end_date,state) VALUES ('p1','c1','2026-04-01','2027-03-31','open')`);
    await admin.query(`INSERT INTO parties(id,company_id,name) VALUES ('cust1','c1','Cust')`);
    await admin.query(`INSERT INTO party_roles(company_id,party_id,role) VALUES ('c1','cust1','customer')`);
    await admin.query(`INSERT INTO items(id,company_id,name,unit,tax_category) VALUES ('item1','c1','Item','pcs','std')`);
    await admin.query(`INSERT INTO locations(id,company_id,name) VALUES ('shop','c1','Shop')`);
    await admin.query(`INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts) VALUES ('s0','c1','opening','OP','2026-08-01','u1','owner','seed',now())`);
    await admin.query(`INSERT INTO vouchers(id,source_id,company_id,series,number) VALUES ('v0','s0','c1','OP',1)`);
    await admin.query(`INSERT INTO postings(id,source_id,voucher_id,company_id,period_id) VALUES ('p0','s0','v0','c1','p1')`);
    await admin.query(`INSERT INTO stock_movements(id,posting_id,source_id,company_id,item_id,location_id,type,direction,qty_minor,business_date,actor_user) VALUES ('m0','p0','s0','c1','item1','shop','receipt','IN',10,'2026-08-01','u1')`);
    await admin.query(`INSERT INTO gst_configs(id,version,effective_from) VALUES ('cfg1','EXAMPLE-v1','2025-04-01')`);
    await admin.query(`INSERT INTO gst_rates(config_id,rate_ref,components,bps_cgst,bps_sgst) VALUES ('cfg1','EXAMPLE-9+9','{CGST,SGST}',900,900)`);
  } finally {
    await admin.end();
  }
  const server = createApi(pool);
  await new Promise<void>((resolve) => { server.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  (globalThis as { __apiServer?: unknown }).__apiServer = server;
}, 180000);

afterAll(async () => {
  const server = (globalThis as { __apiServer?: { close: (cb: () => void) => void } }).__apiServer;
  if (server) await new Promise<void>((resolve) => { server.close(resolve); });
  await pool.end();
});

describe("api transport", () => {
  it("health, sale round-trip, auth rejection, unknown op", async () => {
    const auth = { userId: "u1", companyId: "c1", deviceId: "d" };
    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    const sale = await cmd(auth, "sale.post", {
      partyId: "cust1", series: "INV", businessDate: "2026-09-01",
      lines: [{ itemId: "item1", locationId: "shop", qtyMinor: 2, unitPricePaise: 800 }],
      accounts: { debitCode: "CUST", creditCode: "SALES" },
      gst: { supplyClass: "taxable", intraState: true, rateRef: "EXAMPLE-9+9" },
    });
    expect(sale.ok).toBe(true);
    const stock = await cmd(auth, "read.stock", {});
    expect(stock.ok).toBe(true);
    const badAuth = await cmd({ userId: "ghost", companyId: "c1", deviceId: "d" }, "read.stock", {});
    expect(badAuth.ok).toBe(false);
    expect(badAuth.error).toMatch(/UNAUTHORIZED/);
    const badOp = await cmd(auth, "nope.op", {});
    expect(badOp.ok).toBe(false);
  });
});
