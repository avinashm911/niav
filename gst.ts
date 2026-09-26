// GST: versioned configuration + deterministic determination (Phase 4).
// Rates live ONLY in GstConfig versions. Nothing hardcoded. Example values
// in tests are fixtures labelled EXAMPLE-*, never locked rules.
import { DomainError } from "./errors.js";
import { newId, type Actor, type BusinessDate, type CompanyId, type SourceId, type Timestamp } from "./primitives.js";

export type SupplyClass = "taxable" | "exempt" | "nil-rated" | "non-gst" | "zero-rated";
export type ComponentRole = "CGST" | "SGST" | "IGST" | "UTGST" | "CESS";

export interface GstConfigVersion {
  id: string;
  version: string;
  effectiveFrom: BusinessDate;
  effectiveTo: BusinessDate | null;
  /** rateRef -> { components: ComponentRole[] } — structure only; bps values live alongside */
  rates: Record<string, { components: ComponentRole[]; bps: Partial<Record<ComponentRole, number>> }>;
}

export interface GstInputs {
  companyId: CompanyId;
  supplyClass: SupplyClass;
  intraState: boolean; // true => CGST+SGST (or CGST+UTGST when utTerritory), false => IGST
  utTerritory?: boolean;
  cessBps?: number; // optional cess role in basis points
  rateRef: string;
  taxablePaise: number; // >= 0 integer paise
  businessDate: BusinessDate;
  config: GstConfigVersion;
}

export interface TaxLine {
  id: string;
  determinationId: string;
  role: ComponentRole;
  rateRef: string;
  configVersion: string;
  basisPaise: number;
  amountPaise: number;
}

export interface GstDetermination {
  id: string;
  companyId: CompanyId;
  sourceId: SourceId;
  supplyClass: SupplyClass;
  rateRef: string;
  configVersion: string;
  taxablePaise: number;
  lines: TaxLine[];
  actor: Actor;
  createdAt: Timestamp;
}

function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator / 2) / denominator);
}

export function determineGst(input: GstInputs, sourceId: SourceId, actor: Actor, now: Timestamp): GstDetermination {
  if (!Number.isInteger(input.taxablePaise) || input.taxablePaise < 0) {
    throw new DomainError("GST_VALIDATION_FAILED", "Taxable value must be non-negative integer paise");
  }
  if (input.supplyClass !== "taxable" && input.supplyClass !== "zero-rated") {
    // exempt / nil-rated / non-gst carry classification, no amount lines
    const det: GstDetermination = {
      id: newId("txd"),
      companyId: input.companyId,
      sourceId,
      supplyClass: input.supplyClass,
      rateRef: input.rateRef,
      configVersion: input.config.version,
      taxablePaise: input.taxablePaise,
      lines: [],
      actor,
      createdAt: now,
    };
    return det;
  }
  const rate = input.config.rates[input.rateRef];
  if (!rate) throw new DomainError("TAX_CONFIGURATION_STALE", `No effective rate ${input.rateRef} in config ${input.config.version}`);
  const want: ComponentRole[] = input.intraState
    ? input.utTerritory
      ? ["CGST", "UTGST"]
      : ["CGST", "SGST"]
    : ["IGST"];
  const have: Set<ComponentRole> = new Set(rate.components.filter((c) => c !== "CESS"));
  if (have.size !== want.length || !want.every((w) => have.has(w))) {
    throw new DomainError("GST_VALIDATION_FAILED", `Rate ${input.rateRef} structure does not match ${input.intraState ? "intra-state" : "inter-state"} determination`);
  }
  const detId = newId("txd");
  const lines: TaxLine[] = want.map((role) => {
    const bps = rate.bps[role] ?? 0;
    const amountPaise = roundHalfUp(input.taxablePaise * bps, 10000);
    return { id: newId("txl"), determinationId: detId, role, rateRef: input.rateRef, configVersion: input.config.version, basisPaise: input.taxablePaise, amountPaise };
  });
  if (input.supplyClass === "zero-rated") {
    for (const l of lines) l.amountPaise = 0;
  }
  if (input.cessBps && input.cessBps > 0) {
    lines.push({
      id: newId("txl"),
      determinationId: detId,
      role: "CESS",
      rateRef: input.rateRef,
      configVersion: input.config.version,
      basisPaise: input.taxablePaise,
      amountPaise: roundHalfUp(input.taxablePaise * input.cessBps, 10000),
    });
  }
  return { id: detId, companyId: input.companyId, sourceId, supplyClass: input.supplyClass, rateRef: input.rateRef, configVersion: input.config.version, taxablePaise: input.taxablePaise, lines, actor, createdAt: now };
}
