# KareOne Telegram Assigner Bot

Telegram bot for company-wide task assignment, Q&A between teammates, and team coordination.
Backend runs on **Netlify Functions** (serverless), with **Postgres** for data and **Upstash Redis** for state/idempotency.

> Phase-1 scope is implemented (auth, basic task CRUD, single assignee, due dates, daily digest, due-soon/overdue reminders, Q&A, audit log, invite links). See `docs/PLAN.md` for the full multi-phase capability roadmap.

---

## 1. Prerequisites

- Node.js ≥ 20
- A Telegram bot token (talk to [@BotFather](https://t.me/BotFather))
- A Postgres database (Neon, Supabase, or any managed Postgres)
- An Upstash Redis instance (free tier is fine)
- A Netlify account

## 2. Local setup

```bash
cd "D:/KareOne/Telegram Assigner Bot"
npm install
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN, DATABASE_URL, UPSTASH_REDIS_*, INSTALL_TOKEN, etc.

npm run db:generate     # generate SQL migrations from src/db/schema.ts
npm run db:migrate      # apply them to your DATABASE_URL

npm run dev             # netlify dev — local server on :8888
```

To expose the local webhook to Telegram during development:

```bash
# In another terminal:
ngrok http 8888
# Set PUBLIC_URL=<https url from ngrok> in .env, then:
npm run tg:set-webhook
npm run tg:set-commands
```

## 3. Deploying to Netlify

1. Push the repo to GitHub/GitLab.
2. In Netlify → **Add new site → Import**, select the repo.
3. Build command: `npm run build` — Publish directory: `public` — Functions directory: `netlify/functions`.
4. Add **all** the variables from `.env.example` to **Site settings → Environment variables**.
5. After the first deploy, set `PUBLIC_URL` to the assigned Netlify URL and re-deploy.
6. Register the Telegram webhook (one time):

   ```bash
   PUBLIC_URL=https://your-site.netlify.app npm run tg:set-webhook
   npm run tg:set-commands
   ```

7. Verify: `curl https://your-site.netlify.app/.netlify/functions/health` → `{ "ok": true, ... }`.

## 4. Bootstrapping the workspace

The first user who runs `/start <INSTALL_TOKEN>` becomes **Super Admin** and creates the workspace.
Then they can invite teammates with `/invite`.

```text
/start <your-INSTALL_TOKEN>     # ← only the very first time
/invite                         # generates a one-time invite link
```

## 5. Available commands

| Command | What it does |
|---|---|
| `/start` | Register / accept invite link |
| `/help` | Show command list |
| `/whoami` | Show your role + workspace |
| `/newtask` | Wizard: title → assignee → due → priority |
| `/newtask <title> @user due:tomorrow 5pm p1` | One-shot task |
| `/mytasks` | Tasks assigned to you |
| `/today` | Tasks due today |
| `/overdue` | Overdue tasks |
| `/done <id>` | Mark task done |
| `/assign <id> @user` | Reassign (managers or task creator) |
| `/ask @user <q>` | Direct Q&A |
| `/ask #tag <q>`  | Tag-broadcast Q&A |
| `/invite` | Generate invite link (admin+) |
| `/cancel` / `/skip` | Abort current wizard step |

## 6. Scheduled functions

Configured in `netlify.toml`:

- `scheduled-daily-digest` → 05:00 UTC daily (per-user "today's tasks")
- `scheduled-due-soon` → every 15 min (warns assignees of tasks due within 60 min)
- `scheduled-overdue-sweep` → hourly (overdue notifications)
- `scheduled-recurrence-spawner` → every 10 min (RRULE-driven recurring tasks)

## 7. Project layout

```
.
├── netlify.toml
├── netlify/functions/
│   ├── telegram-webhook.ts          # main entry
│   ├── scheduled-daily-digest.ts
│   ├── scheduled-due-soon.ts
│   ├── scheduled-overdue-sweep.ts
│   ├── scheduled-recurrence-spawner.ts
│   └── health.ts
├── src/
│   ├── commands/                    # one file per Telegram command
│   ├── db/schema.ts                 # Drizzle Postgres schema
│   ├── i18n/{fa,en}.ts              # Persian + English strings
│   └── lib/                         # db, telegram, redis, rbac, audit, env
├── scripts/                         # webhook & migration helpers
└── public/index.html                # placeholder landing page
```

## 8. Security notes

- Telegram webhooks are validated via `X-Telegram-Bot-Api-Secret-Token` (`TELEGRAM_WEBHOOK_SECRET`).
- Every privileged action is recorded in `audit_log`.
- All multi-tenant queries scope by `workspace_id`.
- Wizard state in Redis carries a 15-min TTL.
- Update IDs are de-duped via Redis (`tg:update:<id>`) so Telegram retries are idempotent.

## 9. Roadmap

The full multi-phase plan (subtasks, SLAs, approvals, time tracking, dashboards, AI triage, integrations, custom workflows) is in [`docs/PLAN.md`](docs/PLAN.md).
