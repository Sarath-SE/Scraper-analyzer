# ScrapeLytics

ScrapeLytics is a full-stack web scraping analytics platform that:

- triggers scraping jobs in WebScraper.io for a given sitemap UID,
- ingests and normalizes scraped rows into PostgreSQL snapshots,
- computes pivot-style analytics over time,
- renders an interactive dashboard with CSV export.

## Tech Stack

- Backend: Node.js, Express, PostgreSQL (`pg`), `node-cron`
- Frontend: React + TypeScript + Vite + Tailwind CSS
- External scraping provider: WebScraper.io API

## Repository Structure

- `backend/`: API server, ingestion pipeline, cron jobs
- `frontend/`: UI for scraping and pivot analytics
- `database/scraper_db.sql`: PostgreSQL dump (custom/binary `pg_dump` format)
- `database/auth_setup.sql`: plain SQL script to create auth tables + default admin user

## Core Flow

1. User enters a `sitemap_uid` in the frontend scraper page.
2. Backend `POST /api/scrapes/trigger`:
   - creates/ensures sitemap row,
   - skips if already scraped today (`snapshot_date = CURRENT_DATE`),
   - creates a `scrape_jobs` row,
   - starts WebScraper job and marks status `running`.
3. Poll job (`*/2 * * * *`) checks running jobs:
   - if scraper status is `finished`, job status is atomically moved to `ingesting`,
   - data is fetched and ingested into snapshot tables,
   - job status becomes `finished`.
4. Dashboard calls pivot APIs:
   - `GET /api/pivot/dimensions?sitemap_uid=...`
   - `POST /api/pivot/run`
   and renders time-based pivot results.

## Backend

### Entry Points

- `backend/src/server.js`: starts HTTP server (`PORT` default `3000`)
- `backend/src/app.js`:
  - loads env,
  - enables CORS for `http://localhost:5173`,
  - mounts `/api` routes,
  - starts cron jobs by requiring:
    - `jobs/pollScraperStatus.job.js`
    - `jobs/weeklyAutoScrape.job.js`

### Main API Endpoints

- `POST /api/scrapes/trigger`
  - body: `{ "sitemap_uid": "123", "triggered_by": "user" }`
  - returns:
    - running job: `{ status, scrape_job_id, scraper_job_id }`
    - skipped: `{ status: "skipped", reason, snapshot_id, source }`
- `GET /api/scrapes/status/:jobId`
  - returns `{ id, status, finished_at }`
- `POST /api/auto-scrape/enable`
- `POST /api/auto-scrape/disable`
- `POST /api/auto-scrape/bulk-enable`
- `GET /api/auto-scrape/status`
- `GET /api/pivot/dimensions?sitemap_uid=<uid>`
- `POST /api/pivot/run`
  - body:
    - `rows: string[]`
    - `columns: string[]` (currently expects time column like `snapshot_time`)
    - `measures: ["quantity" | "quantity_sold" | "avg_price" | "estimated_sales"]`
    - `filters: { sitemap_uid: string }`

Authentication endpoints:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

All non-auth `/api/*` routes now require a Bearer token.

### Services

- `services/scraper.service.js`
  - starts WebScraper job,
  - polls job status,
  - downloads JSONL output and parses rows.
- `services/ingestion.service.js`
  - opens transaction,
  - upserts daily snapshot (`ON CONFLICT (sitemap_id, snapshot_date)`),
  - clears prior rows for idempotent re-ingestion,
  - stores raw payload + normalized facts + dynamic dimensions,
  - finalizes row count and job status.
- `services/normalization.service.js`
  - normalizes row fields,
  - parses numeric values,
  - computes stable row hash identity.
- `services/pivotSqlBuilder.service.js`
  - validates dimensions/measures,
  - builds SQL with `LAG`-based `quantity_sold` and `estimated_sales`.
- `services/pivotResult.service.js`
  - shapes SQL rows into frontend pivot format:
    - `columns`
    - `rows[].values`
    - `rows[].totals`
    - `columnTotals`

### Scheduled Jobs

- Poll job: every 2 minutes (`*/2 * * * *`) to process running scraper jobs.
- Weekly auto-scrape: Sunday 2:00 AM (`0 2 * * 0`) for enabled sitemaps that were never scraped or not scraped in last 7 days.

## Frontend

### Pages

- `Scraper` page:
  - accepts sitemap UID,
  - triggers scrape,
  - polls job status every 3 seconds,
  - supports skipped-today flow.
- `Dashboard` page:
  - loads available dimensions,
  - lets user drag/drop rows, columns, values,
  - reruns pivot query on builder changes,
  - renders table with totals and CSV export.

### API Base URL

- `frontend/src/config/api.ts`:
  - uses `VITE_API_BASE_URL`,
  - fallback: `http://localhost:3000/api`.

## Database

The schema contains entities for sitemaps, jobs, snapshots, facts, dimensions, products, and optional reporting tables.

Primary tables used by runtime code:

- `sitemaps`
- `scrape_jobs`
- `snapshots` (with unique daily snapshot behavior per sitemap)
- `products`
- `raw_scrape_data`
- `snapshot_facts`
- `snapshot_dimensions`

Additional tables in dump:

- `pivot_definitions`
- `saved_reports`

## Local Setup

### Prerequisites

- Node.js 18+ (recommended)
- PostgreSQL 14+ (or compatible)
- WebScraper.io API token

### 1) Database

`database/scraper_db.sql` is a custom-format dump, so restore with `pg_restore` (not plain `psql -f`):

```bash
createdb scraper_analytics
pg_restore -d scraper_analytics database/scraper_db.sql
psql -d scraper_analytics -f database/auth_setup.sql
```

Default login seeded by `auth_setup.sql`:

- email: `admin@scrapelytics.local`
- password: `Admin@123`

### 2) Backend

Create `backend/.env` (example values, do not commit real secrets):

```env
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/scraper_analytics
WEBSCRAPER_TOKEN=<your_webscraper_token>
SCRAPER_BASE_URL=https://api.webscraper.io/api/
WEBSCRAPER_NOTIFICATION_TOKEN=<optional>
SESSION_TTL_HOURS=12
```

Install and run:

```bash
cd backend
npm install
npm run dev
```

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL is Vite local server (typically `http://localhost:5173`).

## Operational Notes

- The backend skips duplicate scrapes on the same day for the same sitemap.
- Ingestion is designed to be idempotent for a given daily snapshot.
- Dynamic dimensions are stored in `snapshot_dimensions` and pivotable.
- Pivot SQL currently requires a `sitemap_id` filter internally (resolved from `sitemap_uid`).
- Cron jobs are loaded automatically when backend app starts.

## Known Gaps / Risks

- No automated tests are currently configured (`backend` test script is placeholder).
- CORS is currently hardcoded to `http://localhost:5173`.
- `database/scraper_db.sql` is binary dump content; schema diffs are not human-friendly in Git.
