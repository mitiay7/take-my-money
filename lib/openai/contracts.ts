import { z } from "zod";

export const ReceiptExtractionSchema = z.object({
  schemaVersion: z.literal("1.0"),
  documentType: z.enum(["SUBSCRIPTION_RECEIPT", "PURCHASE_CONFIRMATION", "UNKNOWN"]),
  providerGuess: z.enum(["APPLE_APP_STORE", "GOOGLE_PLAY", "DIRECT_WEB", "UNKNOWN"]),
  productName: z.string().nullable(),
  amountText: z.string().nullable(),
  currencyCode: z.string().length(3).nullable(),
  purchaseDateText: z.string().nullable(),
  expiryOrRenewalDateText: z.string().nullable(),
  syntheticLookupReference: z.string().nullable(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  warnings: z.array(z.string()).max(5),
});

export const MigrationExplanationSchema = z.object({
  schemaVersion: z.literal("1.0"),
  headline: z.string().min(1).max(90),
  summary: z.string().min(1).max(700),
  calculationExplanation: z.string().min(1).max(700),
  nextSteps: z.array(z.string().min(1).max(180)).min(2).max(5),
  riskExplanation: z.string().min(1).max(500),
  tone: z.literal("CLEAR_AND_REASSURING"),
});

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;
export type MigrationExplanation = z.infer<typeof MigrationExplanationSchema>;
