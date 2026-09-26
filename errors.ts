// Canonical business error taxonomy (Phase 5 docs/70). Callers branch on
// `code` to decide: correct-now / retry-same-id / refresh-and-resubmit / done.

export type ErrorCode =
  | "INVALID_SOURCE"
  | "UNAUTHORIZED"
  | "INVALID_COMPANY_CONTEXT"
  | "INVALID_DATE"
  | "PERIOD_CLOSED"
  | "PERIOD_LOCKED"
  | "INVALID_MASTER_REFERENCE"
  | "STOCK_CONFLICT"
  | "TAX_CLASSIFICATION_UNAVAILABLE"
  | "TAX_CONFIGURATION_STALE"
  | "ACCOUNTING_VALIDATION_FAILED"
  | "INVENTORY_VALIDATION_FAILED"
  | "GST_VALIDATION_FAILED"
  | "PAYMENT_VALIDATION_FAILED"
  | "DUPLICATE_SOURCE"
  | "CONFLICT"
  | "INVALID_LIFECYCLE_TRANSITION";

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly alreadyComplete: boolean;
  constructor(code: ErrorCode, message: string, opts?: { retryable?: boolean; alreadyComplete?: boolean }) {
    super(`${code}: ${message}`);
    this.name = "DomainError";
    this.code = code;
    this.retryable = opts?.retryable ?? false;
    this.alreadyComplete = opts?.alreadyComplete ?? false;
  }
}
