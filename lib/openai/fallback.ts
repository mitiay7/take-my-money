import type { DemoScenario } from "@/lib/scenarios/fixtures";
import type { MigrationExplanation, ReceiptExtraction } from "./contracts";

export function fallbackReceiptExtraction(scenario: DemoScenario): ReceiptExtraction {
  return {
    schemaVersion: "1.0",
    documentType: "SUBSCRIPTION_RECEIPT",
    providerGuess: "APPLE_APP_STORE",
    productName: scenario.source.planName,
    amountText: `€${(Number(scenario.source.amountPaidMinor) / 100).toFixed(2)}`,
    currencyCode: scenario.source.currency,
    purchaseDateText: formatDate(scenario.source.periodStartUtc),
    expiryOrRenewalDateText: formatDate(scenario.source.periodEndUtc),
    syntheticLookupReference: scenario.lookupReference,
    confidence: "HIGH",
    warnings: ["Deterministic fixture fallback used; details remain unverified."],
  };
}

export function fallbackExplanation(input: {
  sourcePlan: string;
  targetPlan: string;
  remainingDays: number;
  totalDays: number;
  creditDisplay: string;
  amountDueDisplay: string;
  autoRenew: boolean;
}): MigrationExplanation {
  return {
    schemaVersion: "1.0",
    headline: `Keep the value of ${input.remainingDays} paid days.`,
    summary: `Your verified ${input.sourcePlan} period has ${input.remainingDays} of ${input.totalDays} days remaining. The demo portability policy preserves that unused value as a one-time migration credit toward ${input.targetPlan}.`,
    calculationExplanation: `Deterministic UTC-duration arithmetic creates a ${input.creditDisplay} migration credit. The simulated amount due for the new plan is ${input.amountDueDisplay}.`,
    nextSteps: [
      "Review the verified period, policy, and exact quote.",
      "Accept the three sandbox consent statements.",
      "Run the simulated rebase and inspect the append-only audit trail.",
    ],
    riskExplanation: input.autoRenew
      ? "Source auto-renewal is still active. A production migration must ensure it will not create a future duplicate charge."
      : "The source fixture does not auto-renew, but production would still verify entitlement and cancellation state.",
    tone: "CLEAR_AND_REASSURING",
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
