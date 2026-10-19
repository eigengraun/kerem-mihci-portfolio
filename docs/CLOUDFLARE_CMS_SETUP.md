# Cloudflare D1, R2 & Worker CMS Setup Guide

## Overview
The Portfolio OS CMS is powered by a normalized SQLite schema (`cloudflare/portfolio-api/migrations/0001_initial_schema.sql`), an R2 media bucket (`PORTFOLIO_MEDIA`) for project assets, and a Cloudflare Worker API (`cloudflare/portfolio-api/src/index.ts`), paired with an explicit storage mode controller (`CMS_STORAGE_MODE` and `CMS_DATA_SOURCE` in `src/lib/portfolio/repository.ts`).

---

## 1. Storage Modes & Fail-Closed Production Behavior

| Variable | Values | Purpose |
| :--- | :--- | :--- |
| `CMS_STORAGE_MODE` | `local` \| `staging` \| `production` | Controls whether local simulation (`.local-d1/portfolio.sqlite` and `.local-r2/`) is permitted (`local` only) or strictly blocked (`staging` and `production`). In `staging` and `production`, admin mutations fail closed with HTTP `503` (`CmsStorageUnavailableError`) if the Cloudflare Worker is unconfigured or unreachable. |
| `CMS_DATA_SOURCE` | `legacy` \| `cloudflare` | Controls the public portfolio read path. When `legacy`, public routes serve `src/data/projects.ts` until cutover. When `cloudflare`, public routes serve published records from Cloudflare D1 (`PORTFOLIO_DB`) and retain an in-memory `lastKnownPublishedSnapshot` so a transient Worker network blip after cutover never revives archived/unpublished projects from static files and never exposes drafts. |

---

## 2. Canonical 30-Project Migration & Reconciliation

The canonical `src/data/projects.ts` on `main` contains **30 project case studies**:
- **Design Workspace (`design`)**: `18` projects (`4` featured)
- **Web Workspace (`web`)**: `12` projects (`6` featured)
- **Production / Motion-AI Workspace (`motion-ai`)**: `0` project records *(the 21-item video library in `src/data/videos.ts` is an independent Portfolio OS subsystem for Reels and the Videos app and is intentionally kept separate from project case studies)*.

To run the migration from a clean local database and verify idempotency and 100% field-level reconciliation across all 30 projects (and optionally seed a running Cloudflare Worker when `CLOUDFLARE_CMS_API_URL` and `CLOUDFLARE_API_SERVICE_TOKEN` are set):

```bash
node scripts/migrate-d1.mjs --clean
npm run cms:migrate
```

Expected reconciliation summary:
- `canonicalCount`: `30`
- `totalProjects`: `30` (`design: 18`, `web: 12`, `motion-ai: 0`)
- `totalTranslations`: `60` (`30` TR + `30` EN)
- `featuredCount`: `10` (`6` web + `4` design)
- `totalMediaItems`: `70`
- `fieldDiffCount`: `0`
- `reconciled`: `true`

---

## 3. Local Cloudflare Worker Runtime (`wrangler dev --local`)

You can run the real Cloudflare Worker locally with Wrangler's D1 (`PORTFOLIO_DB`) and R2 (`PORTFOLIO_MEDIA`) bindings:

```bash
cd cloudflare/portfolio-api
npx wrangler d1 migrations apply kerem-portfolio-db --local
npx wrangler dev --local --port 8787 --var CLOUDFLARE_API_SERVICE_TOKEN:your-local-service-token
```

Then seed the Worker's D1 database:

```bash
CLOUDFLARE_CMS_API_URL=http://127.0.0.1:8787 \
CLOUDFLARE_API_SERVICE_TOKEN=your-local-service-token \
npm run cms:migrate
```

---

---

## 4. Cloudflare Environments: Staging & Production

### Staging Environment (Active & Verified)
| Resource | Staging Name / ID | Purpose |
| :--- | :--- | :--- |
| **Worker API** | `kerem-mihci-portfolio-api-staging` (`https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`) | Isolated staging API with rate limiting, session auth, and project CRUD |
| **D1 Database** | `kerem-portfolio-db-staging` (`0efef7a7-cc93-4dc2-8cb7-db28379fe01f`) | Staging database containing the 30 canonical projects |
| **R2 Bucket** | `kerem-portfolio-media-staging` | Isolated staging bucket for project assets |

Deploy to staging:
```bash
cd cloudflare/portfolio-api
npx wrangler deploy --env staging
```

### Production Resource Specification
| Resource | Canonical Production Name | Purpose |
| :--- | :--- | :--- |
| **Worker API** | `kerem-mihci-portfolio-api` | Production Cloudflare Worker API |
| **D1 Database** | `kerem-portfolio-db` | Production D1 SQLite database |
| **R2 Bucket** | `kerem-portfolio-media` | Production R2 asset storage |

Deploy to production (after explicit cutover approval):
```bash
cd cloudflare/portfolio-api
npx wrangler d1 create kerem-portfolio-db
npx wrangler d1 migrations apply kerem-portfolio-db --remote
npx wrangler r2 bucket create kerem-portfolio-media
npx wrangler secret put CLOUDFLARE_API_SERVICE_TOKEN --env production
npx wrangler deploy --env production
```

---

## 5. Zero-Destructive Runtime DDL Architecture

> [!IMPORTANT]
> The Cloudflare Worker API runtime enforces **Zero Destructive Runtime DDL**. Endpoints `/api/v1/admin/auth/sessions` and `/api/v1/admin/auth/rate-limit` execute zero `DROP TABLE` or runtime `CREATE TABLE` commands.
> If the database is missing a table or is temporarily unreachable, endpoints fail closed with HTTP `503` (`Database session/rate-limit store temporarily unavailable`), ensuring existing session records and audit logs can never be dropped or recreated during transient outages.
> All schema modifications must occur strictly through deterministic, versioned migration files in `cloudflare/portfolio-api/migrations/`.

---

## 6. Hostinger Production Environment Variables (Post-Cutover)
```env
CMS_STORAGE_MODE=production
CMS_DATA_SOURCE=cloudflare
CLOUDFLARE_CMS_API_URL=https://kerem-mihci-portfolio-api.<your-subdomain>.workers.dev
CLOUDFLARE_API_SERVICE_TOKEN=<your-production-service-token>
ADMIN_SESSION_SECRET=<minimum-32-character-random-secret>
ADMIN_ALLOWED_EMAILS=kerem@keremmihci.com
ADMIN_PASSWORD_HASH=scrypt:<salt-hex>:<64-byte-derived-key-hex>
```
