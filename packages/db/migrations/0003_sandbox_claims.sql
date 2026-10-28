CREATE TABLE "sandbox_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_fingerprint" text NOT NULL,
	"client_key_hash" text NOT NULL,
	"state" text NOT NULL,
	"project_id" uuid,
	"period_id" uuid,
	"transaction_id" uuid,
	"statement_id" uuid,
	"share_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_claims_address_fingerprint_unique" UNIQUE("address_fingerprint")
);
