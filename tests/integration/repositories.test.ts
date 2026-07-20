// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { targetPlans } from "@/db/schema";
import { closeDatabaseForTests, getDatabase } from "@/lib/db/client";
import { AiInteractionRepository } from "@/lib/repositories/ai-interaction-repository";
import { AuditRepository } from "@/lib/repositories/audit-repository";
import { IdempotencyRepository } from "@/lib/repositories/idempotency-repository";
import { LedgerRepository } from "@/lib/repositories/ledger-repository";
import { OperationRepository } from "@/lib/repositories/operation-repository";
import { QuoteRepository } from "@/lib/repositories/quote-repository";
import { SessionRepository } from "@/lib/repositories/session-repository";
import { SourceRepository } from "@/lib/repositories/source-repository";

const database = getDatabase();

async function resetDatabase() {
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
  await database.insert(targetPlans).values({
    id: "direct-pro-monthly",
    displayName: "Direct Pro",
    priceMinor: 22_900n,
    currency: "EUR",
    billingInterval: "MONTHLY",
    active: true,
    sortOrder: 1,
    metadata: { illustrative: true },
  });
}

async function createFixture() {
  const sessions = new SessionRepository(database);
  const sources = new SourceRepository(database);
  const operations = new OperationRepository(database);
  const session = await sessions.create(new Date("2026-07-19T00:00:00.000Z"));
  const source = await sources.saveVerified({
    demoSessionId: session.id,
    provider: "APPLE_SANDBOX",
    externalSubscriptionIdRedacted: "sub_•••001",
    originalTransactionFingerprint: "fingerprint-active-001",
    originalTransactionSuffix: "-001",
    productId: "plus-mobile-demo",
    planName: "Plus — mobile billed demo",
    status: "ACTIVE",
    periodStart: "2026-07-07T00:00:00.000Z",
    periodEnd: "2026-08-07T00:00:00.000Z",
    amountPaidMinor: 2499n,
    currency: "EUR",
    autoRenew: true,
    environment: "SANDBOX",
    verifiedAt: "2026-07-19T00:00:00.000Z",
    verificationSnapshot: { source: "fixture" },
  });
  const operation = await operations.create({
    demoSessionId: session.id,
    scenarioId: "active-normal",
    sourceSubscriptionId: source.id,
    targetPlanId: "direct-pro-monthly",
    status: "SOURCE_VERIFIED",
    evaluationTime: "2026-07-19T00:00:00.000Z",
    sourceFingerprint: source.originalTransactionFingerprint,
  });
  return { session, source, operation, sessions, sources, operations };
}

beforeEach(resetDatabase);
afterAll(closeDatabaseForTests);

describe("PostgreSQL repositories", () => {
  it("creates, finds, touches, and resets anonymous sessions", async () => {
    const sessions = new SessionRepository(database);
    const session = await sessions.create(new Date("2026-07-19T00:00:00.000Z"));
    expect(session.publicId).toMatch(/^dms_/);
    expect(await sessions.findByPublicId(session.publicId)).toMatchObject({ id: session.id });

    await sessions.incrementReset(session.id, 1);
    expect(await sessions.findByPublicId(session.publicId)).toMatchObject({ resetCount: 1 });
  });

  it("upserts a verified source and consumes it once", async () => {
    const { source, sources, operation } = await createFixture();
    expect(
      await sources.findByFingerprint(source.demoSessionId, source.originalTransactionFingerprint),
    ).toMatchObject({ id: source.id });
    expect(await sources.markConsumed(source.id, operation.id, "2026-07-19T00:00:01.000Z")).toBe(
      true,
    );
    expect(await sources.markConsumed(source.id, operation.id, "2026-07-19T00:00:02.000Z")).toBe(
      false,
    );
  });

  it("isolates operations by owning session and uses optimistic state versions", async () => {
    const { session, operation, operations } = await createFixture();
    const otherSession = await new SessionRepository(database).create();

    expect(await operations.findOwned(operation.publicId, session.id)).toMatchObject({
      id: operation.id,
    });
    expect(await operations.findOwned(operation.publicId, otherSession.id)).toBeNull();
    expect(await operations.update(operation.id, 0, { status: "QUOTE_READY" })).toMatchObject({
      stateVersion: 1,
    });
    expect(await operations.update(operation.id, 0, { status: "FAILED" })).toBeNull();
  });

  it("creates one immutable quote per operation", async () => {
    const { operation } = await createFixture();
    const quotes = new QuoteRepository(database);
    const input = {
      operationId: operation.id,
      algorithmVersion: "utc-rational-v1",
      policyId: "demo-gross-portability",
      policyVersion: "1.0.0",
      currency: "EUR",
      sourceValueMinor: 2499n,
      periodDurationMs: 2_678_400_000n,
      remainingDurationMs: 1_641_600_000n,
      ratioNumerator: 19n,
      ratioDenominator: 31n,
      migrationCreditMinor: 1532n,
      targetPriceMinor: 22_900n,
      creditAppliedMinor: 1532n,
      amountDueMinor: 21_368n,
      carryForwardMinor: 0n,
      roundingMode: "HALF_UP",
      calculationSnapshot: { migrationCreditMinor: "1532" },
      quoteFingerprint: "quote-fingerprint-001",
      expiresAt: "2026-07-19T00:10:00.000Z",
    };

    const quote = await quotes.create(input);
    expect(await quotes.findByOperation(operation.id)).toMatchObject({ id: quote.id });
    await expect(quotes.create({ ...input, quoteFingerprint: "another" })).rejects.toThrow();
  });

  it("keeps ledger entries append-only and unique by operation/type", async () => {
    const { operation, session } = await createFixture();
    const ledger = new LedgerRepository(database);
    const input = {
      operationId: operation.id,
      demoSessionId: session.id,
      entryType: "MIGRATION_CREDIT_ISSUED",
      amountMinor: 1532n,
      currency: "EUR",
      metadata: { quote: "qt_test" },
    };

    await ledger.append(input);
    await expect(ledger.append(input)).rejects.toThrow();
    expect(await ledger.list(operation.id)).toHaveLength(1);
  });

  it("orders audit events and replays completed idempotency records", async () => {
    const { operation, session } = await createFixture();
    const audit = new AuditRepository(database);
    const idempotency = new IdempotencyRepository(database);

    for (const eventType of ["SOURCE_VERIFIED", "ELIGIBILITY_EVALUATED", "QUOTE_CREATED"]) {
      await audit.append({
        operationId: operation.id,
        demoSessionId: session.id,
        eventType,
        actorType: "SYSTEM",
        requestId: `req_${eventType}`,
        metadata: {},
      });
    }
    expect((await audit.list(operation.id)).map((event) => event.sequenceNumber)).toEqual([
      1, 2, 3,
    ]);

    const recordInput = {
      demoSessionId: session.id,
      endpointScope: `confirm:${operation.publicId}`,
      idempotencyKeyHash: "key-hash",
      requestHash: "request-hash",
      status: "PROCESSING",
      expiresAt: "2026-07-20T00:00:00.000Z",
    };
    const record = await idempotency.begin(recordInput);
    expect(record).not.toBeNull();
    expect(await idempotency.begin(recordInput)).toBeNull();
    await idempotency.complete(record!.id, 200, { operation: { status: "COMPLETED" } });
    expect(
      await idempotency.find(session.id, recordInput.endpointScope, recordInput.idempotencyKeyHash),
    ).toMatchObject({ status: "COMPLETED", httpStatus: 200 });
  });

  it("enforces per-session AI concurrency and hourly limits with database locks", async () => {
    const { session, operation } = await createFixture();
    const interactions = new AiInteractionRepository(database);
    const start = (inputHash: string, hourlyLimit = 20) =>
      interactions.tryStart({
        demoSessionId: session.id,
        operationId: operation.id,
        purpose: "RECEIPT_EXTRACTION",
        model: "gpt-5.6",
        inputHash,
        outputSchemaVersion: "1.0",
        hourlyLimit,
      });

    const active = await Promise.all([start("one"), start("two"), start("three")]);
    expect(active.every(Boolean)).toBe(true);
    expect(await start("four")).toBeNull();

    await interactions.finish(active[0]!.id, { status: "LIVE", latencyMs: 25 });
    expect(await start("five")).not.toBeNull();

    const otherSession = await new SessionRepository(database).create();
    const otherOperation = await new OperationRepository(database).create({
      demoSessionId: otherSession.id,
      scenarioId: "active-normal",
      status: "DRAFT",
      evaluationTime: "2026-07-19T00:00:00.000Z",
    });
    const separate = new AiInteractionRepository(database);
    const firstOther = await separate.tryStart({
      demoSessionId: otherSession.id,
      operationId: otherOperation.id,
      purpose: "RECEIPT_EXTRACTION",
      model: "gpt-5.6",
      inputHash: "independent",
      outputSchemaVersion: "1.0",
      hourlyLimit: 1,
    });
    expect(firstOther).not.toBeNull();
    await separate.finish(firstOther!.id, { status: "LIVE", latencyMs: 20 });
    expect(
      await separate.tryStart({
        demoSessionId: otherSession.id,
        operationId: otherOperation.id,
        purpose: "RECEIPT_EXTRACTION",
        model: "gpt-5.6",
        inputHash: "hourly-second",
        outputSchemaVersion: "1.0",
        hourlyLimit: 1,
      }),
    ).toBeNull();
  });
});
