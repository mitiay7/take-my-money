import { scenarios } from "@/lib/scenarios/fixtures";
import { jsonOk } from "@/lib/http/responses";

export const dynamic = "force-dynamic";

export function GET() {
  return jsonOk({
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      shortDescription: scenario.shortDescription,
      receiptAssetId: scenario.receiptAssetId,
      receiptImageUrl: `/receipts/${scenario.receiptAssetId}.png`,
      lookupReference: scenario.lookupReference,
      evaluationTimeUtc: scenario.evaluationTimeUtc,
      defaultTargetPlanId: scenario.defaultTargetPlanId,
    })),
  });
}
