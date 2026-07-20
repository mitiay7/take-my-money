import { and, eq, isNull } from "drizzle-orm";
import { sourceSubscriptions, type SourceSubscriptionRow } from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";

export class SourceRepository {
  constructor(private readonly database: AppDatabase) {}

  async saveVerified(
    values: typeof sourceSubscriptions.$inferInsert,
  ): Promise<SourceSubscriptionRow> {
    const [source] = await this.database
      .insert(sourceSubscriptions)
      .values(values)
      .onConflictDoUpdate({
        target: [
          sourceSubscriptions.demoSessionId,
          sourceSubscriptions.originalTransactionFingerprint,
        ],
        set: {
          status: values.status,
          verifiedAt: values.verifiedAt,
          verificationSnapshot: values.verificationSnapshot,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
    if (!source) throw new Error("Failed to save verified source");
    return source;
  }

  async findByFingerprint(
    demoSessionId: string,
    fingerprint: string,
  ): Promise<SourceSubscriptionRow | null> {
    const [source] = await this.database
      .select()
      .from(sourceSubscriptions)
      .where(
        and(
          eq(sourceSubscriptions.demoSessionId, demoSessionId),
          eq(sourceSubscriptions.originalTransactionFingerprint, fingerprint),
        ),
      )
      .limit(1);
    return source ?? null;
  }

  async markConsumed(id: string, operationId: string, consumedAt: string): Promise<boolean> {
    const rows = await this.database
      .update(sourceSubscriptions)
      .set({ consumedAt, consumedByOperationId: operationId, updatedAt: consumedAt })
      .where(and(eq(sourceSubscriptions.id, id), isNull(sourceSubscriptions.consumedAt)))
      .returning({ id: sourceSubscriptions.id });
    return rows.length === 1;
  }
}
