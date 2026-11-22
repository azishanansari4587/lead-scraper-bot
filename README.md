# 🏰 Knotiq Rugs — B2B Lead Scraper & Intelligence Platform

> **Production-ready, full-stack B2B lead generation, enrichment, scoring, and outreach automation platform tailored for high-end handmade rug exports.**

---

## 1. Business Context

**Knotiq Rugs** is a premium handmade rug manufacturer based in India, specializing in artisan hand-knotted, hand-tufted, flatweave, and bespoke custom rugs. 

This platform autonomously discovers, qualifies, scores, and organizes high-value B2B trade buyers across major export markets:
- 🇦🇪 **United Arab Emirates & GCC** (Dubai, Abu Dhabi, Doha, Riyadh)
- 🇺🇸 **United States** (New York, Los Angeles, Miami, Chicago, Dallas)
- 🇬🇧 **United Kingdom** (London, Manchester, Birmingham)
- 🇪🇺 **Europe** (Frankfurt, Paris, Milan, Amsterdam, Zurich)
- 🇦🇺 **Australia** (Sydney, Melbourne, Brisbane)

### Target B2B Buyer Categories
1. **Carpet & Rug Retailers** (luxury showrooms, flooring boutiques, importers, wholesalers)
2. **Interior Designers & Decorators** (high-end residential & commercial studios)
3. **Interior Fit-Out Contractors** (hospitality, turnkey corporate & luxury villa specialists)
4. **Architectural Firms** (architecture studios with dedicated interiors/FF&E practices)
5. **Hospitality & Hotel Procurement** (luxury resorts, boutique hotels, FF&E purchasers)

---

## 2. Platform Architecture

```mermaid
graph TD
    subgraph Scraping Engines
        T1A[Google Places API]
        T1B[Overpass / OpenStreetMap]
        T2[Directories: IndiaMART, TradeIndia, Justdial, YellowPages, Yelp, Houzz, Europages, Alibaba]
    end

    subgraph Ingestion & Security
        SSRF[SSRF Guard / DNS Check]
        DEDUPE[Deduplication & Entity Resolution Engine]
        ENRICH[Website Enricher: Email / Phone / WhatsApp / Rug Signal]
    end

    subgraph Intelligence & Scoring
        RULES[Rule-Based Scorer 0-100]
        GEMINI[Gemini 1.5 Flash AI Fit Evaluator]
        HYBRID[50/50 Hybrid Score Combiner]
    end

    subgraph Data Store
        DB[(MySQL 8.0 / SQLite Dialect)]
    end

    subgraph Automated Pipeline
        CRON[Background node-cron Scheduler Engine]
        NOTIF[Telegram Bot & SMTP Digest Notifier]
        OUTREACH[Gemini Cold Outreach Generator with Daily Cap]
    end

    subgraph Application & User Surface
        API[Express REST API - 11 Secure Routers]
        DASH[React 19 + Vite Luxury Artisan SPA Dashboard]
        EXP[Export Engine: ExcelJS, CSV BOM, Playwright PDF, WhatsApp]
    end

    T1A --> DEDUPE
    T1B --> DEDUPE
    T2 --> DEDUPE
    DEDUPE --> SSRF
    SSRF --> ENRICH
    ENRICH --> RULES
    RULES --> GEMINI
    GEMINI --> HYBRID
    HYBRID --> DB
    DB <--> CRON
    CRON --> NOTIF
    DB <--> API
    API <--> DASH
    API --> EXP
    API --> OUTREACH
```

---

## 3. Key Capabilities & Features

### 🔍 Multi-Engine Scraping
- **Tier 1 High-Fidelity Sources:** Google Places API and Overpass (OpenStreetMap) with multi-mirror failover.
- **Tier 2 Directory Scrapers:** 9 modular scrapers for major trade directories (IndiaMART, TradeIndia, Justdial, Yellow Pages UAE, Yelp, Yellow Pages US, Houzz, Europages, Alibaba).
- **Stealth Browsing:** Built on Playwright and Puppeteer Stealth plugin with user-agent rotation, polite randomized delays, and `robots.txt` compliance cache.

### 🌐 Deep Website Enrichment & SSRF Defense
- Crawls up to 3 pages per business domain (Home, Contact, About) to extract emails, WhatsApp numbers, social profiles (Instagram, LinkedIn, Facebook), and rug-specific trade signals.
- Hardened with **SSRF Guard**: pre-resolves DNS and strictly blocks loopback (`127.0.0.0/8`), private networks (`10/8`, `172.16/12`, `192.168/16`), cloud instance metadata (`169.254.169.254`), and non-HTTP protocols.

### 🎯 Explainable 0–100 Scoring & Gemini AI Evaluation
- **Transparent Rule Scoring:** Evaluates category match (+20), rug signal (+15), contact reachability (+25), established reputation (+10), priority export market (+10), and B2B trade terms (+10).
- **Gemini 1.5 Flash AI Refinement:** Delimited prompt injection defense (`<untrusted_scraped_data>`), Zod schema validation, daily quota tracking (`GEMINI_DAILY_LIMIT`), and domain caching.
- **50/50 Hybrid Score:** `round(ruleScore * 0.5 + aiFitScore * 0.5)` with rich human-readable `scoreReason`.

### 📊 Multi-Format Secure Exports
- **Excel (.xlsx):** Multi-sheet workbook via `exceljs` featuring frozen header rows, auto-filters, conditional color styling (Green $\ge 70$, Amber $40-69$, Red $<40$), and executive KPI summary tab.
- **CSV (.csv):** Formula injection protection (auto-prepends `'` to active characters `=, +, -, @, \t, \r`) and UTF-8 BOM (`\uFEFF`) for flawless rendering in Microsoft Excel.
- **Executive PDF (.pdf):** High-resolution A4 dossier rendered via Playwright with KPI banner cards, table layout, and HTML fallback.
- **WhatsApp Broadcast (.txt):** E.164 phone normalization generating direct `wa.me/<number>?text=...` conversation links.
- **Signed Download Links:** HMAC-SHA256 download tokens expiring strictly after 15 minutes with canonical path traversal defense.

### 🖥️ Luxury Artisan React Dashboard
- Built with **React 19 + Vite** and Vanilla CSS design tokens (Artisan obsidian `#090D16`, deep navy `#121A2D`, and warm gold `#F59E0B`).
- **Overview:** 4 KPI cards, country & category progress distribution, and scraper run audit feed.
- **Search & Scrape:** Interactive cascading selector (Country $\to$ City $\to$ Category $\to$ Engine) with live scraping progress and "Save Preset".
- **Leads CRM:** Paginated leads table with bulk actions and slide-over detail drawer offering 1-click WhatsApp messaging, AI cold email generation, and notes editing.
- **Presets & Schedules:** Manage saved search queries and recurring cron scraper jobs.
- **Sources & Diagnostics:** Toggle individual scrapers on/off, monitor Gemini API limits, and manage the OptOut suppression list.

### ⏰ Scheduler, Notifications & Outreach Helper
- **Automated Cron Runner:** `node-cron` background engine synchronized with database schedules and run mutex locks.
- **Dual Notifications:** Real-time Telegram Bot Markdown alerts + Nodemailer SMTP digest emails.
- **Anti-Spam Outreach Engine:** Daily send cap (30/day per user), pre-send suppression checks against `OptOut`, and Gemini cold copy generation.

### 📋 Tasks, Internal Calendar & Daily Planner Rituals (Phase B)
- **Task Management Engine:** List & Kanban boards, categories, priorities, MIT flags, lead linkage (appears in lead activity timeline), and recurring tasks (daily, weekdays, weekly, monthly).
- **Internal Unified Calendar:** Consolidates meetings, task deadlines, follow-ups, and scheduled calls to make (`itemType: 'call'`) with time overlap conflict detection and dual UAE (GST) / India (IST) time display.
- **Polymorphic Notebook:** Notes attach seamlessly to leads, calls, tasks, and calendar events (`ownerType: 'event'`), directly accessible in detail drawers.
- **Daily Planner Rituals & Two Streaks:** Morning plan (3 MITs & daily intentions), Evening review with auto-summaries, auto-drafted tomorrow plan, and dual consistency streaks (Evening Review streak & Daily Targets hit streak) computed in user's timezone with day-boundary precision.
- **Founder Reminders:** Automated Telegram and email alerts for morning briefs, evening nudges, and upcoming event notices with duplicate-prevention idempotency (`ReminderLog`).

---

## 4. Quickstart Guide

### Option A: Local Development (SQLite)

1. **Clone & Install Dependencies:**
   ```bash
   git clone https://github.com/knotiq-rugs/lead-scraper-bot.git
   cd lead-scraper-bot
   npm install
   npm --prefix dashboard install
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Set DB_DIALECT=sqlite (default in dev) and add API keys if available
   ```

3. **Initialize Database & Seed Data:**
   ```bash
   npm run migrate
   npm run seed
   ```

4. **Build Frontend & Start Server:**
   ```bash
   npm run build
   npm start
   ```
   Open [http://localhost:5000](http://localhost:5000) in your browser.

---

### Option B: Production (Docker Compose + MySQL 8)

1. **Configure Production `.env`:**
   ```bash
   cp .env.example .env
   # Set DB_DIALECT=mysql and production credentials
   ```

2. **Launch Stack:**
   ```bash
   docker compose up -d --build
   ```

3. **Run Migrations & Seeds in Container:**
   ```bash
   docker compose exec app npm run migrate
   docker compose exec app npm run seed
   ```

4. **Verify Health:**
   ```bash
   curl http://localhost:5000/health
   ```

---

## 5. CLI Commands

| Command | Description |
| :--- | :--- |
| `npm start` | Starts Express API and serves built dashboard on port 5000 |
| `npm test` | Runs complete automated test suite (182 tests across all phases) via Vitest |
| `npm run build` | Compiles React 19 + Vite dashboard into `dashboard/dist` |
| `npm run migrate` | Executes idempotent database migrations tracking `SequelizeMeta` |
| `npm run seed` | Seeds 65 international locations and 19 multilingual trade keyword sets |
| `npm run scrape` | Headless CLI scraper tool (`--country UAE --city Dubai --type rug_retailer`) |
| `npm run check:scrapers` | Self-test runner executing live connectivity tests across all scrapers |
| `npm run backup` | Creates timestamped SQLite file backups and portable JSON table snapshots |

---

## 6. REST API Endpoints

All endpoints (except public `/health` and signed download URLs) require Clerk JWT authentication or `ENABLE_TEST_AUTH=true` with `x-test-user-id`.

| Router | Method | Path | Description |
| :--- | :--- | :--- | :--- |
| **System** | `GET` | `/health` | Uptime, memory usage, and database connection status |
| **Today Hub** | `GET` | `/api/today/summary` | Ultra-fast dashboard (<2s) with dual GST/IST times, targets, 3 MITs, calendar, and streaks |
| **Tasks** | `GET` | `/api/tasks` | Filter tasks by category, priority, status, MIT, search, or lead |
| | `POST` | `/api/tasks` | Create task with recurrence rules and MIT prioritization |
| | `PATCH` | `/api/tasks/:id` | Update task; auto-spawns next occurrence on completion for recurring tasks |
| | `DELETE` | `/api/tasks/:id` | Delete task with audit logging |
| **Calendar** | `GET` | `/api/calendar` | Unified schedule merging events, tasks by dueAt, follow-ups, and calls with conflict detection |
| | `POST` | `/api/calendar/events` | Schedule calendar event with dual GST & IST display |
| | `PATCH` | `/api/calendar/events/:id` | Reschedule or edit calendar event |
| | `DELETE` | `/api/calendar/events/:id` | Delete calendar event |
| **Planner** | `GET` | `/api/planner/daily-plan` | Get founder's morning plan and 3 MITs for a date |
| | `POST` | `/api/planner/daily-plan` | Save morning plan (3 MITs, targets, morning intention) |
| | `GET` | `/api/planner/daily-review/summary`| Auto-summarize today's achievements (calls, emails, WhatsApps, tasks) |
| | `POST` | `/api/planner/daily-review` | Save evening review (win, lesson, tomorrow notes) and lock streak |
| | `GET` | `/api/planner/streaks` | Consistency streaks for daily reviews and target achievements |
| | `GET` | `/api/planner/tomorrow-draft`| Auto-generated pipeline agenda for tomorrow |
| **Calls** | `GET` | `/api/calls` | Paginated call history with lead details and outcomes |
| | `POST` | `/api/calls` | Log call outcome (enforces OptOut check and updates lead status) |
| | `GET` | `/api/calls/scripts` | Buyer-specific call scripts for 8 buyer categories |
| **Notes** | `GET` | `/api/notes` | Polymorphic notes with markdown, search, and tag filters |
| | `POST` | `/api/notes` | Create note linked to lead, call, task, or campaign |
| **Follow-ups**| `GET` | `/api/follow-ups/today` | Pending and overdue scheduled follow-ups |
| | `PATCH`| `/api/follow-ups/:id/status`| Mark follow-up as done |
| **Leads** | `GET` | `/api/leads` | Paginated search, filter by country/city/buyerType/status/score |
| | `GET` | `/api/leads/:id` | Lead details with score explanation, buyer type, and timeline |
| | `PATCH` | `/api/leads/:id` | Update status, buyerType, priority, or notes |
| | `POST` | `/api/leads/:id/mark-replied` | Cancel pending follow-ups and transition status to replied |
| | `POST` | `/api/leads/:id/classify` | Rule-based classification with Gemini fallback |
| **Scrape** | `POST` | `/api/scrape/run` | Execute scraping job across selected engine and location |
| | `GET` | `/api/scrape/runs` | List past scraping run logs with duration & metrics |
| **Presets** | `GET` | `/api/presets` | List saved search query presets |
| | `POST` | `/api/presets` | Create new search query preset |
| **Schedules** | `GET` | `/api/schedules` | List recurring cron scraper schedules |
| | `POST` | `/api/schedules/:id/run-now` | Immediately trigger scheduled scraper run |
| **Exports** | `POST` | `/api/exports` | Trigger async export job (`xlsx`, `csv`, `pdf`, `whatsapp`) |
| | `GET` | `/api/exports/download/:token` | 15-minute HMAC-signed file download endpoint |
| **Outreach** | `GET` | `/api/outreach/stats` | Daily outreach count and quota tracker |
| | `POST` | `/api/outreach/draft` | Generate AI cold email or template draft |
| | `POST` | `/api/outreach/record-sent` | Increment daily send counter & auto-schedule Day 4/7 follow-ups |
| **OptOut** | `POST` | `/api/optout` | Add email, domain, or phone to suppression blacklist |
| **Settings** | `GET` | `/api/settings/user` | Founder preferences, timezone, reminder times, and targets |
| | `PATCH`| `/api/settings/user` | Update daily targets and reminder preferences |
| **Content** | `GET` | `/api/content` | Content posts with platform/status filters, missed calculation & consistency |
| | `POST` | `/api/content` | Plan content post or raw idea (Alt+P shortcut) |
| | `PATCH` | `/api/content/:id` | Update topic, platform, schedule time, or status |
| | `POST` | `/api/content/:id/mark-posted` | Record live post URL and manual performance metrics (impressions, leads) |
| | `DELETE`| `/api/content/:id` | Remove content post |
| **Campaigns** | `GET` | `/api/campaigns` | List trade campaigns with quick lead counts |
| | `POST` | `/api/campaigns` | Create trade campaign with budget, channel, and target buyer type |
| | `GET` | `/api/campaigns/:id` | Campaign details with stage-rank funnel conversion & lead roster |
| | `POST` | `/api/campaigns/:id/preview-leads` | Live preview of matching leads and skipped opt-outs |
| | `POST` | `/api/campaigns/:id/add-leads` | Bulk ingest filtered leads into campaign with OptOut exclusion |
| | `GET` | `/api/campaigns/:id/send-queue` | Queued leads with prefilled wa.me links and deterministic A/B templates |
| | `POST` | `/api/campaigns/:id/record-send` | Record campaign outreach send with Day 4/7 follow-up creation |
| | `POST` | `/api/campaigns/:id/dispatch-email`| Dispatch campaign email with daily cap check, delay pacing, and DRY_RUN |
| | `POST` | `/api/campaigns/:id/archive` | Explicitly archive a campaign to protect historical metrics |
| | `POST` | `/api/campaigns/:id/unarchive` | Restore an archived campaign back to active |
| | `DELETE`| `/api/campaigns/:id` | Archive campaign when activity exists, or delete if empty |
| **Marketing** | `GET` | `/api/marketing/overview` | Cockpit with posts due this week, consistency gauge, and active funnels |
| | `GET` | `/api/marketing/sources-report` | Sources conversion table, A/B reply rates (>=25 send guard), call rates |
| | `GET` | `/api/marketing/export-sources` | Download Excel sources attribution report with formula injection defense |
| | `POST` | `/api/marketing/inbound-lead` | Quick-add inbound lead from WhatsApp/walk-in with dedupe & Day 1 follow-up |

---

## 7. Phase C Demo Checklist & Verification Guide

1. **Email Campaign Path in `DRY_RUN` Mode:**
   - Execute `POST /api/campaigns/:id/dispatch-email` or queue send with `DRY_RUN=true`.
   - Verifies email dispatch logs simulation without sending live SMTP traffic, increments daily sent counters, updates lead to `contacted`, and schedules Day 4 & Day 7 follow-ups.
2. **Dynamic OptOut Suppression After Campaign Addition:**
   - Ingest a lead into a campaign via `POST /api/campaigns/:id/add-leads`.
   - Add that lead's email/phone to the OptOut list via `POST /api/optout`.
   - Request `GET /api/campaigns/:id/send-queue` or attempt `POST /api/campaigns/:id/record-send`.
   - Verifies the lead is completely omitted from the send queue and blocked from dispatch with an explicit suppression error.
3. **Campaign Archival Safeguards (Archive vs Delete):**
   - Attempt to delete a campaign with linked leads or outreach logs.
   - Verifies the campaign is transitioned to `status: 'archived'` instead of hard-deleted, preserving analytics and audit history.
   - Click **Unarchive** or call `POST /api/campaigns/:id/unarchive` to restore the campaign to active status.
4. **Variant B Challenger Fallback & Honest Attribution:**
   - Create a campaign lead that deterministically maps to Variant B.
   - Provide only a Variant A template (no Variant B template created).
   - Verifies the send queue delivers Variant A copy, and `recordCampaignSend` records `variant = 'A'` in `OutreachLog`, ensuring zero false attribution.
5. **Mark Lead Won Dialog & Deal Value Tracking:**
   - On the Leads page, change a lead's status to `Won`.
   - A modal prompts for Deal Value (e.g. `25,000`) and Currency (`AED`) with a "Skip" option.
   - Won revenue immediately appears in the campaign funnel and Sources ROI reports.
6. **Lost Leads Breakdown by Stage:**
   - View any campaign funnel details drawer.
   - Lost leads are reported separately from the funnel with drop-off stage derived from audit logs (`Lost at Quotation`, `Lost at Contacted`) and an explicit limitation note for legacy transitions.

---

## 7. Security & Compliance Summary

Detailed architectural documentation is available in [SECURITY.md](file:///f:/lead-scraper-bot/SECURITY.md) and [DECISIONS.md](file:///f:/lead-scraper-bot/DECISIONS.md).

- **SSRF Immunity:** Pre-resolves DNS and blocks access to cloud metadata (`169.254.169.254`), private networks, and non-HTTP protocols.
- **Formula Injection Defense:** Prepends `'` to active spreadsheet formula characters in CSV exports.
- **Prompt Injection Defense:** Wraps untrusted text in `<untrusted_scraped_data>` delimiters and enforces strict Zod schema validation.
- **Signed Download Links:** HMAC-SHA256 download tokens expiring after 15 minutes with canonical path traversal guards.
- **Polite Crawling:** Respects `robots.txt`, implements exponential backoff, rate limits concurrent workers, and honors suppression lists.

---

## 8. Deployment Architecture

> **Important:** The backend does **not** deploy to Vercel. Because the backend relies on Playwright headless browsers, background scheduler daemons, persistent socket connections, and database engines, it must be deployed as a long-running container service.

- **Backend Hosting (Docker / Railway / Render):**
  - Use the provided [Dockerfile](file:///f:/lead-scraper-bot/Dockerfile), [railway.json](file:///f:/lead-scraper-bot/railway.json), or [render.yaml](file:///f:/lead-scraper-bot/render.yaml).
  - Migrations run automatically on boot before `app.listen`.
  - For SQLite, mount a persistent volume at `/data` (`DB_PATH=/data/app.db`). For remote MySQL, configure `DATABASE_URL` or `DB_HOST`/`DB_USER`/`DB_PASS`.
- **Frontend Dashboard Hosting (Vercel):**
  - Vercel builds and hosts only the Vite static single-page dashboard ([vercel.json](file:///f:/lead-scraper-bot/vercel.json)).
  - You **must** configure `VITE_API_URL` in Vercel Project Settings pointing to your live backend service (e.g. `https://your-backend.railway.app` or `https://your-backend.onrender.com`).

---

## 9. License & Proprietary Notice

Proprietary and Confidential. Copyright © 2026 **Knotiq Rugs**. All rights reserved.
