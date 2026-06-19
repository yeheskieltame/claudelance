CREATE TABLE IF NOT EXISTS "reputation_bridge" (
	"review_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_id" bigint NOT NULL,
	"tx_hash" text,
	"attested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reputation_bridge_workspace_idx" ON "reputation_bridge" USING btree ("workspace_id");