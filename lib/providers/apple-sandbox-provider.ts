import type { VerifiedSubscription } from "@take-my-money/billing-core";
import type { SourceSubscriptionProvider } from "@take-my-money/provider-contracts";
import { findScenarioByLookupReference, getScenario } from "@/lib/scenarios/fixtures";
import { sourceFingerprint } from "@/lib/security/hashing";

export class AppleSandboxSubscriptionProvider implements SourceSubscriptionProvider {
  readonly provider = "APPLE_SANDBOX" as const;

  async verifySubscription(input: {
    lookupReference: string;
    demoSessionId: string;
    requestId: string;
  }): Promise<VerifiedSubscription> {
    const scenario = findScenarioByLookupReference(input.lookupReference);
    if (!scenario) throw new Error("SYNTHETIC_REFERENCE_NOT_FOUND");
    return this.toVerifiedSubscription(scenario.id, input.demoSessionId);
  }

  async getSubscriptionStatus(input: {
    sourceFingerprint: string;
    demoSessionId: string;
    requestId: string;
  }): Promise<VerifiedSubscription> {
    for (const scenarioId of [
      "active-normal",
      "one-day-left",
      "expired",
      "refunded",
      "already-migrated",
      "billing-retry",
      "credit-exceeds-target",
      "ai-unavailable",
      "unknown-target-result",
    ] as const) {
      const subscription = this.toVerifiedSubscription(scenarioId, input.demoSessionId);
      if (
        sourceFingerprint(subscription.provider, subscription.originalTransactionId) ===
        input.sourceFingerprint
      ) {
        return subscription;
      }
    }
    throw new Error("SYNTHETIC_SUBSCRIPTION_NOT_FOUND");
  }

  private toVerifiedSubscription(
    scenarioId: Parameters<typeof getScenario>[0],
    demoSessionId: string,
  ): VerifiedSubscription {
    const scenario = getScenario(scenarioId);
    if (!scenario) throw new Error("SYNTHETIC_SCENARIO_NOT_FOUND");
    const sessionSuffix = demoSessionId.replaceAll("-", "").slice(-12);
    return {
      provider: this.provider,
      externalSubscriptionId: `sandbox-sub-${sessionSuffix}-${scenario.lookupReference}`,
      originalTransactionId: `${scenario.lookupReference}:${demoSessionId}`,
      productId: scenario.source.productId,
      planName: scenario.source.planName,
      status: scenario.source.status,
      periodStartUtc: scenario.source.periodStartUtc,
      periodEndUtc: scenario.source.periodEndUtc,
      amountPaidMinor: scenario.source.amountPaidMinor,
      currency: scenario.source.currency,
      autoRenew: scenario.source.autoRenew,
      environment: "SANDBOX",
      verifiedAtUtc: scenario.evaluationTimeUtc,
    };
  }
}
