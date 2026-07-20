import { CreateQuoteSchema } from "@take-my-money/shared-contracts";
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
    const body = CreateQuoteSchema.parse(await request.json());
    const result = await new RebaseService(getDatabase()).createQuote({
      demoSessionId: session.id,
      operationPublicId: operationId,
      targetPlanId: body.targetPlanId,
      requestId,
    });
    return jsonOk({
      operation: { publicId: result.operation.publicId, status: result.operation.status },
      quote: {
        publicId: result.quote.publicId,
        currency: result.quote.currency,
        sourceValueMinor: result.quote.sourceValueMinor.toString(),
        migrationCreditMinor: result.quote.migrationCreditMinor.toString(),
        targetPriceMinor: result.quote.targetPriceMinor.toString(),
        creditAppliedMinor: result.quote.creditAppliedMinor.toString(),
        amountDueMinor: result.quote.amountDueMinor.toString(),
        carryForwardMinor: result.quote.carryForwardMinor.toString(),
        periodDurationMs: result.quote.periodDurationMs.toString(),
        remainingDurationMs: result.quote.remainingDurationMs.toString(),
        ratio: {
          numerator: result.quote.ratioNumerator.toString(),
          denominator: result.quote.ratioDenominator.toString(),
        },
        policy: { id: result.quote.policyId, version: result.quote.policyVersion },
        roundingMode: result.quote.roundingMode,
        expiresAt: new Date(result.quote.expiresAt).toISOString(),
        fingerprintPrefix: result.quote.quoteFingerprint.slice(0, 8),
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
