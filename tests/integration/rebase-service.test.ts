// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { rebaseQuotes, targetPlans } from "@/db/schema";
import { ApplicationError } from "@/lib/application/errors";
import { RebaseService } from "@/lib/application/rebase-service";
import { closeDatabaseForTests, getDatabase } from "@/lib/db/client";
import { AuditRepository } from "@/lib/repositories/audit-repository";
import { LedgerRepository } from "@/lib/repositories/ledger-repository";
import { OperationRepository } from "@/lib/repositories/operation-repository";
import { SessionRepository } from "@/lib/repositories/session-repository";

const database = getDatabase();
const consents = {
  understandsSandbox: true,
  understandsSourceCancellation: true,
  authorizesSimulatedMigration: true,
};

const clock = {
  current: new Date("2026-07-20T09:00:00.000Z"),
  now() {
    return new Date(this.current);
  },
};

async function resetDatabase() {
  clock.current = new Date("2026-07-20T09:00:00.000Z");
  await database.execute(sql`
    truncate table
      ai_interactions,
      audit_events,
      credit_ledger_entries,
      idempotency_records,
      rebase_quotes,
      sandbox_target_results,
      rebase_operations,
      source_subscriptions,
      demo_sessions,
      target_plans
    restart identity cascade
  `);
  await database.insert(targetPlans).values([
    {
      id: "direct-basic-monthly",
      displayName: "Direct Basic",
      priceMinor: 1900n,
      currency: "EUR",
      billingInterval: "MONTHLY",
      active: true,
      sortOrder: 1,
      metadata: { illustrative: true },
    },
    {
      id: "direct-pro-monthly",
      displayName: "Direct Pro",
      priceMinor: 22_900n,
      currency: "EUR",
      billingInterval: "MONTHLY",
      active: true,
      sortOrder: 2,
      metadata: { illustrative: true },
    },
  ]);
}

async function setupEligibleScenario(scenarioId = "active-normal") {
  const session = await new SessionRepository(database).create(clock.now());
  const service = new RebaseService(database, clock);
  const operation = await service.createOperation({
    demoSessionId: session.id,
    scenarioId,
    requestId: "req_create",
  });
  const verification = await service.verifySource({
    demoSessionId: session.id,
    operationPublicId: operation.publicId,
    lookupReference: scenarioId === "unknown-target-result" ? "TMM-UNKNOWN-001" : "TMM-ACTIVE-001",
    requestId: "req_verify",
  });
  const quoted = await service.createQuote({
    demoSessionId: session.id,
    operationPublicId: operation.publicId,
    targetPlanId: "direct-pro-monthly",
    requestId: "req_quote",
  });
  return { session, service, operation: quoted.operation, verification, quote: quoted.quote };
}

beforeEach(resetDatabase);
afterAll(closeDatabaseForTests);

describe("rebase saga", () => {
  it("completes once, persists the ledger, and replays the same idempotent response", async () => {
    const { session, service, operation, quote } = await setupEligibleScenario();
    const input = {
      demoSessionId: session.id,
      operationPublicId: operation.publicId,
      quotePublicId: quote.publicId,
      consents,
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      requestId: "req_confirm",
    };

    const first = await service.confirm(input);
    const replay = await service.confirm({ ...input, requestId: "req_replay" });

    expect(first).toMatchObject({
      httpStatus: 200,
      replayed: false,
      body: {
        operation: {
          status: "COMPLETED",
          migrationCreditMinor: "1532",
          amountDueMinor: "21368",
          targetSubscription: { planName: "Direct Pro" },
        },
      },
    });
    expect(replay).toEqual({ ...first, replayed: true });

    const stored = await new OperationRepository(database).findOwned(
      operation.publicId,
      session.id,
    );
    expect(stored?.status).toBe("COMPLETED");
    expect(
      (await new LedgerRepository(database).list(operation.id)).map((entry) => entry.entryType),
    ).toEqual(["MIGRATION_CREDIT_RESERVED", "MIGRATION_CREDIT_ISSUED", "MIGRATION_CREDIT_APPLIED"]);
    const audits = await new AuditRepository(database).list(operation.id);
    expect(audits.at(-1)?.eventType).toBe("OPERATION_COMPLETED");
    expect(audits.map((event) => event.sequenceNumber)).toEqual(
      audits.map((_, index) => index + 1),
    );
  });

  it("rejects reuse of an idempotency key with another payload", async () => {
    const { session, service, operation, quote } = await setupEligibleScenario();
    const idempotencyKey = "550e8400-e29b-41d4-a716-446655440001";
    await service.confirm({
      demoSessionId: session.id,
      operationPublicId: operation.publicId,
      quotePublicId: quote.publicId,
      consents,
      idempotencyKey,
      requestId: "req_confirm",
    });

    await expect(
      service.confirm({
        demoSessionId: session.id,
        operationPublicId: operation.publicId,
        quotePublicId: "qt_different_payload",
        consents,
        idempotencyKey,
        requestId: "req_conflict",
      }),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
      httpStatus: 409,
    });
  });

  it("allows exactly one of two concurrent confirmations with different keys", async () => {
    const { session, service, operation, quote } = await setupEligibleScenario();
    const makeRequest = (suffix: string) =>
      service.confirm({
        demoSessionId: session.id,
        operationPublicId: operation.publicId,
        quotePublicId: quote.publicId,
        consents,
        idempotencyKey: `550e8400-e29b-41d4-a716-44665544${suffix}`,
        requestId: `req_concurrent_${suffix}`,
      });

    const results = await Promise.allSettled([makeRequest("0010"), makeRequest("0011")]);
    const successes = results.filter((result) => result.status === "fulfilled");
    const failures = results.filter((result) => result.status === "rejected");
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "SOURCE_ALREADY_CONSUMED",
    });
    expect(await new LedgerRepository(database).list(operation.id)).toHaveLength(3);
  });

  it("releases a reservation on definite failure and succeeds on same-key retry", async () => {
    const { session, service, operation, quote } = await setupEligibleScenario();
    const input = {
      demoSessionId: session.id,
      operationPublicId: operation.publicId,
      quotePublicId: quote.publicId,
      consents,
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440020",
      requestId: "req_fail_once",
      targetBehaviorOverride: "FAIL_ONCE" as const,
    };
    const failed = await service.confirm(input);
    const retried = await service.confirm({ ...input, requestId: "req_retry" });

    expect(failed.httpStatus).toBe(502);
    expect(retried.body.operation.status).toBe("COMPLETED");
    expect(
      (await new LedgerRepository(database).list(operation.id)).map((entry) => entry.entryType),
    ).toEqual([
      "MIGRATION_CREDIT_RESERVED",
      "MIGRATION_CREDIT_RELEASED",
      "MIGRATION_CREDIT_RESERVED",
      "MIGRATION_CREDIT_ISSUED",
      "MIGRATION_CREDIT_APPLIED",
    ]);
  });

  it("holds an unknown result for reconciliation without creating twice", async () => {
    const { session, service, operation, quote } =
      await setupEligibleScenario("unknown-target-result");
    const confirmation = await service.confirm({
      demoSessionId: session.id,
      operationPublicId: operation.publicId,
      quotePublicId: quote.publicId,
      consents,
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440030",
      requestId: "req_unknown",
    });
    expect(confirmation).toMatchObject({
      httpStatus: 202,
      body: { operation: { status: "RECONCILIATION_REQUIRED" } },
    });

    const reconciled = await service.reconcile({
      demoSessionId: session.id,
      operationPublicId: operation.publicId,
      requestId: "req_reconcile",
    });
    expect(reconciled.body.operation.status).toBe("COMPLETED");

    const replay = await service.confirm({
      demoSessionId: session.id,
      operationPublicId: operation.publicId,
      quotePublicId: quote.publicId,
      consents,
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440030",
      requestId: "req_after_reconcile",
    });
    expect(replay).toMatchObject({ httpStatus: 200, replayed: true });
  });

  it("blocks already-consumed and billing-retry fixtures deterministically", async () => {
    const session = await new SessionRepository(database).create(clock.now());
    const service = new RebaseService(database, clock);
    const consumed = await service.createOperation({
      demoSessionId: session.id,
      scenarioId: "already-migrated",
      requestId: "req_consumed_create",
    });
    const consumedVerification = await service.verifySource({
      demoSessionId: session.id,
      operationPublicId: consumed.publicId,
      lookupReference: "TMM-CONSUMED-001",
      requestId: "req_consumed_verify",
    });
    expect(consumedVerification).toMatchObject({
      operation: { status: "INELIGIBLE" },
      decision: { status: "INELIGIBLE", reasons: ["SOURCE_ALREADY_CONSUMED"] },
    });

    const retry = await service.createOperation({
      demoSessionId: session.id,
      scenarioId: "billing-retry",
      requestId: "req_retry_create",
    });
    const retryVerification = await service.verifySource({
      demoSessionId: session.id,
      operationPublicId: retry.publicId,
      lookupReference: "TMM-RETRY-001",
      requestId: "req_retry_verify",
    });
    expect(retryVerification).toMatchObject({
      operation: { status: "MANUAL_REVIEW_REQUIRED" },
      decision: {
        status: "MANUAL_REVIEW_REQUIRED",
        reasons: ["SOURCE_BILLING_RETRY"],
      },
    });
  });

  it("rejects expired and tampered quotes before reserving credit", async () => {
    const expired = await setupEligibleScenario();
    clock.current = new Date("2026-07-20T09:11:00.000Z");
    await expect(
      expired.service.confirm({
        demoSessionId: expired.session.id,
        operationPublicId: expired.operation.publicId,
        quotePublicId: expired.quote.publicId,
        consents,
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440040",
        requestId: "req_expired",
      }),
    ).rejects.toMatchObject({ code: "QUOTE_EXPIRED" });

    await resetDatabase();
    const tampered = await setupEligibleScenario();
    await database
      .update(rebaseQuotes)
      .set({ calculationSnapshot: { migrationCreditMinor: "999999" } })
      .where(eq(rebaseQuotes.id, tampered.quote.id));
    await expect(
      tampered.service.confirm({
        demoSessionId: tampered.session.id,
        operationPublicId: tampered.operation.publicId,
        quotePublicId: tampered.quote.publicId,
        consents,
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440041",
        requestId: "req_tampered",
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
  });
});
