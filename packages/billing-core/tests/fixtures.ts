import type { CreditPolicy, TargetPlan, VerifiedSubscription } from "../src";
import { DEMO_CREDIT_POLICY } from "../src";

export const activeSource: VerifiedSubscription = {
  provider: "APPLE_SANDBOX",
  externalSubscriptionId: "synthetic-subscription-active",
  originalTransactionId: "TMM-ACTIVE-001",
  productId: "plus-mobile-demo",
  planName: "Plus — mobile billed demo",
  status: "ACTIVE",
  periodStartUtc: "2026-07-07T00:00:00.000Z",
  periodEndUtc: "2026-08-07T00:00:00.000Z",
  amountPaidMinor: 2499n,
  currency: "EUR",
  autoRenew: true,
  environment: "SANDBOX",
  verifiedAtUtc: "2026-07-19T00:00:00.000Z",
};

export const directPro: TargetPlan = {
  id: "direct-pro-monthly",
  displayName: "Direct Pro",
  priceMinor: 22_900n,
  currency: "EUR",
  billingInterval: "MONTHLY",
  active: true,
};

export function policy(overrides: Partial<CreditPolicy> = {}): CreditPolicy {
  return { ...DEMO_CREDIT_POLICY, ...overrides };
}
