# Portfolio OS Phase 3 & 3.1: Cloudflare Staging Deployment & Approval Plan

**Author:** Antigravity Autonomous Agent  
**Branch:** `feature/cloudflare-cms-dashboard`  
**Current Local Head:** Phase 3.1 Release Blocker Remediation Verified (58/58 Tests Green)  
**Remote Target:** Cloudflare Staging Worker (`kerem-mihci-portfolio-api-staging`) & D1 (`kerem-portfolio-db-staging`)  
**Status:** **PENDING USER AUTHORIZATION (VERDICT A REQUIRED)**  

---

> [!IMPORTANT]
> **SAFETY COMMITMENT CONFIRMATION**:
> In strict compliance with user instructions, **ZERO remote Cloudflare D1 migrations, ZERO remote Worker deployments, and ZERO remote R2 mutations have been performed**.
> All development, additive migrations, magic byte validators, and end-to-end tests (58/58 checks passed) were conducted exclusively against isolated local SQLite and local R2 simulation.
> Remote execution will occur only when the user explicitly grants authorization by choosing **Verdict A**.

---

## 1. Scope of Remote Changes

Upon user authorization (**Verdict A**), the following atomic operations will deploy Phase 3 & 3.1 to the Cloudflare staging environment:

### 1.1 Remote D1 Migration: `0002_videos_and_reels_schema.sql`
- Applies additive schema to `kerem-portfolio-db-staging` (`0efef7a7-cc93-4dc2-8cb7-db28379fe01f`):
  1. `portfolio_videos` (id, slug, status, orientation, video_type, production_method, ai_assisted, client_name, year, duration, aspect_ratio, featured, sort_order, autoplay_preview, timestamps)
  2. `portfolio_video_translations` (id, video_id, locale, title, short_title, description, full_description, services_json, updated_at)
  3. `portfolio_video_assets` (id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, timestamps)
  4. `portfolio_video_revisions` (id, video_id, revision_number, action, snapshot_json, actor_email, created_at)
- Creates 8 performance lookup indexes.
- **Strict Non-Destructive Guarantee**: Zero modifications or deletions to existing `projects`, `project_translations`, `project_media`, or `admin_sessions` tables.

### 1.2 Remote Cloudflare Worker Deployment
- Deploys updated `cloudflare/portfolio-api/src/index.ts` to `https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`.
- Registers dedicated endpoints:
  - `GET /api/v1/public/videos` (with `Cache-Control: no-store, no-cache, must-revalidate`)
  - `GET /api/v1/public/videos/:slug` (immediate 404 on unpublish)
  - `GET /api/v1/public/media/*` (public conditional streaming with HTTP 206 / 416 support)
  - `GET /api/v1/admin/videos` (authenticated completeness calculation)
  - `POST /api/v1/admin/videos` (create video draft)
  - `GET /api/v1/admin/videos/:id` (detail inspection)
  - `PUT /api/v1/admin/videos/:id` (update metadata, status, publishing)
  - `DELETE /api/v1/admin/videos/:id` (cascaded deletion)
  - `POST /api/v1/admin/videos/reorder` (atomic batch sort order update)
  - `GET /api/v1/admin/videos/:id/revisions` (list point-in-time snapshots)
  - `POST /api/v1/admin/videos/:id/revisions` (rollback to snapshot)
  - `POST /api/v1/admin/videos/upload` (dedicated R2 video/poster upload with magic byte signature enforcement)

### 1.3 Remote Canonical Video Seeding
- Seeds the 21 canonical videos (19 portrait, 2 landscape) from `src/data/videos.ts` into remote staging D1.
- Validates 100% parity against canonical source.

---

## 2. Step-by-Step Executable Commands

```mermaid
flowchart TD
    A["User Sign-Off (Verdict A)"] --> B["Step 1: Apply Remote D1 Migration (0002)"]
    B --> C["Step 2: Deploy Staging Cloudflare Worker"]
    C --> D["Step 3: Seed Canonical Videos to Staging D1"]
    D --> E["Step 4: Execute Verification Suite against Staging"]
    E --> F{"All Checks Pass?"}
    F -- Yes --> G["Phase 3.1 Fully Operational on Cloudflare Staging!"]
    F -- No --> H["Step 5: Non-Destructive Safe Rollback"]
```

### Step 1: Apply Remote D1 Migration
```bash
npx wrangler d1 migrations apply kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote
```
*Expected Output*: `Migration 0002_videos_and_reels_schema.sql applied successfully`.

### Step 2: Deploy Cloudflare Staging Worker
```bash
npx wrangler deploy \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging
```
*Expected Output*: `Uploaded kerem-mihci-portfolio-api-staging to https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`.

### Step 3: Seed Canonical Videos to Remote Staging D1
```bash
node scripts/import-canonical-videos-to-d1.mjs --staging
```
*Expected Output*: `SUCCESS: 21/21 Canonical Videos Verified with 100% Parity`.

### Step 4: Verify Remote Staging Health & Public Endpoints
```bash
# 1. Health & Statistics Check
curl -s "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/health" | jq .

# 2. Public Video Feed Check
curl -s "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/videos" | jq .count

# 3. Public Single Video Check
curl -sI "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev/api/v1/public/videos/ai-moda-kombin-reels"
```

---

## 3. Non-Destructive Rollback Procedure

If remote staging exhibits any anomalies during execution, roll back cleanly without affecting existing projects:

```bash
# 1. Roll back Cloudflare Worker to previous deployment version
npx wrangler rollback \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging

# 2. If video table cleanup is needed, execute targeted drop of video tables ONLY (NEVER drop projects or admin_sessions)
npx wrangler d1 execute kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --command="DROP TABLE IF EXISTS portfolio_video_revisions; DROP TABLE IF EXISTS portfolio_video_assets; DROP TABLE IF EXISTS portfolio_video_translations; DROP TABLE IF EXISTS portfolio_videos;"
```
