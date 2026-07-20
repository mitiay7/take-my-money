import { asc, eq } from "drizzle-orm";
import { creditLedgerEntries, type LedgerEntryRow } from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";

export class LedgerRepository {
  constructor(private readonly database: AppDatabase) {}

  async append(values: typeof creditLedgerEntries.$inferInsert): Promise<LedgerEntryRow> {
    const [entry] = await this.database.insert(creditLedgerEntries).values(values).returning();
    if (!entry) throw new Error("Failed to append ledger entry");
    return entry;
  }

  async list(operationId: string): Promise<LedgerEntryRow[]> {
    return this.database
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.operationId, operationId))
      .orderBy(asc(creditLedgerEntries.createdAt));
  }
}
