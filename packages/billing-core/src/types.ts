export type Provider = "APPLE_SANDBOX" | "DIRECT_SANDBOX";

export type CurrencyCode = string;

export type MinorUnits = bigint;

export type SourceSubscriptionStatus =
  "ACTIVE" | "EXPIRED" | "REFUNDED" | "REVOKED" | "BILLING_RETRY" | "GRACE_PERIOD";

export type VerifiedSubscription = {
  provider: Provider;
  externalSubscriptionId: string;
  originalTransactionId: string;
  productId: string;
  planName: string;
  status: SourceSubscriptionStatus;
  periodStartUtc: string;
  periodEndUtc: string;
  amountPaidMinor: MinorUnits;
  currency: CurrencyCode;
  autoRenew: boolean;
  environment: "SANDBOX" | "PRODUCTION";
  verifiedAtUtc: string;
};

export type TargetPlan = {
  id: string;
  displayName: string;
  priceMinor: MinorUnits;
  currency: CurrencyCode;
  billingInterval: "MONTHLY" | "ANNUAL";
  active: boolean;
};

export type CreditPolicy = {
  id: string;
  version: string;
  valueBasis: "GROSS_AMOUNT_PAID" | "REFERENCE_LIST_PRICE" | "NET_SETTLEMENT_VALUE";
  reimbursementRateBps: bigint;
  minimumCreditMinor: MinorUnits;
  maximumCreditMinor: MinorUnits | null;
  allowCarryForward: boolean;
  quoteTtlSeconds: number;
  roundingMode: "HALF_UP";
};

export type RebaseCalculation = {
  algorithmVersion: string;
  evaluationTimeUtc: string;
  periodDurationMs: bigint;
  remainingDurationMs: bigint;
  unusedRatioNumerator: bigint;
  unusedRatioDenominator: bigint;
  sourceValueMinor: bigint;
  reimbursementRateBps: bigint;
  migrationCreditMinor: bigint;
  targetPriceMinor: bigint;
  creditAppliedMinor: bigint;
  amountDueMinor: bigint;
  carryForwardMinor: bigint;
  currency: string;
  roundingMode: "HALF_UP";
  policyId: string;
  policyVersion: string;
  reasons: string[];
};

export type EligibilityReason =
  | "SOURCE_NOT_VERIFIED"
  | "SOURCE_EXPIRED"
  | "SOURCE_REFUNDED_OR_REVOKED"
  | "SOURCE_ALREADY_CONSUMED"
  | "INVALID_SOURCE_PERIOD"
  | "CURRENCY_CONVERSION_NOT_SUPPORTED"
  | "TARGET_PLAN_INACTIVE"
  | "TARGET_PLAN_SAME_OR_LOWER_NOT_ALLOWED"
  | "BELOW_MINIMUM_CREDIT"
  | "QUOTE_EXPIRED"
  | "SOURCE_BILLING_RETRY"
  | "SOURCE_GRACE_PERIOD"
  | "PERIOD_NOT_STARTED"
  | "PROVIDER_STATUS_AMBIGUOUS"
  | "TARGET_RESULT_UNKNOWN"
  | "DATA_MISMATCH";

export type RiskFlag =
  | "AUTO_RENEW_STILL_ACTIVE"
  | "POSSIBLE_DUPLICATE_FUTURE_CHARGE"
  | "SOURCE_BILLING_RECOVERY_RISK"
  | "CREDIT_CAPPED"
  | "CARRY_FORWARD_CREATED"
  | "AI_EXTRACTION_LOW_CONFIDENCE"
  | "AI_EXTRACTION_MISMATCH"
  | "QUOTE_NEAR_EXPIRY";

export type EligibilityDecision = {
  status: "ELIGIBLE" | "INELIGIBLE" | "MANUAL_REVIEW_REQUIRED";
  reasons: EligibilityReason[];
  riskFlags: RiskFlag[];
};
