// Shared masters: Company, Party (customer/supplier roles), Item, Location.
// Party is the single identity; customer/supplier are role views (Phase 1 docs/20).
import type { CompanyId, ItemId, LocationId, PartyId } from "./primitives.js";

export interface Company {
  id: CompanyId;
  name: string;
  active: boolean;
}

export type PartyRole = "customer" | "supplier";

export interface Party {
  id: PartyId;
  companyId: CompanyId;
  name: string;
  roles: PartyRole[];
  gstin: string | null;
  active: boolean;
  mergedInto: PartyId | null;
}

export interface Item {
  id: ItemId;
  companyId: CompanyId;
  name: string;
  unit: string;
  qtyScale: number;
  stockTracked: boolean; // false = service/non-stock: never generates movements
  taxCategory: string; // hook only; rates live in GST config
  hsn: string | null;
  active: boolean;
}

export interface Location {
  id: LocationId;
  companyId: CompanyId;
  name: string;
  warehouse: boolean; // subtype flag only, never a separate stock system
  active: boolean;
}
