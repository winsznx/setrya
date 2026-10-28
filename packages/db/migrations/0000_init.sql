CREATE TABLE "adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"origin_period_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"calculation_row_id" uuid,
	"kind" text NOT NULL,
	"amount_decimal" text NOT NULL,
	"currency" text NOT NULL,
	"reason_enc" text NOT NULL,
	"applied_period_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"terms_enc" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"reason_enc" text,
	"created_by" uuid NOT NULL,
	"activated_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"source_ids" jsonb NOT NULL,
	"title_enc" text NOT NULL,
	"external_ref_enc" text,
	"current_version" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"ended_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"snapshot_hash" text NOT NULL,
	"snapshot_enc" text NOT NULL,
	"recipients_digest" text NOT NULL,
	"approved_by" uuid NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"network" text NOT NULL,
	"account_id" text NOT NULL,
	"total_zat" bigint NOT NULL,
	"invalidated_at" timestamp with time zone,
	"invalidation_reason" text
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"actor" text NOT NULL,
	"event_type" text NOT NULL,
	"object_type" text,
	"object_id" text,
	"diff_enc" text,
	"reason_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"state" text NOT NULL,
	"lease_until" timestamp with time zone,
	"attempt_counter" integer DEFAULT 0 NOT NULL,
	"last_error_redacted" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "background_jobs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "calculation_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"row_key" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"agreement_version_id" uuid NOT NULL,
	"source_ids_hash" text NOT NULL,
	"source_entry_ids" jsonb NOT NULL,
	"formula_enc" text NOT NULL,
	"owed_decimal" text NOT NULL,
	"currency" text NOT NULL,
	"amount_zat" bigint,
	"residual_zat" text,
	"rate_snapshot_id" uuid,
	"status" text NOT NULL,
	"holds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chain_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"lineage" integer DEFAULT 1 NOT NULL,
	"txid" text,
	"network" text NOT NULL,
	"state" text NOT NULL,
	"pczt_enc" text,
	"pczt_hash" text,
	"inspection_enc" text,
	"signed_hex_enc" text,
	"fee_zat" bigint,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"diagnosis" text,
	"broadcast_at" timestamp with time zone,
	"mined_at" timestamp with time zone,
	"height" integer,
	"blockhash" text,
	"confirmations" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"wallet_observed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rate_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"numerator" text NOT NULL,
	"denominator" text NOT NULL,
	"entered_as" text NOT NULL,
	"source_enc" text NOT NULL,
	"quoted_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"intended_conversion_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"file_hash" text NOT NULL,
	"filename_enc" text NOT NULL,
	"mapping_enc" text NOT NULL,
	"status" text NOT NULL,
	"row_count" integer NOT NULL,
	"eligible_count" integer NOT NULL,
	"held_count" integer NOT NULL,
	"excluded_count" integer NOT NULL,
	"duplicate_count" integer NOT NULL,
	"duplicate_policy" text NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_normalized" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"auth_version" integer DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"network" text NOT NULL,
	"address_enc" text NOT NULL,
	"fingerprint" text NOT NULL,
	"assessment" jsonb NOT NULL,
	"owner_confirmed_at" timestamp with time zone,
	"change_reason_enc" text,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"display_name_enc" text NOT NULL,
	"short_ref_enc" text,
	"contact_enc" text,
	"notes_enc" text,
	"category" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"latest_address_version" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"chain_transaction_id" uuid,
	"stage" text NOT NULL,
	"outcome" text NOT NULL,
	"request_id" text NOT NULL,
	"detail" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"of" integer NOT NULL,
	"network" text NOT NULL,
	"payer_account_id" text NOT NULL,
	"status" text NOT NULL,
	"total_zat" bigint NOT NULL,
	"fee_zat" bigint,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_batches_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payment_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_transaction_id" uuid NOT NULL,
	"payout_intent_id" uuid NOT NULL,
	"output_ref" text NOT NULL,
	"amount_zat" bigint NOT NULL,
	"recipient_commitment" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"calculation_row_id" uuid NOT NULL,
	"address_version_id" uuid NOT NULL,
	"address_fingerprint" text NOT NULL,
	"amount_zat" bigint NOT NULL,
	"memo_ref" text NOT NULL,
	"state" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"chain_transaction_id" uuid,
	"disposition" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_intents_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "period_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"kind" text NOT NULL,
	"target_key" text NOT NULL,
	"reason_enc" text NOT NULL,
	"decided_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"key" text NOT NULL,
	"code" text NOT NULL,
	"severity" text NOT NULL,
	"affected_entry_ids" jsonb NOT NULL,
	"affected_row_keys" jsonb NOT NULL,
	"partner_id" uuid,
	"money_at_risk_enc" text,
	"detail" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"decision" text,
	"before_after_enc" text,
	"reason_enc" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_sources" (
	"period_id" uuid NOT NULL,
	"revenue_entry_id" uuid NOT NULL,
	"inclusion" text NOT NULL,
	"reason_enc" text,
	"decided_at" timestamp with time zone,
	CONSTRAINT "period_sources_period_id_revenue_entry_id_pk" PRIMARY KEY("period_id","revenue_entry_id")
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label_enc" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"source_ids" jsonb NOT NULL,
	"rate_snapshot_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"totals_json" jsonb,
	"frozen_snapshot_enc" text,
	"frozen_snapshot_hash" text,
	"frozen_at" timestamp with time zone,
	"approved_snapshot_id" uuid,
	"calculated_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"close_record_enc" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name_enc" text NOT NULL,
	"org_name_enc" text NOT NULL,
	"issuer_label_enc" text NOT NULL,
	"description_enc" text,
	"contact_enc" text,
	"logo_enc" text,
	"currency" text NOT NULL,
	"timezone" text NOT NULL,
	"cadence" text DEFAULT 'monthly' NOT NULL,
	"min_confirmations" integer DEFAULT 1 NOT NULL,
	"target_confirmations" integer DEFAULT 3 NOT NULL,
	"rate_expiry_hours" integer DEFAULT 72 NOT NULL,
	"step_up_window_seconds" integer DEFAULT 300 NOT NULL,
	"max_recipients_per_batch" integer DEFAULT 10 NOT NULL,
	"min_payout_zat" bigint DEFAULT 10000 NOT NULL,
	"share_expiry_days" integer DEFAULT 14 NOT NULL,
	"reveal_timeout_seconds" integer DEFAULT 30 NOT NULL,
	"default_classification" text DEFAULT 'realised_fee' NOT NULL,
	"onboarding_step" text DEFAULT 'workspace' NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipient_acknowledgments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_share_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"evidence_type" text NOT NULL,
	"encrypted_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"batch_id" uuid,
	"source_id" uuid NOT NULL,
	"external_id_hash" text,
	"raw_fields_enc" text NOT NULL,
	"description_enc" text,
	"reference_enc" text,
	"amount_decimal" text NOT NULL,
	"amount_raw" text NOT NULL,
	"currency" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"entry_type" text NOT NULL,
	"classification" text NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note_enc" text,
	"row_hash" text NOT NULL,
	"row_index" integer,
	"origin" text DEFAULT 'csv' NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"hashed_token" text NOT NULL,
	"auth_version" integer NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_hashed_token_unique" UNIQUE("hashed_token")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name_enc" text NOT NULL,
	"platform_enc" text,
	"note_enc" text,
	"reference_url_enc" text,
	"default_currency" text NOT NULL,
	"fee_type" text NOT NULL,
	"timezone" text NOT NULL,
	"kind" text DEFAULT 'csv' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_id" uuid NOT NULL,
	"share_id" text NOT NULL,
	"ciphertext" text,
	"document_version" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statement_shares_share_id_unique" UNIQUE("share_id")
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"payout_intent_id" uuid,
	"reference" text NOT NULL,
	"document_version" integer DEFAULT 1 NOT NULL,
	"snapshot_enc" text NOT NULL,
	"evidence_level" text NOT NULL,
	"downloaded_at" timestamp with time zone,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statements_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "step_up_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"hashed_token" text NOT NULL,
	"action" text NOT NULL,
	"scope_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "step_up_tokens_hashed_token_unique" UNIQUE("hashed_token")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"vault_salt" text,
	"vault_wrapped_dek" text,
	"vault_version" integer,
	"setup_token_hash" text,
	"auto_lock_minutes" integer DEFAULT 15 NOT NULL,
	"network" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_observations" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"health_json" jsonb,
	"observed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_origin_period_id_periods_id_fk" FOREIGN KEY ("origin_period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_created_by_owners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approved_by_owners_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_rows" ADD CONSTRAINT "calculation_rows_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_rows" ADD CONSTRAINT "calculation_rows_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_rows" ADD CONSTRAINT "calculation_rows_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_rows" ADD CONSTRAINT "calculation_rows_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chain_transactions" ADD CONSTRAINT "chain_transactions_batch_id_payment_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payment_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_rate_snapshots" ADD CONSTRAINT "fx_rate_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_rate_snapshots" ADD CONSTRAINT "fx_rate_snapshots_approved_by_owners_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_addresses" ADD CONSTRAINT "partner_addresses_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_batch_id_payment_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payment_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_outputs" ADD CONSTRAINT "payment_outputs_chain_transaction_id_chain_transactions_id_fk" FOREIGN KEY ("chain_transaction_id") REFERENCES "public"."chain_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_outputs" ADD CONSTRAINT "payment_outputs_payout_intent_id_payout_intents_id_fk" FOREIGN KEY ("payout_intent_id") REFERENCES "public"."payout_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_intents" ADD CONSTRAINT "payout_intents_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_intents" ADD CONSTRAINT "payout_intents_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_intents" ADD CONSTRAINT "payout_intents_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_intents" ADD CONSTRAINT "payout_intents_calculation_row_id_calculation_rows_id_fk" FOREIGN KEY ("calculation_row_id") REFERENCES "public"."calculation_rows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_intents" ADD CONSTRAINT "payout_intents_address_version_id_partner_addresses_id_fk" FOREIGN KEY ("address_version_id") REFERENCES "public"."partner_addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_decisions" ADD CONSTRAINT "period_decisions_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_exceptions" ADD CONSTRAINT "period_exceptions_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_sources" ADD CONSTRAINT "period_sources_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_sources" ADD CONSTRAINT "period_sources_revenue_entry_id_revenue_entries_id_fk" FOREIGN KEY ("revenue_entry_id") REFERENCES "public"."revenue_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periods" ADD CONSTRAINT "periods_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_acknowledgments" ADD CONSTRAINT "recipient_acknowledgments_statement_share_id_statement_shares_id_fk" FOREIGN KEY ("statement_share_id") REFERENCES "public"."statement_shares"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_shares" ADD CONSTRAINT "statement_shares_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_payout_intent_id_payout_intents_id_fk" FOREIGN KEY ("payout_intent_id") REFERENCES "public"."payout_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_up_tokens" ADD CONSTRAINT "step_up_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_versions_number" ON "agreement_versions" USING btree ("agreement_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_period_revision" ON "approvals" USING btree ("period_id","revision");--> statement-breakpoint
CREATE INDEX "audit_events_project_time" ON "audit_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calculation_rows_key" ON "calculation_rows" USING btree ("period_id","revision","row_key");--> statement-breakpoint
CREATE UNIQUE INDEX "chain_transactions_txid" ON "chain_transactions" USING btree ("network","txid");--> statement-breakpoint
CREATE UNIQUE INDEX "chain_transactions_lineage" ON "chain_transactions" USING btree ("batch_id","lineage");--> statement-breakpoint
CREATE UNIQUE INDEX "import_batches_fingerprint" ON "import_batches" USING btree ("project_id","source_id","file_hash");--> statement-breakpoint
CREATE INDEX "login_attempts_bucket" ON "login_attempts" USING btree ("bucket","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "owners_singleton" ON "owners" USING btree ("singleton");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_addresses_version" ON "partner_addresses" USING btree ("partner_id","version");--> statement-breakpoint
CREATE INDEX "payment_attempts_batch" ON "payment_attempts" USING btree ("batch_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_batches_sequence" ON "payment_batches" USING btree ("approval_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_outputs_intent" ON "payment_outputs" USING btree ("chain_transaction_id","payout_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "period_decisions_target" ON "period_decisions" USING btree ("period_id","revision","kind","target_key");--> statement-breakpoint
CREATE UNIQUE INDEX "period_exceptions_key" ON "period_exceptions" USING btree ("period_id","revision","key");--> statement-breakpoint
CREATE UNIQUE INDEX "recipient_ack_share" ON "recipient_acknowledgments" USING btree ("statement_share_id");--> statement-breakpoint
CREATE INDEX "revenue_entries_project_time" ON "revenue_entries" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "revenue_entries_external" ON "revenue_entries" USING btree ("source_id","external_id_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "statements_period_partner" ON "statements" USING btree ("period_id","partner_id");