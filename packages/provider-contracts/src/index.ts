import type { Provider, TargetPlan, VerifiedSubscription } from "@take-my-money/billing-core";

export interface SourceSubscriptionProvider {
  readonly provider: Provider;

  verifySubscription(input: {
    lookupReference: string;
    demoSessionId: string;
    requestId: string;
  }): Promise<VerifiedSubscription>;

  getSubscriptionStatus(input: {
    sourceFingerprint: string;
    demoSessionId: string;
    requestId: string;
  }): Promise<VerifiedSubscription>;
}

export type TargetCreationResult =
  | {
      status: "SUCCEEDED";
      externalSubscriptionId: string;
      externalInvoiceId: string;
      startedAtUtc: string;
      renewsAtUtc: string;
    }
  | { status: "FAILED"; failureCode: string; retryable: boolean }
  | { status: "UNKNOWN" };

export type TargetLookupResult =
  Extract<TargetCreationResult, { status: "SUCCEEDED" | "FAILED" }> | { status: "NOT_FOUND" };

export interface TargetBillingProvider {
  createSubscription(input: {
    operationId: string;
    plan: TargetPlan;
    amountDueMinor: bigint;
    currency: string;
    externalIdempotencyKey: string;
    requestId: string;
  }): Promise<TargetCreationResult>;

  findByIdempotencyKey(input: {
    externalIdempotencyKey: string;
    requestId: string;
  }): Promise<TargetLookupResult>;
}
