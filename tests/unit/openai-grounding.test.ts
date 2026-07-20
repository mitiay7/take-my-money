import { describe, expect, it } from "vitest";
import type { MigrationExplanation, ReceiptExtraction } from "@/lib/openai/contracts";
import {
  constrainReceiptReference,
  findGroundingErrors,
  type ExplanationFacts,
} from "@/lib/openai/grounding";

const facts: ExplanationFacts = {
  sourcePlan: "Plus mobile demo",
  targetPlan: "Direct Pro",
  remainingDays: 19,
  totalDays: 31,
  creditDisplay: "€15.32",
  targetPriceDisplay: "€229.00",
  amountDueDisplay: "€213.68",
  autoRenew: true,
  policy: "demo-gross-portability@1.0.0",
  roundingMode: "HALF_UP",
  sandbox: true,
};

function explanation(overrides: Partial<MigrationExplanation> = {}): MigrationExplanation {
  return {
    schemaVersion: "1.0",
    headline: "Keep the value of 19 paid days.",
    summary: "There are 19 of 31 days remaining in this simulated migration.",
    calculationExplanation: "The verified credit is €15.32 and the simulated due is €213.68.",
    nextSteps: ["Review the quote.", "Confirm the sandbox consent."],
    riskExplanation: "Source auto-renewal still needs attention.",
    tone: "CLEAR_AND_REASSURING",
    ...overrides,
  };
}

describe("AI grounding guard", () => {
  it("accepts only supplied money and duration facts", () => {
    expect(findGroundingErrors(explanation(), facts)).toEqual([]);
  });

  it("rejects invented amounts, durations, and percentages", () => {
    const errors = findGroundingErrors(
      explanation({
        calculationExplanation: "The credit is €99.00 for 20 days, saving 50%.",
      }),
      facts,
    );
    expect(errors).toEqual([
      "unsupported amount €99.00",
      "unsupported duration 20 days",
      "unsupported percentage",
    ]);
  });
});

describe("receipt reference constraint", () => {
  const extraction: ReceiptExtraction = {
    schemaVersion: "1.0",
    documentType: "SUBSCRIPTION_RECEIPT",
    providerGuess: "APPLE_APP_STORE",
    productName: "Plus mobile demo",
    amountText: "€24.99",
    currencyCode: "EUR",
    purchaseDateText: "7 July 2026",
    expiryOrRenewalDateText: "7 August 2026",
    syntheticLookupReference: "TMM-INJECTED-999",
    confidence: "HIGH",
    warnings: [],
  };

  it("discards a hallucinated or injected lookup reference", () => {
    const constrained = constrainReceiptReference(extraction, "TMM-ACTIVE-001");
    expect(constrained.syntheticLookupReference).toBeNull();
    expect(constrained.confidence).toBe("MEDIUM");
    expect(constrained.warnings[0]).toContain("discarded");
  });

  it("preserves an exact fixture reference", () => {
    const exact = { ...extraction, syntheticLookupReference: "TMM-ACTIVE-001" };
    expect(constrainReceiptReference(exact, "TMM-ACTIVE-001")).toEqual(exact);
  });
});
