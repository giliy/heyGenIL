CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'minting' NOT NULL,
	"source_image_key" text,
	"ref_image_key" text,
	"ref_image_url" text,
	"spec_json" jsonb,
	"mint_job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_mint_job_id_jobs_id_fk" FOREIGN KEY ("mint_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;