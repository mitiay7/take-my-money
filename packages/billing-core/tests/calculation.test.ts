// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BillingDomainError,
  calculateRebase,
  divideAndRoundHalfUp,
  serializeBigInts,
} from "../src";
import { activeSource, directPro, policy } from "./fixtures";

function calculate(
  sourceOverrides: Partial<typeof activeSource> = {},
  inputOverrides: Partial<Parameters<typeof calculateRebase>[0]> = {},
) {
  return calculateRebase({
    source: { ...activeSource, ...sourceOverrides },
    targetPlan: directPro,
    policy: policy(),
    evaluationTimeUtc: "2026-07-19T00:00:00.000Z",
    ...inputOverrides,
  });
}

describe("calculateRebase", () => {
  it("calculates the documented 19/31 result exactly", () => {
    const result = calculate();

    expect(result.periodDurationMs).toBe(2_678_400_000n);
    expect(result.remainingDurationMs).toBe(1_641_600_000n);
    expect(result.unusedRatioNumerator).toBe(19n);
    expect(result.unusedRatioDenominator).toBe(31n);
    expect(result.migrationCreditMinor).toBe(1532n);
    expect(result.amountDueMinor).toBe(21_368n);
    expect(result.carryForwardMinor).toBe(0n);
  });

  it("returns full value at period start", () => {
    expect(
      calculate({}, { evaluationTimeUtc: activeSource.periodStartUtc }).migrationCreditMinor,
    ).toBe(2499n);
  });

  it("returns zero at and after period end", () => {
    expect(
      calculate({}, { evaluationTimeUtc: activeSource.periodEndUtc }).migrationCreditMinor,
    ).toBe(0n);
    expect(
      calculate({}, { evaluationTimeUtc: "2026-09-01T00:00:00.000Z" }).migrationCreditMinor,
    ).toBe(0n);
  });

  it("caps evaluation before the period at full value", () => {
    const result = calculate({}, { evaluationTimeUtc: "2026-06-01T00:00:00.000Z" });
    expect(result.remainingDurationMs).toBe(result.periodDurationMs);
    expect(result.migrationCreditMinor).toBe(2499n);
  });

  it("handles a one-second period", () => {
    const result = calculate(
      {
        periodStartUtc: "2026-07-19T00:00:00.000Z",
        periodEndUtc: "2026-07-19T00:00:01.000Z",
        amountPaidMinor: 101n,
      },
      { evaluationTimeUtc: "2026-07-19T00:00:00.500Z" },
    );
    expect(result.migrationCreditMinor).toBe(51n);
  });

  it("uses exact UTC duration across leap day and DST boundaries", () => {
    const leap = calculate(
      {
        periodStartUtc: "2024-02-28T00:00:00.000Z",
        periodEndUtc: "2024-03-01T00:00:00.000Z",
        amountPaidMinor: 200n,
      },
      { evaluationTimeUtc: "2024-02-29T00:00:00.000Z" },
    );
    const dst = calculate(
      {
        periodStartUtc: "2026-03-28T00:00:00.000Z",
        periodEndUtc: "2026-03-30T00:00:00.000Z",
        amountPaidMinor: 200n,
      },
      { evaluationTimeUtc: "2026-03-29T00:00:00.000Z" },
    );

    expect(leap.migrationCreditMinor).toBe(100n);
    expect(dst.migrationCreditMinor).toBe(100n);
  });

  it("rounds below, at, and above half with HALF_UP", () => {
    expect(divideAndRoundHalfUp(149n, 100n)).toBe(1n);
    expect(divideAndRoundHalfUp(150n, 100n)).toBe(2n);
    expect(divideAndRoundHalfUp(151n, 100n)).toBe(2n);
  });

  it("applies reimbursement rate before one final rounding", () => {
    const result = calculate({}, { policy: policy({ reimbursementRateBps: 5000n }) });
    expect(result.migrationCreditMinor).toBe(766n);
  });

  it("applies maximum and minimum policy controls", () => {
    const maximum = calculate({}, { policy: policy({ maximumCreditMinor: 1000n }) });
    const minimum = calculate({}, { policy: policy({ minimumCreditMinor: 2000n }) });

    expect(maximum.migrationCreditMinor).toBe(1000n);
    expect(maximum.reasons).toContain("MAXIMUM_CREDIT_CAP_APPLIED");
    expect(minimum.migrationCreditMinor).toBe(0n);
    expect(minimum.reasons).toContain("BELOW_MINIMUM_CREDIT");
  });

  it("creates carry-forward or caps at target price according to policy", () => {
    const targetPlan = { ...directPro, priceMinor: 1000n };
    const carry = calculate({}, { targetPlan });
    const capped = calculate({}, { targetPlan, policy: policy({ allowCarryForward: false }) });

    expect(carry.amountDueMinor).toBe(0n);
    expect(carry.carryForwardMinor).toBe(532n);
    expect(capped.migrationCreditMinor).toBe(1000n);
    expect(capped.carryForwardMinor).toBe(0n);
  });

  it("supports a zero-priced target without negative values", () => {
    const result = calculate({}, { targetPlan: { ...directPro, priceMinor: 0n } });
    expect(result.amountDueMinor).toBe(0n);
    expect(result.creditAppliedMinor).toBe(0n);
    expect(result.carryForwardMinor).toBe(1532n);
  });

  it("rejects invalid periods and non-UTC timestamps", () => {
    expect(() => calculate({ periodEndUtc: activeSource.periodStartUtc })).toThrowError(
      BillingDomainError,
    );
    expect(() => calculate({}, { evaluationTimeUtc: "2026-07-19" })).toThrowError(
      "evaluationTimeUtc must be an ISO UTC timestamp",
    );
  });

  it("preserves very large values without precision loss", () => {
    const huge = 9_007_199_254_740_993_123_456n;
    const result = calculate(
      { amountPaidMinor: huge },
      { evaluationTimeUtc: activeSource.periodStartUtc },
    );
    expect(result.migrationCreditMinor).toBe(huge);
  });

  it("serializes bigint values as decimal strings", () => {
    const serialized = serializeBigInts(calculate()) as Record<string, unknown>;
    expect(serialized.migrationCreditMinor).toBe("1532");
    expect(serialized.periodDurationMs).toBe("2678400000");
  });
});
