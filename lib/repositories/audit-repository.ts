import { asc, eq, max } from "drizzle-orm";
import { auditEvents, type AuditEventRow } from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";

export class AuditRepository {
  constructor(private readonly database: AppDatabase) {}

  async append(
    values: Omit<typeof auditEvents.$inferInsert, "sequenceNumber">,
  ): Promise<AuditEventRow> {
    const [last] = values.operationId
      ? await this.database
          .select({ value: max(auditEvents.sequenceNumber) })
          .from(auditEvents)
          .where(eq(auditEvents.operationId, values.operationId))
      : [{ value: 0 }];
    const sequenceNumber = (last?.value ?? 0) + 1;
    const [event] = await this.database
      .insert(auditEvents)
      .values({ ...values, sequenceNumber })
      .returning();
    if (!event) throw new Error("Failed to append audit event");
    return event;
  }

  async list(operationId: string): Promise<AuditEventRow[]> {
    return this.database
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.operationId, operationId))
      .orderBy(asc(auditEvents.sequenceNumber));
  }
}
