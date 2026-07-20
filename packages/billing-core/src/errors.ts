export class BillingDomainError extends Error {
  constructor(
    readonly code:
      | "INVALID_SOURCE_PERIOD"
      | "INVALID_TIMESTAMP"
      | "INVALID_MONEY"
      | "INVALID_POLICY"
      | "MISSING_VALUE_BASIS"
      | "INVALID_STATE_TRANSITION",
    message: string,
  ) {
    super(message);
    this.name = "BillingDomainError";
  }
}
