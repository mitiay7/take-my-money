import { eq } from "drizzle-orm";
import { demoSessions, type DemoSessionRow } from "@/db/schema";
import type { AppDatabase } from "@/lib/db/client";
import { createPublicId } from "./ids";

export class SessionRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(now = new Date()): Promise<DemoSessionRow> {
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const [session] = await this.database
      .insert(demoSessions)
      .values({ publicId: createPublicId("dms"), expiresAt })
      .returning();
    if (!session) throw new Error("Failed to create demo session");
    return session;
  }

  async findByPublicId(publicId: string): Promise<DemoSessionRow | null> {
    const [session] = await this.database
      .select()
      .from(demoSessions)
      .where(eq(demoSessions.publicId, publicId))
      .limit(1);
    return session ?? null;
  }

  async touch(id: string): Promise<void> {
    await this.database
      .update(demoSessions)
      .set({ lastSeenAt: new Date().toISOString() })
      .where(eq(demoSessions.id, id));
  }

  async incrementReset(id: string, nextResetCount: number): Promise<void> {
    await this.database
      .update(demoSessions)
      .set({ resetCount: nextResetCount, lastSeenAt: new Date().toISOString() })
      .where(eq(demoSessions.id, id));
  }
}
