CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "candidate";
--> statement-breakpoint
CREATE SCHEMA "question_bank";
--> statement-breakpoint
CREATE SCHEMA "assessment";
--> statement-breakpoint
CREATE SCHEMA "commerce";
--> statement-breakpoint
CREATE SCHEMA "counseling";
--> statement-breakpoint
CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE SCHEMA "files";
--> statement-breakpoint
CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "migration";
--> statement-breakpoint
CREATE TYPE "core"."user_role" AS ENUM('admin', 'ops', 'counselor', 'partner', 'candidate');--> statement-breakpoint
CREATE TYPE "candidate"."gender" AS ENUM('M', 'F', 'O');--> statement-breakpoint
CREATE TYPE "assessment"."attempt_status" AS ENUM('not_started', 'in_progress', 'submitted', 'expired', 'locked');--> statement-breakpoint
CREATE TYPE "commerce"."order_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "commerce"."payment_gateway" AS ENUM('ccavenue', 'razorpay');--> statement-breakpoint
CREATE TYPE "counseling"."booking_status" AS ENUM('requested', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TABLE "core"."organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(300) NOT NULL,
	"kind" varchar(50) DEFAULT 'school' NOT NULL,
	"contact_email" varchar(320),
	"contact_phone" varchar(32),
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "core"."user_role" DEFAULT 'candidate' NOT NULL,
	"full_name" varchar(200),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate"."candidates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"date_of_birth" date NOT NULL,
	"gender" "candidate"."gender" NOT NULL,
	"grade" varchar(32),
	"school_name" varchar(300),
	"city" varchar(120),
	"guardian_name" varchar(200),
	"guardian_phone" varchar(32),
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_bank"."question_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"question_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"pole" varchar(1),
	"order_index" integer DEFAULT 0 NOT NULL,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_bank"."question_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(300) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"scale_code" varchar(32),
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_bank"."questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"question_set_id" uuid NOT NULL,
	"text" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment"."assessment_modules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"assessment_id" uuid NOT NULL,
	"question_set_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"randomize_questions" boolean DEFAULT true NOT NULL,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment"."assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" varchar(2000),
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment"."attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" "assessment"."attempt_status" DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment"."reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"file_id" uuid,
	"template_code" varchar(64),
	"generated_at" timestamp with time zone,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment"."responses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"option_id" uuid,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment"."scores" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"domain" varchar(32) NOT NULL,
	"scale_code" varchar(32) NOT NULL,
	"raw" numeric(12, 4),
	"derived" numeric(12, 4),
	"classification" varchar(8),
	"detail" jsonb,
	"engine_version" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."coupons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"discount_percent" numeric(5, 2),
	"discount_flat_inr" numeric(12, 2),
	"max_redemptions" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_inr" numeric(12, 2) NOT NULL,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "commerce"."order_status" DEFAULT 'pending' NOT NULL,
	"total_inr" numeric(12, 2) NOT NULL,
	"coupon_id" uuid,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"gateway" "commerce"."payment_gateway" NOT NULL,
	"gateway_reference" varchar(128),
	"amount_inr" numeric(12, 2) NOT NULL,
	"status" varchar(32) NOT NULL,
	"gateway_payload" jsonb,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce"."products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(300) NOT NULL,
	"price_inr" numeric(12, 2) NOT NULL,
	"assessment_id" uuid,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counseling"."availability_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"counselor_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 45 NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counseling"."bookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slot_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" "counseling"."booking_status" DEFAULT 'requested' NOT NULL,
	"notes" varchar(2000),
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counseling"."counselors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bio" varchar(2000),
	"specialization" varchar(300),
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."invoice_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"amount_inr" numeric(12, 2) NOT NULL,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"invoice_number" varchar(64) NOT NULL,
	"total_inr" numeric(12, 2) NOT NULL,
	"tax_inr" numeric(12, 2) DEFAULT '0' NOT NULL,
	"issued_at" timestamp with time zone,
	"file_id" uuid,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files"."file_objects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bucket" varchar(128) NOT NULL,
	"object_key" varchar(1024) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" varchar(64),
	"uploaded_by" uuid,
	"legacy_id" bigint,
	"legacy_source" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" varchar(128) NOT NULL,
	"entity" varchar(128) NOT NULL,
	"entity_id" varchar(64),
	"before" jsonb,
	"after" jsonb,
	"ip" varchar(64),
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration"."id_map" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity" varchar(128) NOT NULL,
	"legacy_id" bigint NOT NULL,
	"new_id" uuid NOT NULL,
	"migrated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration"."run_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" varchar(64) NOT NULL,
	"phase" varchar(16) NOT NULL,
	"entity" varchar(128),
	"status" varchar(32) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"detail" jsonb
);
--> statement-breakpoint
ALTER TABLE "core"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate"."candidates" ADD CONSTRAINT "candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate"."candidates" ADD CONSTRAINT "candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_bank"."question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "question_bank"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_bank"."questions" ADD CONSTRAINT "questions_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "question_bank"."question_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."assessment_modules" ADD CONSTRAINT "assessment_modules_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "assessment"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."assessment_modules" ADD CONSTRAINT "assessment_modules_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "question_bank"."question_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."attempts" ADD CONSTRAINT "attempts_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "candidate"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."attempts" ADD CONSTRAINT "attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "assessment"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."reports" ADD CONSTRAINT "reports_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "assessment"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."responses" ADD CONSTRAINT "responses_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "assessment"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."responses" ADD CONSTRAINT "responses_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "question_bank"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."responses" ADD CONSTRAINT "responses_option_id_question_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "question_bank"."question_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment"."scores" ADD CONSTRAINT "scores_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "assessment"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "commerce"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "commerce"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce"."payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "commerce"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counseling"."availability_slots" ADD CONSTRAINT "availability_slots_counselor_id_counselors_id_fk" FOREIGN KEY ("counselor_id") REFERENCES "counseling"."counselors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counseling"."bookings" ADD CONSTRAINT "bookings_slot_id_availability_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "counseling"."availability_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counseling"."bookings" ADD CONSTRAINT "bookings_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "candidate"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counseling"."counselors" ADD CONSTRAINT "counselors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_ux" ON "core"."users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_candidate_assessment_no_ux" ON "assessment"."attempts" USING btree ("candidate_id","assessment_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "responses_attempt_question_ux" ON "assessment"."responses" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "id_map_entity_legacy_ux" ON "migration"."id_map" USING btree ("entity","legacy_id");