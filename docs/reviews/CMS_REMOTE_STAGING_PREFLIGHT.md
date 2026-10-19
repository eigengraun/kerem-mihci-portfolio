# Cloudflare Remote Staging Preflight Review & Execution Plan
**Kerem Mıhçı Portfolio OS**

> [!IMPORTANT]
> **GATE STATUS: PENDING USER APPROVAL.**
> No remote Cloudflare resources have been created or modified. All commands, bindings, credentials, and infrastructure definitions have been verified locally. Remote provisioning requires explicit user authorization and interactive Cloudflare authentication (`npx wrangler login`).

---

## 1. Git State & Exact Commit Provenance

- **Local Working Root:** `/Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio`
- **Active Branch:** `feature/cloudflare-cms-dashboard`
- **Verified Commit SHA (`git rev-parse HEAD`):** `cf37bc4f4ad04213ce41b74ff7c23066fa428544`
- **Remote Origin Status:** Clean (`origin/feature/cloudflare-cms-dashboard` up to date with `cf37bc4`)
- **Production Status:** `main` untouched; Hostinger live deployment untouched.

---

## 2. Canonical Dataset & Provenance Confirmation

Based on machine-readable reconciliation data ([`docs/reviews/cms-reconciliation-verified.json`](file:///Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/docs/reviews/cms-reconciliation-verified.json)) verified against [`src/data/projects.ts`](file:///Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/src/data/projects.ts):

| Metric | Canonical Value | Verification Status |
|---|---|---|
| **Total Projects** | `30` | Verified across Source, Local SQLite, and Worker D1 |
| **Design Workspace** | `18` | Verified across all three datasets |
| **Web Workspace** | `12` | Verified across all three datasets |
| **Motion-AI Case Studies** | `0` | Verified across all three datasets |
| **Featured Projects** | `10` (`design: 4`, `web: 6`, `motion-ai: 0`) | Verified across all three datasets |
| **Gallery Media Items** | `70` | Verified across all three datasets |
| **Separate Video Library** | `21` videos in [`src/data/videos.ts`](file:///Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/src/data/videos.ts) | Verified independent from project database |

### Canonical Fling Arena Record
- **ID / Slug:** `fling-arena`
- **Workspace:** `design`
- **Client:** `KIXOGAMES`
- **Year:** `2026`
- **Featured:** `true` (`featuredOrder: 2`, `sortOrder: 15`)

*(Note: Any previous human-written narrative referencing Fling Arena in `web` or attributing videos to `projects.ts` was an informal report typo; canonical code and machine-readable data have always preserved `fling-arena` as `design` and the 21 videos in `src/data/videos.ts`.)*

---

## 3. Cloudflare Account & CLI Preflight

- **Installed Wrangler Version:** `4.151.2` (`npx wrangler --version`)
- **Authentication Status:** **Authenticated via OAuth** (`npx wrangler whoami`)
- **Account Name:** `Kerem.mihci@ogr.iuc.edu.tr's Account`
- **Account ID:** `9791a288e2e99e7f3403590480e3ad6f`
- **Authenticated Email:** `kerem.mihci@ogr.iuc.edu.tr`
- **Live Resource Preflight Checks:**
  - **D1 Databases (`npx wrangler d1 list`):** `[]` (0 databases exist; `kerem-portfolio-db-staging` is completely clear to create).
  - **Worker Deployments:** `code 10047: This Worker does not exist on your account` (`kerem-mihci-portfolio-api-staging` does not exist; clear to deploy).
  - **R2 Storage (`npx wrangler r2 bucket list`):** Returned `code 10042: Please enable R2 through the Cloudflare Dashboard.` (R2 has not yet been activated on this Cloudflare account in the Cloudflare web dashboard).

---

## 4. Staging Architecture & Resource Isolation

All staging resources are strictly isolated from production:

| Component | Target Staging Resource | Isolation Guarantee |
|---|---|---|
| **Worker API** | `kerem-mihci-portfolio-api-staging` | Deployed to `workers.dev` (`https://kerem-mihci-portfolio-api-staging.<subdomain>.workers.dev`). No custom domain, no DNS change on `keremmihci.com`. |
| **D1 Database** | `kerem-portfolio-db-staging` | Isolated database instance. Completely separated from local SQLite and any future production D1. |
| **R2 Storage** | `kerem-portfolio-media-staging` | Isolated bucket for staging test media. Existing production artwork remains served statically via Next.js public assets. |
| **Public Site** | `https://keremmihci.com` | Stays hosted on Hostinger serving static/canonical assets from `main`. Zero changes made to Hostinger. |

---

## 5. Configuration Review (`cloudflare/portfolio-api/wrangler.jsonc`)

- **Worker Name (Staging):** `kerem-mihci-portfolio-api-staging`
- **D1 Binding:** `PORTFOLIO_DB` -> `kerem-portfolio-db-staging` (`database_id: "REPLACE_WITH_STAGING_D1_DATABASE_ID"`)
- **R2 Binding:** `PORTFOLIO_MEDIA` -> `kerem-portfolio-media-staging`
- **Compatibility Date:** `2025-02-14` (`compatibility_flags: ["nodejs_compat"]`)
- **Staging Environment Variables (`vars`):**
  - `ENVIRONMENT`: `"staging"`
  - `PUBLIC_SITE_ORIGIN`: `"https://keremmihci.com"`
  - `R2_PUBLIC_BASE_URL`: `""` (media served with draft isolation via `/api/v1/public/media/:key`)
  - `ALLOW_CANONICAL_SEED`: `"true"` (enabled only for authorized initial import; automatically locked in `site_settings` after initial seed)
- **Production Gating:** `production` environment has `ALLOW_CANONICAL_SEED: "false"` and `workers_dev: false`.
- **Zero Secrets in Git:** `wrangler.jsonc` contains no tokens, passwords, or keys. All sensitive credentials are provided exclusively via Cloudflare encrypted secrets or runtime environment variables.

---

## 6. Snapshot Coordination & Multi-Host Architecture Analysis

### Current Single-Host Implementation
In [`src/lib/portfolio/repository.ts`](file:///Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/src/lib/portfolio/repository.ts), tombstone coordination during an upstream Cloudflare Worker outage uses:
- Monotonic generation and tombstone ledger in `.local-d1/snapshot-coordination.json` (or `CMS_SNAPSHOT_COORDINATION_PATH`).
- Tested and verified across multiple independent Node.js processes (`:3099`, `:3100`, `:3101`) sharing the local host volume.

### Multi-Host Limitation & Production Roadmap
- **Limitation:** If Next.js is ever deployed across multiple distinct physical/virtual servers without a shared network volume, Machine A's tombstone write would not immediately reach Machine B during an outage.
- **Current Deployment Context:** The current production deployment on Hostinger is a single-host Node.js application, where all worker threads share the same filesystem, making the local coordination ledger fully functional.
- **Production Architecture Proposal for Distributed Multi-Host:**
  1. **Primary Fail-Closed Policy:** During an upstream Cloudflare Worker outage, any process without a verified fresh read from canonical D1 serves cached published projects only up to `CMS_SNAPSHOT_MAX_STALE_MS` (default 5 minutes), and cold-start instances return `503 Service Unavailable` with zero unverified static fallback.
  2. **Cloudflare-Backed Distributed Invalidation:** For future multi-region / serverless Next.js edge instances, the publication generation counter and tombstone IDs can be mirrored in Cloudflare KV or Cloudflare Cache Tags, eliminating reliance on local disk across distributed machines.

---

## 7. Verified Staging Deployment Commands

The following commands have been verified against Wrangler `4.151.2` syntax.

> [!CAUTION]
> **DO NOT RUN THESE COMMANDS UNTIL YOU HAVE REVIEWED AND APPROVED THIS PREFLIGHT DOCUMENT.**

```bash
# ==============================================================================
# PHASE 1: Cloudflare Authentication (Interactive)
# ==============================================================================
cd /Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/cloudflare/portfolio-api

# 1. Login to Cloudflare via browser
npx wrangler login

# 2. Confirm authenticated account
npx wrangler whoami

# ==============================================================================
# PHASE 2: Provision Staging Resources (Requires User Approval)
# ==============================================================================

# 3. Create isolated staging D1 database
npx wrangler d1 create kerem-portfolio-db-staging
# (Copy the returned database_id and paste it into wrangler.jsonc under env.staging.d1_databases[0].database_id)

# 4. Create isolated staging R2 bucket
npx wrangler r2 bucket create kerem-portfolio-media-staging

# 5. Apply initial D1 schema migrations to remote staging D1
npx wrangler d1 migrations apply PORTFOLIO_DB --env staging --remote

# 6. Configure Worker service token secret in staging environment
# (You will be prompted to paste a strong random 32-byte secret token)
npx wrangler secret put CLOUDFLARE_API_SERVICE_TOKEN --env staging

# 7. Deploy staging Worker to workers.dev
npx wrangler deploy --env staging

# ==============================================================================
# PHASE 3: Health & Verification
# ==============================================================================

# 8. Test public health endpoint on deployed staging Worker
curl -s https://kerem-mihci-portfolio-api-staging.<your-subdomain>.workers.dev/api/v1/public/health
```

---

## 8. Staging Data Migration & Initial Seed Plan

1. **Idempotent Canonical Seed:**
   Execute the verified reconciliation tool with `--seed-worker`:
   ```bash
   CLOUDFLARE_CMS_API_URL="https://kerem-mihci-portfolio-api-staging.<your-subdomain>.workers.dev" \
   CLOUDFLARE_API_SERVICE_TOKEN="<your-service-token>" \
   node scripts/reconcile-and-generate-report.mjs --seed-worker
   ```
2. **Seed Endpoint Protections:**
   - Requires `Authorization: Bearer <CLOUDFLARE_API_SERVICE_TOKEN>` (`401` if missing/invalid).
   - Seeds all 30 canonical projects.
   - Sets `canonical_seed_locked = { locked: true }` in `site_settings`. Subsequent attempts return `409 Conflict`.
   - Refuses overwrite if non-seed revisions exist.
3. **Media Strategy:**
   - Existing portfolio images and videos remain served through Next.js static asset paths (`/projects/...`, `/videos/...`).
   - New media uploaded via the CMS admin dashboard will be stored in `kerem-portfolio-media-staging` and proxied through `/api/v1/public/media/...` with draft isolation.

---

## 9. Staging Next.js Application Integration Plan

To test the full CMS admin dashboard and dynamic routing against the remote Cloudflare staging infrastructure:

1. **Generate Local Admin Password Hash:**
   ```bash
   node scripts/hash-admin-password.mjs "YourStrongStagingAdminPassword"
   ```
2. **Launch Local Next.js Connected to Staging Worker:**
   ```bash
   CMS_STORAGE_MODE=staging \
   CMS_DATA_SOURCE=cloudflare \
   CLOUDFLARE_CMS_API_URL="https://kerem-mihci-portfolio-api-staging.<your-subdomain>.workers.dev" \
   CLOUDFLARE_API_SERVICE_TOKEN="<your-service-token>" \
   ADMIN_SESSION_SECRET="<32-byte-hex-hmac-secret>" \
   ADMIN_PASSWORD_HASH="scrypt:<salt-hex>:<key-hex>" \
   ADMIN_ALLOWED_EMAILS="kerem@keremmihci.com" \
   ADMIN_TRUSTED_ORIGINS="http://127.0.0.1:3000,http://localhost:3000" \
   npm run dev
   ```
3. **Safety Isolation Guarantees:**
   - `CMS_STORAGE_MODE=staging` disables local SQLite/R2 fallback (fail-closed).
   - Dev fixtures and bypasses are strictly disabled in staging mode.
   - `CLOUDFLARE_API_SERVICE_TOKEN` is used strictly server-to-server and never exposed in client bundles.
   - Hostinger production environment variables remain 100% untouched.

---

## 10. Real Remote Staging Acceptance Test Plan (Future Phase)

Once staging infrastructure is provisioned, the following 20 acceptance tests will be executed:

1. [ ] **Remote Health Check:** `GET /api/v1/public/health` returns `200` with `publishedCount: 30`.
2. [ ] **Unauthorized Worker Gating:** Direct `GET /api/v1/admin/projects` without token returns `401`.
3. [ ] **Bad Service Token Rejection:** `Authorization: Bearer wrong-token` returns `401`.
4. [ ] **Seed Endpoint Gate:** `POST /api/v1/admin/seed` rejects unauthenticated requests (`401`) and locks after initial seed (`409`).
5. [ ] **30 Canonical Projects Import:** All 30 projects match `src/data/projects.ts` (18 design, 12 web, 0 motion-ai).
6. [ ] **33 Fields Parity:** All slugs, clients, years, titles, descriptions, SEO metadata verified.
7. [ ] **Admin Authentication:** Login via `POST /api/admin/auth` with `scrypt` hash and constant-time verification.
8. [ ] **Durable Session Store:** Session token hashed and stored in remote staging D1 `admin_sessions`.
9. [ ] **Durable Rate Limiting:** 5 failed logins trigger 15-minute lockout in staging D1 `admin_rate_limits`.
10. [ ] **R2 Media Upload:** Valid WebP/JPEG uploaded to `kerem-portfolio-media-staging`.
11. [ ] **MIME & SVG Rejection:** SVGs and unsupported MIME types return `400`.
12. [ ] **Draft Isolation:** Unpublished draft project media returns `404` publicly; returns `200` for admin session.
13. [ ] **No-Deploy Publishing:** Draft project created, published via `PATCH /api/admin/projects/:slug`.
14. [ ] **Dynamic Public Routes:** TR and EN routes (`/tr/project/:slug`, `/en/project/:slug`) become live immediately without rebuilding Next.js.
15. [ ] **Sitemap Inclusion:** Published project appears in `/sitemap.xml`.
16. [ ] **Live Editorial Update:** Title/summary updated in admin dashboard; immediately reflected in browser.
17. [ ] **Revision History:** `project_revisions` in remote staging D1 captures snapshots for each update.
18. [ ] **Unpublishing & Sitemap Removal:** Project unpublished; routes return `404`; completely removed from `/sitemap.xml` and `/api/projects`.
19. [ ] **Single & Global Session Revocation:** Logout invalidates session in remote D1; rejected immediately.
20. [ ] **Cleanup & Parity Check:** Temporary test records removed; remote staging D1 returns to exact 30 canonical projects.

---

## 11. Cost & Resource Safety Summary

- **Cloudflare Plan Requirement:** Standard **Cloudflare Free Plan** is 100% sufficient.
- **D1 Usage:** Staging uses ~500 rows and < 1 MB storage (Free tier allows 5 GB and 5M reads/day).
- **R2 Usage:** Staging media uses < 10 MB storage (Free tier allows 10 GB-months and 1M writes/month).
- **Workers Usage:** Staging tests use < 1,000 requests (Free tier allows 100,000 requests/day).
- **Expected Cost:** **$0.00**. No billing upgrades or paid resources required.

---

## 12. Explicit Approval Gate

### Current Status
**Authentication Confirmed (`kerem.mihci@ogr.iuc.edu.tr`). Remote Resource Mutation Halted Pending Approval.**

### Action Required for R2
`npx wrangler r2 bucket list` returned `code 10042: Please enable R2 through the Cloudflare Dashboard.`
Before an R2 bucket can be provisioned via Wrangler, open the Cloudflare Dashboard for account `9791a288e2e99e7f3403590480e3ad6f` (`Kerem.mihci@ogr.iuc.edu.tr's Account`), navigate to **R2 Object Storage**, and click **Enable R2**.

### Explicit Approval Requested
Once R2 is enabled, please confirm your authorization to provision:
1. Cloudflare D1 database: `kerem-portfolio-db-staging`
2. Cloudflare R2 bucket: `kerem-portfolio-media-staging`
3. Cloudflare Worker: `kerem-mihci-portfolio-api-staging` (workers.dev)

---

## 13. Final Preflight Verdict

### **READY_FOR_STAGING_APPROVAL**

- Local implementation: **100% Verified** (all 11 test stages passed, 0 build/lint/type errors).
- Data parity: **100% Verified** (30 projects, 0 field differences).
- Account Authentication: **Verified** (`Kerem.mihci@ogr.iuc.edu.tr's Account`, ID `9791a288e2e99e7f3403590480e3ad6f`).
- Remote mutation: **Safely Halted** pending R2 dashboard enablement and explicit user approval.
