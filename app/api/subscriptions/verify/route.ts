import { VerifySourceSchema } from "@take-my-money/shared-contracts";
import { serializeBigInts } from "@take-my-money/billing-core";
import { RebaseService } from "@/lib/application/rebase-service";
import { requireSession, verifyCsrf } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, csrfError, jsonError, jsonOk } from "@/lib/http/responses";

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const session = await requireSession();
    if (!verifyCsrf(request, session)) return csrfError(requestId);
    const body = VerifySourceSchema.parse(await request.json());
    const result = await new RebaseService(getDatabase()).verifySource({
      demoSessionId: session.id,
      operationPublicId: body.operationId,
      lookupReference: body.lookupReference,
      requestId,
    });
    return jsonOk({
      operation: {
        publicId: result.operation.publicId,
        status: result.operation.status,
      },
      source: serializeBigInts({
        planName: result.source.planName,
        status: result.source.status,
        periodStartUtc: result.source.periodStartUtc,
        periodEndUtc: result.source.periodEndUtc,
        amountPaidMinor: result.source.amountPaidMinor,
        currency: result.source.currency,
        autoRenew: result.source.autoRenew,
        provider: result.source.provider,
      }),
      eligibility: result.decision,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
