// Inventory: immutable IN/OUT movements, derived balances (Phase 3).
// Representation: direction-enum + strictly positive quantity. No signed qty.
import { DomainError } from "./errors.js";
import type { Actor, BusinessDate, CompanyId, ItemId, LocationId, PostingId, SourceId, Timestamp } from "./primitives.js";
import { newId } from "./primitives.js";

export type Direction = "IN" | "OUT";
export type MovementType =
  | "opening"
  | "receipt"
  | "issue"
  | "delivery" // Kacha / Delivery Challan physical delivery: OUT only, no accounting
  | "transfer-out"
  | "transfer-in"
  | "adjust-in"
  | "adjust-out"
  | "reversal";

export interface StockMovement {
  id: string;
  companyId: CompanyId;
  sourceId: SourceId;
  postingId: PostingId;
  type: MovementType;
  direction: Direction;
  qtyMinor: number; // > 0 integer in item scale
  itemId: ItemId;
  locationId: LocationId;
  businessDate: BusinessDate;
  isOpening: boolean;
  isAdjustment: boolean;
  reversalOf: string | null;
  transferId: string | null; // shared id for paired transfer legs
  actor: Actor;
  createdAt: Timestamp;
  reason: string | null;
}

export interface PostMovementInput {
  companyId: CompanyId;
  sourceId: SourceId;
  postingId: PostingId;
  type: MovementType;
  direction: Direction;
  qtyMinor: number;
  item: { id: ItemId; companyId: CompanyId; active: boolean; stockTracked: boolean };
  location: { id: LocationId; companyId: CompanyId; active: boolean };
  businessDate: BusinessDate;
  actor: Actor;
  now: Timestamp;
  reason?: string | null;
  isOpening?: boolean;
  reversalOf?: string | null;
  transferId?: string | null;
}

const typeDirection: Record<MovementType, Direction> = {
  opening: "IN",
  receipt: "IN",
  issue: "OUT",
  delivery: "OUT",
  "transfer-out": "OUT",
  "transfer-in": "IN",
  "adjust-in": "IN",
  "adjust-out": "OUT",
  reversal: "IN", // placeholder; reversal direction validated against original by caller
};

export function buildMovement(input: PostMovementInput, originalDirection?: Direction): StockMovement {
  if (!Number.isInteger(input.qtyMinor) || input.qtyMinor <= 0) throw new DomainError("INVENTORY_VALIDATION_FAILED", "Quantity must be positive integer minor units");
  if (input.item.companyId !== input.companyId || input.location.companyId !== input.companyId) {
    throw new DomainError("INVALID_COMPANY_CONTEXT", "Item/location belong to another company");
  }
  if (!input.item.active) throw new DomainError("INVENTORY_VALIDATION_FAILED", "Item retired");
  if (!input.item.stockTracked) throw new DomainError("INVENTORY_VALIDATION_FAILED", "Non-stock item cannot move stock");
  if (!input.location.active) throw new DomainError("INVENTORY_VALIDATION_FAILED", "Location retired");
  if (input.type === "reversal") {
    if (!input.reversalOf || !originalDirection) throw new DomainError("INVENTORY_VALIDATION_FAILED", "Reversal needs original ref + direction");
    const want: Direction = originalDirection === "IN" ? "OUT" : "IN";
    if (input.direction !== want) throw new DomainError("INVENTORY_VALIDATION_FAILED", "Reversal must oppose original direction");
  } else if (typeDirection[input.type] !== input.direction) {
    throw new DomainError("INVENTORY_VALIDATION_FAILED", `Type ${input.type} requires direction ${typeDirection[input.type]}`);
  }
  if ((input.type === "adjust-in" || input.type === "adjust-out") && !input.reason) {
    throw new DomainError("INVENTORY_VALIDATION_FAILED", "Adjustments require a reason");
  }
  return {
    id: newId("mv"),
    companyId: input.companyId,
    sourceId: input.sourceId,
    postingId: input.postingId,
    type: input.type,
    direction: input.direction,
    qtyMinor: input.qtyMinor,
    itemId: input.item.id,
    locationId: input.location.id,
    businessDate: input.businessDate,
    isOpening: input.isOpening ?? input.type === "opening",
    isAdjustment: input.type === "adjust-in" || input.type === "adjust-out",
    reversalOf: input.reversalOf ?? null,
    transferId: input.transferId ?? null,
    actor: input.actor,
    createdAt: input.now,
    reason: input.reason ?? null,
  };
}

/** Derived balance: SUM(IN) − SUM(OUT). No stored truth. */
export function onHand(movements: StockMovement[], companyId: CompanyId, itemId: ItemId, locationId: LocationId): number {
  let bal = 0;
  for (const m of movements) {
    if (m.companyId !== companyId || m.itemId !== itemId || m.locationId !== locationId) continue;
    bal += m.direction === "IN" ? m.qtyMinor : -m.qtyMinor;
  }
  return bal;
}
