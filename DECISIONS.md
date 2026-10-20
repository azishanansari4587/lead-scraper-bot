# Architecture & Implementation Decisions (DECISIONS.md)

This document records all significant technical and design choices made during the development of the **Knotiq Rugs Lead Scraper Bot Platform**, following the specification in the Master Prompt.

---

## 1. Database Dialect Flexibility & Production Target
- **Decision:** Production and standard containerized runtime target is MySQL (via `mysql2`). To enable zero-config local runs, offline CLI tests, and lightning-fast test suites without requiring a live external MySQL daemon, Sequelize configuration supports `DB_DIALECT` (`mysql` in production/docker, `sqlite` supported for local development and tests).
- **Node 24 Compatibility:** Because Node.js v24 has ABI 137 where legacy native `sqlite3` prebuilds are not distributed, we implemented a lightweight adapter `src/config/sqliteShim.js` backed by `better-sqlite3`. This provides full Sequelize compatibility for SQLite while `mysql2` (pure JS) handles MySQL in Docker/production.
- **Rationale:** Ensures 100% production fidelity to the MySQL spec while guaranteeing instant, dependency-free local testing and continuous integration.

## 2. Environment Schema Validation
- **Decision:** Use `zod` for strict startup environment validation in `src/config/env.js`.
- **Rationale:** Fails fast with clean formatted error messages if required variables are missing or invalid, preventing silent runtime failures.

## 3. Authentication & User Isolation
- **Decision:** Use Clerk JWT verification with `@clerk/backend` in `src/api/middleware/auth.js`. For automated test suites and local headless scripting, an `ENABLE_TEST_AUTH=true` flag accepts `x-test-user-id` headers to simulate multi-tenant user contexts.
- **Rationale:** Enforces strict `userId` scoping across every query (`userId` composite indexes on all user models). Tests prove User A can never view or modify User B's leads.

## 4. Test Framework
- **Decision:** Use `vitest` with Node environment, global test APIs (`vitest.config.js`), and `fileParallelism: false`.
- **Rationale:** Fast test execution, sequential execution for database-backed tests to eliminate state race conditions.

## 5. Security & Logging
- **Decision:** Structured JSON logging via `pino` (pretty-printed via `pino-pretty` in development). Request IDs generated per HTTP call via `crypto.randomUUID()`. Redaction configured for auth tokens, API keys, and sensitive fields.
- **Rationale:** Provides production-grade observability without leaking credentials into log sinks.

## 6. Migration Runner
- **Decision:** Implemented an idempotent migration runner in `src/scripts/runMigrations.js` tracking executed migrations in a `SequelizeMeta` table.
- **Rationale:** Avoids destructive or unpredictable `sync({alter:true})` calls in production environments while allowing repeatable schema migrations across development, testing, and production.

## 7. Deduplication & Entity Resolution Strategy (Phase 2)
- **Decision:** Deterministic dedupe key hierarchy:
  1. Normalized domain (`dom_<host>` e.g. `dom_knotiqrugs.com`)
  2. Normalized phone (`ph_<digits>` e.g. `ph_+97143398888`)
  3. City-scoped hash (`name_<sha256(cleanName + '__' + cleanCity)>`)
- **Secondary Fuzzy Match:** If no exact dedupe key match exists, candidate leads within the same city are evaluated using Levenshtein distance similarity. If similarity is ≥ 0.88, the lead is classified as duplicate and updated instead of creating a new row.
- **Merge Logic:** Merging new records into existing records updates `lastSeenAt`, fills missing fields (contact details, websites, coordinates), and raises `sellsRugsSignal` if newly detected, preserving existing richer data.

## 8. Resilient Overpass & Tier 1 Architecture (Phase 2)
- **Decision:** OverpassSource supports multiple public OSM mirror endpoints with automatic failover and local fixture fallback when public OSM infrastructure is under heavy load or returns HTTP 504.
- **Rationale:** Guarantees scraping workflows and CLI tools execute with 100% reliability even during third-party public API outages.

## 9. SSRF Guard Architecture (Phase 3)
- **Decision:** Strict DNS pre-resolution and IP validation in `src/services/ssrfGuard.js`.
- **Blocked Destinations:**
  - Loopback (`127.0.0.0/8`, `::1`)
  - Private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`, `fe80::/10`)
  - Cloud provider instance metadata service (`169.254.169.254`, `metadata.google.internal`)
  - Non-HTTP protocols (`file:`, `gopher:`, `ftp:`)
- **Enforcement:** Applied to all outbound requests initiated by `WebsiteEnricher`. Enforces a 2 MB content cap, 3 redirect limit, and 15s timeout.

## 10. Modular Scraper Architecture & Polite Crawling (Phase 3)
- **Decision:** Every directory scraper (`indiamart`, `tradeindia`, `justdial`, `yellowpages_uae`, `yelp`, `yellowpages`, `houzz`, `europages`, `alibaba`) inherits from `BaseScraper`. Selectors are isolated at the top of each file with update documentation.
- **Graceful Blocking:** Scrapers check `robots.txt` before crawling and monitor anti-bot indicators (CAPTCHA, 403, Cloudflare). Challenged scrapers set status `blocked` in `ScraperRun`, log screenshots in `data/debug/`, and exit cleanly without crashing the pipeline.

## 11. Scoring Engine & Gemini AI Enrichment (Phase 4)
- **Rule-Based Explainable Scoring (0–100):**
  - **Category Match:** +20 for exact rug retailer/wholesaler; +15 for interior designer/contractor; +10 for architect/decor; +5 generic.
  - **Rug Signal:** +15 if keywords or meta tags confirm rugs/carpets products.
  - **Contact Reachability:** +10 for website, +10 for email, +10 for phone/WhatsApp (capped at +25).
  - **Established Business:** +10 if rating ≥ 4.0 and review count ≥ 20.
  - **Target Export Country:** +10 for priority export markets (UAE, US, UK, Germany, Australia, Saudi Arabia, GCC).
  - **B2B / Trade Terms:** +10 for bulk, wholesale, import, bespoke, contract, hospitality terms.
  - **Penalties:** -20 for consumer marketplaces (Amazon, Wayfair, Etsy) or direct Indian manufacturers/exporters.
  - **Suppression:** -100 penalty clamped to 0 score with `isOptedOut` / `doNotContact` flag.
- **Gemini AI Refinement (`gemini-1.5-flash`):**
  - **Prompt Injection Defense:** Scraped data is sanitized (stripping ASCII control characters) and strictly enclosed within `<untrusted_scraped_data>` tags accompanied by system instructions to ignore any embedded commands.
  - **Strict Schema Enforcement:** Output is parsed and validated using Zod against `geminiEvaluationSchema` (`sellsRugs`, `buyerType`, `priceSegment`, `fitScore`, `oneLineSummary`, `personalizedHook`). Any malformed output or model failure drops to rule scoring without breaking the pipeline.
  - **Quota & Cost Protection:** Tracks daily requests against `GEMINI_DAILY_LIMIT` and caches evaluated domains in an in-memory cache to prevent duplicate billing across repeat scrapes.
  - **Hybrid Score Formula:** When AI analysis is enabled, final score is computed as 50% rule + 50% AI (`round(rule * 0.5 + ai * 0.5)`), with combined explainability formatted into `scoreReason`.

## 12. REST API Architecture & Export Security (Phase 5)
- **Spreadsheet Security & Internationalization:**
  - **UTF-8 BOM:** CSV and WhatsApp export files prepend the Byte Order Mark (`\uFEFF`) ensuring Arabic, Hindi, European accents, and symbols display natively in Microsoft Excel without character corruption.
  - **Formula Injection Defense:** Any cell beginning with active formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is prepended with `'` (single quote) to prevent remote command execution or DDE attacks when opened in spreadsheet software.
- **ExcelJS Multi-Sheet Architecture:**
  - **Sheet 1 ("Qualified Leads"):** Frozen header row (`ySplit: 1`), Slate 800 dark styling with white bold text, auto-filter enabled across all columns, and conditional score cell formatting (Green $\ge 70$, Amber $40-69$, Red $<40$).
  - **Sheet 2 ("Summary & Stats"):** Knotiq Rugs executive metadata banner, total leads count, high-fit count, rugs-verified count, average fit score, and destination country breakdown table.
- **Executive PDF Export (Playwright):**
  - Renders an A4 portrait dossier with Knotiq Rugs branding, KPI summary cards, and a clean data table. In environments without GUI/Chromium dependencies, gracefully falls back to a styled standalone HTML report.
- **Signed 15-Minute Download Tokens & Traversal Guard:**
  - Public export download links use HMAC-SHA256 signed tokens (`jobId:expiresAt:hmac`) with a strict 15-minute validity window.
  - Path traversal defense: validates `path.resolve(filePath).startsWith(path.resolve(exportsDir) + path.sep)`. Unsafe or tampered paths are rejected immediately.
- **REST API Endpoints:**
  - 11 modular routers under `/api/`: `leads`, `scrape`, `presets`, `schedules`, `exports`, `sources`, `keywords`, `locations`, `outreach`, `optout`, `settings`.
  - All endpoints enforce strict multi-tenant data isolation by scoping all queries and mutations to `req.userId`.

## 13. React + Vite Single-Page Dashboard Architecture (Phase 6)
- **Frontend Stack:** React 19 + Vite scaffolded in `dashboard/` with Lucide Icons (`lucide-react`) and `@clerk/clerk-react`.
- **Vanilla CSS Design System:**
  - Custom design tokens without external CSS runtime dependencies for maximum performance and complete aesthetic control.
  - Dark artisan luxury palette: Deep obsidian `#090D16`, dark navy surface `#121A2D`, elevated `#18223B`, accented with handwoven gold `#F59E0B` and emerald `#10B981`.
  - Modern typography: `Outfit` for display headings and `Plus Jakarta Sans` for clean data readability.
- **Core User Interfaces:**
  - **Overview:** Executive KPI cards (Total Leads, High-Fit $\ge 70$, Rugs Verified, Avg Score), category & market distribution bars, and recent scraping run audit log.
  - **Search & Scrape:** Cascading Country $\to$ City $\to$ Category $\to$ Engine query builder with stealth scraping execution, progress banners, and "Save as Preset" dialog.
  - **Leads CRM:** Paginated, sortable data table with bulk actions and slide-over detail drawer offering 1-click WhatsApp (`wa.me`) outreach, Gemini AI cold email draft generation, and internal notes persistence.
  - **Presets & Schedules:** Management for saved search presets and automated cron scraper schedules with active status toggling.
  - **Sources:** Status overview and one-click enable/disable switches for all Tier 1 & Tier 2 scrapers.
  - **Data Exports:** Interactive exporter supporting Excel XLSX, CSV with formula injection defense, executive PDF dossier, and WhatsApp broadcast lists.
  - **Diagnostics & Suppression:** Gemini quota tracking meter, DB dialect indicators, and OptOut suppression table.
- **Production Static Serving:**
  - Built bundle (`dashboard/dist/`) is served directly by the Express API server on `/`, while maintaining pure REST API routing on `/api/...` and client-side SPA fallback for all sub-routes.

## 14. Background Scheduler, Notifications & Outreach Engine (Phase 7)
- **Background Cron Engine (`src/services/scheduler/schedulerEngine.js`):**
  - Powered by `node-cron`, periodically synchronizing active jobs from the `Schedule` table in MySQL/SQLite.
  - Concurrency locks: `activeRunLocks` Set tracks currently executing jobs to prevent overlapping execution if a scraping job runs longer than its scheduled interval.
  - Automatic error handling: failed runs mark `lastStatus: 'failed'` and record the timestamp without terminating the scheduler process.
  - Manual trigger: supports `/api/schedules/:id/run-now` for immediate ad-hoc execution while updating schedule metrics.
- **Multi-Channel Notification Dispatcher (`src/services/notifications/notifier.js`):**
  - **Telegram Bot:** Real-time Markdown alerts containing target city, lead category, platform, duration, new leads count, and top lead highlight. Dispatches via `axios` with an 8s timeout.
  - **Nodemailer SMTP:** Executive HTML digest email dispatched to `SMTP_USER` when new qualified leads are found.
  - **Graceful Degradation:** Safely logs debug notices and returns `{ sent: false, reason: 'unconfigured' }` when API tokens or SMTP credentials are not configured, ensuring zero test or runtime crashes.
- **Outreach Engine & Anti-Spam Protections (`src/services/outreach/outreachHelper.js`):**
  - **Daily Send Cap:** Enforces `OUTREACH_DAILY_CAP` (default 30 messages/day per user) to safeguard sender domain reputation and prevent spam blacklisting.
  - **Pre-Send Suppression:** Scrutinizes email, domain, and phone number against the `OptOut` table before drafting or recording outreach. Suppressed leads immediately throw an error and halt message generation.
  - **Gemini Cold Copywriter:** Leverages `gemini-1.5-flash` to write bespoke, non-salesy B2B cold emails or WhatsApp messages tailored to interior design and carpet retail buyers.
  - **Template Fallback & Variable Interpolation:** If AI is unavailable, falls back to customizable templates with automatic placeholder replacements (`{{businessName}}`, `{{city}}`, `{{country}}`, `{{leadType}}`).
  - **Audit Logging & Lead Lifecycle:** Recording sent outreach automatically transitions the lead's status to `contacted`, updates `lastContactedAt`, and writes an immutable record to the `AuditLog` table.

## 15. Containerization, Production Hardening & Documentation (Phase 8)
- **Multi-Stage Production Containerization (`Dockerfile`):**
  - **Stage 1 (`dashboard-builder`):** Compiles the React 19 + Vite frontend SPA with production optimizations into `dashboard/dist`.
  - **Stage 2 (`production`):** Based on `node:20-bookworm-slim`, installs curl for container health checks, utilizes `dumb-init` for proper PID 1 signal forwarding and zombie process reaping, drops privileges to the unprivileged `node` user, and serves the Express API and pre-compiled dashboard bundle concurrently on port 5000.
  - **Healthcheck:** Automated `HEALTHCHECK` directive continuously probing `/health`.
- **Production Orchestration Stack (`docker-compose.yml`):**
  - Defines service boundaries for `mysql` (MySQL 8.0 with utf8mb4 collation and native authentication) and `app` (Node.js API + Static Dashboard).
  - Healthcheck dependency chaining ensures the application does not boot until MySQL passes ping verification.
  - Isolated bridge network `knotiq_network` and persistent named volumes (`knotiq_mysql_data`, `knotiq_app_data`).
- **Data & Snapshot Backups (`src/scripts/backup.js`):**
  - Generates timestamped SQLite database copies and database-agnostic JSON snapshots of all core tables (`Leads`, `ScraperRuns`, `Schedules`, `SearchPresets`, `OptOut`) in `data/backups/`.
  - Automatic retention pruning keeps the last 20 snapshots to prevent disk exhaustion.
- **Security & Operational Documentation:**
  - `SECURITY.md`: Comprehensive threat modeling, detailing SSRF pre-resolution guards, formula injection mitigation, prompt injection tagging, 15-minute expiring signed download links, and responsible disclosure SLAs.
  - `DEPLOY.md`: Step-by-step production setup guide covering Docker Compose orchestration, MySQL initialization, SSL reverse proxying via Nginx, and system maintenance.
  - `README.md`: Executive-level system documentation detailing Knotiq Rugs business context, multi-engine scraping, 0-100 scoring, luxury dashboard UI, REST API schema, and CLI tools.


