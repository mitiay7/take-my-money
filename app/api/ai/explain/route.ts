import { ExplainSchema } from "@take-my-money/shared-contracts";
import { aiInteractions } from "@/db/schema";
import { getOperationView } from "@/lib/application/operation-query";
import { requireSession, verifyCsrf } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, csrfError, jsonError, jsonOk } from "@/lib/http/responses";
import { fallbackExplanation } from "@/lib/openai/fallback";
import { sha256 } from "@/lib/security/hashing";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  try {
    const session = await requireSession();
    if (!verifyCsrf(request, session)) return csrfError(requestId);
    const body = ExplainSchema.parse(await request.json());
    const database = getDatabase();
    const view = await getOperationView(database, session.id, body.operationId);
    if (!view.source || !view.targetPlan || !view.quote) {
      return jsonOk(
        {
          error: {
            code: "QUOTE_NOT_FOUND",
            message: "Create a verified quote before requesting an explanation.",
            userMessage: "Create a quote first.",
            retryable: false,
            requestId,
            details: {},
          },
        },
        409,
      );
    }
    const dayMs = 86_400_000;
    const explanation = fallbackExplanation({
      sourcePlan: view.source.planName,
      targetPlan: view.targetPlan.displayName,
      remainingDays: Number(BigInt(view.quote.remainingDurationMs) / BigInt(dayMs)),
      totalDays: Number(BigInt(view.quote.periodDurationMs) / BigInt(dayMs)),
      creditDisplay: formatMoney(view.quote.migrationCreditMinor, view.quote.currency),
      amountDueDisplay: formatMoney(view.quote.amountDueMinor, view.quote.currency),
      autoRenew: view.source.autoRenew,
    });
    await database.insert(aiInteractions).values({
      demoSessionId: session.id,
      operationId: (await database.query.rebaseOperations.findFirst({
        where: (table, operators) => operators.eq(table.publicId, body.operationId),
      }))!.id,
      purpose: "MIGRATION_EXPLANATION",
      model: process.env.OPENAI_MODEL ?? "gpt-5.6",
      status: "FALLBACK",
      inputHash: sha256(`${body.operationId}:${view.quote.fingerprintPrefix}`),
      outputSchemaVersion: explanation.schemaVersion,
      latencyMs: Date.now() - startedAt,
      errorCode: "OPENAI_NOT_CONFIGURED",
    });
    return jsonOk({ explanation, model: "deterministic-fallback", live: false });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

function formatMoney(amountMinor: string, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    Number(amountMinor) / 100,
  );
}
