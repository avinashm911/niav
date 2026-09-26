// Read-only reporting from domain truth (Checkpoint 7). Every function is a
// SELECT-only fold over posted consequences + links. No writes, no
// recomputation of authoritative tax, no separate balances. Company-scoped.
import type { Pool } from "pg";
import type { Session } from "./session.js";

async function scoped<T>(pool: Pool, s: Session, sql: string, params: unknown[] = []): Promise<T[]> {
  const c = await pool.connect();
  try {
    await c.query(`SET LOCAL app.user_id='${s.userId}'; SET LOCAL app.company_id='${s.companyId}'`);
    // NOTE: SET LOCAL requires a transaction block.
    const r = await c.query(sql, params as never[]);
    return r.rows as T[];
  } finally {
    c.release();
  }
}

async function scopedTx<T>(pool: Pool, s: Session, fn: (q: (sql: string, p?: unknown[]) => Promise<T[]>) => Promise<T[]>): Promise<T[]> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL app.user_id='${s.userId}'; SET LOCAL app.company_id='${s.companyId}'`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await fn(async (sql, p = []) => (await c.query(sql, p as never[])).rows as any as T[]);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export interface RegisterRow {
  source: string;
  series: string;
  number: string;
  party: string;
  business_date: string;
  lines: number;
  qty: string;
  value: string;
}

export async function salesRegister(pool: Pool, s: Session): Promise<RegisterRow[]> {
  return scopedTx<RegisterRow>(pool, s, async (q) => q(
    `SELECT d.source_id AS source, d.series, v.number::text, d.party_id AS party,
            src.business_date::text,
            (SELECT COUNT(*) FROM sales_lines l WHERE l.sale_source=d.source_id) AS lines,
            COALESCE((SELECT SUM(qty_minor) FROM sales_lines l WHERE l.sale_source=d.source_id),0)::text AS qty,
            COALESCE((SELECT SUM(qty_minor*unit_price_paise) FROM sales_lines l WHERE l.sale_source=d.source_id),0)::text AS value
     FROM sales_docs d JOIN vouchers v ON v.source_id=d.source_id JOIN sources src ON src.id=d.source_id
     WHERE d.company_id=$1 ORDER BY v.number`, [s.companyId]));
}

export async function purchaseRegister(pool: Pool, s: Session): Promise<Array<RegisterRow & { supplier_ref: string }>> {
  return scopedTx(pool, s, async (q) => q(
    `SELECT d.source_id AS source, d.series, v.number::text, d.party_id AS party, d.supplier_ref,
            src.business_date::text,
            (SELECT COUNT(*) FROM purchase_lines l WHERE l.purchase_source=d.source_id) AS lines,
            COALESCE((SELECT SUM(qty_minor) FROM purchase_lines l WHERE l.purchase_source=d.source_id),0)::text AS qty,
            COALESCE((SELECT SUM(qty_minor*unit_price_paise) FROM purchase_lines l WHERE l.purchase_source=d.source_id),0)::text AS value
     FROM purchase_docs d JOIN vouchers v ON v.source_id=d.source_id JOIN sources src ON src.id=d.source_id
     WHERE d.company_id=$1 ORDER BY v.number`, [s.companyId]));
}

export interface StockRow {
  item: string;
  location: string;
  on_hand: string;
}

export async function stockBalances(pool: Pool, s: Session): Promise<StockRow[]> {
  return scopedTx(pool, s, async (q) => q(
    `SELECT item_id AS item, location_id AS location,
            SUM(CASE WHEN direction='IN' THEN qty_minor ELSE -qty_minor END)::text AS on_hand
     FROM stock_movements WHERE company_id=$1 GROUP BY 1,2 ORDER BY 1,2`, [s.companyId]));
}

export async function accountBalance(pool: Pool, s: Session, accountId: string): Promise<number> {
  const rows = await scopedTx<{ b: string }>(pool, s, async (q) => q(
    `SELECT COALESCE(SUM(l.debit - l.credit),0)::text AS b FROM journal_legs l
     JOIN journal_entries e ON e.id=l.entry_id WHERE l.company_id=$1 AND l.account_id=$2`, [s.companyId, accountId]));
  return Number(rows[0]!.b);
}

export interface PaymentRow {
  source: string;
  amount: string;
  method: string;
  applied: string;
}

export async function paymentSummary(pool: Pool, s: Session): Promise<PaymentRow[]> {
  return scopedTx(pool, s, async (q) => q(
    `SELECT p.source_id AS source, p.amount_paise::text AS amount, p.method,
            COALESCE((SELECT SUM(amount_paise) FROM payment_applications a WHERE a.payment_source=p.source_id),0)::text AS applied
     FROM payments p WHERE p.company_id=$1 ORDER BY p.created_at`, [s.companyId]));
}

export interface TaxRow {
  source: string;
  supply_class: string;
  rate_ref: string;
  config_version: string;
  taxable: string;
  role: string | null;
  amount: string | null;
}

export async function taxSummary(pool: Pool, s: Session): Promise<TaxRow[]> {
  return scopedTx(pool, s, async (q) => q(
    `SELECT d.source_id AS source, d.supply_class, d.rate_ref, d.config_version, d.taxable_paise::text AS taxable,
            t.role, t.amount_paise::text AS amount
     FROM gst_determinations d LEFT JOIN gst_tax_lines t ON t.determination_id=d.id
     WHERE d.company_id=$1 ORDER BY d.created_at, t.role`, [s.companyId]));
}

export async function kachaTrace(pool: Pool, s: Session, kachaSource: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL app.user_id='${s.userId}'; SET LOCAL app.company_id='${s.companyId}'`);
    const qq = async (sql: string, p: unknown[] = []) => (await c.query(sql, p as never[])).rows as Record<string, unknown>[];
    const docs = await qq(`SELECT * FROM kacha_docs WHERE source_id=$1 AND company_id=$2`, [kachaSource, s.companyId]);
    const lines = await qq(
      `SELECT kl.id, kl.qty_minor,
              kl.qty_minor - COALESCE((SELECT SUM(cr.qty_minor) FROM conversion_refs cr
                WHERE cr.kacha_source=kl.kacha_source AND cr.kacha_line=kl.id
                AND NOT EXISTS (SELECT 1 FROM conversion_reversals r WHERE r.action_id=cr.action_id)),0) AS remaining
       FROM kacha_lines kl WHERE kl.kacha_source=$1 AND kl.company_id=$2`, [kachaSource, s.companyId]);
    const convs = await qq(
      `SELECT ca.id AS action, ca.target_source, cr.kacha_line, cr.qty_minor FROM conversion_refs cr
       JOIN conversion_actions ca ON ca.id=cr.action_id
       WHERE cr.kacha_source=$1 AND cr.company_id=$2`, [kachaSource, s.companyId]);
    await c.query("COMMIT");
    return { docs, lines, convs };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

void scoped;
