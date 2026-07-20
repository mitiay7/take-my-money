import { ExtractReceiptSchema } from "@take-my-money/shared-contracts";
import { ApplicationError } from "@/lib/application/errors";
import { RebaseService } from "@/lib/application/rebase-service";
import { requireSession, verifyCsrf } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, csrfError, jsonError, jsonOk } from "@/lib/http/responses";
import { fallbackReceiptExtraction } from "@/lib/openai/fallback";
import {
  configuredModel,
  extractReceiptLive,
  LiveAiError,
  liveAiEnabled,
} from "@/lib/openai/runtime";
import { AiInteractionRepository } from "@/lib/repositories/ai-interaction-repository";
import { OperationRepository } from "@/lib/repositories/operation-repository";
import { getScenario } from "@/lib/scenarios/fixtures";
import { sha256 } from "@/lib/security/hashing";

export const maxDuration = 30;

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  try {
    const session = await requireSession();
    if (!verifyCsrf(request, session)) return csrfError(requestId);
    const body = ExtractReceiptSchema.parse(await request.json());
    const scenario = getScenario(body.scenarioId);
    if (!scenario || scenario.receiptAssetId !== body.receiptAssetId) {
      throw new ApplicationError("SCENARIO_NOT_FOUND", "Synthetic receipt fixture not found", 404);
    }
    const database = getDatabase();
    const operation = await new OperationRepository(database).findOwned(
      body.operationId,
      session.id,
    );
    if (!operation) throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);
    if (operation.status !== "DRAFT" && operation.status !== "RECEIPT_EXTRACTED") {
      throw new ApplicationError(
        "OPERATION_NOT_CONFIRMABLE",
        "Receipt extraction is not available in the current state",
        409,
      );
    }

    const fallback = fallbackReceiptExtraction(scenario);
    const inputHash = sha256(`${scenario.receiptAssetId}:${session.publicId}`);
    const interactions = new AiInteractionRepository(database);
    let extraction = fallback;
    let model = "deterministic-fallback";
    let live = false;
    let fallbackCode = scenario.aiAvailable ? "OPENAI_NOT_CONFIGURED" : "SEEDED_AI_UNAVAILABLE";

    if (scenario.aiAvailable && liveAiEnabled()) {
      const interaction = await interactions.tryStart({
        demoSessionId: session.id,
        operationId: operation.id,
        purpose: "RECEIPT_EXTRACTION",
        model: configuredModel(),
        inputHash,
        outputSchemaVersion: fallback.schemaVersion,
        hourlyLimit: 10,
      });
      if (interaction) {
        try {
          const result = await extractReceiptLive({
            scenario,
            safetyIdentifier: sha256(session.publicId).slice(0, 64),
          });
          extraction = result.value;
          model = result.model;
          live = true;
          await interactions.finish(interaction.id, {
            status: "LIVE",
            latencyMs: Date.now() - startedAt,
            ...result.usage,
          });
        } catch (error) {
          fallbackCode = error instanceof LiveAiError ? error.code : "OPENAI_REQUEST_FAILED";
          await interactions.finish(interaction.id, {
            status: "FALLBACK",
            latencyMs: Date.now() - startedAt,
            errorCode: fallbackCode,
          });
        }
      } else {
        fallbackCode = "AI_RATE_LIMITED";
        await interactions.recordFallback({
          demoSessionId: session.id,
          operationId: operation.id,
          purpose: "RECEIPT_EXTRACTION",
          model: configuredModel(),
          inputHash,
          outputSchemaVersion: fallback.schemaVersion,
          errorCode: fallbackCode,
        });
      }
    } else {
      await interactions.recordFallback({
        demoSessionId: session.id,
        operationId: operation.id,
        purpose: "RECEIPT_EXTRACTION",
        model: configuredModel(),
        inputHash,
        outputSchemaVersion: fallback.schemaVersion,
        errorCode: fallbackCode,
      });
    }

    await new RebaseService(database).recordReceiptExtracted({
      demoSessionId: session.id,
      operationPublicId: body.operationId,
      requestId,
      extractionMode: live ? "LIVE" : "FALLBACK",
    });
    return jsonOk({
      extraction,
      verified: false,
      model,
      live,
      fallbackCode: live ? null : fallbackCode,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
