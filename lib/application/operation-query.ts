import { asc, eq } from "drizzle-orm";
import {
  aiInteractions,
  auditEvents,
  creditLedgerEntries,
  rebaseOperations,
  rebaseQuotes,
  sandboxTargetResults,
  sourceSubscriptions,
  targetPlans,
} from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";
import { ApplicationError } from "./errors";

export async function getOperationView(
  database: AppDatabase,
  demoSessionId: string,
  publicId: string,
) {
  const [operation] = await database
    .select()
    .from(rebaseOperations)
    .where(eq(rebaseOperations.publicId, publicId))
    .limit(1);
  if (!operation || operation.demoSessionId !== demoSessionId) {
    throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);
  }
  const [source] = operation.sourceSubscriptionId
    ? await database
        .select()
        .from(sourceSubscriptions)
        .where(eq(sourceSubscriptions.id, operation.sourceSubscriptionId))
        .limit(1)
    : [];
  const [quote] = await database
    .select()
    .from(rebaseQuotes)
    .where(eq(rebaseQuotes.operationId, operation.id))
    .limit(1);
  const [targetPlan] = operation.targetPlanId
    ? await database
        .select()
        .from(targetPlans)
        .where(eq(targetPlans.id, operation.targetPlanId))
        .limit(1)
    : [];

  return {
    operation: {
      publicId: operation.publicId,
      scenarioId: operation.scenarioId,
      status: operation.status,
      eligibilityStatus: operation.eligibilityStatus,
      eligibilityReasons: operation.eligibilityReasons,
      riskFlags: operation.riskFlags,
      evaluationTime: iso(operation.evaluationTime),
      completedAt: operation.completedAt ? iso(operation.completedAt) : null,
      externalTargetId: operation.externalTargetId
        ? `${operation.externalTargetId.slice(0, 12)}…`
        : null,
    },
    source: source
      ? {
          provider: source.provider,
          externalSubscriptionId: source.externalSubscriptionIdRedacted,
          originalTransactionSuffix: source.originalTransactionSuffix,
          planName: source.planName,
          status: source.status,
          periodStart: iso(source.periodStart),
          periodEnd: iso(source.periodEnd),
          amountPaidMinor: source.amountPaidMinor.toString(),
          currency: source.currency,
          autoRenew: source.autoRenew,
          consumedAt: source.consumedAt ? iso(source.consumedAt) : null,
        }
      : null,
    targetPlan: targetPlan
      ? {
          id: targetPlan.id,
          displayName: targetPlan.displayName,
          priceMinor: targetPlan.priceMinor.toString(),
          currency: targetPlan.currency,
          billingInterval: targetPlan.billingInterval,
        }
      : null,
    quote: quote
      ? {
          publicId: quote.publicId,
          algorithmVersion: quote.algorithmVersion,
          policyId: quote.policyId,
          policyVersion: quote.policyVersion,
          currency: quote.currency,
          sourceValueMinor: quote.sourceValueMinor.toString(),
          periodDurationMs: quote.periodDurationMs.toString(),
          remainingDurationMs: quote.remainingDurationMs.toString(),
          ratioNumerator: quote.ratioNumerator.toString(),
          ratioDenominator: quote.ratioDenominator.toString(),
          migrationCreditMinor: quote.migrationCreditMinor.toString(),
          targetPriceMinor: quote.targetPriceMinor.toString(),
          creditAppliedMinor: quote.creditAppliedMinor.toString(),
          amountDueMinor: quote.amountDueMinor.toString(),
          carryForwardMinor: quote.carryForwardMinor.toString(),
          roundingMode: quote.roundingMode,
          expiresAt: iso(quote.expiresAt),
          fingerprintPrefix: quote.quoteFingerprint.slice(0, 8),
        }
      : null,
  };
}

export async function getSystemView(
  database: AppDatabase,
  demoSessionId: string,
  publicId: string,
) {
  const consumer = await getOperationView(database, demoSessionId, publicId);
  const [operation] = await database
    .select()
    .from(rebaseOperations)
    .where(eq(rebaseOperations.publicId, publicId))
    .limit(1);
  if (!operation) throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);

  const [audits, ledger, ai, target] = await Promise.all([
    database
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.operationId, operation.id))
      .orderBy(asc(auditEvents.sequenceNumber)),
    database
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.operationId, operation.id))
      .orderBy(asc(creditLedgerEntries.createdAt)),
    database
      .select()
      .from(aiInteractions)
      .where(eq(aiInteractions.operationId, operation.id))
      .orderBy(asc(aiInteractions.createdAt)),
    database
      .select()
      .from(sandboxTargetResults)
      .where(eq(sandboxTargetResults.operationId, operation.id))
      .limit(1),
  ]);

  return {
    ...consumer,
    technical: {
      providerAdapter: "AppleSandboxSubscriptionProvider",
      targetAdapter: "DirectSandboxBillingProvider",
      sourceFingerprintPrefix: operation.sourceFingerprint?.slice(0, 8) ?? null,
      idempotencyKeyPrefix: operation.externalTargetIdempotencyKey?.slice(0, 12) ?? null,
      stateVersion: operation.stateVersion,
      reconciliationStatus:
        operation.status === "RECONCILIATION_REQUIRED"
          ? "PENDING"
          : (target[0]?.lookupOutcome ?? "NOT_REQUIRED"),
    },
    audits: audits.map((event) => ({
      sequenceNumber: event.sequenceNumber,
      eventType: event.eventType,
      previousState: event.previousState,
      nextState: event.nextState,
      actorType: event.actorType,
      requestIdPrefix: event.requestId.slice(0, 12),
      createdAt: iso(event.createdAt),
      metadata: event.metadata,
    })),
    ledger: ledger.map((entry) => ({
      entryType: entry.entryType,
      amountMinor: entry.amountMinor.toString(),
      currency: entry.currency,
      externalReference: entry.externalReference
        ? `${entry.externalReference.slice(0, 12)}…`
        : null,
      createdAt: iso(entry.createdAt),
      metadata: entry.metadata,
    })),
    ai: ai.map((interaction) => ({
      purpose: interaction.purpose,
      model: interaction.model,
      status: interaction.status,
      latencyMs: interaction.latencyMs,
      inputTokens: interaction.inputTokens,
      outputTokens: interaction.outputTokens,
      reasoningTokens: interaction.reasoningTokens,
      errorCode: interaction.errorCode,
      createdAt: iso(interaction.createdAt),
    })),
  };
}

function iso(value: string): string {
  return new Date(value).toISOString();
}
