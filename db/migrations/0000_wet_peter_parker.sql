CREATE TABLE "ai_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demo_session_id" uuid NOT NULL,
	"operation_id" uuid,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"input_hash" text NOT NULL,
	"output_schema_version" text NOT NULL,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"reasoning_tokens" integer,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid,
	"demo_session_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"event_type" text NOT NULL,
	"previous_state" text,
	"next_state" text,
	"actor_type" text NOT NULL,
	"request_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"demo_session_id" uuid NOT NULL,
	"entry_type" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"related_entry_id" uuid,
	"external_reference" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reset_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demo_session_id" uuid NOT NULL,
	"endpoint_scope" text NOT NULL,
	"idempotency_key_hash" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text NOT NULL,
	"http_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebase_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"demo_session_id" uuid NOT NULL,
	"scenario_id" text NOT NULL,
	"source_subscription_id" uuid,
	"target_plan_id" text,
	"status" text NOT NULL,
	"eligibility_status" text,
	"eligibility_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"evaluation_time" timestamp with time zone NOT NULL,
	"source_fingerprint" text,
	"external_target_id" text,
	"external_target_idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rebase_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"algorithm_version" text NOT NULL,
	"policy_id" text NOT NULL,
	"policy_version" text NOT NULL,
	"currency" char(3) NOT NULL,
	"source_value_minor" bigint NOT NULL,
	"period_duration_ms" bigint NOT NULL,
	"remaining_duration_ms" bigint NOT NULL,
	"ratio_numerator" bigint NOT NULL,
	"ratio_denominator" bigint NOT NULL,
	"migration_credit_minor" bigint NOT NULL,
	"target_price_minor" bigint NOT NULL,
	"credit_applied_minor" bigint NOT NULL,
	"amount_due_minor" bigint NOT NULL,
	"carry_forward_minor" bigint NOT NULL,
	"rounding_mode" text NOT NULL,
	"calculation_snapshot" jsonb NOT NULL,
	"quote_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rebase_quotes_amounts_non_negative" CHECK (
      "rebase_quotes"."source_value_minor" >= 0 and
      "rebase_quotes"."period_duration_ms" > 0 and
      "rebase_quotes"."remaining_duration_ms" >= 0 and
      "rebase_quotes"."migration_credit_minor" >= 0 and
      "rebase_quotes"."target_price_minor" >= 0 and
      "rebase_quotes"."credit_applied_minor" >= 0 and
      "rebase_quotes"."amount_due_minor" >= 0 and
      "rebase_quotes"."carry_forward_minor" >= 0
    )
);
--> statement-breakpoint
CREATE TABLE "sandbox_target_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_idempotency_key" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"external_subscription_id" text,
	"external_invoice_id" text,
	"started_at" timestamp with time zone,
	"renews_at" timestamp with time zone,
	"lookup_outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demo_session_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_subscription_id_redacted" text NOT NULL,
	"original_transaction_fingerprint" text NOT NULL,
	"original_transaction_suffix" text NOT NULL,
	"product_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"status" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"amount_paid_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"auto_renew" boolean NOT NULL,
	"environment" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"verification_snapshot" jsonb NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_operation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_subscriptions_amount_non_negative" CHECK ("source_subscriptions"."amount_paid_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "target_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"price_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"billing_interval" text NOT NULL,
	"active" boolean NOT NULL,
	"sort_order" integer NOT NULL,
	"metadata" jsonb NOT NULL,
	CONSTRAINT "target_plans_price_non_negative" CHECK ("target_plans"."price_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_demo_session_id_demo_sessions_id_fk" FOREIGN KEY ("demo_session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_operation_id_rebase_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."rebase_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_operation_id_rebase_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."rebase_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_demo_session_id_demo_sessions_id_fk" FOREIGN KEY ("demo_session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_operation_id_rebase_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."rebase_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_demo_session_id_demo_sessions_id_fk" FOREIGN KEY ("demo_session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_demo_session_id_demo_sessions_id_fk" FOREIGN KEY ("demo_session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebase_operations" ADD CONSTRAINT "rebase_operations_demo_session_id_demo_sessions_id_fk" FOREIGN KEY ("demo_session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebase_operations" ADD CONSTRAINT "rebase_operations_source_subscription_id_source_subscriptions_id_fk" FOREIGN KEY ("source_subscription_id") REFERENCES "public"."source_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebase_operations" ADD CONSTRAINT "rebase_operations_target_plan_id_target_plans_id_fk" FOREIGN KEY ("target_plan_id") REFERENCES "public"."target_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebase_quotes" ADD CONSTRAINT "rebase_quotes_operation_id_rebase_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."rebase_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_target_results" ADD CONSTRAINT "sandbox_target_results_operation_id_rebase_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."rebase_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_subscriptions" ADD CONSTRAINT "source_subscriptions_demo_session_id_demo_sessions_id_fk" FOREIGN KEY ("demo_session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_interactions_session_purpose_idx" ON "ai_interactions" USING btree ("demo_session_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_operation_sequence_unique" ON "audit_events" USING btree ("operation_id","sequence_number");--> statement-breakpoint
CREATE INDEX "audit_events_session_idx" ON "audit_events" USING btree ("demo_session_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_operation_idx" ON "credit_ledger_entries" USING btree ("operation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_entries_operation_type_unique" ON "credit_ledger_entries" USING btree ("operation_id","entry_type");--> statement-breakpoint
CREATE UNIQUE INDEX "demo_sessions_public_id_unique" ON "demo_sessions" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_scope_key_unique" ON "idempotency_records" USING btree ("demo_session_id","endpoint_scope","idempotency_key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "rebase_operations_public_id_unique" ON "rebase_operations" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "rebase_operations_session_idx" ON "rebase_operations" USING btree ("demo_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rebase_operations_consumed_source_unique" ON "rebase_operations" USING btree ("source_fingerprint") WHERE "rebase_operations"."source_fingerprint" is not null and "rebase_operations"."status" in ('SOURCE_CONSUMED', 'CREDIT_COMMITTED', 'COMPLETED');--> statement-breakpoint
CREATE UNIQUE INDEX "rebase_quotes_public_id_unique" ON "rebase_quotes" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rebase_quotes_operation_unique" ON "rebase_quotes" USING btree ("operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rebase_quotes_fingerprint_unique" ON "rebase_quotes" USING btree ("quote_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "sandbox_target_results_idempotency_unique" ON "sandbox_target_results" USING btree ("external_idempotency_key");--> statement-breakpoint
CREATE INDEX "source_subscriptions_session_idx" ON "source_subscriptions" USING btree ("demo_session_id");--> statement-breakpoint
CREATE INDEX "source_subscriptions_fingerprint_idx" ON "source_subscriptions" USING btree ("original_transaction_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "source_subscriptions_session_fingerprint_unique" ON "source_subscriptions" USING btree ("demo_session_id","original_transaction_fingerprint");