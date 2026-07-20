import { eq } from "drizzle-orm";
import { rebaseQuotes, type RebaseQuoteRow } from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";
import { createPublicId } from "./ids";

export class QuoteRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(
    values: Omit<typeof rebaseQuotes.$inferInsert, "publicId">,
  ): Promise<RebaseQuoteRow> {
    const [quote] = await this.database
      .insert(rebaseQuotes)
      .values({ ...values, publicId: createPublicId("qt") })
      .returning();
    if (!quote) throw new Error("Failed to create immutable quote");
    return quote;
  }

  async findByOperation(operationId: string): Promise<RebaseQuoteRow | null> {
    const [quote] = await this.database
      .select()
      .from(rebaseQuotes)
      .where(eq(rebaseQuotes.operationId, operationId))
      .limit(1);
    return quote ?? null;
  }
}
