# Cloudflare CMS Remote Staging Readiness Plan

> [!IMPORTANT]
> **No remote Cloudflare resources have been created or modified.** All changes remain isolated on `feature/cloudflare-cms-dashboard`. Remote staging provisioning requires explicit user approval and verified account credentials.

## 1. Staging Configuration in `cloudflare/portfolio-api/wrangler.jsonc`

- **Staging Worker Name**: `kerem-mihci-portfolio-api-staging`
- **Deployment Target**: `workers_dev: true` (deploys to `https://kerem-mihci-portfolio-api-staging.<account-subdomain>.workers.dev`; **no** custom DNS subdomain on `keremmihci.com` is assumed or required).
- **Staging D1 Binding**: `PORTFOLIO_DB` -> `kerem-portfolio-db-staging` (`database_id` placeholder `REPLACE_WITH_STAGING_D1_DATABASE_ID` to be populated after `wrangler d1 create`).
- **Staging R2 Binding**: `PORTFOLIO_MEDIA` -> `kerem-portfolio-media-staging`.
- **Staging Environment Variables (`vars`)**:
  - `ENVIRONMENT`: `"staging"`
  - `PUBLIC_SITE_ORIGIN`: `"https://keremmihci.com"`
  - `R2_PUBLIC_BASE_URL`: `""` (serves media through Worker `/api/v1/public/media/:key` with draft isolation)
  - `ALLOW_CANONICAL_SEED`: `"true"` (automatically locks via `canonical_seed_locked` in `site_settings` after initial 30-project seed)

## 2. Exact Commands for User-Authorized Remote Staging Provisioning

Once you approve remote Cloudflare staging setup, run the following commands from `/Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/cloudflare/portfolio-api`:

```bash
# 1. Verify Cloudflare authentication
npx wrangler whoami

# 2. Create isolated staging D1 database (copy returned database_id into wrangler.jsonc env.staging.d1_databases[0].database_id)
npx wrangler d1 create kerem-portfolio-db-staging

# 3. Create isolated staging R2 bucket
npx wrangler r2 bucket create kerem-portfolio-media-staging

# 4. Apply D1 schema migration to remote staging D1
npx wrangler d1 migrations apply PORTFOLIO_DB --env staging --remote

# 5. Set the staging Worker service token secret
npx wrangler secret put CLOUDFLARE_API_SERVICE_TOKEN --env staging

# 6. Deploy the staging Worker to workers.dev
npx wrangler deploy --env staging
```

## 3. Exact Environment Variables Required for Hostinger / Next.js Staging Verification

Generate your `scrypt` admin password hash locally without storing plaintext passwords in any file:

```bash
node scripts/hash-admin-password.mjs "YourStrongAdminPasswordHere"
```

Then configure the following environment variables on the Next.js server:

```env
CMS_STORAGE_MODE=production
CLOUDFLARE_CMS_API_URL=https://kerem-mihci-portfolio-api-staging.<your-subdomain>.workers.dev
CLOUDFLARE_API_SERVICE_TOKEN=<same-32-byte-secret-configured-on-worker>
ADMIN_SESSION_SECRET=<32-byte-hex-hmac-secret>
ADMIN_PASSWORD_HASH=scrypt:<salt-hex>:<derived-key-hex>
ADMIN_ALLOWED_EMAILS=<your-verified-admin-email>
ADMIN_TRUSTED_ORIGINS=https://keremmihci.com
TRUSTED_PROXY_SHARED_SECRET=<optional-shared-secret-if-behind-trusted-reverse-proxy>
```

## 4. Initial Canonical 30-Project Staging Seed & Reconciliation Command

After deploying `kerem-mihci-portfolio-api-staging`:

```bash
CLOUDFLARE_CMS_API_URL="https://kerem-mihci-portfolio-api-staging.<your-subdomain>.workers.dev" \
CLOUDFLARE_API_SERVICE_TOKEN="<your-service-token>" \
node scripts/reconcile-and-generate-report.mjs --seed-worker
```

This command:
1. Verifies `GET /api/v1/public/health` on the staging Worker.
2. Verifies `POST /api/v1/admin/seed` rejects unauthenticated (`401`) and invalid-token (`401`) requests.
3. Seeds the 30 canonical projects and immediately locks `canonical_seed_locked = true` in `site_settings`.
4. Performs a 33-field-per-project reconciliation across `src/data/projects.ts`, local D1, and Worker D1.
