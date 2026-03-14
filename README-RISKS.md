# Scraper Analyzer: Live Risk And Vulnerability Guide

This document focuses only on the risks, vulnerabilities, and operational issues the application may face when exposed on a live server or public/private production network.

It is based on the current repository implementation in:

- `backend/`
- `frontend/`
- `database/`

## Scope

This guide covers:

- security risks,
- infrastructure risks,
- data risks,
- operational risks,
- scaling risks,
- business-impact risks,
- recommended mitigations.

## Executive Summary

The application is functional for local and controlled internal use, but it is not yet hardened for internet-facing production deployment.

The highest-risk areas today are:

1. predictable seeded admin credentials,
2. bearer token storage in `localStorage`,
3. no rate limiting,
4. missing role-based authorization,
5. duplicate cron execution in multi-instance hosting,
6. unrestricted or weakly configured CORS behavior,
7. dependency on an external scraping provider,
8. lack of production-grade monitoring, audit logging, and migration discipline.

## Risk Categories

### 1. Authentication Risks

#### 1.1 Default admin credentials

Current state:

- `database/auth_setup.sql` seeds:
  - `admin@scrapelytics.local`
  - `Admin@123`

Risk:

- If deployed unchanged, anyone who knows or guesses the default credentials can access the application immediately.

Impact:

- full account compromise,
- scrape abuse,
- analytics access,
- auto-scrape manipulation.

Severity:

- Critical

Mitigation:

- remove seeded production credentials,
- create the first admin through a secure bootstrap process,
- enforce strong password rules,
- rotate all seeded credentials before go-live.

#### 1.2 Session token stored in browser `localStorage`

Current state:

- frontend stores auth token and user object in `localStorage`.

Risk:

- if any XSS occurs, the token can be stolen and reused.

Impact:

- account takeover until token expiry or revocation.

Severity:

- High

Mitigation:

- prefer `HttpOnly`, `Secure`, `SameSite` cookies,
- add a strict Content Security Policy,
- reduce session TTL,
- add session revocation and anomaly monitoring.

#### 1.3 No brute-force protection

Current state:

- no login attempt throttling or lockout.

Risk:

- attackers can automate password guessing.

Impact:

- account compromise,
- noisy logs,
- database load.

Severity:

- High

Mitigation:

- add IP and account-based rate limiting,
- add temporary lockout or backoff,
- log suspicious login activity.

### 2. Authorization Risks

#### 2.1 No role-based route enforcement

Current state:

- users have a `role`, but routes do not enforce role-based access.

Risk:

- any authenticated user can trigger scrapes, inspect analytics, and manage auto-scrape settings.

Impact:

- privilege misuse,
- accidental or malicious operational changes.

Severity:

- High

Mitigation:

- define access rules for each route,
- enforce admin-only actions server-side,
- audit privileged changes.

### 3. API And Web Security Risks

#### 3.1 Broad CORS fallback

Current state:

- if `CORS_ORIGIN` is not configured, the backend accepts all origins.

Risk:

- unintended browser-based clients can call the API if they obtain a valid token.

Impact:

- wider attack surface,
- token misuse from unapproved frontends.

Severity:

- Medium to High

Mitigation:

- explicitly set allowed origins in every environment,
- fail closed when CORS config is missing in production.

#### 3.2 No rate limiting on scrape endpoints

Current state:

- scrape trigger routes have no request throttling.

Risk:

- excessive job creation,
- external API quota exhaustion,
- cost spikes,
- denial of service through workload amplification.

Impact:

- degraded service,
- billing issues,
- queue congestion.

Severity:

- High

Mitigation:

- rate limit by user and IP,
- add per-user daily quotas,
- add validation for allowed sitemap ids.

#### 3.3 Potential XSS impact is amplified by token storage

Current state:

- the UI renders application data and stores tokens in browser storage.

Risk:

- even a small XSS issue becomes more serious because token theft becomes possible.

Impact:

- persistent session hijack during token lifetime.

Severity:

- High

Mitigation:

- sanitize all untrusted content,
- use a CSP,
- move auth out of `localStorage`,
- review rendering of scraped values carefully.

### 4. Background Job And Scheduler Risks

#### 4.1 Duplicate cron execution in scaled backend deployments

Current state:

- cron jobs start automatically when each backend process starts.

Affected jobs:

- scrape polling job,
- weekly auto-scrape job.

Risk:

- multiple app instances may run the same cron tasks.

Impact:

- duplicate remote scrape creation,
- race conditions during ingestion,
- inconsistent job updates,
- unexpected scraper costs.

Severity:

- Critical in multi-instance production

Mitigation:

- run schedulers on one dedicated worker only,
- use leader election,
- or move scheduling to an external scheduler/queue system.

#### 4.2 Job lifecycle is tied to backend health

Current state:

- ingestion and polling rely on the Node process being alive and healthy.

Risk:

- if the backend crashes or restarts frequently, jobs may remain stale for longer than expected.

Impact:

- delayed analytics availability,
- stale job states,
- support confusion.

Severity:

- Medium

Mitigation:

- add resilient background workers,
- add retry/reconciliation jobs,
- add health alerts for stuck `running` or `ingesting` jobs.

### 5. External Dependency Risks

#### 5.1 Reliance on WebScraper API availability

Current state:

- scraping depends on a remote WebScraper service and token.

Risk:

- third-party downtime, latency, API changes, or quota limits block ingestion.

Impact:

- scrape failures,
- delayed reporting,
- operational incidents outside your direct control.

Severity:

- High

Mitigation:

- add retries with backoff where appropriate,
- monitor upstream failure rates,
- document degraded-mode behavior,
- plan quota management.

#### 5.2 Upstream schema drift

Current state:

- the app expects scraped fields like manufacturer, part number, quantity, price, and dynamic dimensions.

Risk:

- if the external scraper output format changes, normalization may degrade silently or partially.

Impact:

- inaccurate analytics,
- missing dimensions,
- broken trend calculations.

Severity:

- High

Mitigation:

- validate required fields during ingestion,
- alert on unexpected field changes,
- version scraper mappings.

### 6. Data Integrity Risks

#### 6.1 Dynamic dimension model can carry inconsistent keys

Current state:

- dynamic attributes are normalized into snake_case dimension keys.

Risk:

- slightly different upstream labels can create multiple semantically similar dimensions.

Examples:

- `part-number`
- `part number`
- `Part Number`

Impact:

- fragmented analytics,
- confusing dashboard fields,
- inconsistent reporting.

Severity:

- Medium

Mitigation:

- maintain a canonical dimension mapping layer,
- review new dimension keys,
- add field aliasing rules.

#### 6.2 Raw payload retention increases storage and compliance risk

Current state:

- all raw scrape rows are stored in `raw_scrape_data`.

Risk:

- database growth,
- backup inflation,
- retention of sensitive or unnecessary data.

Impact:

- higher storage cost,
- slower restore operations,
- compliance review issues.

Severity:

- Medium to High

Mitigation:

- define retention windows,
- archive or purge old raw data,
- classify what may be scraped and stored.

#### 6.3 Derived sales metrics may be misleading

Current state:

- `quantity_sold` and `estimated_sales` are inferred from quantity deltas over time.

Risk:

- stock changes may not equal sales.

Impact:

- business users may treat estimates as exact revenue.

Severity:

- Medium

Mitigation:

- label inferred metrics clearly,
- document calculation assumptions,
- avoid positioning them as authoritative sales data.

### 7. Database And Infrastructure Risks

#### 7.1 Large SQL dump instead of migrations

Current state:

- schema is managed through a large SQL dump file and separate auth SQL.

Risk:

- difficult change tracking,
- inconsistent environments,
- risky manual updates.

Impact:

- deployment errors,
- schema drift,
- rollback difficulty.

Severity:

- Medium

Mitigation:

- adopt versioned migrations,
- add environment promotion discipline,
- validate schema state in CI/CD.

#### 7.2 Secrets exposure risk

Sensitive values:

- `DATABASE_URL`
- `WEBSCRAPER_TOKEN`
- frontend/backed endpoint configuration

Risk:

- leaked secrets can expose database access or scraping provider access.

Impact:

- data compromise,
- cost abuse,
- operational takeover.

Severity:

- Critical

Mitigation:

- use a secret manager,
- avoid committing `.env` files,
- rotate credentials,
- limit DB network access.

#### 7.3 No explicit backup and recovery strategy in repo

Current state:

- repository does not define backup, restore, or disaster-recovery procedures.

Risk:

- production recovery may be slow or incomplete after data loss.

Impact:

- downtime,
- lost historical analytics,
- operational disruption.

Severity:

- High

Mitigation:

- define backup frequency,
- test restores regularly,
- document RPO and RTO targets.

### 8. Observability And Incident Response Risks

#### 8.1 Limited logging

Current state:

- mostly `console.log` and `console.error`.

Risk:

- insufficient production diagnostics and poor correlation across events.

Impact:

- slower debugging,
- weak auditability,
- difficult incident triage.

Severity:

- Medium

Mitigation:

- add structured logs,
- include request ids and job ids,
- centralize logs in a monitoring platform.

#### 8.2 No metrics or alerting in repo

Current state:

- no built-in metrics, no dashboards, no alerts.

Risk:

- failures may be discovered late.

Impact:

- longer outages,
- unnoticed scrape failures,
- stale analytics.

Severity:

- High

Mitigation:

- add uptime checks,
- track scrape success/failure rates,
- alert on stuck jobs, login spikes, and DB errors.

### 9. Availability And Performance Risks

#### 9.1 Dynamic pivot queries may become expensive

Current state:

- pivot SQL is assembled dynamically and can scan significant historical data.

Risk:

- large datasets can increase response time and DB load.

Impact:

- slow dashboard performance,
- timeouts,
- degraded user experience.

Severity:

- Medium to High

Mitigation:

- add indexes aligned to query patterns,
- limit query ranges,
- consider pre-aggregation or materialized views for heavy workloads.

#### 9.2 Application has no visible queueing or workload isolation

Current state:

- scrape orchestration, polling, ingestion, and API serving happen under the same backend service boundary.

Risk:

- heavy ingestion periods can affect API responsiveness.

Impact:

- slow user requests,
- unstable dashboard experience during busy scrape windows.

Severity:

- Medium

Mitigation:

- separate API and worker roles,
- move long-running tasks to a queue-backed worker model.

## Attack Scenarios

### Scenario 1: Default admin takeover

1. Production is deployed with seeded admin credentials unchanged.
2. An attacker logs in with known defaults.
3. They trigger scrapes repeatedly or change auto-scrape settings.
4. External scraping costs and data exposure increase.

### Scenario 2: Token theft through XSS

1. A frontend XSS issue appears through an unsafe rendering path.
2. The attacker reads `localStorage`.
3. The bearer token is exfiltrated.
4. The attacker reuses it from another environment.

### Scenario 3: Cost abuse through scrape spam

1. A valid user account is compromised or abused.
2. The attacker repeatedly calls scrape trigger endpoints.
3. Remote jobs accumulate.
4. Quota, billing, and backend workload spike.

### Scenario 4: Multi-instance cron duplication

1. The app is scaled to multiple backend instances.
2. Every instance runs weekly auto-scrape.
3. The same sitemaps are triggered multiple times.
4. Duplicate jobs and inconsistent states appear.

## Risk Prioritization

### Immediate before production

- remove default admin credentials,
- add rate limiting,
- enforce CORS strictly,
- add authorization rules,
- solve multi-instance cron duplication,
- protect tokens better than `localStorage` if possible,
- secure and rotate secrets.

### Short-term after first deployment

- add structured logging,
- add alerting and job monitoring,
- add migration tooling,
- add retention policy for raw payloads,
- add query performance review for pivot endpoints.

### Medium-term maturity work

- move to worker queues,
- implement RBAC fully,
- add audit logs,
- add test coverage,
- add security review for all user-rendered content and scraped values.

## Recommended Production Controls Checklist

- TLS enabled end to end
- reverse proxy configured
- strict CORS origins configured
- secret manager used
- no default credentials
- admin password rotated
- login rate limiting enabled
- scrape trigger quotas enabled
- RBAC enforced
- security headers enabled
- CSP configured
- centralized logging enabled
- uptime and error alerts enabled
- DB backups verified
- one scheduler instance only
- restore procedure tested

## Final Assessment

The application can be hosted live, but not safely in its current form without production hardening.

The biggest live risks are not obscure edge cases. They are straightforward and actionable:

- predictable credentials,
- token exposure model,
- missing rate limiting,
- missing authorization enforcement,
- scheduler duplication in scaled deployments,
- weak operational controls.

If those are addressed first, the application becomes much safer to operate in a production setting.
