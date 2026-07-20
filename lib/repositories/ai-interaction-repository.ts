import { and, count, eq, gte, lt, sql } from "drizzle-orm";
import { aiInteractions, type AiInteractionRow } from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";

export type AiPurpose = "RECEIPT_EXTRACTION" | "MIGRATION_EXPLANATION";

type StartInput = {
  demoSessionId: string;
  operationId: string;
  purpose: AiPurpose;
  model: string;
  inputHash: string;
  outputSchemaVersion: string;
  hourlyLimit: number;
};

export class AiInteractionRepository {
  constructor(private readonly database: AppDatabase) {}

  async tryStart(input: StartInput): Promise<AiInteractionRow | null> {
    return this.database.transaction(async (transaction) => {
      const database = transaction as unknown as AppDatabase;
      await database.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`ai:${input.demoSessionId}`}))`,
      );
      const staleBefore = new Date(Date.now() - 60_000).toISOString();
      await database
        .update(aiInteractions)
        .set({ status: "ERROR", errorCode: "STALE_PROCESSING" })
        .where(
          and(
            eq(aiInteractions.demoSessionId, input.demoSessionId),
            eq(aiInteractions.status, "PROCESSING"),
            lt(aiInteractions.createdAt, staleBefore),
          ),
        );
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [recent] = await database
        .select({ value: count() })
        .from(aiInteractions)
        .where(
          and(
            eq(aiInteractions.demoSessionId, input.demoSessionId),
            eq(aiInteractions.purpose, input.purpose),
            eq(aiInteractions.model, input.model),
            gte(aiInteractions.createdAt, since),
          ),
        );
      const [active] = await database
        .select({ value: count() })
        .from(aiInteractions)
        .where(
          and(
            eq(aiInteractions.demoSessionId, input.demoSessionId),
            eq(aiInteractions.status, "PROCESSING"),
          ),
        );
      if (Number(recent?.value ?? 0) >= input.hourlyLimit || Number(active?.value ?? 0) >= 3) {
        return null;
      }
      const [row] = await database
        .insert(aiInteractions)
        .values({
          demoSessionId: input.demoSessionId,
          operationId: input.operationId,
          purpose: input.purpose,
          model: input.model,
          status: "PROCESSING",
          inputHash: input.inputHash,
          outputSchemaVersion: input.outputSchemaVersion,
        })
        .returning();
      if (!row) throw new Error("Failed to start AI interaction");
      return row;
    });
  }

  async finish(
    id: string,
    values: {
      status: "LIVE" | "FALLBACK" | "ERROR";
      latencyMs: number;
      inputTokens?: number;
      outputTokens?: number;
      reasoningTokens?: number;
      errorCode?: string;
    },
  ): Promise<void> {
    await this.database
      .update(aiInteractions)
      .set({
        status: values.status,
        latencyMs: values.latencyMs,
        inputTokens: values.inputTokens,
        outputTokens: values.outputTokens,
        reasoningTokens: values.reasoningTokens,
        errorCode: values.errorCode,
      })
      .where(eq(aiInteractions.id, id));
  }

  async recordFallback(
    input: Omit<StartInput, "hourlyLimit"> & { errorCode: string },
  ): Promise<void> {
    await this.database.insert(aiInteractions).values({
      demoSessionId: input.demoSessionId,
      operationId: input.operationId,
      purpose: input.purpose,
      model: "deterministic-fallback",
      status: "FALLBACK",
      inputHash: input.inputHash,
      outputSchemaVersion: input.outputSchemaVersion,
      latencyMs: 0,
      errorCode: input.errorCode,
    });
  }
}
