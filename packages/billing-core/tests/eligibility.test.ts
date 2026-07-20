// @vitest-environment node
import { describe, expect, it } from "vitest";
import { calculateRebase, evaluateEligibility } from "../src";
import { activeSource, directPro, policy } from "./fixtures";

const evaluationTimeUtc = "2026-07-19T00:00:00.000Z";

function decide(overrides: Partial<Parameters<typeof evaluateEligibility>[0]> = {}) {
  return evaluateEligibility({
    source: activeSource,
    sourceVerified: true,
    sourceConsumed: false,
    targetPlan: directPro,
    evaluationTimeUtc,
    calculation: calculateRebase({
      source: activeSource,
      targetPlan: directPro,
      policy: policy(),
      evaluationTimeUtc,
    }),
    ...overrides,
  });
}

describe("evaluateEligibility", () => {
  it("allows the active source and surfaces renewal risks", () => {
    const result = decide();
    expect(result.status).toBe("ELIGIBLE");
    expect(result.riskFlags).toEqual([
      "AUTO_RENEW_STILL_ACTIVE",
      "POSSIBLE_DUPLICATE_FUTURE_CHARGE",
    ]);
  });

  it.each([
    [{ source: null, sourceVerified: false }, "SOURCE_NOT_VERIFIED"],
    [{ sourceConsumed: true }, "SOURCE_ALREADY_CONSUMED"],
    [{ source: { ...activeSource, status: "REFUNDED" as const } }, "SOURCE_REFUNDED_OR_REVOKED"],
    [{ source: { ...activeSource, status: "REVOKED" as const } }, "SOURCE_REFUNDED_OR_REVOKED"],
    [{ source: { ...activeSource, status: "EXPIRED" as const } }, "SOURCE_EXPIRED"],
    [
      { source: { ...activeSource, periodEndUtc: activeSource.periodStartUtc } },
      "INVALID_SOURCE_PERIOD",
    ],
    [{ source: { ...activeSource, currency: "USD" } }, "CURRENCY_CONVERSION_NOT_SUPPORTED"],
    [{ targetPlan: { ...directPro, active: false } }, "TARGET_PLAN_INACTIVE"],
    [{ targetIsUpgrade: false }, "TARGET_PLAN_SAME_OR_LOWER_NOT_ALLOWED"],
  ])("returns ineligible for %s", (overrides, reason) => {
    const result = decide(overrides);
    expect(result.status).toBe("INELIGIBLE");
    expect(result.reasons).toContain(reason);
  });

  it("requires manual review for billing recovery and future periods", () => {
    const retry = decide({ source: { ...activeSource, status: "BILLING_RETRY" } });
    const grace = decide({ source: { ...activeSource, status: "GRACE_PERIOD" } });
    const future = decide({ evaluationTimeUtc: "2026-07-01T00:00:00.000Z" });

    expect(retry).toMatchObject({
      status: "MANUAL_REVIEW_REQUIRED",
      reasons: ["SOURCE_BILLING_RETRY"],
    });
    expect(grace.reasons).toContain("SOURCE_GRACE_PERIOD");
    expect(future.reasons).toContain("PERIOD_NOT_STARTED");
  });

  it("blocks an expired quote", () => {
    const result = decide({ quoteExpiresAtUtc: "2026-07-18T23:59:59.000Z" });
    expect(result.reasons).toContain("QUOTE_EXPIRED");
  });

  it("blocks credit below policy minimum", () => {
    const calculation = calculateRebase({
      source: activeSource,
      targetPlan: directPro,
      policy: policy({ minimumCreditMinor: 2000n }),
      evaluationTimeUtc,
    });
    expect(decide({ calculation }).reasons).toContain("BELOW_MINIMUM_CREDIT");
  });
});
