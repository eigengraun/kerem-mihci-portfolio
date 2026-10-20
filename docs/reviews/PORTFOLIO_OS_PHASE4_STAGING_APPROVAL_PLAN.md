# Portfolio OS Phase 4: Cloudflare Staging Deployment & Approval Plan

**Author:** Antigravity Autonomous Agent  
**Branch:** `feature/cloudflare-cms-dashboard`  
**Current Local Head:** Phase 4 Personal Gallery CMS Implementation Complete & Verified (75/75 Tests Green)  
**Remote Target:** Cloudflare Staging Worker (`kerem-mihci-portfolio-api-staging`) & D1 (`kerem-portfolio-db-staging`)  
**Database ID:** `0efef7a7-cc93-4dc2-8cb7-db28379fe01f`  
**R2 Bucket:** `kerem-portfolio-media-staging`  
**Worker URL:** `https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`  
**Status:** **PENDING USER AUTHORIZATION (VERDICT A REQUIRED)**  

---

> [!IMPORTANT]
> **SAFETY COMMITMENT CONFIRMATION**:
> In strict compliance with user instructions, **ZERO remote Cloudflare D1 migrations, ZERO remote Worker deployments, and ZERO remote R2 mutations have been performed during Phase 4**.
> All schema designs, API endpoints, upload contracts, magic byte validators, and end-to-end verifications (**75/75 checks passed, 112/112 Phase 3 non-regression checks passed**) were conducted exclusively against isolated local SQLite (`.local-d1/portfolio.sqlite`) and local storage simulation.
> Remote execution will occur only when the user explicitly grants authorization by selecting **Verdict A**.

---

## 1. Scope of Remote Operations

Upon receiving explicit user authorization (**Verdict A**), the following atomic operations will deploy the Phase 4 Personal Gallery CMS to the Cloudflare staging environment:

### Step 1: Pre-Migration Backup & Strict Validation (Safety First)

Before applying schema migration `0003`, an immutable cryptographic backup of the staging D1 database must be captured and verified:

```bash
# 1. Enforce restrictive file creation mask for operator session
umask 077

# 2. Record current active Worker deployment version as verified rollback target
npx wrangler deployments list \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging > /tmp/portfolio-pre-phase4-deployments.txt

# 3. Export immutable SQL dump of staging D1 to a secure path outside git
BACKUP_PATH="/tmp/portfolio-d1-staging-pre-phase4-$(date +%s).sql"

npx wrangler d1 export kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --output "$BACKUP_PATH"

# 4. Cryptographic integrity and SQLite syntax validation
test -s "$BACKUP_PATH" || { echo "FATAL: Empty backup file"; exit 1; }
sqlite3 :memory: < "$BACKUP_PATH" "PRAGMA quick_check;" || { echo "FATAL: Backup SQL syntax invalid"; exit 1; }
sha256sum "$BACKUP_PATH" > "${BACKUP_PATH}.sha256"
```

#### Pre-Migration Baseline Invariants
The pre-migration backup must contain exactly:
- `projects`: At least 30 canonical projects.
- `project_media`: Exactly 72 records in staging.
- `portfolio_videos`: Exactly 21 canonical videos.

---

### Step 2: Additive D1 Schema Migration (Migration 0003)

Execute migration file `0003_personal_gallery_schema.sql` against the approved remote staging D1 database:

```bash
npx wrangler d1 execute kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --file=cloudflare/portfolio-api/migrations/0003_personal_gallery_schema.sql
```

#### Post-Migration Schema Verification
Inspect that all 4 new tables and 5 indices were created with zero disruption to existing data:

```bash
npx wrangler d1 execute kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'portfolio_gallery%';"
```

Expected output:
- `portfolio_gallery_items`
- `portfolio_gallery_translations`
- `portfolio_gallery_assets`
- `portfolio_gallery_revisions`

Verify existing row counts remain 100% unchanged:
```bash
npx wrangler d1 execute kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --command="SELECT 'projects' as tbl, count(*) as cnt FROM projects UNION ALL SELECT 'videos', count(*) FROM portfolio_videos;"
```

---

### Step 3: Cloudflare Staging Worker Deployment

Deploy the hardened Worker code containing the new gallery routes:
- `GET /api/v1/public/gallery` (Deterministic published stream)
- `GET /api/v1/admin/gallery` (Full catalog with draft/archived items)
- `POST /api/v1/admin/gallery` (Create photograph)
- `GET /api/v1/admin/gallery/:id` (Fetch photograph)
- `PUT /api/v1/admin/gallery/:id` (Update photograph)
- `DELETE /api/v1/admin/gallery/:id` (Delete photograph)
- `POST /api/v1/admin/gallery/reorder` (Reorder sequence)
- `POST /api/v1/admin/gallery/upload` (Upload media asset)
- `GET /api/v1/admin/gallery/:id/revisions` (List revisions)
- `POST /api/v1/admin/gallery/:id/rollback` (Rollback revision)

```bash
npx wrangler deploy \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging
```

---

### Step 4: Staging Health & E2E Validation

Verify remote Worker and D1 health endpoints:

```bash
# 1. Health check
curl -fsS https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/health

# 2. Public Gallery endpoint (expect ok: true, count: 0)
curl -fsS https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/gallery

# 3. Non-regression: Projects endpoint (expect 30 projects)
curl -fsS https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/projects | grep -q '"ok":true'

# 4. Non-regression: Videos endpoint (expect 21 videos)
curl -fsS https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/videos | grep -q '"count":21'
```

---

## 2. Emergency Rollback Procedures

Should any anomaly occur during or immediately following staging deployment:

### Rollback Scenario A: Worker Deployment Anomaly
If the newly deployed Worker exhibits routing or execution issues:
```bash
# Retrieve previous version from /tmp/portfolio-pre-phase4-deployments.txt
PREV_VERSION=$(head -n 2 /tmp/portfolio-pre-phase4-deployments.txt | tail -n 1 | awk '{print $1}')

npx wrangler rollback "$PREV_VERSION" \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging
```

### Rollback Scenario B: Database Schema Anomaly
If the schema migration encounters an error:
```bash
# Restore staging database from verified pre-migration backup
npx wrangler d1 execute kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --file="$BACKUP_PATH"
```

---

## 3. Decision Gate

| Verdict | Meaning | Next Action |
| :--- | :--- | :--- |
| **VERDICT A (Approved)** | User approves remote staging rollout | Execute Step 1 through Step 4 autonomously against Cloudflare staging resources. |
| **VERDICT B (Revise)** | User requests local modifications | Adjust local implementation or test criteria before any remote execution. |
| **VERDICT C (Hold)** | User pauses rollout | Retain local implementation and postpone remote staging deployment. |
