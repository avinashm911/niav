// NiavERP domain — pure TypeScript, zero dependencies.
// Money is stored as integer paise (exact decimal). Quantities as integer
// minor units with per-item scale (default 3 decimals, e.g. grams/kg).
// No floats cross any boundary.

export type CompanyId = string;
export type UserId = string;
export type PartyId = string;
export type ItemId = string;
export type LocationId = string;
export type SeriesId = string;
export type SourceId = string; // durable client-generated UUID
export type PostingId = string;
export type VoucherId = string;
export type ActionId = string;
export type AuditId = string;

export function newId(prefix: string): string {
  // Deterministic-enough durable ID for domain + tests.
  // Runtime (mobile) will use crypto.randomUUID; this keeps domain dependency-free.
  const r = Math.random().toString(16).slice(2, 10);
  const t = Date.now().toString(36);
  return `${prefix}_${t}${r}`;
}

/** Integer paise. 1 INR = 100 paise. Never negative in a posted leg. */
export type Paise = number;

export function inrToPaise(inr: number): Paise {
  return Math.round(inr * 100);
}

export function paiseToInr(p: Paise): number {
  return p / 100;
}

/** Quantity in minor units. scale = decimals (0..3 typical). */
export interface Qty {
  minor: number; // integer >= 0
  scale: number; // decimals, item-defined
}

export function qty(minor: number, scale = 0): Qty {
  if (!Number.isInteger(minor) || minor < 0) throw new Error("INVALID_QUANTITY");
  return { minor, scale };
}

export type BusinessDate = string; // YYYY-MM-DD
export type Timestamp = string; // ISO-8601

export type Role = "owner" | "accountant" | "biller" | "viewer";

export interface Actor {
  userId: UserId;
  companyId: CompanyId;
  role: Role;
  deviceId: string;
}
