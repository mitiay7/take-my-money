import { getOperationView } from "@/lib/application/operation-query";
import { requireSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, jsonError, jsonOk } from "@/lib/http/responses";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ operationId: string }> },
) {
  const requestId = createRequestId();
  try {
    const session = await requireSession();
    const { operationId } = await context.params;
    return jsonOk(await getOperationView(getDatabase(), session.id, operationId));
  } catch (error) {
    return jsonError(error, requestId);
  }
}
