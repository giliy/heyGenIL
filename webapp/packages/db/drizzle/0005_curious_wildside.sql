CREATE TABLE "avatars" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'stock' NOT NULL,
	"name_he" text NOT NULL,
	"face_image_key" text,
	"face_image_url" text,
	"talk_model" text,
	"premium" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"logo_asset_id" text,
	"accent" text DEFAULT '#0b6ce0' NOT NULL,
	"font" text DEFAULT 'hebrew' NOT NULL,
	"cta_text" text,
	"phone" text,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "kind" text DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "face_ref_image_key" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "talk_model" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "consent_asset_key" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "consent_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_logo_asset_id_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_kits_user_name_uq" ON "brand_kits" USING btree ("user_id","name");