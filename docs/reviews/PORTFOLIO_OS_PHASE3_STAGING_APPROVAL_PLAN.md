# Portfolio OS Phase 3 & 3.2: Cloudflare Staging Deployment & Approval Plan

**Author:** Antigravity Autonomous Agent<br/>
**Branch:** `feature/cloudflare-cms-dashboard`<br/>
**Current Local Head:** Final Staging Operator Preflight Verified (112/112 Tests Green)<br/>
**Remote Target:** Cloudflare Staging Worker (`kerem-mihci-portfolio-api-staging`) & D1 (`kerem-portfolio-db-staging`)<br/>
**Database ID:** `0efef7a7-cc93-4dc2-8cb7-db28379fe01f`<br/>
**R2 Bucket:** `kerem-portfolio-media-staging`<br/>
**Active Deployment Version:** `3da74ed3-ec9a-41a2-931f-c0453b15e4e2`<br/>
**Worker URL:** `https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`<br/>
**Status:** **PENDING USER AUTHORIZATION (VERDICT A REQUIRED)**

---

> [!IMPORTANT]
> **SAFETY COMMITMENT CONFIRMATION**:
> In strict compliance with user instructions, **ZERO remote Cloudflare D1 migrations, ZERO remote Worker deployments, and ZERO remote R2 mutations have been performed**.
> All development, additive migrations, magic byte validators, isolated fail-closed regression tests, authenticated seed inventory checks, conservative no-store cache headers, and end-to-end verifications (**112/112 checks passed**) were conducted exclusively against isolated local SQLite and local R2 simulation.
> Remote execution will occur only when the user explicitly grants authorization by choosing **Verdict A**.

---

## 1. Scope of Remote Changes

Upon user authorization (**Verdict A**), the following atomic operations will deploy Phase 3 & 3.2 to the Cloudflare staging environment:

### 1.1 Pre-Migration Backup & Strict Validation (Safety First)
Before applying any schema changes or deployments, a complete pre-migration D1 backup must be taken and strictly validated according to rigorous operator criteria:

```bash
# 1. Enforce restrictive file creation mask for operator session
umask 077

# 2. Record current active Worker deployment version ID as verified rollback target
# Confirmed active version: 3da74ed3-ec9a-41a2-931f-c0453b15e4e2
npx wrangler deployments list \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging > /tmp/portfolio-pre-phase3-deployments.txt

# 3. Export immutable SQL dump of staging D1 to a secure path outside git
BACKUP_PATH="/tmp/portfolio-d1-staging-pre-phase3-$(date +%s).sql"

npx wrangler d1 export kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --output "$BACKUP_PATH"
```

#### Pre-Migration Backup Validation Checklist
The deployment must halt immediately if any of these validation criteria are not met:
1. **Exit Code**: Wrangler export command returns exit code `0`.
2. **Non-Empty**: Backup file size is strictly greater than zero (`test -s "$BACKUP_PATH"`).
3. **Expected Tables**: SQL dump contains statements for all existing production/staging tables:
   - `projects`
   - `project_translations`
   - `project_media`
   - `admin_sessions`
4. **SQL Integrity**: The exported SQL parses cleanly without syntax errors in an isolated SQLite instance:
   `sqlite3 :memory: < "$BACKUP_PATH" "PRAGMA quick_check;"`
5. **Cryptographic Checksum**: Compute and record SHA-256 checksum:
   `shasum -a 256 "$BACKUP_PATH" > "${BACKUP_PATH}.sha256"`
6. **Location Outside Git**: Stored in `/tmp/` (never committed to repository).
7. **File Permissions**: Set restricted read/write permissions:
   `chmod 0600 "$BACKUP_PATH"` (protects session tokens and hashes).
8. **Baseline Project Count & Preservation**:
   The staging database baseline comprises **30 published canonical projects** and **1 legitimate staging draft project** (total 31 projects), with **72 project_media records** and **11 published featured projects** (12 total featured).
   Do NOT require `total projects == 30`. Instead, verify:
   - All 30 canonical projects are present by ID/slug and confirmed published:
     `SELECT count(*) FROM projects WHERE status = 'published';` (returns 30)
   - Separate inventory of drafts confirms the 1 existing staging test draft:
     `SELECT count(*) FROM projects WHERE status = 'draft';` (returns 1)
   - Existing media records count:
     `SELECT count(*) FROM project_media;` (returns 72)
   - Featured live count:
     `SELECT count(*) FROM projects WHERE featured = 1 AND status = 'published';` (returns 11)
   - Never delete or drop the staging draft project automatically.
9. **Baseline Video Count**: Confirm video count is baseline (0 before migration).

---

### 1.2 Remote D1 Migration: `0002_videos_and_reels_schema.sql`
- Applies additive schema to `kerem-portfolio-db-staging` (`0efef7a7-cc93-4dc2-8cb7-db28379fe01f`):
  1. `portfolio_videos` (id, slug, status, orientation, video_type, production_method, ai_assisted, client_name, year, duration, aspect_ratio, featured, sort_order, autoplay_preview, timestamps)
  2. `portfolio_video_translations` (id, video_id, locale, title, short_title, description, full_description, services_json, updated_at)
  3. `portfolio_video_assets` (id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, timestamps)
  4. `portfolio_video_revisions` (id, video_id, revision_number, action, snapshot_json, actor_email, created_at)
- Creates 8 performance lookup indexes.
- **Strict Non-Destructive Guarantee**: Zero modifications or deletions to existing `projects`, `project_translations`, `project_media`, or `admin_sessions` tables.

---

### 1.3 Remote Cloudflare Worker Deployment
- Records current active deployment version (`3da74ed3-ec9a-41a2-931f-c0453b15e4e2`) prior to upload.
- Deploys updated `cloudflare/portfolio-api/src/index.ts` to `https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`.
- Registers dedicated endpoints:
  - `GET /api/v1/public/health` & `GET /api/v1/health` (supporting GET and HEAD)
  - `GET /api/v1/public/videos` (with `Cache-Control: no-store, no-cache, must-revalidate`)
  - `GET /api/v1/public/videos/:slug` (immediate 404 on unpublish)
  - `GET /api/v1/public/media/*` (public streaming with HTTP 206 / 416 support and conservative `no-store, no-cache, must-revalidate`)
  - `GET /api/v1/admin/videos` (authenticated completeness calculation discovering published, draft, and archived)
  - `POST /api/v1/admin/videos` (create video draft with 409 conflict detection)
  - `GET /api/v1/admin/videos/:id` (detail inspection)
  - `PUT /api/v1/admin/videos/:id` (update metadata, status, publishing)
  - `DELETE /api/v1/admin/videos/:id` (cascaded deletion)
  - `POST /api/v1/admin/videos/reorder` (atomic batch sort order update)
  - `GET /api/v1/admin/videos/:id/revisions` (list point-in-time snapshots)
  - `POST /api/v1/admin/videos/:id/revisions` (rollback to snapshot)
  - `POST /api/v1/admin/videos/upload` (dedicated R2 video/poster upload with magic byte signature enforcement)

---

### 1.4 Remote Canonical Video Seeding
- Runs preflight check against authenticated `GET /api/v1/admin/videos`.
- Performs strict reconciliation across all 21 canonical videos:
  - Matching ID and matching slug: `CANONICAL_PARITY` (or `OWNER_MODIFIED` if edited by owner).
  - Matching ID but conflicting slug: `IDENTITY_CONFLICT` (blocks seeding).
  - Matching slug but conflicting ID: `IDENTITY_CONFLICT` (blocks seeding).
  - Multiple matches: `IDENTITY_CONFLICT` (blocks seeding).
  - Missing ID and missing slug: `MISSING` (pending insertion).
- Preserves existing draft and archived records; preserves owner-modified content.
- Preserves optional-field semantics: absent full description is NOT replaced with short description.
- Uses original canonical video position when deriving missing `sortOrder`.
- Validates canonical parity in dry-run mode before seeding:
  `node scripts/import-canonical-videos-to-d1.mjs --remote-staging --dry-run`
- Seeds the 21 canonical videos with all 28 canonical metadata fields:
  `node scripts/import-canonical-videos-to-d1.mjs --remote-staging --execute`
- Guaranteed non-destructive: `--force` is rejected on remote staging. Existing records are preserved.
- After seeding, executes read-only authenticated `GET /api/v1/admin/videos` to verify every newly inserted record.

---

## 2. Step-by-Step Executable Commands

```mermaid
flowchart TD
    A["User Sign-Off (Verdict A)"] --> B["Step 1: Record Deployment & Take Validated D1 Export"]
    B --> C["Step 2: Apply Remote D1 Migration (0002)"]
    C --> D["Step 3: Deploy Staging Cloudflare Worker"]
    D --> E["Step 4: Authenticated Dry-Run Validation on Staging"]
    E --> F["Step 5: Execute Remote Canonical Video Seeding"]
    F --> G["Step 6: Remote Health & Parity Verification"]
    G --> H{"All Checks Pass?"}
    H -- Yes --> I["Phase 3.2 Fully Operational on Cloudflare Staging!"]
    H -- No --> J["Step 7: Recovery Procedure (Worker Rollback / Data Recovery)"]
```

### Step 1: Pre-Migration Deployment Record & Validated Backup
```bash
# Set restrictive umask
umask 077

# Record active deployment
npx wrangler deployments list \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging

# Export and validate D1 database
BACKUP_PATH="/tmp/portfolio-d1-staging-pre-phase3-$(date +%s).sql"

npx wrangler d1 export kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --output "$BACKUP_PATH"

# Validate backup integrity
test -s "$BACKUP_PATH" && echo "Backup non-empty: OK"
grep -q "CREATE TABLE.*projects" "$BACKUP_PATH" && echo "Projects table present: OK"
shasum -a 256 "$BACKUP_PATH" > "${BACKUP_PATH}.sha256"
chmod 0600 "$BACKUP_PATH"
sqlite3 :memory: < "$BACKUP_PATH" "PRAGMA quick_check;"
```

### Step 2: Apply Remote D1 Migration
```bash
npx wrangler d1 migrations apply kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote
```
*Expected Output*: `Migration 0002_videos_and_reels_schema.sql applied successfully`.

### Step 3: Deploy Cloudflare Staging Worker
```bash
npx wrangler deploy \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging
```
*Expected Output*: `Uploaded kerem-mihci-portfolio-api-staging to https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`.

### Step 4: Validate Remote Staging in Dry-Run Mode
```bash
node scripts/import-canonical-videos-to-d1.mjs --remote-staging --dry-run
```
*Expected Output*: Authenticates with staging admin, confirms table availability, shows pending 21 canonical insertions without writing.

### Step 5: Execute Canonical Video Seeding
```bash
node scripts/import-canonical-videos-to-d1.mjs --remote-staging --execute
```
*Expected Output*: `SUCCESS: 21/21 Canonical Videos Verified with 100% Parity`.

### Step 6: Verify Remote Staging Health & Public Endpoints
```bash
# 1. Health & Statistics Check (Worker health & D1 connectivity)
curl -s "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/health" | jq .

# 2. Public Video Feed Check (21 published canonical videos)
curl -s "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/videos" | jq .count

# 3. Public Single Video Check
curl -sI "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/videos/ai-moda-kombin-reels"

# 4. Cache Policy Check (ensures no-store, no-cache, must-revalidate)
curl -sI "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/videos" | grep -i "cache-control"
```

---

## 3. Rollback & Recovery Architecture

The system distinguishes three distinct recovery levels to provide controlled operational recovery while distinguishing Worker routing reversions from database schema and data modifications:

| Recovery Level | Trigger | Action | Impact on Data | Operator Approval Required? |
|---|---|---|---|---|
| **Worker Rollback** | Worker code bug or runtime routing regression | Revert Worker to previous deployment version (`3da74ed3-ec9a-41a2-931f-c0453b15e4e2`) via `wrangler rollback` | Zero impact on database. Existing and new tables remain untouched. | Standard operator step |
| **Schema Isolation** | Additive schema migration applied | Schema `0002` is strictly additive. **NO DROP TABLE is permitted.** Reverting Worker stops access to video tables while project tables remain 100% functional. | Zero impact on project data. Existing 30 projects and media remain intact. | Automatic safety guarantee |
| **Data Restoration** | Catastrophic data corruption during manual operator error | Execute SQL dump restore against D1 database | Overwrites current staging database with pre-migration export | **REQUIRES SEPARATE EXPLICIT OPERATOR APPROVAL** |

### 3.1 Worker Rollback Procedure
```bash
# Roll back Cloudflare Worker to previous stable deployment version (3da74ed3-ec9a-41a2-931f-c0453b15e4e2)
npx wrangler rollback \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging

# Verify previous Worker version is serving existing projects correctly
curl -s "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/projects" | jq .count
```

### 3.2 Additive Schema Isolation (Why `DROP TABLE` is Forbidden)
> [!CAUTION]
> **NO DESTRUCTIVE `DROP TABLE` COMMANDS**:
> The `0002_videos_and_reels_schema.sql` migration creates independent tables (`portfolio_videos`, `portfolio_video_translations`, `portfolio_video_assets`, `portfolio_video_revisions`).
> It does **not** alter, constrain, or touch `projects`, `project_translations`, `project_media`, or `admin_sessions`.
> Therefore, if a Worker rollback is executed, the previous Worker code simply ignores the new video tables. Issuing raw `DROP TABLE` commands introduces severe risk of accidental collateral drops and is strictly barred from all recovery scripts unless a separately authorized, reviewed compensating migration is created.

### 3.3 Data Restoration (Disaster Recovery Only — Requires Separate Approval)
> [!CAUTION]
> A full database export SQL file contains table creation and insert statements. Importing a full backup into an existing database may fail on existing primary keys or overwrite legitimate records.
> Data restoration must **NEVER** be run as an automatic or unapproved step. It requires separate explicit human operator authorization:

```bash
# ONLY UPON SEPARATE EXPLICIT OPERATOR APPROVAL:
# npx wrangler d1 execute kerem-portfolio-db-staging \
#   --config cloudflare/portfolio-api/wrangler.jsonc \
#   --env staging \
#   --remote \
#   --file="$BACKUP_PATH"
```
