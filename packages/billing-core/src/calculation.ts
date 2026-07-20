import { BillingDomainError } from "./errors";
import { assertNonNegativeMinorUnits, divideAndRoundHalfUp, minBigInt } from "./money";
import type { CreditPolicy, RebaseCalculation, TargetPlan, VerifiedSubscription } from "./types";

export const BILLING_ALGORITHM_VERSION = "utc-rational-v1";

export const DEMO_CREDIT_POLICY: CreditPolicy = {
  id: "demo-gross-portability",
  version: "1.0.0",
  valueBasis: "GROSS_AMOUNT_PAID",
  reimbursementRateBps: 10_000n,
  minimumCreditMinor: 1n,
  maximumCreditMinor: null,
  allowCarryForward: true,
  quoteTtlSeconds: 600,
  roundingMode: "HALF_UP",
};

type CalculationInput = {
  source: VerifiedSubscription;
  targetPlan: TargetPlan;
  policy: CreditPolicy;
  evaluationTimeUtc: string;
  referenceListPriceMinor?: bigint;
  netSettlementValueMinor?: bigint;
};

function parseUtcMilliseconds(value: string, label: string): bigint {
  if (!value.endsWith("Z")) {
    throw new BillingDomainError("INVALID_TIMESTAMP", `${label} must be an ISO UTC timestamp`);
  }

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new BillingDomainError("INVALID_TIMESTAMP", `${label} is invalid`);
  }

  return BigInt(milliseconds);
}

function clamp(value: bigint, minimum: bigint, maximum: bigint): bigint {
  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}

function resolveSourceValue(input: CalculationInput): bigint {
  switch (input.policy.valueBasis) {
    case "GROSS_AMOUNT_PAID":
      return input.source.amountPaidMinor;
    case "REFERENCE_LIST_PRICE":
      if (input.referenceListPriceMinor === undefined) {
        throw new BillingDomainError(
          "MISSING_VALUE_BASIS",
          "Reference list price is required by this policy",
        );
      }
      return input.referenceListPriceMinor;
    case "NET_SETTLEMENT_VALUE":
      if (input.netSettlementValueMinor === undefined) {
        throw new BillingDomainError(
          "MISSING_VALUE_BASIS",
          "Net settlement value is required by this policy",
        );
      }
      return input.netSettlementValueMinor;
  }
}

function assertPolicy(policy: CreditPolicy): void {
  if (
    policy.reimbursementRateBps < 0n ||
    policy.reimbursementRateBps > 10_000n ||
    policy.minimumCreditMinor < 0n ||
    (policy.maximumCreditMinor !== null && policy.maximumCreditMinor < 0n) ||
    policy.quoteTtlSeconds <= 0 ||
    policy.roundingMode !== "HALF_UP"
  ) {
    throw new BillingDomainError("INVALID_POLICY", "Credit policy contains invalid values");
  }
}

export function calculateRebase(input: CalculationInput): RebaseCalculation {
  assertPolicy(input.policy);
  assertNonNegativeMinorUnits(input.source.amountPaidMinor, "source amount");
  assertNonNegativeMinorUnits(input.targetPlan.priceMinor, "target price");

  if (input.source.currency !== input.targetPlan.currency) {
    throw new BillingDomainError("INVALID_MONEY", "Source and target currency must match");
  }

  const periodStartMs = parseUtcMilliseconds(input.source.periodStartUtc, "periodStartUtc");
  const periodEndMs = parseUtcMilliseconds(input.source.periodEndUtc, "periodEndUtc");
  const evaluationTimeMs = parseUtcMilliseconds(input.evaluationTimeUtc, "evaluationTimeUtc");
  const periodDurationMs = periodEndMs - periodStartMs;

  if (periodDurationMs <= 0n) {
    throw new BillingDomainError(
      "INVALID_SOURCE_PERIOD",
      "Source period end must be after its start",
    );
  }

  const remainingDurationMs = clamp(periodEndMs - evaluationTimeMs, 0n, periodDurationMs);
  const sourceValueMinor = resolveSourceValue(input);
  assertNonNegativeMinorUnits(sourceValueMinor, "source value");

  const numerator = sourceValueMinor * remainingDurationMs * input.policy.reimbursementRateBps;
  const denominator = periodDurationMs * 10_000n;
  let migrationCreditMinor = divideAndRoundHalfUp(numerator, denominator);
  const reasons: string[] = [];

  if (
    input.policy.maximumCreditMinor !== null &&
    migrationCreditMinor > input.policy.maximumCreditMinor
  ) {
    migrationCreditMinor = input.policy.maximumCreditMinor;
    reasons.push("MAXIMUM_CREDIT_CAP_APPLIED");
  }

  if (migrationCreditMinor < input.policy.minimumCreditMinor) {
    migrationCreditMinor = 0n;
    reasons.push("BELOW_MINIMUM_CREDIT");
  }

  if (!input.policy.allowCarryForward && migrationCreditMinor > input.targetPlan.priceMinor) {
    migrationCreditMinor = input.targetPlan.priceMinor;
    reasons.push("TARGET_PRICE_CAP_APPLIED");
  }

  const creditAppliedMinor = minBigInt(migrationCreditMinor, input.targetPlan.priceMinor);
  const amountDueMinor = input.targetPlan.priceMinor - creditAppliedMinor;
  const carryForwardMinor = migrationCreditMinor - creditAppliedMinor;
  const ratioDivisor = greatestCommonDivisor(remainingDurationMs, periodDurationMs);

  const result: RebaseCalculation = {
    algorithmVersion: BILLING_ALGORITHM_VERSION,
    evaluationTimeUtc: input.evaluationTimeUtc,
    periodDurationMs,
    remainingDurationMs,
    unusedRatioNumerator: remainingDurationMs / ratioDivisor,
    unusedRatioDenominator: periodDurationMs / ratioDivisor,
    sourceValueMinor,
    reimbursementRateBps: input.policy.reimbursementRateBps,
    migrationCreditMinor,
    targetPriceMinor: input.targetPlan.priceMinor,
    creditAppliedMinor,
    amountDueMinor,
    carryForwardMinor,
    currency: input.targetPlan.currency,
    roundingMode: input.policy.roundingMode,
    policyId: input.policy.id,
    policyVersion: input.policy.version,
    reasons,
  };

  assertCalculationInvariants(result);
  return result;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a === 0n ? 1n : a;
}

export function assertCalculationInvariants(calculation: RebaseCalculation): void {
  const nonNegative = [
    calculation.remainingDurationMs,
    calculation.sourceValueMinor,
    calculation.migrationCreditMinor,
    calculation.targetPriceMinor,
    calculation.creditAppliedMinor,
    calculation.amountDueMinor,
    calculation.carryForwardMinor,
  ];

  if (
    calculation.periodDurationMs <= 0n ||
    nonNegative.some((value) => value < 0n) ||
    calculation.remainingDurationMs > calculation.periodDurationMs ||
    calculation.creditAppliedMinor > calculation.migrationCreditMinor ||
    calculation.creditAppliedMinor > calculation.targetPriceMinor ||
    calculation.amountDueMinor + calculation.creditAppliedMinor !== calculation.targetPriceMinor ||
    calculation.creditAppliedMinor + calculation.carryForwardMinor !==
      calculation.migrationCreditMinor
  ) {
    throw new BillingDomainError("INVALID_MONEY", "Calculation invariant failed");
  }
}
