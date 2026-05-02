CREATE TYPE "public"."approval_decision" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('any', 'all');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_steps" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"approval_id" bigint NOT NULL,
	"approver_user_id" bigint NOT NULL,
	"decision" "approval_decision" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"task_id" bigint NOT NULL,
	"type" "approval_type" DEFAULT 'any' NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"required_count" integer DEFAULT 1 NOT NULL,
	"approved_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"requested_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sla_escalations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"task_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"notified_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sla_policies" (
	"workspace_id" bigint NOT NULL,
	"priority" "priority" NOT NULL,
	"response_minutes" integer NOT NULL,
	"resolution_minutes" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sla_policies_workspace_id_priority_pk" PRIMARY KEY("workspace_id","priority")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_escalations" ADD CONSTRAINT "sla_escalations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_escalations" ADD CONSTRAINT "sla_escalations_notified_user_id_users_id_fk" FOREIGN KEY ("notified_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
