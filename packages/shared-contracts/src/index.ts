import { z } from "zod";

export const ScenarioIdSchema = z.enum([
  "active-normal",
  "one-day-left",
  "expired",
  "refunded",
  "already-migrated",
  "billing-retry",
  "credit-exceeds-target",
  "ai-unavailable",
  "unknown-target-result",
]);

export const PublicOperationIdSchema = z.string().regex(/^op_[A-Za-z0-9_-]{16,}$/);
export const PublicQuoteIdSchema = z.string().regex(/^qt_[A-Za-z0-9_-]{16,}$/);

export const CreateOperationSchema = z.object({ scenarioId: ScenarioIdSchema }).strict();

export const VerifySourceSchema = z
  .object({
    operationId: PublicOperationIdSchema,
    lookupReference: z.string().regex(/^TMM-[A-Z-]+-\d{3}$/),
  })
  .strict();

export const CreateQuoteSchema = z.object({ targetPlanId: z.string().min(3).max(80) }).strict();

export const ConfirmSchema = z
  .object({
    quotePublicId: PublicQuoteIdSchema,
    consents: z
      .object({
        understandsSandbox: z.literal(true),
        understandsSourceCancellation: z.literal(true),
        authorizesSimulatedMigration: z.literal(true),
      })
      .strict(),
  })
  .strict();

export const ExtractReceiptSchema = z
  .object({
    operationId: PublicOperationIdSchema,
    scenarioId: ScenarioIdSchema,
    receiptAssetId: z.string().regex(/^receipt-[a-z-]+$/),
  })
  .strict();

export const ExplainSchema = z.object({ operationId: PublicOperationIdSchema }).strict();

export type ScenarioIdInput = z.infer<typeof ScenarioIdSchema>;
