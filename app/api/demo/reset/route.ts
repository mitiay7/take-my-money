import { eq } from "drizzle-orm";
import { rebaseOperations, sourceSubscriptions } from "@/db/schema";
import { requireSession, verifyCsrf } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, csrfError, jsonError, jsonOk } from "@/lib/http/responses";
import { AuditRepository } from "@/lib/repositories/audit-repository";
import { SessionRepository } from "@/lib/repositories/session-repository";

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const session = await requireSession();
    if (!verifyCsrf(request, session)) return csrfError(requestId);
    const database = getDatabase();
    await database.transaction(async (transaction) => {
      await transaction
        .delete(rebaseOperations)
        .where(eq(rebaseOperations.demoSessionId, session.id));
      await transaction
        .delete(sourceSubscriptions)
        .where(eq(sourceSubscriptions.demoSessionId, session.id));
    });
    await new SessionRepository(database).incrementReset(session.id, session.resetCount + 1);
    await new AuditRepository(database).append({
      operationId: null,
      demoSessionId: session.id,
      eventType: "DEMO_RESET",
      actorType: "USER",
      requestId,
      metadata: { resetCount: session.resetCount + 1 },
    });
    return jsonOk({ reset: true });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
