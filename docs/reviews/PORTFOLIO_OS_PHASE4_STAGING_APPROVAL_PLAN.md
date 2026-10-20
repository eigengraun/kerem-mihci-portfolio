# Portfolio OS Phase 4: Cloudflare Staging Deployment & Approval Plan

**Author:** Antigravity Autonomous Agent  
**Branch:** `feature/cloudflare-cms-dashboard`  
**Current Local Head:** Phase 4.1 Personal Gallery CMS Release Hardening Verified (87/87 Tests Green)  
**Remote Target:** Cloudflare Staging Worker (`kerem-mihci-portfolio-api-staging`) & D1 (`kerem-portfolio-db-staging`)  
**Database ID:** `0efef7a7-cc93-4dc2-8cb7-db28379fe01f`  
**R2 Bucket:** `kerem-portfolio-media-staging`  
**Worker URL:** `https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`  
**Status:** **PENDING USER AUTHORIZATION (VERDICT A REQUIRED)**  

---

> [!IMPORTANT]
> **SAFETY COMMITMENT CONFIRMATION**:
> In strict compliance with user instructions, **ZERO remote Cloudflare D1 migrations, ZERO remote Worker deployments, and ZERO remote R2 mutations have been performed during Phase 4 & Phase 4.1**.
> All schema designs, API endpoints, provisional asset isolation mechanisms, EXIF GPS privacy checks, and end-to-end verifications (**87/87 checks passed, 112/112 Phase 3 non-regression checks passed**) were conducted exclusively against isolated temporary SQLite (`/tmp/portfolio-test-*.sqlite`) and local storage simulation.
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

# 4. Cryptographic integrity and SQLite syntax validation (standard macOS & Linux)
test -s "$BACKUP_PATH" || { echo "FATAL: Empty backup file"; exit 1; }
sqlite3 :memory: < "$BACKUP_PATH" "PRAGMA quick_check;" || { echo "FATAL: Backup SQL syntax invalid"; exit 1; }
shasum -a 256 "$BACKUP_PATH" > "${BACKUP_PATH}.sha256"
```

#### Pre-Migration Baseline Invariants
The pre-migration backup must contain exactly:
- `projects`: At least 30 canonical projects.
- `project_media`: Exactly 72 records in staging.
- `portfolio_videos`: Exactly 21 canonical videos.

---

### Step 2: Additive D1 Schema Migration (Migration 0003)

Execute migration file `0003_personal_gallery_schema.sql` via Cloudflare's migration tracking engine to ensure `d1_migrations` ledger consistency:

```bash
npx wrangler d1 migrations apply kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote
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
  --command="SELECT 'projects' as tbl, count(*) as cnt FROM projects UNION ALL SELECT 'videos', count(*) FROM portfolio_videos UNION ALL SELECT 'media', count(*) FROM project_media;"
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
- `POST /api/v1/admin/gallery/upload` (Upload media asset with EXIF GPS check)
- `GET /api/v1/admin/gallery/:id/revisions` (List revisions)
- `POST /api/v1/admin/gallery/:id/rollback` (Rollback revision)

```bash
npx wrangler deploy \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging
```

---

### Step 4: Real Staging Non-Destructive E2E Checklist

When staging rollout authorization is granted, execute the exact sequence of non-destructive verifications:

1. **Remote Health & Binding Check**:
   - `GET /api/v1/public/health` returns `200 OK` with active D1 and R2 bindings.
   - `wrangler d1 migrations list` confirms `0003_personal_gallery_schema.sql` marked applied.

2. **Complete Test-Owned Gallery Lifecycle**:
   - Establish stable test ID `photo-staging-e2e-<timestamp>`.
   - Upload real JPEG image (`POST /api/v1/admin/gallery/upload`), verify dimension extraction and R2 storage.
   - Save draft metadata (`POST /api/admin/gallery`), verify adoption of same ID without orphan duplicates.
   - Private Preview: Verify anonymous `GET /api/media/gallery/...` returns `404` with `no-store`; authenticated admin preview returns `200 OK`.
   - Explicit Publish: Change status to `published`, verify anonymous `GET` now returns `200 OK`.
   - Stream Reorder: Update `sortOrder` via `POST /api/v1/admin/gallery/reorder`, confirm sequence persistence.
   - Safe Provisional Replacement: Upload replacement image for published item, confirm provisional asset status, anonymous `404` on replacement, anonymous `200` on active original image.
   - Re-publish: Confirm promotion of provisional asset and archiving of historical asset.
   - Rollback: Revert to revision 1, verify snapshot restoration.

3. **Guaranteed Post-Test Resource Cleanup**:
   - Delete test item via `DELETE /api/v1/admin/gallery/:id`.
   - Query remote D1 to verify 0 orphan translation, asset, or revision rows remain.
   - Delete exact test R2 storage keys using Wrangler, then execute read-only head inspection to verify objects no longer exist.
   - Never perform bucket-wide or wildcard deletions.

4. **Remote Canonical Baseline Parity Invariants**:
   - Verify 30 canonical projects, 72 media items, and 21 canonical videos in remote staging D1 are 100% intact.

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
If the additive migration needs to be reversed:
> [!CAUTION]
> **NEVER RESTORE FULL SQL BACKUP OVER CANONICAL DATABASE.**
> Executing a full database restore would wipe or disrupt legitimate project and video CMS records in remote D1.
> Rollback is strictly non-destructive:
```bash
# Safely remove empty additive Phase 4 tables only:
npx wrangler d1 execute kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --command="DROP TABLE IF EXISTS portfolio_gallery_revisions; DROP TABLE IF EXISTS portfolio_gallery_assets; DROP TABLE IF EXISTS portfolio_gallery_translations; DROP TABLE IF EXISTS portfolio_gallery_items;"
```

---

## 3. Decision Gate

| Verdict | Meaning | Next Action |
| :--- | :--- | :--- |
| **VERDICT A (Approved)** | User approves remote staging rollout | Execute Step 1 through Step 4 autonomously against Cloudflare staging resources. |
| **VERDICT B (Revise)** | User requests local modifications | Adjust local implementation or test criteria before any remote execution. |
| **VERDICT C (Hold)** | User pauses rollout | Retain local implementation and postpone remote staging deployment. |
