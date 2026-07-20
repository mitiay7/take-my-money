import { and, eq } from "drizzle-orm";
import { idempotencyRecords, type IdempotencyRecordRow } from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";

export class IdempotencyRepository {
  constructor(private readonly database: AppDatabase) {}

  async find(
    demoSessionId: string,
    endpointScope: string,
    keyHash: string,
  ): Promise<IdempotencyRecordRow | null> {
    const [record] = await this.database
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.demoSessionId, demoSessionId),
          eq(idempotencyRecords.endpointScope, endpointScope),
          eq(idempotencyRecords.idempotencyKeyHash, keyHash),
        ),
      )
      .limit(1);
    return record ?? null;
  }

  async begin(
    values: typeof idempotencyRecords.$inferInsert,
  ): Promise<IdempotencyRecordRow | null> {
    const [record] = await this.database
      .insert(idempotencyRecords)
      .values(values)
      .onConflictDoNothing()
      .returning();
    return record ?? null;
  }

  async complete(
    id: string,
    httpStatus: number,
    responseBody: Record<string, unknown>,
  ): Promise<void> {
    await this.database
      .update(idempotencyRecords)
      .set({ status: "COMPLETED", httpStatus, responseBody, updatedAt: new Date().toISOString() })
      .where(eq(idempotencyRecords.id, id));
  }
}
