# KareOne Telegram Bot — Comprehensive Capability Plan

## 1. High-Level Architecture
- **Client:** Telegram (1:1 chats, group chats, optional Telegram Mini App / WebApp).
- **Webhook entry:** Telegram → `POST /.netlify/functions/telegram-webhook`.
- **Compute:** Netlify Functions (sync, <10 s) + Background Functions (≤15 min) + Scheduled Functions (cron).
- **Database:** Postgres (Neon/Supabase) via Drizzle ORM.
- **Cache / queues:** Upstash Redis — rate-limit, idempotency, conversation state, dedup.
- **File storage:** Netlify Blobs or Cloudinary/S3.
- **Secrets:** Netlify env vars.
- **Observability:** Function logs + `/health` endpoint + optional Logtail/Axiom.

## 2. User Roles & Permission Matrix
- Super Admin · Admin/HR · Manager/Team Lead · Member · Guest · Bot/System.
- RBAC checks at central layer (resource × verb × scope).

## 3. Onboarding & Authentication
- Bootstrap via `INSTALL_TOKEN` (first user becomes Super Admin).
- Invite deep-links: `t.me/KareOneBot?start=invite_<token>`.
- Telegram identity ↔ KareOne employee record.
- Optional SSO (email magic link / Google) via Telegram WebApp.
- Multi-workspace memberships.

## 4. Task Management — Core Capabilities
### 4.1 Lifecycle
Draft → Open → Assigned → In Progress → Blocked → In Review → Done → Archived (+ Cancelled / Rejected). Custom statuses per workspace.
### 4.2 Creating tasks
Wizard, one-shot syntax, forwarded-message conversion, voice-note (Whisper), email forward, templates, CSV bulk import.
### 4.3 Fields
Title, Markdown desc, checklists/subtasks, labels, project, milestone/sprint, story points, time, priority (P0–P3), due/start dates, RRULE recurrence, attachments, watchers, dependencies, parent, custom fields.
### 4.4 Assignment models
Single, multiple co-assignees, watchers; auto-assign rules (round-robin, skill, load, schedule); accept/decline + escalation chain on SLA breach.
### 4.5 Subtasks & dependencies
Unlimited nesting; Gantt-style graph; auto-block/unblock notifications.
### 4.6 Recurring tasks
Daily/weekly/monthly/RRULE; rotation-aware; holiday-aware (skip/shift/firm).
### 4.7 Time & effort
`/work start|stop`; manual logs; estimate vs actual; timesheet exports.
### 4.8 Comments & collaboration
Threaded comments; mentions; reactions; edit history; attachments (file/photo/voice/location/contact).
### 4.9 Approval workflows
N-of-M approvers; sequential or parallel; rejection reasons.
### 4.10 SLA & escalation
Per-priority targets; pre-breach warnings; auto-escalation; SLA pauses (Blocked / outside hours).

## 5. Q&A — User-to-User Questions
- `/ask @user`, `/ask #tag`, AI-routed questions.
- Answers as text, voice, file, link to a task, KB cross-reference.
- Auto-built KB from answered questions; voted official answers.
- `/kb search <terms>` with low-confidence escalation.
- Anonymous mode (HR/suggestions box).
- Question SLAs.
- Optional AI: summarize threads, draft answers, fa↔en translation.

## 6. Notifications & Reminders
- DM events: assigned, mention, due-soon, due-now, overdue, status change, comment, approval.
- Quiet hours, DND, timezone-aware.
- Per-user event matrix (DM vs digest).
- Daily morning digest, Monday plan, Friday recap.
- Snooze (in 2h, tomorrow 9am, next Monday).
- Group-channel announcements for SLA breaches.

## 7. Search & Discovery
- `/find <query>` full-text across tasks/comments/KB.
- Filters: assignee, status, due, tag, project, priority.
- Saved searches as smart inboxes.
- Built-ins: `/mytasks`, `/today`, `/overdue`, `/inbox`, `/blocked`, `/waiting`.

## 8. Reporting & Analytics
- Personal: throughput, cycle time, on-time rate, current load.
- Team: WIP, burndown, SLA compliance, top tags, bottlenecks.
- Org: department heatmap, workload imbalance, recurring blockers.
- Exports: CSV/XLSX/PDF; scheduled email reports.
- Live dashboards via Telegram WebApp.

## 9. Admin & Governance
- User CRUD, bulk invite, deactivate, leaver-task transfer.
- Departments, teams, projects, tag taxonomy.
- Custom statuses & workflow editor.
- Custom fields editor.
- Holidays, working hours, timezones.
- Auto-assign rule editor.
- Audit log (before/after).
- GDPR-style export/delete.
- Workspace branding.

## 10. Integrations
Calendar (Google/Outlook), Drive (Google/OneDrive/Dropbox), inbound email, CRM/insurance core webhooks, GitHub/GitLab, Slack mirror, Zapier/Make, AI providers (OpenAI/Anthropic).

## 11. Telegram-Specific UX Features
Inline keyboards, inline mode, forum topics per project, pinned daily summary, deep links, Mini App, voice→transcription→command, location for field tasks, multi-language UI (fa primary, RTL), Markdown-V2 with safe escaping.

## 12. Conversation State Machine
Wizard flows in Redis (15-min TTL); idempotency by `update_id`; per-user rate limiting.

## 13. Data Model (initial Postgres tables)
`workspaces, users, memberships, departments, teams, team_members, projects, tasks, task_assignees, task_watchers, subtasks, comments, attachments, labels, task_labels, dependencies, custom_fields, custom_field_values, statuses, workflows, time_logs, recurrences, approvals, approval_steps, questions, answers, kb_articles, votes, notifications, notification_prefs, audit_log, integrations, sessions, invite_tokens, sla_policies, escalations, holidays, working_hours.`

## 14. Netlify Functions Layout
- `functions/telegram-webhook.ts` — single entry; routes by command/callback_data.
- `functions/webapp-api/*` — REST/GraphQL for the Mini App.
- `functions/integrations/*` — inbound webhooks (email, CRM, calendar).
- `functions/scheduled/*` — SLA sweep, daily digests, recurrence spawner, KB reindex.
- `functions/background/*` — bulk import, report generation, AI batch.
- Shared `lib/` (db, telegram, RBAC, i18n, validation, command router).

## 15. Security
- Verify Telegram webhook secret token header.
- Verify Telegram WebApp `initData` HMAC.
- ORM with parameterized queries.
- Per-tenant isolation at query level.
- PII at-rest encryption.
- Audit log on every privileged action.
- Secret rotation procedure.
- Input validation (Zod) at every entry point.
- Rate limiting & abuse detection.

## 16. DevEx & Quality
Monorepo (`apps/bot`, `apps/webapp`, `packages/shared`), TypeScript everywhere, ESLint+Prettier, Husky, Drizzle migrations with preview DB per Netlify deploy preview, Vitest unit + integration tests, contract tests for Telegram payloads, `netlify dev` + ngrok for local webhook, CI = lint + type-check + test + deploy preview + smoke.

## 17. Phased Rollout
- **Phase 1 (MVP):** auth, basic task CRUD, single assignee, due dates, comments, DM notifications, `/mytasks`, daily digest, audit log. ← *implemented*
- **Phase 2:** subtasks, recurrences, SLA, escalations, group/topic support, Q&A basic, KB search.
- **Phase 3:** auto-assign rules, approvals, time tracking, dashboards in WebApp.
- **Phase 4:** integrations (calendar, email, CRM), AI triage/translate, advanced analytics, multi-workspace.
- **Phase 5:** custom workflows, custom fields, public API, marketplace integrations.
