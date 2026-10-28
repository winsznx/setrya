CREATE TABLE "payout_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"payout_intent_id" uuid NOT NULL,
	"leaf_index" integer NOT NULL,
	"leaf_hash" text NOT NULL,
	"encrypted_leaf" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_commitments_payout_intent_id_unique" UNIQUE("payout_intent_id")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "payout_root" text;--> statement-breakpoint
ALTER TABLE "payout_intents" ADD COLUMN "memo_text" text;--> statement-breakpoint
ALTER TABLE "payout_commitments" ADD CONSTRAINT "payout_commitments_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_commitments" ADD CONSTRAINT "payout_commitments_payout_intent_id_payout_intents_id_fk" FOREIGN KEY ("payout_intent_id") REFERENCES "public"."payout_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payout_commitments_approval_leaf" ON "payout_commitments" USING btree ("approval_id","leaf_index");