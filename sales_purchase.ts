// Sales + Purchase workflows over the Store (Phases 7–8) + shared payments.
// Supplier invoice ref is an attribute; NiavERP source/voucher identity is canonical.
import { DomainError } from "./errors.js";
import type { Store } from "./store.js";
import type { Actor, BusinessDate, Paise, SourceId, Timestamp } from "./primitives.js";
import { newId } from "./primitives.js";
import type { GstConfigVersion, SupplyClass } from "./gst.js";
import type { Period } from "./accounting.js";

export interface LineInput {
  itemId: string;
  locationId: string;
  qtyMinor: number;
  unitPricePaise: number;
}

export interface SaleInput {
  sourceId: SourceId;
  companyId: string;
  partyId: string;
  series: string;
  businessDate: BusinessDate;
  actor: Actor;
  now: Timestamp;
  period: Period;
  lines: LineInput[];
  accounts: { debitId: string; creditId: string };
  gst: { supplyClass: SupplyClass; intraState: boolean; rateRef: string; config: GstConfigVersion };
}

function resolveMasters(store: Store, companyId: string, lines: LineInput[]) {
  return lines.map((l) => {
    const item = store.items.get(`${companyId}:${l.itemId}`) ?? store.items.get(l.itemId);
    const location = store.locations.get(`${companyId}:${l.locationId}`) ?? store.locations.get(l.locationId);
    if (!item) throw new DomainError("INVALID_MASTER_REFERENCE", `Unknown item ${l.itemId}`);
    if (!location) throw new DomainError("INVALID_MASTER_REFERENCE", `Unknown location ${l.locationId}`);
    return { ...l, item, location };
  });
}

/** Direct sale: revenue/receivable + issue movements + GST determination, atomically. */
export function postSale(store: Store, input: SaleInput) {
  const party = store.parties.get(`${input.companyId}:${input.partyId}`) ?? store.parties.get(input.partyId);
  if (!party || party.companyId !== input.companyId) throw new DomainError("INVALID_MASTER_REFERENCE", "Unknown party");
  if (!party.roles.includes("customer")) throw new DomainError("INVALID_MASTER_REFERENCE", "Party is not a customer");
  if (!input.lines.length) throw new DomainError("INVALID_SOURCE", "Sale needs lines");
  const lines = resolveMasters(store, input.companyId, input.lines);
  let taxable = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.qtyMinor) || l.qtyMinor <= 0) throw new DomainError("INVALID_SOURCE", "Bad quantity");
    if (!Number.isInteger(l.unitPricePaise) || l.unitPricePaise < 0) throw new DomainError("INVALID_SOURCE", "Bad price");
    taxable += l.qtyMinor * l.unitPricePaise;
  }
  const debit = store.accounts.get(input.accounts.debitId);
  const credit = store.accounts.get(input.accounts.creditId);
  if (!debit || !credit) throw new DomainError("INVALID_MASTER_REFERENCE", "Unknown accounts");
  return store.post({
    companyId: input.companyId, sourceId: input.sourceId, series: input.series,
    businessDate: input.businessDate, actor: input.actor, now: input.now, period: input.period,
    accountLegs: taxable > 0
      ? [{ account: debit, debit: taxable, credit: 0 }, { account: credit, debit: 0, credit: taxable }]
      : [],
    stockIntents: lines.map((l) => ({ type: "issue" as const, direction: "OUT" as const, qtyMinor: l.qtyMinor, item: l.item, location: l.location })),
    gstIntents: [{ supplyClass: input.gst.supplyClass, intraState: input.gst.intraState, rateRef: input.gst.rateRef, taxablePaise: taxable, config: input.gst.config }],
    auditKind: "sale",
  });
}

export interface PurchaseInput extends SaleInput {
  supplierInvoiceRef: string; // external attribute only
  seenSupplierRefs: Set<string>; // duplicate detection scope (company)
}

export function postPurchase(store: Store, input: PurchaseInput) {
  const key = `${input.companyId}:${input.supplierInvoiceRef}`;
  if (input.seenSupplierRefs.has(key)) throw new DomainError("CONFLICT", "Duplicate supplier invoice ref");
  const party = store.parties.get(`${input.companyId}:${input.partyId}`) ?? store.parties.get(input.partyId);
  if (!party || party.companyId !== input.companyId) throw new DomainError("INVALID_MASTER_REFERENCE", "Unknown party");
  if (!party.roles.includes("supplier")) throw new DomainError("INVALID_MASTER_REFERENCE", "Party is not a supplier");
  const lines = resolveMasters(store, input.companyId, input.lines);
  let taxable = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.qtyMinor) || l.qtyMinor <= 0) throw new DomainError("INVALID_SOURCE", "Bad quantity");
    taxable += l.qtyMinor * l.unitPricePaise;
  }
  const debit = store.accounts.get(input.accounts.debitId);
  const credit = store.accounts.get(input.accounts.creditId);
  if (!debit || !credit) throw new DomainError("INVALID_MASTER_REFERENCE", "Unknown accounts");
  const bundle = store.post({
    companyId: input.companyId, sourceId: input.sourceId, series: input.series,
    businessDate: input.businessDate, actor: input.actor, now: input.now, period: input.period,
    accountLegs: taxable > 0
      ? [{ account: debit, debit: taxable, credit: 0 }, { account: credit, debit: 0, credit: taxable }]
      : [],
    stockIntents: lines.map((l) => ({ type: "receipt" as const, direction: "IN" as const, qtyMinor: l.qtyMinor, item: l.item, location: l.location })),
    gstIntents: [{ supplyClass: input.gst.supplyClass, intraState: input.gst.intraState, rateRef: input.gst.rateRef, taxablePaise: taxable, config: input.gst.config }],
    auditKind: "purchase",
  });
  input.seenSupplierRefs.add(key);
  store.audit(input.companyId, input.sourceId, "supplier-ref", input.actor, input.now, { supplierInvoiceRef: input.supplierInvoiceRef });
  return bundle;
}

export interface PaymentInput {
  sourceId: SourceId;
  companyId: string;
  series: string;
  businessDate: BusinessDate;
  actor: Actor;
  now: Timestamp;
  period: Period;
  legs: { debitId: string; creditId: string; amount: Paise };
  applications: Array<{ invoiceSourceId: SourceId; amount: Paise }>;
  applicationsStore: Map<string, Array<{ paymentSourceId: SourceId; amount: Paise }>>;
}

/** Payment fact + application links. Zero applications = advance (never auto-applied). */
export function postPayment(store: Store, input: PaymentInput) {
  const debit = store.accounts.get(input.legs.debitId);
  const credit = store.accounts.get(input.legs.creditId);
  if (!debit || !credit) throw new DomainError("INVALID_MASTER_REFERENCE", "Unknown accounts");
  if (!Number.isInteger(input.legs.amount) || input.legs.amount <= 0) throw new DomainError("INVALID_SOURCE", "Bad payment amount");
  const bundle = store.post({
    companyId: input.companyId, sourceId: input.sourceId, series: input.series,
    businessDate: input.businessDate, actor: input.actor, now: input.now, period: input.period,
    accountLegs: [
      { account: debit, debit: input.legs.amount, credit: 0 },
      { account: credit, debit: 0, credit: input.legs.amount },
    ],
    auditKind: "payment",
  });
  for (const a of input.applications) {
    const list = input.applicationsStore.get(a.invoiceSourceId) ?? [];
    list.push({ paymentSourceId: input.sourceId, amount: a.amount });
    input.applicationsStore.set(a.invoiceSourceId, list);
  }
  store.audit(input.companyId, input.sourceId, "payment-apply", input.actor, input.now, {
    applications: input.applications, advance: input.applications.length === 0,
  });
  return bundle;
}

export function outstandingFor(applications: Map<string, Array<{ amount: Paise }>>, invoiceSourceId: SourceId, invoiced: Paise): Paise {
  const applied = (applications.get(invoiceSourceId) ?? []).reduce((a, x) => a + x.amount, 0);
  return invoiced - applied;
}

export { newId };
