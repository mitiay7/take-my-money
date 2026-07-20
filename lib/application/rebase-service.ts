import { and, eq, isNull, max, sql } from "drizzle-orm";
import {
  calculateRebase,
  DEMO_CREDIT_POLICY,
  evaluateEligibility,
  serializeBigInts,
  transitionState,
  type EligibilityDecision,
  type MigrationState,
  type TargetPlan,
  type VerifiedSubscription,
} from "@take-my-money/billing-core";
import type { TargetCreationResult } from "@take-my-money/provider-contracts";
import {
  auditEvents,
  creditLedgerEntries,
  idempotencyRecords,
  rebaseOperations,
  rebaseQuotes,
  sourceSubscriptions,
  targetPlans,
  type RebaseOperationRow,
  type RebaseQuoteRow,
} from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";
import { AppleSandboxSubscriptionProvider } from "@/lib/providers/apple-sandbox-provider";
import {
  DirectSandboxBillingProvider,
  type TargetBehavior,
} from "@/lib/providers/direct-sandbox-provider";
import { getScenario } from "@/lib/scenarios/fixtures";
import { sha256, sourceFingerprint, stableStringify } from "@/lib/security/hashing";
import { AuditRepository } from "@/lib/repositories/audit-repository";
import { OperationRepository } from "@/lib/repositories/operation-repository";
import { QuoteRepository } from "@/lib/repositories/quote-repository";
import { SourceRepository } from "@/lib/repositories/source-repository";
import { ApplicationError } from "./errors";

type ConfirmationBody = {
  operation: {
    publicId: string;
    status: "COMPLETED" | "RECONCILIATION_REQUIRED" | "TARGET_CREATION_FAILED";
    migrationCreditMinor: string;
    amountDueMinor: string;
    targetSubscription?: {
      planName: string;
      startsAt: string;
      renewsAt: string;
    };
  };
};

type ConfirmationResult = {
  httpStatus: number;
  body: ConfirmationBody;
  replayed: boolean;
};

type ConsentInput = {
  understandsSandbox: boolean;
  understandsSourceCancellation: boolean;
  authorizesSimulatedMigration: boolean;
};

type Clock = { now(): Date };

const systemClock: Clock = { now: () => new Date() };

export class RebaseService {
  private readonly sourceProvider = new AppleSandboxSubscriptionProvider();

  constructor(
    private readonly database: AppDatabase,
    private readonly clock: Clock = systemClock,
  ) {}

  async createOperation(input: {
    demoSessionId: string;
    scenarioId: string;
    requestId: string;
  }): Promise<RebaseOperationRow> {
    const scenario = getScenario(input.scenarioId);
    if (!scenario) {
      throw new ApplicationError("SCENARIO_NOT_FOUND", "Scenario not found", 404);
    }

    const operation = await new OperationRepository(this.database).create({
      demoSessionId: input.demoSessionId,
      scenarioId: scenario.id,
      status: "DRAFT",
      evaluationTime: scenario.evaluationTimeUtc,
    });
    await new AuditRepository(this.database).append({
      operationId: operation.id,
      demoSessionId: input.demoSessionId,
      eventType: "SCENARIO_SELECTED",
      actorType: "USER",
      requestId: input.requestId,
      metadata: { scenarioId: scenario.id },
    });
    return operation;
  }

  async verifySource(input: {
    demoSessionId: string;
    operationPublicId: string;
    lookupReference: string;
    requestId: string;
  }): Promise<{
    operation: RebaseOperationRow;
    source: VerifiedSubscription;
    decision: EligibilityDecision;
  }> {
    const operationRepository = new OperationRepository(this.database);
    let operation = await operationRepository.findOwned(
      input.operationPublicId,
      input.demoSessionId,
    );
    if (!operation) throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);
    if (operation.status !== "DRAFT" && operation.status !== "RECEIPT_EXTRACTED") {
      throw new ApplicationError(
        "OPERATION_NOT_CONFIRMABLE",
        "Operation cannot be verified from its current state",
        409,
      );
    }

    const scenario = getScenario(operation.scenarioId);
    if (!scenario) throw new ApplicationError("SCENARIO_NOT_FOUND", "Scenario not found", 404);
    if (scenario.lookupReference !== input.lookupReference) {
      throw new ApplicationError(
        "SOURCE_NOT_VERIFIED",
        "Receipt reference does not match scenario",
        422,
      );
    }

    const audit = new AuditRepository(this.database);
    await audit.append({
      operationId: operation.id,
      demoSessionId: input.demoSessionId,
      eventType: "SOURCE_VERIFICATION_REQUESTED",
      actorType: "USER",
      requestId: input.requestId,
      metadata: { provider: "APPLE_SANDBOX" },
    });
    const source = await this.sourceProvider.verifySubscription({
      lookupReference: input.lookupReference,
      demoSessionId: input.demoSessionId,
      requestId: input.requestId,
    });
    const fingerprint = sourceFingerprint(source.provider, source.originalTransactionId);
    const sourceRow = await new SourceRepository(this.database).saveVerified({
      demoSessionId: input.demoSessionId,
      provider: source.provider,
      externalSubscriptionIdRedacted: redact(source.externalSubscriptionId),
      originalTransactionFingerprint: fingerprint,
      originalTransactionSuffix: source.originalTransactionId.slice(-8),
      productId: source.productId,
      planName: source.planName,
      status: source.status,
      periodStart: source.periodStartUtc,
      periodEnd: source.periodEndUtc,
      amountPaidMinor: source.amountPaidMinor,
      currency: source.currency,
      autoRenew: source.autoRenew,
      environment: source.environment,
      verifiedAt: source.verifiedAtUtc,
      verificationSnapshot: {
        provider: source.provider,
        status: source.status,
        periodStartUtc: source.periodStartUtc,
        periodEndUtc: source.periodEndUtc,
        amountPaidMinor: source.amountPaidMinor.toString(),
        currency: source.currency,
        autoRenew: source.autoRenew,
      },
      consumedAt: scenario.alreadyConsumed ? scenario.evaluationTimeUtc : null,
    });

    const [targetPlan] = await this.database
      .select()
      .from(targetPlans)
      .where(eq(targetPlans.id, scenario.defaultTargetPlanId))
      .limit(1);
    if (!targetPlan) {
      throw new ApplicationError("TARGET_PLAN_NOT_FOUND", "Target plan not found", 404);
    }
    const decision = evaluateEligibility({
      source,
      sourceVerified: true,
      sourceConsumed: sourceRow.consumedAt !== null,
      targetPlan: toTargetPlan(targetPlan),
      evaluationTimeUtc: operation.evaluationTime,
    });

    operation = await this.transitionOperation(
      operation,
      "SOURCE_VERIFIED",
      "SOURCE_VERIFIED",
      input.requestId,
      {
        sourceSubscriptionId: sourceRow.id,
        sourceFingerprint: fingerprint,
        eligibilityStatus: decision.status,
        eligibilityReasons: decision.reasons,
        riskFlags: decision.riskFlags,
      },
    );
    await audit.append({
      operationId: operation.id,
      demoSessionId: input.demoSessionId,
      eventType: "ELIGIBILITY_EVALUATED",
      actorType: "SYSTEM",
      requestId: input.requestId,
      metadata: {
        status: decision.status,
        reasons: decision.reasons,
        riskFlags: decision.riskFlags,
      },
    });

    if (decision.status !== "ELIGIBLE") {
      operation = await this.transitionOperation(
        operation,
        decision.status,
        decision.status,
        input.requestId,
      );
    }

    return { operation, source, decision };
  }

  async createQuote(input: {
    demoSessionId: string;
    operationPublicId: string;
    targetPlanId: string;
    requestId: string;
  }): Promise<{ operation: RebaseOperationRow; quote: RebaseQuoteRow }> {
    return this.database.transaction(async (transaction) => {
      const database = transaction as unknown as AppDatabase;
      const operations = new OperationRepository(database);
      let operation = await operations.findOwned(input.operationPublicId, input.demoSessionId);
      if (!operation) throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);

      const existing = await new QuoteRepository(database).findByOperation(operation.id);
      if (existing) return { operation, quote: existing };
      if (operation.status !== "SOURCE_VERIFIED" || !operation.sourceSubscriptionId) {
        throw new ApplicationError(
          "SOURCE_NOT_VERIFIED",
          "A verified eligible source is required",
          409,
        );
      }

      const [sourceRow] = await database
        .select()
        .from(sourceSubscriptions)
        .where(eq(sourceSubscriptions.id, operation.sourceSubscriptionId))
        .limit(1);
      const [targetPlanRow] = await database
        .select()
        .from(targetPlans)
        .where(eq(targetPlans.id, input.targetPlanId))
        .limit(1);
      if (!sourceRow) throw new ApplicationError("SOURCE_NOT_VERIFIED", "Source not found", 409);
      if (!targetPlanRow) {
        throw new ApplicationError("TARGET_PLAN_NOT_FOUND", "Target plan not found", 404);
      }

      const source = toVerifiedSubscription(sourceRow);
      const targetPlan = toTargetPlan(targetPlanRow);
      const calculation = calculateRebase({
        source,
        targetPlan,
        policy: DEMO_CREDIT_POLICY,
        evaluationTimeUtc: toIsoUtc(operation.evaluationTime),
      });
      const decision = evaluateEligibility({
        source,
        sourceVerified: true,
        sourceConsumed: sourceRow.consumedAt !== null,
        targetPlan,
        evaluationTimeUtc: toIsoUtc(operation.evaluationTime),
        calculation,
      });
      if (decision.status !== "ELIGIBLE") {
        throw new ApplicationError(
          "OPERATION_NOT_CONFIRMABLE",
          `Quote blocked: ${decision.reasons.join(", ")}`,
          409,
        );
      }

      const snapshot = serializeBigInts(calculation) as Record<string, unknown>;
      const quoteFingerprint = sha256(stableStringify(snapshot));
      const createdAt = this.clock.now();
      const expiresAt = new Date(
        createdAt.getTime() + DEMO_CREDIT_POLICY.quoteTtlSeconds * 1000,
      ).toISOString();
      const quote = await new QuoteRepository(database).create({
        operationId: operation.id,
        algorithmVersion: calculation.algorithmVersion,
        policyId: calculation.policyId,
        policyVersion: calculation.policyVersion,
        currency: calculation.currency,
        sourceValueMinor: calculation.sourceValueMinor,
        periodDurationMs: calculation.periodDurationMs,
        remainingDurationMs: calculation.remainingDurationMs,
        ratioNumerator: calculation.unusedRatioNumerator,
        ratioDenominator: calculation.unusedRatioDenominator,
        migrationCreditMinor: calculation.migrationCreditMinor,
        targetPriceMinor: calculation.targetPriceMinor,
        creditAppliedMinor: calculation.creditAppliedMinor,
        amountDueMinor: calculation.amountDueMinor,
        carryForwardMinor: calculation.carryForwardMinor,
        roundingMode: calculation.roundingMode,
        calculationSnapshot: snapshot,
        quoteFingerprint,
        createdAt: createdAt.toISOString(),
        expiresAt,
      });

      operation = await this.transitionOperationWithDatabase(
        database,
        operation,
        "QUOTE_READY",
        "QUOTE_CREATED",
        input.requestId,
        {
          targetPlanId: targetPlan.id,
          eligibilityStatus: decision.status,
          eligibilityReasons: decision.reasons,
          riskFlags: decision.riskFlags,
        },
      );
      return { operation, quote };
    });
  }

  async confirm(input: {
    demoSessionId: string;
    operationPublicId: string;
    quotePublicId: string;
    consents: ConsentInput;
    idempotencyKey: string;
    requestId: string;
    targetBehaviorOverride?: TargetBehavior;
  }): Promise<ConfirmationResult> {
    if (!input.idempotencyKey) {
      throw new ApplicationError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required", 400);
    }
    if (!Object.values(input.consents).every(Boolean)) {
      throw new ApplicationError("CONSENT_REQUIRED", "All three consents are required", 422);
    }

    const operation = await new OperationRepository(this.database).findOwned(
      input.operationPublicId,
      input.demoSessionId,
    );
    if (!operation) throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);
    if (!operation.sourceFingerprint) {
      throw new ApplicationError("SOURCE_NOT_VERIFIED", "Source not verified", 409);
    }

    const keyHash = sha256(input.idempotencyKey);
    const requestHash = sha256(
      stableStringify({ quotePublicId: input.quotePublicId, consents: input.consents }),
    );
    const endpointScope = `confirm:${operation.publicId}`;
    const prepared = await this.prepareConfirmation({
      ...input,
      operation,
      keyHash,
      requestHash,
      endpointScope,
    });

    if (prepared.kind === "REPLAY") {
      return { httpStatus: prepared.httpStatus, body: prepared.body, replayed: true };
    }
    if (prepared.kind === "WAIT") {
      return this.waitForConfirmation({
        demoSessionId: input.demoSessionId,
        operationPublicId: input.operationPublicId,
        endpointScope,
        keyHash,
        requestHash,
      });
    }

    const scenario = getScenario(operation.scenarioId);
    if (!scenario) throw new ApplicationError("SCENARIO_NOT_FOUND", "Scenario not found", 404);
    const behavior = input.targetBehaviorOverride ?? scenario.targetBehavior;
    const provider = new DirectSandboxBillingProvider(
      this.database,
      behavior,
      scenario.evaluationTimeUtc,
    );
    const targetResult = await provider.createSubscription({
      operationId: operation.id,
      plan: prepared.targetPlan,
      amountDueMinor: prepared.quote.amountDueMinor,
      currency: prepared.quote.currency,
      externalIdempotencyKey: prepared.externalIdempotencyKey,
      requestId: input.requestId,
    });

    if (targetResult.status === "SUCCEEDED") {
      return this.finalizeSuccess({
        operationId: operation.id,
        idempotencyRecordId: prepared.idempotencyRecordId,
        targetResult,
        requestId: input.requestId,
      });
    }
    if (targetResult.status === "FAILED") {
      return this.finalizeFailure({
        operationId: operation.id,
        idempotencyRecordId: prepared.idempotencyRecordId,
        requestId: input.requestId,
        retryable: targetResult.retryable,
      });
    }
    return this.finalizeUnknown({
      operationId: operation.id,
      idempotencyRecordId: prepared.idempotencyRecordId,
      requestId: input.requestId,
    });
  }

  async reconcile(input: {
    demoSessionId: string;
    operationPublicId: string;
    requestId: string;
  }): Promise<ConfirmationResult> {
    const operation = await new OperationRepository(this.database).findOwned(
      input.operationPublicId,
      input.demoSessionId,
    );
    if (!operation) throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);
    if (operation.status !== "RECONCILIATION_REQUIRED" || !operation.externalTargetIdempotencyKey) {
      throw new ApplicationError(
        "RECONCILIATION_NOT_READY",
        "Operation does not require reconciliation",
        409,
      );
    }
    const scenario = getScenario(operation.scenarioId);
    if (!scenario) throw new ApplicationError("SCENARIO_NOT_FOUND", "Scenario not found", 404);
    const provider = new DirectSandboxBillingProvider(
      this.database,
      scenario.targetBehavior,
      scenario.evaluationTimeUtc,
    );
    const result = await provider.findByIdempotencyKey({
      externalIdempotencyKey: operation.externalTargetIdempotencyKey,
      requestId: input.requestId,
    });
    if (result.status !== "SUCCEEDED") {
      throw new ApplicationError(
        "RECONCILIATION_NOT_READY",
        "Target result is not yet authoritative",
        409,
        true,
      );
    }
    return this.finalizeSuccess({
      operationId: operation.id,
      idempotencyRecordId: null,
      targetResult: result,
      requestId: input.requestId,
    });
  }

  private async prepareConfirmation(input: {
    demoSessionId: string;
    operationPublicId: string;
    quotePublicId: string;
    consents: ConsentInput;
    idempotencyKey: string;
    requestId: string;
    operation: RebaseOperationRow;
    keyHash: string;
    requestHash: string;
    endpointScope: string;
  }): Promise<
    | { kind: "REPLAY"; httpStatus: number; body: ConfirmationBody }
    | { kind: "WAIT" }
    | {
        kind: "PREPARED";
        idempotencyRecordId: string;
        externalIdempotencyKey: string;
        targetPlan: TargetPlan;
        quote: RebaseQuoteRow;
      }
  > {
    return this.database.transaction(async (transaction) => {
      const database = transaction as unknown as AppDatabase;
      await database.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${input.operation.sourceFingerprint!}, 0))`,
      );
      const [current] = await database
        .select()
        .from(rebaseOperations)
        .where(
          and(
            eq(rebaseOperations.id, input.operation.id),
            eq(rebaseOperations.demoSessionId, input.demoSessionId),
          ),
        )
        .limit(1);
      if (!current) throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);

      const [existing] = await database
        .select()
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.demoSessionId, input.demoSessionId),
            eq(idempotencyRecords.endpointScope, input.endpointScope),
            eq(idempotencyRecords.idempotencyKeyHash, input.keyHash),
          ),
        )
        .limit(1);
      if (existing && existing.requestHash !== input.requestHash) {
        throw new ApplicationError(
          "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
          "Idempotency key was already used with a different payload",
          409,
        );
      }
      if (existing?.status === "COMPLETED" && existing.httpStatus && existing.responseBody) {
        return {
          kind: "REPLAY" as const,
          httpStatus: existing.httpStatus,
          body: existing.responseBody as ConfirmationBody,
        };
      }
      if (existing?.status === "PROCESSING") return { kind: "WAIT" as const };
      if (current.status === "TARGET_CREATION_PENDING") return { kind: "WAIT" as const };
      if (current.status === "COMPLETED" || current.status === "SOURCE_CONSUMED") {
        throw new ApplicationError(
          "SOURCE_ALREADY_CONSUMED",
          "Source subscription has already been migrated",
          409,
        );
      }
      if (current.status !== "QUOTE_READY") {
        throw new ApplicationError(
          "OPERATION_NOT_CONFIRMABLE",
          `Operation is ${current.status}`,
          409,
        );
      }

      const [quote] = await database
        .select()
        .from(rebaseQuotes)
        .where(
          and(
            eq(rebaseQuotes.operationId, current.id),
            eq(rebaseQuotes.publicId, input.quotePublicId),
          ),
        )
        .limit(1);
      if (!quote) throw new ApplicationError("QUOTE_NOT_FOUND", "Quote not found", 404);
      if (this.clock.now().getTime() >= Date.parse(quote.expiresAt)) {
        throw new ApplicationError("QUOTE_EXPIRED", "Quote has expired", 409);
      }
      if (sha256(stableStringify(quote.calculationSnapshot)) !== quote.quoteFingerprint) {
        throw new ApplicationError(
          "QUOTE_FINGERPRINT_MISMATCH",
          "Quote calculation snapshot no longer matches its fingerprint",
          409,
        );
      }
      const [source] = await database
        .select()
        .from(sourceSubscriptions)
        .where(eq(sourceSubscriptions.id, current.sourceSubscriptionId!))
        .limit(1);
      if (!source || source.consumedAt) {
        throw new ApplicationError(
          "SOURCE_ALREADY_CONSUMED",
          "Source subscription has already been migrated",
          409,
        );
      }
      const [targetPlanRow] = await database
        .select()
        .from(targetPlans)
        .where(eq(targetPlans.id, current.targetPlanId!))
        .limit(1);
      if (!targetPlanRow) {
        throw new ApplicationError("TARGET_PLAN_NOT_FOUND", "Target plan not found", 404);
      }

      let idempotencyRecordId = existing?.id;
      if (existing?.status === "RETRYABLE") {
        await database
          .update(idempotencyRecords)
          .set({ status: "PROCESSING", httpStatus: null, responseBody: null })
          .where(eq(idempotencyRecords.id, existing.id));
      } else if (!existing) {
        const [created] = await database
          .insert(idempotencyRecords)
          .values({
            demoSessionId: input.demoSessionId,
            endpointScope: input.endpointScope,
            idempotencyKeyHash: input.keyHash,
            requestHash: input.requestHash,
            status: "PROCESSING",
            expiresAt: new Date(this.clock.now().getTime() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .returning();
        idempotencyRecordId = created?.id;
      }
      if (!idempotencyRecordId) throw new Error("Failed to persist idempotency record");

      let updated = await this.transitionOperationWithDatabase(
        database,
        current,
        "CONFIRMATION_PENDING",
        "CONFIRMATION_REQUESTED",
        input.requestId,
      );
      updated = await this.transitionOperationWithDatabase(
        database,
        updated,
        "CREDIT_RESERVED",
        "CREDIT_RESERVED",
        input.requestId,
      );
      await database.insert(creditLedgerEntries).values({
        operationId: current.id,
        demoSessionId: current.demoSessionId,
        entryType: "MIGRATION_CREDIT_RESERVED",
        amountMinor: quote.migrationCreditMinor,
        currency: quote.currency,
        metadata: { quotePublicId: quote.publicId },
      });
      const externalIdempotencyKey = `target_${sha256(current.publicId).slice(0, 32)}`;
      await this.transitionOperationWithDatabase(
        database,
        updated,
        "TARGET_CREATION_PENDING",
        "TARGET_CREATION_REQUESTED",
        input.requestId,
        { externalTargetIdempotencyKey: externalIdempotencyKey },
      );
      return {
        kind: "PREPARED" as const,
        idempotencyRecordId,
        externalIdempotencyKey,
        targetPlan: toTargetPlan(targetPlanRow),
        quote,
      };
    });
  }

  private async finalizeSuccess(input: {
    operationId: string;
    idempotencyRecordId: string | null;
    targetResult: Extract<TargetCreationResult, { status: "SUCCEEDED" }>;
    requestId: string;
  }): Promise<ConfirmationResult> {
    try {
      return await this.database.transaction(async (transaction) => {
        const database = transaction as unknown as AppDatabase;
        const [initial] = await database
          .select()
          .from(rebaseOperations)
          .where(eq(rebaseOperations.id, input.operationId))
          .limit(1);
        if (!initial || !initial.sourceFingerprint || !initial.sourceSubscriptionId) {
          throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);
        }
        await database.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${initial.sourceFingerprint}, 0))`,
        );
        const [quote] = await database
          .select()
          .from(rebaseQuotes)
          .where(eq(rebaseQuotes.operationId, initial.id))
          .limit(1);
        const [targetPlan] = await database
          .select()
          .from(targetPlans)
          .where(eq(targetPlans.id, initial.targetPlanId!))
          .limit(1);
        if (!quote) throw new ApplicationError("QUOTE_NOT_FOUND", "Quote not found", 404);
        if (!targetPlan) {
          throw new ApplicationError("TARGET_PLAN_NOT_FOUND", "Target plan not found", 404);
        }
        if (initial.status === "COMPLETED") {
          const body = buildSuccessBody(initial, quote, targetPlan.displayName, input.targetResult);
          return { httpStatus: 200, body, replayed: true };
        }

        let operation = await this.transitionOperationWithDatabase(
          database,
          initial,
          "TARGET_CREATED",
          "TARGET_CREATED",
          input.requestId,
          { externalTargetId: input.targetResult.externalSubscriptionId },
        );
        const consumed = await database
          .update(sourceSubscriptions)
          .set({
            consumedAt: this.clock.now().toISOString(),
            consumedByOperationId: operation.id,
            updatedAt: this.clock.now().toISOString(),
          })
          .where(
            and(
              eq(sourceSubscriptions.id, operation.sourceSubscriptionId!),
              isNull(sourceSubscriptions.consumedAt),
            ),
          )
          .returning({ id: sourceSubscriptions.id });
        if (consumed.length !== 1) {
          throw new ApplicationError(
            "SOURCE_ALREADY_CONSUMED",
            "Source subscription has already been migrated",
            409,
          );
        }
        operation = await this.transitionOperationWithDatabase(
          database,
          operation,
          "SOURCE_CONSUMED",
          "SOURCE_CONSUMED",
          input.requestId,
        );
        await database.insert(creditLedgerEntries).values([
          {
            operationId: operation.id,
            demoSessionId: operation.demoSessionId,
            entryType: "MIGRATION_CREDIT_ISSUED",
            amountMinor: quote.migrationCreditMinor,
            currency: quote.currency,
            metadata: { policyVersion: quote.policyVersion },
          },
          {
            operationId: operation.id,
            demoSessionId: operation.demoSessionId,
            entryType: "MIGRATION_CREDIT_APPLIED",
            amountMinor: -quote.creditAppliedMinor,
            currency: quote.currency,
            externalReference: input.targetResult.externalInvoiceId,
            metadata: { targetPlanId: operation.targetPlanId },
          },
          ...(quote.carryForwardMinor > 0n
            ? [
                {
                  operationId: operation.id,
                  demoSessionId: operation.demoSessionId,
                  entryType: "MIGRATION_CREDIT_CARRIED_FORWARD",
                  amountMinor: quote.carryForwardMinor,
                  currency: quote.currency,
                  metadata: { source: "migration-credit" },
                },
              ]
            : []),
        ]);
        operation = await this.transitionOperationWithDatabase(
          database,
          operation,
          "CREDIT_COMMITTED",
          "CREDIT_COMMITTED",
          input.requestId,
        );
        operation = await this.transitionOperationWithDatabase(
          database,
          operation,
          "COMPLETED",
          "OPERATION_COMPLETED",
          input.requestId,
          { completedAt: this.clock.now().toISOString() },
        );
        const body = buildSuccessBody(operation, quote, targetPlan.displayName, input.targetResult);
        await this.completeIdempotency(database, operation, input.idempotencyRecordId, 200, body);
        return { httpStatus: 200, body, replayed: false };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApplicationError(
          "SOURCE_ALREADY_CONSUMED",
          "Source subscription has already been migrated",
          409,
        );
      }
      throw error;
    }
  }

  private async finalizeFailure(input: {
    operationId: string;
    idempotencyRecordId: string;
    requestId: string;
    retryable: boolean;
  }): Promise<ConfirmationResult> {
    return this.database.transaction(async (transaction) => {
      const database = transaction as unknown as AppDatabase;
      const [initial] = await database
        .select()
        .from(rebaseOperations)
        .where(eq(rebaseOperations.id, input.operationId))
        .limit(1);
      const [quote] = await database
        .select()
        .from(rebaseQuotes)
        .where(eq(rebaseQuotes.operationId, input.operationId))
        .limit(1);
      if (!initial || !quote)
        throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);
      let operation = await this.transitionOperationWithDatabase(
        database,
        initial,
        "TARGET_CREATION_FAILED",
        "TARGET_CREATION_FAILED",
        input.requestId,
      );
      await database.insert(creditLedgerEntries).values({
        operationId: operation.id,
        demoSessionId: operation.demoSessionId,
        entryType: "MIGRATION_CREDIT_RELEASED",
        amountMinor: -quote.migrationCreditMinor,
        currency: quote.currency,
        metadata: { retryable: input.retryable },
      });
      if (input.retryable) {
        operation = await this.transitionOperationWithDatabase(
          database,
          operation,
          "QUOTE_READY",
          "CREDIT_RELEASED",
          input.requestId,
        );
      }
      const body: ConfirmationBody = {
        operation: {
          publicId: operation.publicId,
          status: "TARGET_CREATION_FAILED",
          migrationCreditMinor: quote.migrationCreditMinor.toString(),
          amountDueMinor: quote.amountDueMinor.toString(),
        },
      };
      await database
        .update(idempotencyRecords)
        .set({
          status: input.retryable ? "RETRYABLE" : "COMPLETED",
          httpStatus: 502,
          responseBody: body,
          updatedAt: this.clock.now().toISOString(),
        })
        .where(eq(idempotencyRecords.id, input.idempotencyRecordId));
      return { httpStatus: 502, body, replayed: false };
    });
  }

  private async finalizeUnknown(input: {
    operationId: string;
    idempotencyRecordId: string;
    requestId: string;
  }): Promise<ConfirmationResult> {
    return this.database.transaction(async (transaction) => {
      const database = transaction as unknown as AppDatabase;
      const [initial] = await database
        .select()
        .from(rebaseOperations)
        .where(eq(rebaseOperations.id, input.operationId))
        .limit(1);
      const [quote] = await database
        .select()
        .from(rebaseQuotes)
        .where(eq(rebaseQuotes.operationId, input.operationId))
        .limit(1);
      if (!initial || !quote)
        throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);
      const operation = await this.transitionOperationWithDatabase(
        database,
        initial,
        "RECONCILIATION_REQUIRED",
        "RECONCILIATION_REQUIRED",
        input.requestId,
      );
      const body: ConfirmationBody = {
        operation: {
          publicId: operation.publicId,
          status: "RECONCILIATION_REQUIRED",
          migrationCreditMinor: quote.migrationCreditMinor.toString(),
          amountDueMinor: quote.amountDueMinor.toString(),
        },
      };
      await this.completeIdempotency(database, operation, input.idempotencyRecordId, 202, body);
      return { httpStatus: 202, body, replayed: false };
    });
  }

  private async waitForConfirmation(input: {
    demoSessionId: string;
    operationPublicId: string;
    endpointScope: string;
    keyHash: string;
    requestHash: string;
  }): Promise<ConfirmationResult> {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      const [record] = await this.database
        .select()
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.demoSessionId, input.demoSessionId),
            eq(idempotencyRecords.endpointScope, input.endpointScope),
            eq(idempotencyRecords.idempotencyKeyHash, input.keyHash),
          ),
        )
        .limit(1);
      if (record && record.requestHash !== input.requestHash) {
        throw new ApplicationError(
          "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
          "Idempotency key was already used with a different payload",
          409,
        );
      }
      if (record?.status === "COMPLETED" && record.httpStatus && record.responseBody) {
        return {
          httpStatus: record.httpStatus,
          body: record.responseBody as ConfirmationBody,
          replayed: true,
        };
      }
      const operation = await new OperationRepository(this.database).findOwned(
        input.operationPublicId,
        input.demoSessionId,
      );
      if (operation?.status === "COMPLETED") {
        throw new ApplicationError(
          "SOURCE_ALREADY_CONSUMED",
          "Source subscription has already been migrated",
          409,
        );
      }
    }
    throw new ApplicationError(
      "REQUEST_IN_PROGRESS",
      "Confirmation is still in progress",
      409,
      true,
    );
  }

  private async transitionOperation(
    operation: RebaseOperationRow,
    to: MigrationState,
    eventType: string,
    requestId: string,
    updates: Partial<typeof rebaseOperations.$inferInsert> = {},
  ): Promise<RebaseOperationRow> {
    return this.transitionOperationWithDatabase(
      this.database,
      operation,
      to,
      eventType,
      requestId,
      updates,
    );
  }

  private async transitionOperationWithDatabase(
    database: AppDatabase,
    operation: RebaseOperationRow,
    to: MigrationState,
    eventType: string,
    requestId: string,
    updates: Partial<typeof rebaseOperations.$inferInsert> = {},
  ): Promise<RebaseOperationRow> {
    const transition = transitionState({
      from: operation.status as MigrationState,
      to,
      eventType,
      actorType: eventType.startsWith("RECONCILIATION") ? "RECONCILER" : "SYSTEM",
      actorId: "take-my-money",
      requestId,
      timestampUtc: this.clock.now().toISOString(),
      currentVersion: operation.stateVersion,
      metadata: updates,
    });
    const updated = await new OperationRepository(database).update(
      operation.id,
      operation.stateVersion,
      { ...updates, status: to },
    );
    if (!updated) {
      throw new ApplicationError(
        "CONCURRENT_STATE_CHANGE",
        "Operation changed concurrently",
        409,
        true,
      );
    }
    await this.appendAuditWithDatabase(database, {
      operationId: operation.id,
      demoSessionId: operation.demoSessionId,
      eventType,
      previousState: transition.previousState,
      nextState: transition.nextState,
      actorType: transition.actorType,
      requestId,
      metadata: updates as Record<string, unknown>,
    });
    return updated;
  }

  private async appendAuditWithDatabase(
    database: AppDatabase,
    values: Omit<typeof auditEvents.$inferInsert, "sequenceNumber">,
  ): Promise<void> {
    const [last] = values.operationId
      ? await database
          .select({ value: max(auditEvents.sequenceNumber) })
          .from(auditEvents)
          .where(eq(auditEvents.operationId, values.operationId))
      : [{ value: 0 }];
    await database
      .insert(auditEvents)
      .values({ ...values, sequenceNumber: (last?.value ?? 0) + 1 });
  }

  private async completeIdempotency(
    database: AppDatabase,
    operation: RebaseOperationRow,
    recordId: string | null,
    httpStatus: number,
    body: ConfirmationBody,
  ): Promise<void> {
    const where = recordId
      ? eq(idempotencyRecords.id, recordId)
      : eq(idempotencyRecords.endpointScope, `confirm:${operation.publicId}`);
    await database
      .update(idempotencyRecords)
      .set({
        status: "COMPLETED",
        httpStatus,
        responseBody: body,
        updatedAt: this.clock.now().toISOString(),
      })
      .where(where);
  }
}

function toTargetPlan(row: typeof targetPlans.$inferSelect): TargetPlan {
  return {
    id: row.id,
    displayName: row.displayName,
    priceMinor: row.priceMinor,
    currency: row.currency,
    billingInterval: row.billingInterval as TargetPlan["billingInterval"],
    active: row.active,
  };
}

function toVerifiedSubscription(
  row: typeof sourceSubscriptions.$inferSelect,
): VerifiedSubscription {
  return {
    provider: row.provider as VerifiedSubscription["provider"],
    externalSubscriptionId: row.externalSubscriptionIdRedacted,
    originalTransactionId: row.originalTransactionFingerprint,
    productId: row.productId,
    planName: row.planName,
    status: row.status as VerifiedSubscription["status"],
    periodStartUtc: toIsoUtc(row.periodStart),
    periodEndUtc: toIsoUtc(row.periodEnd),
    amountPaidMinor: row.amountPaidMinor,
    currency: row.currency,
    autoRenew: row.autoRenew,
    environment: row.environment as VerifiedSubscription["environment"],
    verifiedAtUtc: toIsoUtc(row.verifiedAt),
  };
}

function redact(value: string): string {
  return `${value.slice(0, 5)}•••${value.slice(-4)}`;
}

function toIsoUtc(value: string): string {
  return new Date(value).toISOString();
}

function buildSuccessBody(
  operation: RebaseOperationRow,
  quote: RebaseQuoteRow,
  targetPlanName: string,
  targetResult: Extract<TargetCreationResult, { status: "SUCCEEDED" }>,
): ConfirmationBody {
  return {
    operation: {
      publicId: operation.publicId,
      status: "COMPLETED",
      migrationCreditMinor: quote.migrationCreditMinor.toString(),
      amountDueMinor: quote.amountDueMinor.toString(),
      targetSubscription: {
        planName: targetPlanName,
        startsAt: targetResult.startedAtUtc,
        renewsAt: targetResult.renewsAtUtc,
      },
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
