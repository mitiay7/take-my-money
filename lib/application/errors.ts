export class ApplicationError extends Error {
  constructor(
    readonly code:
      | "SCENARIO_NOT_FOUND"
      | "OPERATION_NOT_FOUND"
      | "OPERATION_NOT_CONFIRMABLE"
      | "SOURCE_NOT_VERIFIED"
      | "SOURCE_ALREADY_CONSUMED"
      | "TARGET_PLAN_NOT_FOUND"
      | "QUOTE_NOT_FOUND"
      | "QUOTE_EXPIRED"
      | "QUOTE_FINGERPRINT_MISMATCH"
      | "CONSENT_REQUIRED"
      | "IDEMPOTENCY_KEY_REQUIRED"
      | "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD"
      | "REQUEST_IN_PROGRESS"
      | "TARGET_CREATION_FAILED"
      | "RECONCILIATION_REQUIRED"
      | "RECONCILIATION_NOT_READY"
      | "CONCURRENT_STATE_CHANGE",
    message: string,
    readonly httpStatus: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
