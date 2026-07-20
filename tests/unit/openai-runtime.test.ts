import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { MigrationExplanation, ReceiptExtraction } from "@/lib/openai/contracts";
import { type ExplanationFacts } from "@/lib/openai/grounding";
import { explainMigrationLive, extractReceiptLive, LiveAiError } from "@/lib/openai/runtime";
import { getScenario } from "@/lib/scenarios/fixtures";

function mockClient(outputParsed: unknown) {
  const parse = vi.fn().mockResolvedValue({
    output_parsed: outputParsed,
    model: "gpt-5.6-2026-07-01",
    usage: {
      input_tokens: 400,
      output_tokens: 120,
      output_tokens_details: { reasoning_tokens: 40 },
    },
  });
  return { client: { responses: { parse } } as unknown as OpenAI, parse };
}

const extraction: ReceiptExtraction = {
  schemaVersion: "1.0",
  documentType: "SUBSCRIPTION_RECEIPT",
  providerGuess: "APPLE_APP_STORE",
  productName: "Plus — mobile billed demo",
  amountText: "€24.99",
  currencyCode: "EUR",
  purchaseDateText: "7 July 2026",
  expiryOrRenewalDateText: "7 August 2026",
  syntheticLookupReference: "TMM-ACTIVE-001",
  confidence: "HIGH",
  warnings: [],
};

const facts: ExplanationFacts = {
  sourcePlan: "Plus — mobile billed demo",
  targetPlan: "Direct Pro",
  remainingDays: 19,
  totalDays: 31,
  creditDisplay: "€15.32",
  targetPriceDisplay: "€229.00",
  amountDueDisplay: "€213.68",
  autoRenew: true,
  policy: "demo-gross-portability@1.0.0",
  roundingMode: "HALF_UP",
  sandbox: true,
};

const explanation: MigrationExplanation = {
  schemaVersion: "1.0",
  headline: "Keep the value of 19 paid days.",
  summary: "There are 19 of 31 days left in this simulated migration.",
  calculationExplanation: "The credit is €15.32 and the simulated due is €213.68.",
  nextSteps: ["Review the quote.", "Confirm the sandbox consent."],
  riskExplanation: "Source auto-renewal still needs attention.",
  tone: "CLEAR_AND_REASSURING",
};

describe("OpenAI Responses runtime", () => {
  it("sends a trusted local image with structured output and a safety identifier", async () => {
    const scenario = getScenario("active-normal")!;
    const { client, parse } = mockClient(extraction);
    const result = await extractReceiptLive(
      { scenario, safetyIdentifier: "hashed-demo-session" },
      client,
    );

    expect(result.value).toEqual(extraction);
    expect(result.usage).toEqual({ inputTokens: 400, outputTokens: 120, reasoningTokens: 40 });
    const request = parse.mock.calls[0]![0];
    expect(request.model).toBe("gpt-5.6");
    expect(request.store).toBe(false);
    expect(request.safety_identifier).toBe("hashed-demo-session");
    expect(request.text.format.type).toBe("json_schema");
    expect(request.input[0].content[1].image_url).toMatch(/^data:image\/png;base64,/);
  });

  it("accepts a grounded structured explanation", async () => {
    const { client } = mockClient(explanation);
    const result = await explainMigrationLive(
      { facts, safetyIdentifier: "hashed-demo-session" },
      client,
    );
    expect(result.value).toEqual(explanation);
  });

  it("rejects model output that invents a financial value", async () => {
    const { client } = mockClient({
      ...explanation,
      calculationExplanation: "The credit is €99.00.",
    });
    await expect(
      explainMigrationLive({ facts, safetyIdentifier: "hashed-demo-session" }, client),
    ).rejects.toEqual(new LiveAiError("OPENAI_UNGROUNDED_OUTPUT"));
  });
});
