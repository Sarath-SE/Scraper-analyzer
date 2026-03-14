# Scraper Analyzer

Scraper Analyzer is a full-stack web scraping analytics application built around three layers:

1. A `Node.js + Express` backend that triggers WebScraper jobs, stores normalized snapshots in PostgreSQL, and serves analytics APIs.
2. A `React + Vite + TypeScript` frontend that provides login, scrape triggering, and an interactive pivot dashboard.
3. A `PostgreSQL` database that stores raw scrape payloads, normalized facts, dynamic dimensions, users, sessions, and scrape job history.

The current UI brand shown in the app is `ScrapeLytics`.

## What The Application Does

This application is designed for teams that want to:

- trigger a scrape for a WebScraper sitemap UID,
- avoid duplicate same-day scrapes,
- ingest raw scraper output into PostgreSQL,
- normalize product data into analytics-friendly tables,
- compare quantity, average price, quantity sold, and estimated sales over time,
- explore data with a drag-and-drop pivot-style dashboard,
- optionally enable weekly auto-scraping for selected sitemaps.

## High-Level Architecture

```text
Frontend (React/Vite)
    |
    | HTTP + Bearer token
    v
Backend (Express API)
    |
    | PostgreSQL queries
    v
Database
    |
    | WebScraper API
    v
External scraping provider
```

## Core Features

- Email/password login backed by PostgreSQL user and session tables.
- Bearer-token session validation on all protected `/api` routes.
- Manual scrape trigger by `sitemap_uid`.
- Automatic deduplication when the same sitemap was already scraped on the current day.
- Background polling job to sync remote scraper status and ingest finished jobs.
- Weekly auto-scrape job for enabled sitemaps.
- Raw payload storage for traceability.
- Normalized facts and dynamic dimensions for analytics.
- Pivot dashboard with sitemap filter, month filter, drag-and-drop rows/columns/measures, and guided tour.

## Tech Stack

### Backend

- Node.js
- Express 5
- PostgreSQL (`pg`)
- `@webscraperio/api-client-nodejs`
- `axios`
- `node-cron`

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- react-joyride

### Database

- PostgreSQL
- `pgcrypto` extension for password hashing in SQL auth bootstrap

## Repository Structure

```text
backend/      Express API, jobs, controllers, services
frontend/     React client
database/     SQL bootstrap files
README.md     Root documentation
```

## End-To-End Working Flow

### 1. User authentication

1. User opens the frontend.
2. If no token exists, the login page is shown.
3. The frontend posts credentials to `POST /api/auth/login`.
4. Backend validates the user from `app_users` using `crypt(password, password_digest)`.
5. Backend creates a session row in `auth_sessions` with a hashed token and expiry.
6. Frontend stores the returned token and user object in `localStorage`.
7. Protected API calls send `Authorization: Bearer <token>`.

### 2. Manual scrape flow

1. User enters a `sitemap_uid` on the scraper page.
2. Backend upserts the sitemap into `sitemaps`.
3. Backend checks `snapshots` for an existing row for that sitemap on `CURRENT_DATE`.
4. If already scraped today, the backend returns `status: skipped`.
5. Otherwise a row is created in `scrape_jobs` with `status = requested`.
6. Backend triggers a remote WebScraper job.
7. Backend updates the local scrape job to `status = running` and stores the remote scraper job id.
8. Frontend polls `GET /api/scrapes/status/:jobId` every 3 seconds.

### 3. Job polling and ingestion flow

1. A backend cron job runs every minute.
2. It checks local `scrape_jobs` with status `running` or `ingesting`.
3. When a remote WebScraper job finishes, the backend locks the local job into `ingesting`.
4. The ingestion service creates or updates one daily snapshot for that sitemap.
5. Existing rows for that snapshot are deleted first so re-ingestion is idempotent.
6. Raw JSON lines are downloaded from WebScraper.
7. Duplicate rows inside the same payload are skipped using a row hash.
8. Raw rows are stored in `raw_scrape_data`.
9. Each product is resolved into `products`.
10. Normalized facts are inserted into `snapshot_facts`.
11. Remaining dynamic attributes are inserted into `snapshot_dimensions`.
12. Snapshot row count is updated.
13. Local scrape job is marked `finished`.

### 4. Dashboard analytics flow

1. Dashboard fetches available sitemaps from `GET /api/sitemaps`.
2. Dashboard fetches available pivot dimensions from `GET /api/pivot/dimensions`.
3. User selects rows, columns, measures, and optional month filter.
4. Frontend sends a pivot request to `POST /api/pivot/run`.
5. Backend validates dimensions and measures, builds SQL dynamically, and queries PostgreSQL.
6. Backend returns a pivot-shaped response with columns, rows, and totals.
7. Frontend renders the interactive pivot table.

### 5. Weekly auto-scrape flow

1. User enables auto-scrape for one or more sitemaps.
2. A backend cron job runs every Sunday at `2:00 AM` server time.
3. The job finds enabled sitemaps that were never scraped or not scraped within the last 7 days.
4. It creates local scrape jobs and triggers remote scraper jobs.
5. Normal polling and ingestion then complete the process.

## Main Database Concepts

The app relies on a schema centered around these logical groups:

- `app_users`, `auth_sessions`: authentication and sessions
- `sitemaps`: registered scraper definitions
- `scrape_jobs`: manual and automatic scrape tracking
- `snapshots`: one analytical snapshot per sitemap per day
- `raw_scrape_data`: original payload archive
- `products`: stable product identity per sitemap
- `snapshot_facts`: normalized measures and core dimensions
- `snapshot_dimensions`: flexible dynamic attributes for pivoting

## Required Environment Variables

### Backend `.env`

Create `backend/.env` with values similar to:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/scraper_analytics
WEBSCRAPER_TOKEN=your_webscraper_token
SCRAPER_BASE_URL=https://api.webscraper.io
SESSION_TTL_HOURS=12
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

Notes:

- `CORS_ORIGIN` can be a comma-separated list.
- If `CORS_ORIGIN` is empty, the backend effectively allows all origins.
- `SCRAPER_BASE_URL` must match the remote scraper API base URL expected by the download endpoint.

### Frontend `.env`

Create `frontend/.env` with:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## Database Setup

There are two SQL bootstrap files you should care about:

- `database/scraper-analytics-db.sql`: main analytics schema/data dump
- `database/auth_setup.sql`: auth tables, indexes, and default admin seed

Optional helper:

- `database/auth_functions.sql`: reusable PostgreSQL functions to bootstrap auth tables and create/update users

### Local database bootstrap order

1. Create a PostgreSQL database, for example `scraper_analytics`.
2. Import the main schema dump.
3. Run the auth setup script.
4. Verify the default user was created.

Example:

```powershell
psql -U postgres -d scraper_analytics -f database/scraper-analytics-db.sql
psql -U postgres -d scraper_analytics -f database/auth_setup.sql
```

Default seeded login from the auth setup:

```text
Email: admin@scrapelytics.local
Password: Admin@123
```

Change this immediately outside local development.

## Local Development Setup

### 1. Install dependencies

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

### 2. Start backend

```powershell
cd backend
npm run dev
```

Backend runs on `http://localhost:3000` by default.

### 3. Start frontend

```powershell
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173` by default.

### 4. Open the app

Open the frontend URL in a browser, sign in, then use the scraper and dashboard screens.

## Production Run Flow

Typical production request lifecycle:

1. Frontend is served as static assets behind Nginx, Apache, or a CDN.
2. Backend runs as a long-lived Node.js process or container.
3. Backend connects to PostgreSQL using `DATABASE_URL`.
4. Background cron jobs start automatically when the backend process boots.
5. Users authenticate and interact with the API through the frontend.
6. Remote scraper jobs continue asynchronously even after the initial request finishes.
7. Backend polling finalizes ingestion and makes data available in the dashboard.

Important operational note:

- If you run multiple backend instances, each instance will start the same cron jobs unless you add leader election or external scheduling. Without that, duplicate polling and duplicate weekly job execution are possible.

## API Summary

### Public routes

- `POST /api/auth/login`

### Authenticated routes

- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/scrapes/trigger`
- `GET /api/scrapes/status/:jobId`
- `GET /api/sitemaps`
- `POST /api/auto-scrape/enable`
- `POST /api/auto-scrape/disable`
- `POST /api/auto-scrape/bulk-enable`
- `GET /api/auto-scrape/status`
- `GET /api/pivot/dimensions`
- `POST /api/pivot/run`

### Health check

- `GET /health`

## Advantages

- Clear separation between scrape orchestration, ingestion, and analytics.
- Raw data plus normalized data are both preserved, which helps debugging and auditing.
- Same-day deduplication reduces unnecessary scrape cost and duplicate snapshots.
- Dynamic dimension model makes the dashboard adaptable to changing scraper fields.
- Background polling decouples user requests from long-running scrape completion.
- Pivot interface gives non-technical users a usable analysis workflow.

## Disadvantages And Current Limitations

- No automated tests are present in the repository.
- Backend cron jobs are process-local and not safe for naive horizontal scaling.
- Dynamic SQL is validated but still increases complexity and operational risk.
- Authentication is session-token based but not role-enforced beyond storing the role value.
- The app depends on an external scraping provider, so failures there directly affect ingestion.
- Frontend navigation and session handling rely on `localStorage`, which is simple but not the strongest security model.
- The main database schema is stored as a large SQL dump, which is harder to maintain than versioned migrations.
- Logging is console-based and not structured for production observability.

## Vulnerabilities And Live Hosting Risks

These are the main areas to review before going live.

### 1. Default admin credentials

`database/auth_setup.sql` seeds a predictable admin account:

- `admin@scrapelytics.local`
- `Admin@123`

If this script is run unchanged in production, the system is immediately exposed.

### 2. Auth token stored in `localStorage`

The frontend stores the bearer token in browser `localStorage`.

Risk:

- any successful XSS can steal the token and impersonate the user until expiry or logout.

Safer direction:

- move sessions to secure, `HttpOnly`, `SameSite` cookies if the architecture allows it.

### 3. No rate limiting on auth or API routes

There is no request throttling or brute-force protection.

Risk:

- login brute-force,
- API abuse,
- unnecessary database load,
- scraper job spam.

### 4. Broad CORS behavior when not configured

If `CORS_ORIGIN` is empty, the backend effectively accepts all origins.

Risk:

- unintended browser clients can call the API if they possess a valid token.

### 5. Missing authorization boundaries

The code authenticates users, but does not enforce role-based authorization on routes.

Risk:

- any authenticated user can trigger scrapes, run analytics, and manage auto-scrape behavior.

### 6. No explicit input throttling for scrape triggers

Users can trigger scrapes by sending `sitemap_uid`.

Risk:

- excessive external API usage,
- cost spikes,
- queue congestion,
- accidental repeated job creation for many different sitemaps.

### 7. Background jobs can duplicate in multi-instance deployments

Each backend process starts:

- minute polling,
- weekly auto-scrape scheduler.

Risk:

- duplicated cron execution,
- duplicate remote jobs,
- race conditions,
- inconsistent job state updates.

### 8. Sensitive secrets are environment-dependent

Production safety depends heavily on protecting:

- `DATABASE_URL`
- `WEBSCRAPER_TOKEN`
- session configuration

Risk:

- secret leakage through logs, bad CI/CD handling, or weak server access control compromises the system quickly.

### 9. Large raw payload retention

Raw scraped rows are stored in the database.

Risk:

- storage growth,
- slower backups,
- longer restore time,
- potential retention of sensitive or unexpected scraped content.

### 10. Limited audit and monitoring coverage

The current app uses `console.log` and `console.error`.

Risk:

- weak incident visibility,
- harder forensic analysis,
- slower production debugging.

## Hardening Recommendations Before Production

Minimum recommended improvements:

1. Remove seeded default credentials and create admins through a secure bootstrap path.
2. Add rate limiting for login and scrape-trigger routes.
3. Restrict CORS explicitly to known frontend origins.
4. Move auth tokens out of `localStorage` if possible.
5. Add route-level authorization for admin-only operations like auto-scrape management.
6. Add centralized logging, metrics, and alerting.
7. Add job coordination for cron execution in multi-instance deployments.
8. Add database migrations instead of relying only on a dump file.
9. Add validation and quotas around sitemap triggering.
10. Review data retention policy for raw payload tables.

## Suggested Production Deployment Pattern

Recommended shape:

- frontend static build behind Nginx/CDN,
- backend container or process manager such as PM2/systemd,
- managed PostgreSQL,
- secrets injected from a secret manager,
- reverse proxy with TLS termination,
- one scheduler instance only, or move cron execution to an external scheduler,
- central logging and uptime monitoring.

## Build Commands

### Frontend production build

```powershell
cd frontend
npm run build
```

### Backend production start

```powershell
cd backend
npm start
```

## Known Gaps

- No root-level automated setup script.
- No Docker configuration in the repository.
- No `.env.example` files.
- No test suite.
- No migration framework.

## Troubleshooting

### Login fails

- Confirm `app_users` exists.
- Confirm `pgcrypto` extension is enabled.
- Confirm the seeded or created user has a valid `password_digest`.

### Scrape trigger fails

- Check `WEBSCRAPER_TOKEN`.
- Check `SCRAPER_BASE_URL`.
- Confirm the `sitemap_uid` exists in the external scraper system.

### Dashboard shows no data

- Confirm a scrape finished successfully.
- Confirm `snapshots`, `snapshot_facts`, and `snapshot_dimensions` contain rows.
- Confirm the selected sitemap has at least one snapshot.

### Session expires unexpectedly

- Check `SESSION_TTL_HOURS`.
- Confirm server time is correct.
- Confirm the stored bearer token matches a non-revoked row in `auth_sessions`.

## Summary

This repository already contains the core workflow for authenticated scraping, ingestion, and pivot analytics. It is suitable for local development and controlled internal use, but it should be hardened before public internet exposure or multi-instance hosting.
