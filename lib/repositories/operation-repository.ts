import { and, eq } from "drizzle-orm";
import { rebaseOperations, type RebaseOperationRow } from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";
import { createPublicId } from "./ids";

export class OperationRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(
    values: Omit<typeof rebaseOperations.$inferInsert, "publicId">,
  ): Promise<RebaseOperationRow> {
    const [operation] = await this.database
      .insert(rebaseOperations)
      .values({ ...values, publicId: createPublicId("op") })
      .returning();
    if (!operation) throw new Error("Failed to create rebase operation");
    return operation;
  }

  async findOwned(publicId: string, demoSessionId: string): Promise<RebaseOperationRow | null> {
    const [operation] = await this.database
      .select()
      .from(rebaseOperations)
      .where(
        and(
          eq(rebaseOperations.publicId, publicId),
          eq(rebaseOperations.demoSessionId, demoSessionId),
        ),
      )
      .limit(1);
    return operation ?? null;
  }

  async update(
    id: string,
    currentVersion: number,
    values: Partial<typeof rebaseOperations.$inferInsert>,
  ): Promise<RebaseOperationRow | null> {
    const [operation] = await this.database
      .update(rebaseOperations)
      .set({ ...values, stateVersion: currentVersion + 1, updatedAt: new Date().toISOString() })
      .where(and(eq(rebaseOperations.id, id), eq(rebaseOperations.stateVersion, currentVersion)))
      .returning();
    return operation ?? null;
  }
}
