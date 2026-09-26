// Device-run seed: creates niaverp_device DB, applies migrations, seeds the
// minimum owner-governed roots (company, users+memberships incl. viewer,
// accounts, period, GST config). Everything else is created on-device (D03+).
import { Client } from "pg";
import { applyMigrations } from "../packages/db/src/migrate.js";

const URL = "postgres://postgres:niaverp-dev-only@localhost:5433/niaverp_device";
const root = new Client({ connectionString: "postgres://postgres:niaverp-dev-only@localhost:5433/niaverp" });
await root.connect();
await root.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='niaverp_device' AND pid <> pg_backend_pid()");
await root.query("DROP DATABASE IF EXISTS niaverp_device");
await root.query("CREATE DATABASE niaverp_device");
await root.end();
await applyMigrations(URL);
const c = new Client({ connectionString: URL });
await c.connect();
await c.query(`INSERT INTO companies(id,name) VALUES ('c1','Device Dukaan')`);
await c.query(`INSERT INTO profiles(id,display_name) VALUES ('u-owner','Owner'),('u-viewer','Viewer')`);
await c.query(`INSERT INTO memberships(company_id,user_id,role) VALUES ('c1','u-owner','owner'),('c1','u-viewer','viewer')`);
await c.query(`INSERT INTO accounts(id,company_id,code,name,type,acc_group) VALUES
  ('a-cash','c1','CASH','Cash','asset','g'),('a-rev','c1','SALES','Sales','income','g'),
  ('a-cost','c1','PURCH','Purchase','expense','g'),('a-cust','c1','CUST','Cust ledger','asset','g'),
  ('a-supd','c1','SUPP','Supp ledger','liability','g')`);
await c.query(`INSERT INTO periods(id,company_id,start_date,end_date,state) VALUES ('p1','c1','2026-04-01','2027-03-31','open')`);
await c.query(`INSERT INTO gst_configs(id,version,effective_from) VALUES ('cfg1','EXAMPLE-v1','2025-04-01')`);
await c.query(`INSERT INTO gst_rates(config_id,rate_ref,components,bps_cgst,bps_sgst) VALUES ('cfg1','EXAMPLE-9+9','{CGST,SGST}',900,900)`);
await c.end();
console.log("seed-device: ready");
