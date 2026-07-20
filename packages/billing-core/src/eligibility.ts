import type {
  EligibilityDecision,
  EligibilityReason,
  RebaseCalculation,
  RiskFlag,
  TargetPlan,
  VerifiedSubscription,
} from "./types";

type EligibilityInput = {
  source: VerifiedSubscription | null;
  sourceVerified: boolean;
  sourceConsumed: boolean;
  targetPlan: TargetPlan;
  evaluationTimeUtc: string;
  targetIsUpgrade?: boolean;
  calculation?: RebaseCalculation;
  quoteExpiresAtUtc?: string;
};

export function evaluateEligibility(input: EligibilityInput): EligibilityDecision {
  const ineligible: EligibilityReason[] = [];
  const manualReview: EligibilityReason[] = [];
  const riskFlags: RiskFlag[] = [];
  const source = input.source;

  if (!input.sourceVerified || source === null) {
    return { status: "INELIGIBLE", reasons: ["SOURCE_NOT_VERIFIED"], riskFlags: [] };
  }

  const startMs = Date.parse(source.periodStartUtc);
  const endMs = Date.parse(source.periodEndUtc);
  const evaluationMs = Date.parse(input.evaluationTimeUtc);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    ineligible.push("INVALID_SOURCE_PERIOD");
  }
  if (source.status === "REFUNDED" || source.status === "REVOKED") {
    ineligible.push("SOURCE_REFUNDED_OR_REVOKED");
  }
  if (input.sourceConsumed) ineligible.push("SOURCE_ALREADY_CONSUMED");
  if (source.status === "EXPIRED" || (Number.isFinite(evaluationMs) && evaluationMs >= endMs)) {
    ineligible.push("SOURCE_EXPIRED");
  }
  if (source.currency !== input.targetPlan.currency) {
    ineligible.push("CURRENCY_CONVERSION_NOT_SUPPORTED");
  }
  if (!input.targetPlan.active) ineligible.push("TARGET_PLAN_INACTIVE");
  if (input.targetIsUpgrade === false) {
    ineligible.push("TARGET_PLAN_SAME_OR_LOWER_NOT_ALLOWED");
  }
  if (input.calculation?.reasons.includes("BELOW_MINIMUM_CREDIT")) {
    ineligible.push("BELOW_MINIMUM_CREDIT");
  }
  if (
    input.quoteExpiresAtUtc &&
    Number.isFinite(evaluationMs) &&
    evaluationMs >= Date.parse(input.quoteExpiresAtUtc)
  ) {
    ineligible.push("QUOTE_EXPIRED");
  }

  if (ineligible.length > 0) {
    return { status: "INELIGIBLE", reasons: dedupe(ineligible), riskFlags: [] };
  }

  if (source.status === "BILLING_RETRY") {
    manualReview.push("SOURCE_BILLING_RETRY");
    riskFlags.push("SOURCE_BILLING_RECOVERY_RISK");
  }
  if (source.status === "GRACE_PERIOD") {
    manualReview.push("SOURCE_GRACE_PERIOD");
    riskFlags.push("SOURCE_BILLING_RECOVERY_RISK");
  }
  if (evaluationMs < startMs) manualReview.push("PERIOD_NOT_STARTED");

  if (source.autoRenew) {
    riskFlags.push("AUTO_RENEW_STILL_ACTIVE", "POSSIBLE_DUPLICATE_FUTURE_CHARGE");
  }
  if (input.calculation?.reasons.some((reason) => reason.includes("CAP_APPLIED"))) {
    riskFlags.push("CREDIT_CAPPED");
  }
  if (input.calculation && input.calculation.carryForwardMinor > 0n) {
    riskFlags.push("CARRY_FORWARD_CREATED");
  }

  return {
    status: manualReview.length > 0 ? "MANUAL_REVIEW_REQUIRED" : "ELIGIBLE",
    reasons: dedupe(manualReview),
    riskFlags: dedupe(riskFlags),
  };
}

function dedupe<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}
