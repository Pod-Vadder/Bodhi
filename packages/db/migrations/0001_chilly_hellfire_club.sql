CREATE TYPE "assessment"."module_progress_status" AS ENUM('pending', 'in_progress', 'submitted', 'expired');--> statement-breakpoint
CREATE TABLE "assessment"."attempt_modules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"status" "assessment"."module_progress_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment"."attempt_modules" ADD CONSTRAINT "attempt_modules_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "assessment"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."attempt_modules" ADD CONSTRAINT "attempt_modules_module_id_assessment_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "assessment"."assessment_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_modules_attempt_module_ux" ON "assessment"."attempt_modules" USING btree ("attempt_id","module_id");