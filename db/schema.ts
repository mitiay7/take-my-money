import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestampUtc = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const money = (name: string) => bigint(name, { mode: "bigint" });

export const demoSessions = pgTable(
  "demo_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicId: text("public_id").notNull(),
    createdAt: timestampUtc("created_at").defaultNow().notNull(),
    expiresAt: timestampUtc("expires_at").notNull(),
    lastSeenAt: timestampUtc("last_seen_at").defaultNow().notNull(),
    resetCount: integer("reset_count").default(0).notNull(),
  },
  (table) => [uniqueIndex("demo_sessions_public_id_unique").on(table.publicId)],
);

export const sourceSubscriptions = pgTable(
  "source_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    demoSessionId: uuid("demo_session_id")
      .notNull()
      .references(() => demoSessions.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalSubscriptionIdRedacted: text("external_subscription_id_redacted").notNull(),
    originalTransactionFingerprint: text("original_transaction_fingerprint").notNull(),
    originalTransactionSuffix: text("original_transaction_suffix").notNull(),
    productId: text("product_id").notNull(),
    planName: text("plan_name").notNull(),
    status: text("status").notNull(),
    periodStart: timestampUtc("period_start").notNull(),
    periodEnd: timestampUtc("period_end").notNull(),
    amountPaidMinor: money("amount_paid_minor").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    autoRenew: boolean("auto_renew").notNull(),
    environment: text("environment").notNull(),
    verifiedAt: timestampUtc("verified_at").notNull(),
    verificationSnapshot: jsonb("verification_snapshot").$type<Record<string, unknown>>().notNull(),
    consumedAt: timestampUtc("consumed_at"),
    consumedByOperationId: uuid("consumed_by_operation_id"),
    createdAt: timestampUtc("created_at").defaultNow().notNull(),
    updatedAt: timestampUtc("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("source_subscriptions_session_idx").on(table.demoSessionId),
    index("source_subscriptions_fingerprint_idx").on(table.originalTransactionFingerprint),
    uniqueIndex("source_subscriptions_session_fingerprint_unique").on(
      table.demoSessionId,
      table.originalTransactionFingerprint,
    ),
    check("source_subscriptions_amount_non_negative", sql`${table.amountPaidMinor} >= 0`),
  ],
);

export const targetPlans = pgTable(
  "target_plans",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    priceMinor: money("price_minor").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    billingInterval: text("billing_interval").notNull(),
    active: boolean("active").notNull(),
    sortOrder: integer("sort_order").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [check("target_plans_price_non_negative", sql`${table.priceMinor} >= 0`)],
);

export const rebaseOperations = pgTable(
  "rebase_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicId: text("public_id").notNull(),
    demoSessionId: uuid("demo_session_id")
      .notNull()
      .references(() => demoSessions.id, { onDelete: "cascade" }),
    scenarioId: text("scenario_id").notNull(),
    sourceSubscriptionId: uuid("source_subscription_id").references(() => sourceSubscriptions.id),
    targetPlanId: text("target_plan_id").references(() => targetPlans.id),
    status: text("status").notNull(),
    eligibilityStatus: text("eligibility_status"),
    eligibilityReasons: jsonb("eligibility_reasons").$type<string[]>().default([]).notNull(),
    riskFlags: jsonb("risk_flags").$type<string[]>().default([]).notNull(),
    stateVersion: integer("state_version").default(0).notNull(),
    evaluationTime: timestampUtc("evaluation_time").notNull(),
    sourceFingerprint: text("source_fingerprint"),
    externalTargetId: text("external_target_id"),
    externalTargetIdempotencyKey: text("external_target_idempotency_key"),
    createdAt: timestampUtc("created_at").defaultNow().notNull(),
    updatedAt: timestampUtc("updated_at").defaultNow().notNull(),
    completedAt: timestampUtc("completed_at"),
  },
  (table) => [
    uniqueIndex("rebase_operations_public_id_unique").on(table.publicId),
    index("rebase_operations_session_idx").on(table.demoSessionId),
    uniqueIndex("rebase_operations_consumed_source_unique")
      .on(table.sourceFingerprint)
      .where(
        sql`${table.sourceFingerprint} is not null and ${table.status} in ('SOURCE_CONSUMED', 'CREDIT_COMMITTED', 'COMPLETED')`,
      ),
  ],
);

export const rebaseQuotes = pgTable(
  "rebase_quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicId: text("public_id").notNull(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => rebaseOperations.id, { onDelete: "cascade" }),
    algorithmVersion: text("algorithm_version").notNull(),
    policyId: text("policy_id").notNull(),
    policyVersion: text("policy_version").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    sourceValueMinor: money("source_value_minor").notNull(),
    periodDurationMs: bigint("period_duration_ms", { mode: "bigint" }).notNull(),
    remainingDurationMs: bigint("remaining_duration_ms", { mode: "bigint" }).notNull(),
    ratioNumerator: bigint("ratio_numerator", { mode: "bigint" }).notNull(),
    ratioDenominator: bigint("ratio_denominator", { mode: "bigint" }).notNull(),
    migrationCreditMinor: money("migration_credit_minor").notNull(),
    targetPriceMinor: money("target_price_minor").notNull(),
    creditAppliedMinor: money("credit_applied_minor").notNull(),
    amountDueMinor: money("amount_due_minor").notNull(),
    carryForwardMinor: money("carry_forward_minor").notNull(),
    roundingMode: text("rounding_mode").notNull(),
    calculationSnapshot: jsonb("calculation_snapshot").$type<Record<string, unknown>>().notNull(),
    quoteFingerprint: text("quote_fingerprint").notNull(),
    createdAt: timestampUtc("created_at").defaultNow().notNull(),
    expiresAt: timestampUtc("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("rebase_quotes_public_id_unique").on(table.publicId),
    uniqueIndex("rebase_quotes_operation_unique").on(table.operationId),
    uniqueIndex("rebase_quotes_fingerprint_unique").on(table.quoteFingerprint),
    check(
      "rebase_quotes_amounts_non_negative",
      sql`
      ${table.sourceValueMinor} >= 0 and
      ${table.periodDurationMs} > 0 and
      ${table.remainingDurationMs} >= 0 and
      ${table.migrationCreditMinor} >= 0 and
      ${table.targetPriceMinor} >= 0 and
      ${table.creditAppliedMinor} >= 0 and
      ${table.amountDueMinor} >= 0 and
      ${table.carryForwardMinor} >= 0
    `,
    ),
  ],
);

export const creditLedgerEntries = pgTable(
  "credit_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => rebaseOperations.id, { onDelete: "cascade" }),
    demoSessionId: uuid("demo_session_id")
      .notNull()
      .references(() => demoSessions.id, { onDelete: "cascade" }),
    entryType: text("entry_type").notNull(),
    amountMinor: money("amount_minor").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    relatedEntryId: uuid("related_entry_id"),
    externalReference: text("external_reference"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestampUtc("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("credit_ledger_entries_operation_idx").on(table.operationId, table.createdAt),
    uniqueIndex("credit_ledger_entries_operation_type_unique").on(
      table.operationId,
      table.entryType,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operationId: uuid("operation_id").references(() => rebaseOperations.id, {
      onDelete: "cascade",
    }),
    demoSessionId: uuid("demo_session_id")
      .notNull()
      .references(() => demoSessions.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    eventType: text("event_type").notNull(),
    previousState: text("previous_state"),
    nextState: text("next_state"),
    actorType: text("actor_type").notNull(),
    requestId: text("request_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestampUtc("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("audit_events_operation_sequence_unique").on(
      table.operationId,
      table.sequenceNumber,
    ),
    index("audit_events_session_idx").on(table.demoSessionId, table.createdAt),
  ],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    demoSessionId: uuid("demo_session_id")
      .notNull()
      .references(() => demoSessions.id, { onDelete: "cascade" }),
    endpointScope: text("endpoint_scope").notNull(),
    idempotencyKeyHash: text("idempotency_key_hash").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull(),
    httpStatus: integer("http_status"),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    createdAt: timestampUtc("created_at").defaultNow().notNull(),
    updatedAt: timestampUtc("updated_at").defaultNow().notNull(),
    expiresAt: timestampUtc("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("idempotency_records_scope_key_unique").on(
      table.demoSessionId,
      table.endpointScope,
      table.idempotencyKeyHash,
    ),
  ],
);

export const aiInteractions = pgTable(
  "ai_interactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    demoSessionId: uuid("demo_session_id")
      .notNull()
      .references(() => demoSessions.id, { onDelete: "cascade" }),
    operationId: uuid("operation_id").references(() => rebaseOperations.id, {
      onDelete: "cascade",
    }),
    purpose: text("purpose").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull(),
    inputHash: text("input_hash").notNull(),
    outputSchemaVersion: text("output_schema_version").notNull(),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    errorCode: text("error_code"),
    createdAt: timestampUtc("created_at").defaultNow().notNull(),
  },
  (table) => [index("ai_interactions_session_purpose_idx").on(table.demoSessionId, table.purpose)],
);

export const sandboxTargetResults = pgTable(
  "sandbox_target_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalIdempotencyKey: text("external_idempotency_key").notNull(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => rebaseOperations.id, { onDelete: "cascade" }),
    outcome: text("outcome").notNull(),
    externalSubscriptionId: text("external_subscription_id"),
    externalInvoiceId: text("external_invoice_id"),
    startedAt: timestampUtc("started_at"),
    renewsAt: timestampUtc("renews_at"),
    lookupOutcome: text("lookup_outcome"),
    createdAt: timestampUtc("created_at").defaultNow().notNull(),
    updatedAt: timestampUtc("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sandbox_target_results_idempotency_unique").on(table.externalIdempotencyKey),
  ],
);

export type DemoSessionRow = typeof demoSessions.$inferSelect;
export type SourceSubscriptionRow = typeof sourceSubscriptions.$inferSelect;
export type TargetPlanRow = typeof targetPlans.$inferSelect;
export type RebaseOperationRow = typeof rebaseOperations.$inferSelect;
export type RebaseQuoteRow = typeof rebaseQuotes.$inferSelect;
export type LedgerEntryRow = typeof creditLedgerEntries.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type IdempotencyRecordRow = typeof idempotencyRecords.$inferSelect;
