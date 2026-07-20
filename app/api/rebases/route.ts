import { CreateOperationSchema } from "@take-my-money/shared-contracts";
import { RebaseService } from "@/lib/application/rebase-service";
import { requireSession, verifyCsrf } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, csrfError, jsonError, jsonOk } from "@/lib/http/responses";

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const session = await requireSession();
    if (!verifyCsrf(request, session)) return csrfError(requestId);
    const body = CreateOperationSchema.parse(await request.json());
    const operation = await new RebaseService(getDatabase()).createOperation({
      demoSessionId: session.id,
      scenarioId: body.scenarioId,
      requestId,
    });
    return jsonOk({ operation: { publicId: operation.publicId, status: operation.status } }, 201);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
