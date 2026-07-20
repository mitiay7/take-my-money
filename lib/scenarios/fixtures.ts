import type { SourceSubscriptionStatus } from "@take-my-money/billing-core";

export type ScenarioId =
  | "active-normal"
  | "one-day-left"
  | "expired"
  | "refunded"
  | "already-migrated"
  | "billing-retry"
  | "credit-exceeds-target"
  | "ai-unavailable"
  | "unknown-target-result";

export type DemoScenario = {
  id: ScenarioId;
  title: string;
  shortDescription: string;
  receiptAssetId: string;
  lookupReference: string;
  evaluationTimeUtc: string;
  source: {
    planName: string;
    productId: string;
    amountPaidMinor: bigint;
    currency: "EUR";
    periodStartUtc: string;
    periodEndUtc: string;
    status: SourceSubscriptionStatus;
    autoRenew: boolean;
  };
  defaultTargetPlanId: "direct-basic-monthly" | "direct-pro-monthly";
  alreadyConsumed: boolean;
  aiAvailable: boolean;
  targetBehavior: "SUCCESS" | "UNKNOWN_THEN_SUCCESS";
};

const baseSource = {
  planName: "Plus — mobile billed demo",
  productId: "plus-mobile-demo",
  amountPaidMinor: 2499n,
  currency: "EUR" as const,
  periodStartUtc: "2026-07-07T00:00:00.000Z",
  periodEndUtc: "2026-08-07T00:00:00.000Z",
  status: "ACTIVE" as const,
  autoRenew: true,
};

export const scenarios: readonly DemoScenario[] = [
  {
    id: "active-normal",
    title: "Active subscription",
    shortDescription: "19 of 31 paid days remain. Eligible for an immediate migration credit.",
    receiptAssetId: "receipt-active-normal",
    lookupReference: "TMM-ACTIVE-001",
    evaluationTimeUtc: "2026-07-19T00:00:00.000Z",
    source: baseSource,
    defaultTargetPlanId: "direct-pro-monthly",
    alreadyConsumed: false,
    aiAvailable: true,
    targetBehavior: "SUCCESS",
  },
  {
    id: "one-day-left",
    title: "One day remaining",
    shortDescription: "A small positive credit shows exact rounding near expiry.",
    receiptAssetId: "receipt-one-day-left",
    lookupReference: "TMM-ONE-DAY-001",
    evaluationTimeUtc: "2026-07-31T00:00:00.000Z",
    source: {
      ...baseSource,
      periodStartUtc: "2026-07-01T00:00:00.000Z",
      periodEndUtc: "2026-08-01T00:00:00.000Z",
    },
    defaultTargetPlanId: "direct-pro-monthly",
    alreadyConsumed: false,
    aiAvailable: true,
    targetBehavior: "SUCCESS",
  },
  {
    id: "expired",
    title: "Expired subscription",
    shortDescription: "Verification succeeds, but no unused value remains.",
    receiptAssetId: "receipt-expired",
    lookupReference: "TMM-EXPIRED-001",
    evaluationTimeUtc: "2026-07-19T00:00:00.000Z",
    source: {
      ...baseSource,
      periodStartUtc: "2026-06-01T00:00:00.000Z",
      periodEndUtc: "2026-07-01T00:00:00.000Z",
      status: "EXPIRED",
      autoRenew: false,
    },
    defaultTargetPlanId: "direct-pro-monthly",
    alreadyConsumed: false,
    aiAvailable: true,
    targetBehavior: "SUCCESS",
  },
  {
    id: "refunded",
    title: "Refunded transaction",
    shortDescription: "Provider status blocks reuse of refunded value.",
    receiptAssetId: "receipt-refunded",
    lookupReference: "TMM-REFUNDED-001",
    evaluationTimeUtc: "2026-07-19T00:00:00.000Z",
    source: { ...baseSource, status: "REFUNDED", autoRenew: false },
    defaultTargetPlanId: "direct-pro-monthly",
    alreadyConsumed: false,
    aiAvailable: true,
    targetBehavior: "SUCCESS",
  },
  {
    id: "already-migrated",
    title: "Already migrated",
    shortDescription: "Exactly-once protection blocks a second migration credit.",
    receiptAssetId: "receipt-already-migrated",
    lookupReference: "TMM-CONSUMED-001",
    evaluationTimeUtc: "2026-07-19T00:00:00.000Z",
    source: baseSource,
    defaultTargetPlanId: "direct-pro-monthly",
    alreadyConsumed: true,
    aiAvailable: true,
    targetBehavior: "SUCCESS",
  },
  {
    id: "billing-retry",
    title: "Billing retry",
    shortDescription: "A possible recovered charge routes the migration to manual review.",
    receiptAssetId: "receipt-billing-retry",
    lookupReference: "TMM-RETRY-001",
    evaluationTimeUtc: "2026-07-19T00:00:00.000Z",
    source: { ...baseSource, status: "BILLING_RETRY" },
    defaultTargetPlanId: "direct-pro-monthly",
    alreadyConsumed: false,
    aiAvailable: true,
    targetBehavior: "SUCCESS",
  },
  {
    id: "credit-exceeds-target",
    title: "Credit exceeds target",
    shortDescription: "Excess portable value becomes a visible carry-forward balance.",
    receiptAssetId: "receipt-credit-exceeds-target",
    lookupReference: "TMM-EXCESS-001",
    evaluationTimeUtc: "2026-07-08T00:00:00.000Z",
    source: { ...baseSource, amountPaidMinor: 4999n },
    defaultTargetPlanId: "direct-basic-monthly",
    alreadyConsumed: false,
    aiAvailable: true,
    targetBehavior: "SUCCESS",
  },
  {
    id: "ai-unavailable",
    title: "AI unavailable",
    shortDescription: "The complete deterministic migration remains available with fallback copy.",
    receiptAssetId: "receipt-ai-unavailable",
    lookupReference: "TMM-AI-OFFLINE-001",
    evaluationTimeUtc: "2026-07-19T00:00:00.000Z",
    source: baseSource,
    defaultTargetPlanId: "direct-pro-monthly",
    alreadyConsumed: false,
    aiAvailable: false,
    targetBehavior: "SUCCESS",
  },
  {
    id: "unknown-target-result",
    title: "Unknown target result",
    shortDescription: "A timeout pauses safely until reconciliation finds the target subscription.",
    receiptAssetId: "receipt-unknown-result",
    lookupReference: "TMM-UNKNOWN-001",
    evaluationTimeUtc: "2026-07-19T00:00:00.000Z",
    source: baseSource,
    defaultTargetPlanId: "direct-pro-monthly",
    alreadyConsumed: false,
    aiAvailable: true,
    targetBehavior: "UNKNOWN_THEN_SUCCESS",
  },
] as const;

export function getScenario(id: string): DemoScenario | null {
  return scenarios.find((scenario) => scenario.id === id) ?? null;
}

export function findScenarioByLookupReference(reference: string): DemoScenario | null {
  return scenarios.find((scenario) => scenario.lookupReference === reference) ?? null;
}
