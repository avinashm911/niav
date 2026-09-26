// Accounting: chart + balanced entries + periods + openings (Phase 2).
// Legs carry positive one-sided paise amounts. No floats. No valuation.
import { DomainError } from "./errors.js";
import { newId, type Actor, type BusinessDate, type CompanyId, type Paise, type PostingId, type SourceId, type Timestamp } from "./primitives.js";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export interface Account {
  id: string;
  companyId: CompanyId;
  code: string;
  name: string;
  type: AccountType;
  group: string;
  active: boolean;
  systemRole: string | null; // e.g. "cash", "bank", "sale", "purchase", "party-ledger", placeholders
}

export type PeriodState = "open" | "closed" | "locked";

export interface Period {
  id: string;
  companyId: CompanyId;
  start: BusinessDate;
  end: BusinessDate;
  state: PeriodState;
}

export interface JournalLeg {
  id: string;
  accountId: string;
  debit: Paise; // exactly one side > 0
  credit: Paise;
}

export interface JournalEntry {
  id: string;
  companyId: CompanyId;
  sourceId: SourceId;
  postingId: PostingId;
  businessDate: BusinessDate;
  periodId: string;
  legs: JournalLeg[];
  isOpening: boolean;
  reverses: string | null; // entry id
  corrects: string | null;
  actor: Actor;
  createdAt: Timestamp;
}

export function validateBalanced(legs: JournalLeg[]): void {
  if (legs.length < 2) throw new DomainError("ACCOUNTING_VALIDATION_FAILED", "Entry needs at least 2 legs");
  let dr = 0;
  let cr = 0;
  for (const l of legs) {
    const both = l.debit > 0 && l.credit > 0;
    const neither = l.debit === 0 && l.credit === 0;
    if (both || neither) throw new DomainError("ACCOUNTING_VALIDATION_FAILED", "Each leg is debit-xor-credit");
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit) || l.debit < 0 || l.credit < 0) {
      throw new DomainError("ACCOUNTING_VALIDATION_FAILED", "Leg amounts must be non-negative integer paise");
    }
    dr += l.debit;
    cr += l.credit;
  }
  if (dr !== cr || dr === 0) throw new DomainError("ACCOUNTING_VALIDATION_FAILED", "TOTAL_DEBITS must equal TOTAL_CREDITS and be non-zero");
}

export interface PostEntryInput {
  companyId: CompanyId;
  sourceId: SourceId;
  postingId: PostingId;
  businessDate: BusinessDate;
  period: Period;
  legs: Array<{ account: Account; debit: Paise; credit: Paise }>;
  isOpening?: boolean | undefined;
  reverses?: string | null | undefined;
  corrects?: string | null | undefined;
  actor: Actor;
  now: Timestamp;
}

export function buildEntry(input: PostEntryInput): JournalEntry {
  if (input.period.companyId !== input.companyId) {
    throw new DomainError("INVALID_COMPANY_CONTEXT", "Period belongs to another company");
  }
  if (input.period.state !== "open") {
    throw new DomainError(input.period.state === "closed" ? "PERIOD_CLOSED" : "PERIOD_LOCKED", `Period ${input.period.state}`);
  }
  for (const l of input.legs) {
    if (l.account.companyId !== input.companyId) throw new DomainError("INVALID_COMPANY_CONTEXT", "Account belongs to another company");
    if (!l.account.active) throw new DomainError("ACCOUNTING_VALIDATION_FAILED", `Account ${l.account.code} retired`);
  }
  const legs: JournalLeg[] = input.legs.map((l) => ({ id: newId("leg"), accountId: l.account.id, debit: l.debit, credit: l.credit }));
  validateBalanced(legs);
  return {
    id: newId("entry"),
    companyId: input.companyId,
    sourceId: input.sourceId,
    postingId: input.postingId,
    businessDate: input.businessDate,
    periodId: input.period.id,
    legs,
    isOpening: input.isOpening ?? false,
    reverses: input.reverses ?? null,
    corrects: input.corrects ?? null,
    actor: input.actor,
    createdAt: input.now,
  };
}
