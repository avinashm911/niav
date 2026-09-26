// Application commands: UI/API -> session -> domain validation -> api_post_bundle
// (atomic) -> commercial rows -> audit. No business math here: totals come
// from callers, balance/availability/tax enforced inside api_post_bundle.
// LOCKED (global correction): Kacha / Delivery Challan is physical delivery —
// creation posts ONE inventory OUT movement per line and NO accounting/GST.
// A later invoice consumes Kacha quantity and posts accounting/GST with NO
// further stock movement.
import type { Pool, PoolClient } from "pg";
import { authenticate, requireOwner, requirePoster, withServiceTx, type Session } from "./session.js";

export interface LineIn {
  itemId: string;
  locationId: string;
  qtyMinor: number;
  unitPricePaise: number;
}
export interface GstIn {
  supplyClass: "taxable" | "exempt" | "nil-rated" | "non-gst" | "zero-rated";
  intraState: boolean;
  rateRef: string;
  configVersion?: string;
}
export interface Accts {
  debitCode: string;
  creditCode: string;
}
export interface PostResult {
  sourceId: string;
  postingId: string;
  voucherNumber: number | string;
  deduped: boolean;
}

let seq = 0;
export function newSource(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}-${Math.random().toString(16).slice(2, 8)}`;
}

async function apiPost(
  c: PoolClient,
  s: Session,
  p: {
    sourceId: string;
    kind: string;
    series: string;
    businessDate: string;
    legs: Array<{ code: string; debit: number; credit: number }>;
    movements?: Array<{ item: string; loc: string; type: string; direction: string; qty: number; reason?: string }>;
    gst?: Array<{ supply_class: string; intra_state: boolean; rate_ref: string; taxable: number }>;
    audit_kind?: string;
  },
): Promise<PostResult> {
  const r = await c.query(`SELECT api_post_bundle($1) AS r`, [
    JSON.stringify({
      company_id: s.companyId, kind: p.kind, series: p.series, business_date: p.businessDate,
      source_id: p.sourceId, legs: p.legs,
      movements: p.movements ?? [], gst: p.gst ?? [], audit_kind: p.audit_kind ?? p.kind,
    }),
  ]);
  const row = r.rows[0].r as { posting_id: string; voucher_number: number | string; deduped: boolean };
  return { sourceId: p.sourceId, postingId: row.posting_id, voucherNumber: row.voucher_number, deduped: row.deduped };
}

async function needMaster<T>(c: PoolClient, sql: string, params: unknown[], what: string): Promise<T> {
  const r = await c.query(sql, params as never[]);
  if (r.rows.length === 0) throw new Error(`INVALID_MASTER_REFERENCE: unknown ${what}`);
  return r.rows[0] as T;
}

// ---- masters ----

export async function createParty(pool: Pool, s: Session, input: { id?: string; name: string; roles: Array<"customer" | "supplier">; gstin?: string | null }) {
  requirePoster(s);
  const id = input.id ?? newSource("party");
  return withServiceTx(pool, s, async (c) => {
    await c.query(`INSERT INTO parties(id,company_id,name,gstin) VALUES ($1,$2,$3,$4)`, [id, s.companyId, input.name, input.gstin ?? null]);
    for (const r of input.roles) {
      await c.query(`INSERT INTO party_roles(company_id,party_id,role) VALUES ($1,$2,$3)`, [s.companyId, id, r]);
    }
    await c.query(
      `INSERT INTO audit_events(id,company_id,source_id,kind,actor_user,actor_role,device_id,detail) VALUES ($1,$2,NULL,'master-party-create',$3,$4,$5,$6)`,
      [`aud-${id}`, s.companyId, s.userId, s.role, s.deviceId, JSON.stringify({ party: id })],
    );
    return { id };
  });
}

export async function createItem(pool: Pool, s: Session, input: { id?: string; name: string; unit?: string; stockTracked?: boolean; taxCategory?: string; hsn?: string | null }) {
  requirePoster(s);
  const id = input.id ?? newSource("item");
  return withServiceTx(pool, s, async (c) => {
    await c.query(
      `INSERT INTO items(id,company_id,name,unit,stock_tracked,tax_category,hsn) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, s.companyId, input.name, input.unit ?? "pcs", input.stockTracked ?? true, input.taxCategory ?? "std", input.hsn ?? null],
    );
    return { id };
  });
}

export async function createLocation(pool: Pool, s: Session, input: { id?: string; name: string; warehouse?: boolean }) {
  requirePoster(s);
  const id = input.id ?? newSource("loc");
  return withServiceTx(pool, s, async (c) => {
    await c.query(`INSERT INTO locations(id,company_id,name,warehouse) VALUES ($1,$2,$3,$4)`, [id, s.companyId, input.name, input.warehouse ?? false]);
    return { id };
  });
}

export async function createAccount(pool: Pool, s: Session, input: { id?: string; code: string; name: string; type: string; group?: string; systemRole?: string | null }) {
  requireOwner(s);
  const id = input.id ?? newSource("acc");
  return withServiceTx(pool, s, async (c) => {
    await c.query(`INSERT INTO accounts(id,company_id,code,name,type,acc_group,system_role) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, s.companyId, input.code, input.name, input.type, input.group ?? "g", input.systemRole ?? null]);
    return { id };
  });
}

// ---- sales / purchase ----

export interface DocInput {
  sourceId?: string;
  partyId: string;
  series: string;
  businessDate: string;
  lines: LineIn[];
  accounts: Accts;
  gst: GstIn;
}

function taxableOf(lines: LineIn[]): number {
  return lines.reduce((a, l) => {
    if (!Number.isInteger(l.qtyMinor) || l.qtyMinor <= 0) throw new Error("INVALID_SOURCE: bad quantity");
    if (!Number.isInteger(l.unitPricePaise) || l.unitPricePaise < 0) throw new Error("INVALID_SOURCE: bad price");
    return a + l.qtyMinor * l.unitPricePaise;
  }, 0);
}

async function needStockLine(c: PoolClient, companyId: string, l: LineIn): Promise<void> {
  await needMaster(c, `SELECT 1 FROM items WHERE company_id=$1 AND id=$2 AND active AND stock_tracked`, [companyId, l.itemId], "stock-tracked active item");
  await needMaster(c, `SELECT 1 FROM locations WHERE company_id=$1 AND id=$2 AND active`, [companyId, l.locationId], "active location");
}

export async function postSale(pool: Pool, s: Session, input: DocInput): Promise<PostResult> {
  requirePoster(s);
  const sourceId = input.sourceId ?? newSource("src");
  const taxable = taxableOf(input.lines);
  return withServiceTx(pool, s, async (c) => {
    await needMaster(c, `SELECT 1 FROM parties WHERE company_id=$1 AND id=$2 AND active`, [s.companyId, input.partyId], "party");
    for (const l of input.lines) await needStockLine(c, s.companyId, l);
    const out = await apiPost(c, s, {
      sourceId, kind: "sale", series: input.series, businessDate: input.businessDate,
      legs: [{ code: input.accounts.debitCode, debit: taxable, credit: 0 }, { code: input.accounts.creditCode, debit: 0, credit: taxable }],
      movements: input.lines.map((l) => ({ item: l.itemId, loc: l.locationId, type: "issue", direction: "OUT", qty: l.qtyMinor })),
      gst: [{ supply_class: input.gst.supplyClass, intra_state: input.gst.intraState, rate_ref: input.gst.rateRef, taxable }],
    });
    if (!out.deduped) {
      const num = await c.query(`SELECT number FROM vouchers WHERE source_id=$1`, [sourceId]);
      await c.query(`INSERT INTO sales_docs(source_id,company_id,party_id,series,number) VALUES ($1,$2,$3,$4,$5)`,
        [sourceId, s.companyId, input.partyId, input.series, num.rows[0].number]);
      for (let i = 0; i < input.lines.length; i++) {
        const l = input.lines[i]!;
        await c.query(
          `INSERT INTO sales_lines(id,sale_source,company_id,item_id,location_id,qty_minor,unit_price_paise) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [`${sourceId}-l${i}`, sourceId, s.companyId, l.itemId, l.locationId, l.qtyMinor, l.unitPricePaise],
        );
      }
    }
    return out;
  });
}

export async function postPurchase(pool: Pool, s: Session, input: DocInput & { supplierRef: string }): Promise<PostResult> {
  requirePoster(s);
  const sourceId = input.sourceId ?? newSource("src");
  const taxable = taxableOf(input.lines);
  return withServiceTx(pool, s, async (c) => {
    await needMaster(c, `SELECT 1 FROM parties WHERE company_id=$1 AND id=$2 AND active`, [s.companyId, input.partyId], "party");
    for (const l of input.lines) await needStockLine(c, s.companyId, l);
    const out = await apiPost(c, s, {
      sourceId, kind: "purchase", series: input.series, businessDate: input.businessDate,
      legs: [{ code: input.accounts.debitCode, debit: taxable, credit: 0 }, { code: input.accounts.creditCode, debit: 0, credit: taxable }],
      movements: input.lines.map((l) => ({ item: l.itemId, loc: l.locationId, type: "receipt", direction: "IN", qty: l.qtyMinor })),
      gst: [{ supply_class: input.gst.supplyClass, intra_state: input.gst.intraState, rate_ref: input.gst.rateRef, taxable }],
      audit_kind: "purchase",
    });
    if (!out.deduped) {
      const num = await c.query(`SELECT number FROM vouchers WHERE source_id=$1`, [sourceId]);
      await c.query(`INSERT INTO purchase_docs(source_id,company_id,party_id,series,number,supplier_ref) VALUES ($1,$2,$3,$4,$5,$6)`,
        [sourceId, s.companyId, input.partyId, input.series, num.rows[0].number, input.supplierRef]);
      for (let i = 0; i < input.lines.length; i++) {
        const l = input.lines[i]!;
        await c.query(
          `INSERT INTO purchase_lines(id,purchase_source,company_id,item_id,location_id,qty_minor,unit_price_paise) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [`${sourceId}-l${i}`, sourceId, s.companyId, l.itemId, l.locationId, l.qtyMinor, l.unitPricePaise],
        );
      }
      await c.query(
        `INSERT INTO audit_events(id,company_id,source_id,kind,actor_user,actor_role,device_id,detail) VALUES ($1,$2,$3,'supplier-ref',$4,$5,$6,$7)`,
        [`aud-${sourceId}-ref`, s.companyId, sourceId, s.userId, s.role, s.deviceId, JSON.stringify({ supplierRef: input.supplierRef })],
      );
    }
    return out;
  });
}

// ---- payments (advance = zero applications, never auto-applied) ----

export async function postPayment(
  pool: Pool, s: Session,
  input: { sourceId?: string; series: string; businessDate: string; debitCode: string; creditCode: string; amount: number; method?: string; applications?: Array<{ invoiceSource: string; amount: number }> },
): Promise<PostResult> {
  requirePoster(s);
  const sourceId = input.sourceId ?? newSource("src");
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error("INVALID_SOURCE: bad payment amount");
  return withServiceTx(pool, s, async (c) => {
    const out = await apiPost(c, s, {
      sourceId, kind: "payment", series: input.series, businessDate: input.businessDate,
      legs: [{ code: input.debitCode, debit: input.amount, credit: 0 }, { code: input.creditCode, debit: 0, credit: input.amount }],
      audit_kind: "payment",
    });
    if (!out.deduped) {
      const num = await c.query(`SELECT number FROM vouchers WHERE source_id=$1`, [sourceId]);
      await c.query(`INSERT INTO payments(source_id,company_id,series,number,amount_paise,method) VALUES ($1,$2,$3,$4,$5,$6)`,
        [sourceId, s.companyId, input.series, num.rows[0].number, input.amount, input.method ?? "cash"]);
      for (const a of input.applications ?? []) {
        await c.query(`INSERT INTO payment_applications(id,company_id,payment_source,invoice_source,amount_paise) VALUES ($1,$2,$3,$4,$5)`,
          [`${sourceId}-a-${a.invoiceSource}`, s.companyId, sourceId, a.invoiceSource, a.amount]);
      }
      await c.query(
        `INSERT INTO audit_events(id,company_id,source_id,kind,actor_user,actor_role,device_id,detail) VALUES ($1,$2,$3,'payment-apply',$4,$5,$6,$7)`,
        [`aud-${sourceId}-apply`, s.companyId, sourceId, s.userId, s.role, s.deviceId,
          JSON.stringify({ applications: input.applications ?? [], advance: (input.applications ?? []).length === 0 })],
      );
    }
    return out;
  });
}

// ---- kacha ----

export async function createKacha(
  pool: Pool, s: Session,
  input: { sourceId?: string; partyId: string; series: string; businessDate: string; lines: Array<{ id?: string; itemId: string; locationId: string; qtyMinor: number; ratePaise: number }> },
): Promise<{ sourceId: string }> {
  requirePoster(s);
  const sourceId = input.sourceId ?? newSource("src");
  if (!input.lines.length) throw new Error("INVALID_SOURCE: Kacha needs lines");
  return withServiceTx(pool, s, async (c) => {
    await needMaster(c, `SELECT 1 FROM parties WHERE company_id=$1 AND id=$2 AND active`, [s.companyId, input.partyId], "party");
    for (const l of input.lines) {
      await needMaster(c, `SELECT 1 FROM items WHERE company_id=$1 AND id=$2 AND active AND stock_tracked`, [s.companyId, l.itemId], "stock-tracked active item");
      await needMaster(c, `SELECT 1 FROM locations WHERE company_id=$1 AND id=$2 AND active`, [s.companyId, l.locationId], "active location");
      if (!Number.isInteger(l.qtyMinor) || l.qtyMinor <= 0) throw new Error("INVALID_SOURCE: bad Kacha quantity");
    }
    // Physical delivery: ONE inventory OUT movement per line, no legs, no GST.
    const out = await apiPost(c, s, {
      sourceId, kind: "challan", series: input.series, businessDate: input.businessDate,
      legs: [],
      movements: input.lines.map((l) => ({ item: l.itemId, loc: l.locationId, type: "delivery", direction: "OUT", qty: l.qtyMinor })),
      gst: [],
      audit_kind: "kacha-create",
    });
    if (!out.deduped) {
      const num = await c.query(`SELECT number FROM vouchers WHERE source_id=$1`, [sourceId]);
      await c.query(`INSERT INTO kacha_docs(source_id,company_id,party_id,series,number) VALUES ($1,$2,$3,$4,$5)`,
        [sourceId, s.companyId, input.partyId, input.series, num.rows[0].number]);
      for (let i = 0; i < input.lines.length; i++) {
        const l = input.lines[i]!;
        await c.query(`INSERT INTO kacha_lines(id,kacha_source,company_id,item_id,location_id,qty_minor,rate_paise) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [l.id ?? `${sourceId}-l${i}`, sourceId, s.companyId, l.itemId, l.locationId, l.qtyMinor, l.ratePaise]);
      }
    }
    return { sourceId };
  });
}

export async function kachaRemaining(pool: Pool, s: Session, kachaSource: string, lineId: string): Promise<number> {
  const r = await pool.query(
    `SELECT remaining FROM kacha_remaining WHERE kacha_source=$1 AND line_id=$2 AND company_id=$3`,
    [kachaSource, lineId, s.companyId],
  );
  if (r.rows.length === 0) throw new Error("INVALID_SOURCE: unknown kacha line");
  return Number(r.rows[0].remaining);
}

export async function convertKacha(
  pool: Pool, s: Session,
  input: {
    actionId?: string; refs: Array<{ kachaSource: string; lineId: string; qtyMinor: number }>;
    series: string; businessDate: string; unitPricePaise: number;
    accounts: Accts; gst: GstIn;
  },
): Promise<PostResult> {
  requirePoster(s);
  const actionId = input.actionId ?? newSource("conv");
  return withServiceTx(pool, s, async (c) => {
    const done = await c.query(`SELECT target_source FROM conversion_actions WHERE id=$1 AND company_id=$2`, [actionId, s.companyId]);
    if (done.rows.length > 0) {
      const t = await c.query(`SELECT p.id AS posting_id, v.number FROM postings p JOIN vouchers v ON v.source_id=p.source_id WHERE p.source_id=$1`, [done.rows[0].target_source]);
      return { sourceId: done.rows[0].target_source as string, postingId: t.rows[0]?.posting_id as string, voucherNumber: Number(t.rows[0]?.number ?? 0), deduped: true };
    }
    if (input.refs.length === 0) throw new Error("INVALID_SOURCE: empty conversion");
    let party: string | null = null;
    let totalQty = 0;
    for (const r of input.refs) {
      const kl = await c.query(
        `SELECT kl.qty_minor, kl.rate_paise, kl.item_id, kd.party_id FROM kacha_lines kl
         JOIN kacha_docs kd ON kd.source_id=kl.kacha_source
         WHERE kl.kacha_source=$1 AND kl.id=$2 AND kl.company_id=$3 FOR UPDATE OF kl`,
        [r.kachaSource, r.lineId, s.companyId],
      );
      if (kl.rows.length === 0) throw new Error("INVALID_SOURCE: unknown kacha line");
      const row = kl.rows[0] as { qty_minor: string; rate_paise: string; item_id: string; party_id: string };
      if (party === null) party = row.party_id;
      if (row.party_id !== party) throw new Error("INVALID_SOURCE: incompatible parties in many→one");
      if (input.unitPricePaise !== Number(row.rate_paise)) throw new Error("INVALID_SOURCE: rate edit DENY");
      // The physical delivery movement must exist: conversion consumes it, never duplicates it.
      const delivered = await c.query(
        `SELECT COUNT(*)::int AS c FROM stock_movements
         WHERE source_id=$1 AND company_id=$2 AND type='delivery'`,
        [r.kachaSource, s.companyId],
      );
      if (delivered.rows[0].c === 0) throw new Error("INVALID_SOURCE: kacha has no delivery movement");
      const rem = await c.query(`SELECT remaining FROM kacha_remaining WHERE kacha_source=$1 AND line_id=$2 AND company_id=$3`, [r.kachaSource, r.lineId, s.companyId]);
      if (rem.rows.length === 0) throw new Error("INVALID_SOURCE: unknown kacha line");
      if (Number(rem.rows[0].remaining) < r.qtyMinor) throw new Error("STOCK_CONFLICT: over-conversion exceeds remaining");
      totalQty += r.qtyMinor;
    }
    const taxable = totalQty * input.unitPricePaise;
    const targetSource = newSource("src");
    // Accounting + GST for the invoiced quantity. NO inventory movement: the
    // physical OUT already happened at Kacha time (enforced by trg_no_double_issue).
    const out = await apiPost(c, s, {
      sourceId: targetSource, kind: "sale", series: input.series, businessDate: input.businessDate,
      legs: [{ code: input.accounts.debitCode, debit: taxable, credit: 0 }, { code: input.accounts.creditCode, debit: 0, credit: taxable }],
      gst: [{ supply_class: input.gst.supplyClass, intra_state: input.gst.intraState, rate_ref: input.gst.rateRef, taxable }],
      audit_kind: "convert",
    });
    const num = await c.query(`SELECT number FROM vouchers WHERE source_id=$1`, [targetSource]);
    await c.query(`INSERT INTO sales_docs(source_id,company_id,party_id,series,number) VALUES ($1,$2,$3,$4,$5)`,
      [targetSource, s.companyId, party, input.series, num.rows[0].number]);
    await c.query(`INSERT INTO conversion_actions(id,company_id,target_source,actor_user) VALUES ($1,$2,$3,$4)`,
      [actionId, s.companyId, targetSource, s.userId]);
    for (const r of input.refs) {
      await c.query(`INSERT INTO conversion_refs(action_id,kacha_source,kacha_line,qty_minor,company_id) VALUES ($1,$2,$3,$4,$5)`,
        [actionId, r.kachaSource, r.lineId, r.qtyMinor, s.companyId]);
    }
    return out;
  });
}

// ---- returns / reversal / correction (additive; originals retained) ----

export async function postReturn(
  pool: Pool, s: Session,
  input: { originalSource: string; series: string; businessDate: string; lines: LineIn[]; accounts: Accts; reason: string; side: "sales" | "purchase" },
): Promise<PostResult> {
  requirePoster(s);
  const sourceId = newSource("src");
  const taxable = taxableOf(input.lines);
  return withServiceTx(pool, s, async (c) => {
    const orig = await c.query(`SELECT company_id FROM sources WHERE id=$1`, [input.originalSource]);
    if (orig.rows.length === 0 || orig.rows[0].company_id !== s.companyId) throw new Error("INVALID_SOURCE: unknown original");
    for (const l of input.lines) await needStockLine(c, s.companyId, l);
    // Sales return: goods come back (IN). Purchase return: goods go back (OUT).
    const isSales = input.side === "sales";
    const out = await apiPost(c, s, {
      sourceId, kind: "return", series: input.series, businessDate: input.businessDate,
      legs: [{ code: input.accounts.debitCode, debit: taxable, credit: 0 }, { code: input.accounts.creditCode, debit: 0, credit: taxable }],
      movements: input.lines.map((l) => ({
        item: l.itemId, loc: l.locationId,
        type: isSales ? "receipt" : "issue", direction: isSales ? ("IN" as const) : ("OUT" as const),
        qty: l.qtyMinor, reason: input.reason,
      })),
      audit_kind: "return",
    });
    await c.query(
      `INSERT INTO audit_events(id,company_id,source_id,kind,actor_user,actor_role,device_id,detail) VALUES ($1,$2,$3,'return-link',$4,$5,$6,$7)`,
      [`aud-${sourceId}-ret`, s.companyId, sourceId, s.userId, s.role, s.deviceId,
        JSON.stringify({ returns: input.originalSource, reason: input.reason })],
    );
    return out;
  });
}

export async function reverseSource(
  pool: Pool, s: Session, input: { originalSource: string; series: string; businessDate: string; reason: string },
): Promise<PostResult> {
  requirePoster(s);
  const sourceId = newSource("src");
  return withServiceTx(pool, s, async (c) => {
    const dup = await c.query(
      `SELECT 1 FROM audit_events WHERE company_id=$1 AND kind='reverse-link' AND detail->>'reverses'=$2 LIMIT 1`,
      [s.companyId, input.originalSource],
    );
    if (dup.rows.length > 0) throw new Error("INVALID_LIFECYCLE_TRANSITION: already reversed");
    // A Kacha with invoiced quantity cannot be reversed behind the invoice's
    // back: reverse the converted invoices first (commercial lineage safety).
    const kacha = await c.query(`SELECT source_id FROM kacha_docs WHERE source_id=$1 AND company_id=$2`, [input.originalSource, s.companyId]);
    if (kacha.rows.length > 0) {
      const invoiced = await c.query(
        `SELECT COALESCE(SUM(cr.qty_minor),0)::int AS q FROM conversion_refs cr
         JOIN kacha_lines kl ON kl.kacha_source=cr.kacha_source AND kl.id=cr.kacha_line
         LEFT JOIN conversion_reversals r ON r.action_id=cr.action_id
         WHERE cr.kacha_source=$1 AND cr.company_id=$2 AND r.action_id IS NULL`,
        [input.originalSource, s.companyId],
      );
      if (Number(invoiced.rows[0].q) > 0) {
        throw new Error("INVALID_LIFECYCLE_TRANSITION: kacha has invoiced quantity; reverse the converted invoices first");
      }
    }
    const legs = await c.query(
      `SELECT l.account_id, a.code, l.debit, l.credit FROM journal_legs l
       JOIN journal_entries e ON e.id=l.entry_id JOIN accounts a ON a.id=l.account_id AND a.company_id=l.company_id
       WHERE e.source_id=$1 AND e.company_id=$2`,
      [input.originalSource, s.companyId],
    );
    const moves = await c.query(`SELECT item_id,location_id,type,direction,qty_minor FROM stock_movements WHERE source_id=$1 AND company_id=$2`, [input.originalSource, s.companyId]);
    if (legs.rows.length === 0 && moves.rows.length === 0) throw new Error("INVALID_SOURCE: nothing to reverse");
    const out = await apiPost(c, s, {
      sourceId, kind: "reversal", series: input.series, businessDate: input.businessDate,
      legs: legs.rows.map((l: { code: string; debit: string; credit: string }) => ({
        code: l.code, debit: Number(l.credit), credit: Number(l.debit),
      })),
      movements: moves.rows.map((m: { item_id: string; location_id: string; qty_minor: string; direction: string }) => ({
        item: m.item_id, loc: m.location_id, type: "reversal", direction: m.direction === "IN" ? "OUT" : "IN",
        qty: Number(m.qty_minor), reason: input.reason,
      })),
      audit_kind: "reverse",
    });
    await c.query(
      `INSERT INTO audit_events(id,company_id,source_id,kind,actor_user,actor_role,device_id,detail) VALUES ($1,$2,$3,'reverse-link',$4,$5,$6,$7)`,
      [`aud-${sourceId}-rev`, s.companyId, sourceId, s.userId, s.role, s.deviceId,
        JSON.stringify({ reverses: input.originalSource, reason: input.reason })],
    );
    // Reversing a converted invoice restores Kacha convertibility: record the
    // conversion reversal additively (remaining recalculates; history kept).
    const conv = await c.query(`SELECT id FROM conversion_actions WHERE target_source=$1 AND company_id=$2`, [input.originalSource, s.companyId]);
    for (const a of conv.rows as Array<{ id: string }>) {
      await c.query(`INSERT INTO conversion_reversals(action_id,reversal_source,company_id,actor_user) VALUES ($1,$2,$3,$4) ON CONFLICT (action_id) DO NOTHING`,
        [a.id, sourceId, s.companyId, s.userId]);
    }
    return out;
  });
}

export async function correctSource(
  pool: Pool, s: Session,
  input: { originalSource: string; series: string; businessDate: string; reason: string; replacement: { lines: LineIn[]; accounts: Accts; gst: GstIn; partyId: string } },
): Promise<{ reversal: PostResult; replacement: PostResult; correctionId: string }> {
  const correctionId = newSource("corr");
  const reversal = await reverseSource(pool, s, { originalSource: input.originalSource, series: input.series, businessDate: input.businessDate, reason: `correction:${correctionId}:${input.reason}` });
  // A converted invoice's replacement must not move stock either: the goods
  // were delivered once at Kacha time. Detect conversion lineage and post
  // the replacement as accounting/GST-only.
  const c0 = await pool.connect();
  let converted: boolean;
  try {
    const r = await c0.query(`SELECT 1 FROM conversion_actions WHERE target_source=$1`, [input.originalSource]);
    converted = r.rows.length > 0;
  } finally {
    c0.release();
  }
  const replacement = converted
    ? await (async () => {
        const taxable = input.replacement.lines.reduce((a, l) => a + l.qtyMinor * l.unitPricePaise, 0);
        return withServiceTx(pool, s, async (c) => {
          for (const l of input.replacement.lines) await needStockLine(c, s.companyId, l);
          const sourceId = newSource("src");
          const out = await apiPost(c, s, {
            sourceId, kind: "sale", series: input.series, businessDate: input.businessDate,
            legs: [
              { code: input.replacement.accounts.debitCode, debit: taxable, credit: 0 },
              { code: input.replacement.accounts.creditCode, debit: 0, credit: taxable },
            ],
            gst: [{ supply_class: input.replacement.gst.supplyClass, intra_state: input.replacement.gst.intraState, rate_ref: input.replacement.gst.rateRef, taxable }],
            audit_kind: "correct-replace",
          });
          const num = await c.query(`SELECT number FROM vouchers WHERE source_id=$1`, [sourceId]);
          await c.query(`INSERT INTO sales_docs(source_id,company_id,party_id,series,number) VALUES ($1,$2,$3,$4,$5)`,
            [sourceId, s.companyId, input.replacement.partyId, input.series, num.rows[0].number]);
          return out;
        });
      })()
    : await postSale(pool, s, {
        partyId: input.replacement.partyId, series: input.series, businessDate: input.businessDate,
        lines: input.replacement.lines, accounts: input.replacement.accounts, gst: input.replacement.gst,
      });
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO audit_events(id,company_id,source_id,kind,actor_user,actor_role,device_id,detail) VALUES ($1,$2,$3,'correct-link',$4,$5,$6,$7)`,
      [`aud-${correctionId}`, s.companyId, replacement.sourceId, s.userId, s.role, s.deviceId,
        JSON.stringify({ correctionId, reverses: input.originalSource, reversal: reversal.sourceId, replacement: replacement.sourceId, reason: input.reason })],
    );
  } finally {
    c.release();
  }
  return { reversal, replacement, correctionId };
}

// ---- lookups + sync ----

export async function getTransaction(pool: Pool, s: Session, sourceId: string) {
  const c = await pool.connect();
  try {
    await c.query(`SET LOCAL app.user_id='${s.userId}'; SET LOCAL app.company_id='${s.companyId}'`);
    const head = await c.query(
      `SELECT s.id, s.kind, s.status, v.series, v.number, p.id AS posting_id, s.business_date
       FROM sources s LEFT JOIN vouchers v ON v.source_id=s.id LEFT JOIN postings p ON p.source_id=s.id
       WHERE s.id=$1 AND s.company_id=$2`, [sourceId, s.companyId]);
    if (head.rows.length === 0) throw new Error("INVALID_SOURCE: unknown transaction");
    const legs = await c.query(`SELECT l.account_id, l.debit, l.credit FROM journal_legs l JOIN journal_entries e ON e.id=l.entry_id WHERE e.source_id=$1`, [sourceId]);
    const moves = await c.query(`SELECT item_id, location_id, type, direction, qty_minor FROM stock_movements WHERE source_id=$1`, [sourceId]);
    const tax = await c.query(`SELECT d.supply_class, d.rate_ref, d.config_version, d.taxable_paise, t.role, t.amount_paise FROM gst_determinations d LEFT JOIN gst_tax_lines t ON t.determination_id=d.id WHERE d.source_id=$1`, [sourceId]);
    const audits = await c.query(`SELECT kind, actor_user, actor_role, created_at, detail FROM audit_events WHERE source_id=$1 ORDER BY created_at`, [sourceId]);
    return { head: head.rows[0], legs: legs.rows, moves: moves.rows, tax: tax.rows, audits: audits.rows };
  } finally {
    c.release();
  }
}

export async function getAuditTrail(pool: Pool, s: Session, sourceId: string) {
  const t = await getTransaction(pool, s, sourceId);
  return t.audits;
}

export async function submitSync(pool: Pool, s: Session, input: { sourceId: string; status: "pending" | "acked" | "rejected" | "conflicted" }) {
  requirePoster(s);
  return withServiceTx(pool, s, async (c) => {
    await c.query(
      `INSERT INTO sync_outbox(source_id,company_id,status,attempts,updated_at) VALUES ($1,$2,$3,1,now())
       ON CONFLICT (source_id) DO UPDATE SET status=EXCLUDED.status, attempts=sync_outbox.attempts+1, updated_at=now()`,
      [input.sourceId, s.companyId, input.status],
    );
    return { sourceId: input.sourceId, status: input.status };
  });
}

export { authenticate };
export type { Session };
