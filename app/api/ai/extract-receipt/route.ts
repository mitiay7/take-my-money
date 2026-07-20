import { ExtractReceiptSchema } from "@take-my-money/shared-contracts";
import { aiInteractions } from "@/db/schema";
import { RebaseService } from "@/lib/application/rebase-service";
import { requireSession, verifyCsrf } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, csrfError, jsonError, jsonOk } from "@/lib/http/responses";
import { fallbackReceiptExtraction } from "@/lib/openai/fallback";
import { getScenario } from "@/lib/scenarios/fixtures";
import { sha256 } from "@/lib/security/hashing";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  try {
    const session = await requireSession();
    if (!verifyCsrf(request, session)) return csrfError(requestId);
    const body = ExtractReceiptSchema.parse(await request.json());
    const scenario = getScenario(body.scenarioId);
    if (!scenario || scenario.receiptAssetId !== body.receiptAssetId) {
      return jsonOk(
        {
          error: {
            code: "FIXTURE_NOT_FOUND",
            message: "Synthetic receipt fixture not found",
            userMessage: "Choose one of the built-in synthetic receipts.",
            retryable: false,
            requestId,
            details: {},
          },
        },
        404,
      );
    }
    const database = getDatabase();
    const operation = await new RebaseService(database).recordReceiptExtracted({
      demoSessionId: session.id,
      operationPublicId: body.operationId,
      requestId,
      extractionMode: "FALLBACK",
    });
    const extraction = fallbackReceiptExtraction(scenario);
    await database.insert(aiInteractions).values({
      demoSessionId: session.id,
      operationId: operation.id,
      purpose: "RECEIPT_EXTRACTION",
      model: process.env.OPENAI_MODEL ?? "gpt-5.6",
      status: "FALLBACK",
      inputHash: sha256(`${scenario.receiptAssetId}:${session.publicId}`),
      outputSchemaVersion: extraction.schemaVersion,
      latencyMs: Date.now() - startedAt,
      errorCode: scenario.aiAvailable ? "OPENAI_NOT_CONFIGURED" : "SEEDED_AI_UNAVAILABLE",
    });
    return jsonOk({ extraction, verified: false, model: "deterministic-fallback", live: false });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
