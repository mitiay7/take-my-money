import { eq } from "drizzle-orm";
import type { TargetPlan } from "@take-my-money/billing-core";
import type {
  TargetBillingProvider,
  TargetCreationResult,
  TargetLookupResult,
} from "@take-my-money/provider-contracts";
import { sandboxTargetResults } from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";
import { sha256 } from "@/lib/security/hashing";

export type TargetBehavior = "SUCCESS" | "FAIL_ONCE" | "UNKNOWN_THEN_SUCCESS";

export class DirectSandboxBillingProvider implements TargetBillingProvider {
  constructor(
    private readonly database: AppDatabase,
    private readonly behavior: TargetBehavior,
    private readonly evaluationTimeUtc: string,
  ) {}

  async createSubscription(input: {
    operationId: string;
    plan: TargetPlan;
    amountDueMinor: bigint;
    currency: string;
    externalIdempotencyKey: string;
    requestId: string;
  }): Promise<TargetCreationResult> {
    const [existing] = await this.database
      .select()
      .from(sandboxTargetResults)
      .where(eq(sandboxTargetResults.externalIdempotencyKey, input.externalIdempotencyKey))
      .limit(1);

    if (existing) {
      if (existing.outcome === "FAILED" && existing.lookupOutcome === "SUCCEEDED") {
        const success = this.successResult(input.externalIdempotencyKey);
        await this.database
          .update(sandboxTargetResults)
          .set({
            outcome: "SUCCEEDED",
            externalSubscriptionId: success.externalSubscriptionId,
            externalInvoiceId: success.externalInvoiceId,
            startedAt: success.startedAtUtc,
            renewsAt: success.renewsAtUtc,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(sandboxTargetResults.id, existing.id));
        return success;
      }
      return this.rowToCreationResult(existing);
    }

    const success = this.successResult(input.externalIdempotencyKey);
    if (this.behavior === "SUCCESS") {
      await this.database.insert(sandboxTargetResults).values({
        externalIdempotencyKey: input.externalIdempotencyKey,
        operationId: input.operationId,
        outcome: "SUCCEEDED",
        externalSubscriptionId: success.externalSubscriptionId,
        externalInvoiceId: success.externalInvoiceId,
        startedAt: success.startedAtUtc,
        renewsAt: success.renewsAtUtc,
      });
      return success;
    }

    if (this.behavior === "FAIL_ONCE") {
      await this.database.insert(sandboxTargetResults).values({
        externalIdempotencyKey: input.externalIdempotencyKey,
        operationId: input.operationId,
        outcome: "FAILED",
        lookupOutcome: "SUCCEEDED",
      });
      return { status: "FAILED", failureCode: "SANDBOX_TARGET_DECLINED", retryable: true };
    }

    await this.database.insert(sandboxTargetResults).values({
      externalIdempotencyKey: input.externalIdempotencyKey,
      operationId: input.operationId,
      outcome: "UNKNOWN",
      lookupOutcome: "SUCCEEDED",
      externalSubscriptionId: success.externalSubscriptionId,
      externalInvoiceId: success.externalInvoiceId,
      startedAt: success.startedAtUtc,
      renewsAt: success.renewsAtUtc,
    });
    return { status: "UNKNOWN" };
  }

  async findByIdempotencyKey(input: {
    externalIdempotencyKey: string;
    requestId: string;
  }): Promise<TargetLookupResult> {
    const [row] = await this.database
      .select()
      .from(sandboxTargetResults)
      .where(eq(sandboxTargetResults.externalIdempotencyKey, input.externalIdempotencyKey))
      .limit(1);
    if (!row) return { status: "NOT_FOUND" };
    if (row.lookupOutcome === "SUCCEEDED") {
      return this.successResult(input.externalIdempotencyKey);
    }
    return this.rowToLookupResult(row);
  }

  private successResult(externalIdempotencyKey: string) {
    const digest = sha256(externalIdempotencyKey).slice(0, 16);
    const start = new Date(this.evaluationTimeUtc);
    const renewal = new Date(start);
    renewal.setUTCMonth(renewal.getUTCMonth() + 1);
    return {
      status: "SUCCEEDED" as const,
      externalSubscriptionId: `sub_direct_${digest}`,
      externalInvoiceId: `inv_demo_${digest}`,
      startedAtUtc: start.toISOString(),
      renewsAtUtc: renewal.toISOString(),
    };
  }

  private rowToCreationResult(row: typeof sandboxTargetResults.$inferSelect): TargetCreationResult {
    if (
      row.outcome === "SUCCEEDED" &&
      row.externalSubscriptionId &&
      row.externalInvoiceId &&
      row.startedAt &&
      row.renewsAt
    ) {
      return {
        status: "SUCCEEDED",
        externalSubscriptionId: row.externalSubscriptionId,
        externalInvoiceId: row.externalInvoiceId,
        startedAtUtc: row.startedAt,
        renewsAtUtc: row.renewsAt,
      };
    }
    if (row.outcome === "FAILED") {
      return { status: "FAILED", failureCode: "SANDBOX_TARGET_DECLINED", retryable: true };
    }
    return { status: "UNKNOWN" };
  }

  private rowToLookupResult(row: typeof sandboxTargetResults.$inferSelect): TargetLookupResult {
    const result = this.rowToCreationResult(row);
    return result.status === "UNKNOWN" ? { status: "NOT_FOUND" } : result;
  }
}
