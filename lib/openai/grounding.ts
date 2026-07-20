import type { MigrationExplanation, ReceiptExtraction } from "./contracts";

export type ExplanationFacts = {
  sourcePlan: string;
  targetPlan: string;
  remainingDays: number;
  totalDays: number;
  creditDisplay: string;
  targetPriceDisplay: string;
  amountDueDisplay: string;
  autoRenew: boolean;
  policy: string;
  roundingMode: string;
  sandbox: true;
};

export function findGroundingErrors(
  explanation: MigrationExplanation,
  facts: ExplanationFacts,
): string[] {
  const text = [
    explanation.headline,
    explanation.summary,
    explanation.calculationExplanation,
    ...explanation.nextSteps,
    explanation.riskExplanation,
  ].join(" ");
  const allowedMoney = new Set(
    [facts.creditDisplay, facts.targetPriceDisplay, facts.amountDueDisplay].map(normalizeMoney),
  );
  const errors: string[] = [];
  for (const match of text.matchAll(/[€$£]\s?\d[\d,]*(?:\.\d{1,2})?/g)) {
    if (!allowedMoney.has(normalizeMoney(match[0]))) errors.push(`unsupported amount ${match[0]}`);
  }
  const allowedDays = new Set([facts.remainingDays, facts.totalDays]);
  for (const match of text.matchAll(/\b(\d+)\s+(?:paid\s+)?days?\b/gi)) {
    if (!allowedDays.has(Number(match[1]))) errors.push(`unsupported duration ${match[0]}`);
  }
  if (/\d+(?:\.\d+)?\s*%/.test(text)) errors.push("unsupported percentage");
  return errors;
}

export function constrainReceiptReference(
  extraction: ReceiptExtraction,
  expectedReference: string,
): ReceiptExtraction {
  if (
    extraction.syntheticLookupReference === null ||
    extraction.syntheticLookupReference === expectedReference
  ) {
    return extraction;
  }
  return {
    ...extraction,
    syntheticLookupReference: null,
    confidence: extraction.confidence === "HIGH" ? "MEDIUM" : extraction.confidence,
    warnings: [
      ...extraction.warnings,
      "Extracted reference did not match the selected fixture and was discarded.",
    ].slice(0, 5),
  };
}

function normalizeMoney(value: string): string {
  return value.replaceAll(" ", "").replaceAll(",", "");
}
