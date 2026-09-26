// Server session: authenticate membership, enforce roles. Never trusts client
// claims — identity resolves from memberships table on every command.
import type { Pool, PoolClient } from "pg";

export type Role = "owner" | "accountant" | "biller" | "viewer";

export interface Session {
  userId: string;
  companyId: string;
  role: Role;
  deviceId: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(`UNAUTHORIZED: ${message}`);
    this.name = "AuthError";
  }
}

export async function authenticate(
  pool: Pool,
  userId: string,
  companyId: string,
  deviceId: string,
): Promise<Session> {
  const r = await pool.query(`SELECT role FROM memberships WHERE user_id=$1 AND company_id=$2`, [userId, companyId]);
  if (r.rows.length === 0) throw new AuthError("no membership for company");
  return { userId, companyId, role: r.rows[0].role as Role, deviceId };
}

export function requirePoster(s: Session): void {
  if (s.role !== "owner" && s.role !== "accountant" && s.role !== "biller") {
    throw new AuthError(`poster role required (have ${s.role})`);
  }
}

export function requireOwner(s: Session): void {
  if (s.role !== "owner") throw new AuthError(`owner role required (have ${s.role})`);
}

/** Service transaction with session identity bound as SET LOCAL settings so
 *  RLS, guard triggers and api_post_bundle enforce the same principal. */
export async function withServiceTx<T>(pool: Pool, s: Session, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL app.user_id = '${s.userId}'`);
    await c.query(`SET LOCAL app.company_id = '${s.companyId}'`);
    await c.query(`SET LOCAL app.role = '${s.role}'`);
    await c.query(`SET LOCAL app.device_id = '${s.deviceId}'`);
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
