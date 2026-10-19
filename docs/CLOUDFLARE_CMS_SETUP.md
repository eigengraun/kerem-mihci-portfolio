# Cloudflare D1, R2 & Worker CMS Setup Guide

## Overview
The Portfolio OS CMS is powered by a normalized SQLite schema (`cloudflare/portfolio-api/migrations/0001_initial_schema.sql`), an R2 media bucket for project assets, and a Cloudflare Worker API (`cloudflare/portfolio-api/src/index.ts`), paired with a local SQLite D1 + R2 engine (`src/lib/portfolio/d1Engine.ts`) for zero-friction local development and Hostinger runtime persistence.

---

## 1. Local Development & Canonical Migration

Out of the box, the application automatically initializes `.local-d1/portfolio.sqlite` using Node 22's built-in `node:sqlite` (`DatabaseSync`), applies `0001_initial_schema.sql`, and seeds all 30 canonical projects from `src/data/projects.ts`.

To explicitly run the migration and verify idempotency & 30/30 canonical reconciliation:

```bash
npm run cms:migrate
```

Expected output:
- `canonicalCount`: `30`
- `totalProjects`: `30`
- `totalTranslations`: `60` (`30` TR + `30` EN)
- `featuredCount`: `10` (`6` web + `4` design)
- `reconciled`: `true`

---

## 2. Provisioning Live Cloudflare D1 & R2

When ready to connect live Cloudflare cloud resources:

### Step 1 — Authenticate Wrangler
```bash
cd cloudflare/portfolio-api
npx wrangler login
```

### Step 2 — Create the D1 Database
```bash
npx wrangler d1 create kerem-portfolio-db
```
Copy the returned `database_id` into `cloudflare/portfolio-api/wrangler.jsonc`.

### Step 3 — Apply the D1 Schema Migration
```bash
npm run d1:migrate:remote
```

### Step 4 — Create the R2 Media Bucket
```bash
npx wrangler r2 bucket create kerem-portfolio-media
```

### Step 5 — Configure the Worker Service Token Secret
Generate a strong random token (at least 32 characters) and register it with the Worker:
```bash
npx wrangler secret put CLOUDFLARE_API_SERVICE_TOKEN
```

### Step 6 — Deploy the Cloudflare Worker
```bash
npm run deploy
```

### Step 7 — Set Next.js Environment Variables on Hostinger
Add to your Hostinger environment configuration:
```env
CMS_DATA_SOURCE=d1
CLOUDFLARE_CMS_API_URL=https://kerem-mihci-portfolio-api.<your-subdomain>.workers.dev
CLOUDFLARE_API_SERVICE_TOKEN=<your-service-token>
R2_PUBLIC_BASE_URL=https://media.keremmihci.com
```
