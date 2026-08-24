CREATE TABLE "music_beats" (
	"id" text PRIMARY KEY NOT NULL,
	"bed_id" text NOT NULL,
	"bpm" real,
	"times" real[],
	"grid_ms" real,
	"source" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "render_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"revision" integer NOT NULL,
	"format" jsonb,
	"output_key" text,
	"poster_key" text,
	"duration_sec" real,
	"spec_json" jsonb,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "input_aspect" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "aspect_ratio" text DEFAULT '9:16' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_rendered_version_id" text;--> statement-breakpoint
ALTER TABLE "render_versions" ADD CONSTRAINT "render_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_versions" ADD CONSTRAINT "render_versions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "render_versions_project_revision_uq" ON "render_versions" USING btree ("project_id","revision");--> statement-breakpoint
CREATE INDEX "render_versions_project_idx" ON "render_versions" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_last_rendered_version_id_render_versions_id_fk" FOREIGN KEY ("last_rendered_version_id") REFERENCES "public"."render_versions"("id") ON DELETE set null ON UPDATE no action;