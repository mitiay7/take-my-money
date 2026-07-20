import { ConfirmSchema } from "@take-my-money/shared-contracts";
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
    const body = ConfirmSchema.parse(await request.json());
    const result = await new RebaseService(getDatabase()).confirm({
      demoSessionId: session.id,
      operationPublicId: operationId,
      quotePublicId: body.quotePublicId,
      consents: body.consents,
      idempotencyKey: request.headers.get("idempotency-key") ?? "",
      requestId,
    });
    return jsonOk({ ...result.body, replayed: result.replayed }, result.httpStatus);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
