import { RebaseService } from "@/lib/application/rebase-service";
import { requireSession, verifyCsrf } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, csrfError, jsonError, jsonOk } from "@/lib/http/responses";

export async function POST(
  request: Request,
  context: { params: Promise<{ operationId: string }> },
) {
  const requestId = createRequestId();
  try {
    const session = await requireSession();
    if (!verifyCsrf(request, session)) return csrfError(requestId);
    const { operationId } = await context.params;
    const result = await new RebaseService(getDatabase()).reconcile({
      demoSessionId: session.id,
      operationPublicId: operationId,
      requestId,
    });
    return jsonOk(result.body, result.httpStatus);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
