import { ExplainSchema } from "@take-my-money/shared-contracts";
import { ApplicationError } from "@/lib/application/errors";
import { getOperationView } from "@/lib/application/operation-query";
import { requireSession, verifyCsrf } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, csrfError, jsonError, jsonOk } from "@/lib/http/responses";
import { fallbackExplanation } from "@/lib/openai/fallback";
import type { ExplanationFacts } from "@/lib/openai/grounding";
import {
  configuredModel,
  explainMigrationLive,
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
    const body = ExplainSchema.parse(await request.json());
    const database = getDatabase();
    const operation = await new OperationRepository(database).findOwned(
      body.operationId,
      session.id,
    );
    if (!operation) throw new ApplicationError("OPERATION_NOT_FOUND", "Operation not found", 404);
    const view = await getOperationView(database, session.id, body.operationId);
    if (!view.source || !view.targetPlan || !view.quote) {
      throw new ApplicationError("QUOTE_NOT_FOUND", "Create a verified quote first", 409);
    }

    const facts = toExplanationFacts(view);
    const fallback = fallbackExplanation(facts);
    const inputHash = sha256(`${body.operationId}:${view.quote.fingerprintPrefix}`);
    const scenario = getScenario(operation.scenarioId);
    const interactions = new AiInteractionRepository(database);
    let explanation = fallback;
    let model = "deterministic-fallback";
    let live = false;
    let fallbackCode =
      scenario?.aiAvailable === false ? "SEEDED_AI_UNAVAILABLE" : "OPENAI_NOT_CONFIGURED";

    if (scenario?.aiAvailable !== false && liveAiEnabled()) {
      const interaction = await interactions.tryStart({
        demoSessionId: session.id,
        operationId: operation.id,
        purpose: "MIGRATION_EXPLANATION",
        model: configuredModel(),
        inputHash,
        outputSchemaVersion: fallback.schemaVersion,
        hourlyLimit: 20,
      });
      if (interaction) {
        try {
          const result = await explainMigrationLive({
            facts,
            safetyIdentifier: sha256(session.publicId).slice(0, 64),
          });
          explanation = result.value;
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
          purpose: "MIGRATION_EXPLANATION",
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
        purpose: "MIGRATION_EXPLANATION",
        model: configuredModel(),
        inputHash,
        outputSchemaVersion: fallback.schemaVersion,
        errorCode: fallbackCode,
      });
    }

    return jsonOk({ explanation, model, live, fallbackCode: live ? null : fallbackCode });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

function toExplanationFacts(view: Awaited<ReturnType<typeof getOperationView>>): ExplanationFacts {
  if (!view.source || !view.targetPlan || !view.quote) {
    throw new ApplicationError("QUOTE_NOT_FOUND", "Create a verified quote first", 409);
  }
  const dayMs = 86_400_000n;
  return {
    sourcePlan: view.source.planName,
    targetPlan: view.targetPlan.displayName,
    remainingDays: Number(BigInt(view.quote.remainingDurationMs) / dayMs),
    totalDays: Number(BigInt(view.quote.periodDurationMs) / dayMs),
    creditDisplay: formatMoney(view.quote.migrationCreditMinor, view.quote.currency),
    targetPriceDisplay: formatMoney(view.quote.targetPriceMinor, view.quote.currency),
    amountDueDisplay: formatMoney(view.quote.amountDueMinor, view.quote.currency),
    autoRenew: view.source.autoRenew,
    policy: `${view.quote.policyId}@${view.quote.policyVersion}`,
    roundingMode: view.quote.roundingMode,
    sandbox: true,
  };
}

function formatMoney(amountMinor: string, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    Number(amountMinor) / 100,
  );
}
