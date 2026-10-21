# Portfolio OS Phase 4: Cloudflare Staging Deployment & Approval Plan

**Author:** Antigravity Autonomous Agent
**Branch:** `feature/cloudflare-cms-dashboard`
**Current Local Head:** Phase 4.2 Verified Local Staging Preflight
**Remote Target:** Cloudflare Staging Worker (`kerem-mihci-portfolio-api-staging`) & D1 (`kerem-portfolio-db-staging`)
**Account ID:** `9791a288e2e99e7f3403590480e3ad6f`
**Database ID:** `0efef7a7-cc93-4dc2-8cb7-db28379fe01f`
**R2 Bucket:** `kerem-portfolio-media-staging`
**Worker URL:** `https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`
**Wrangler Configuration:** `cloudflare/portfolio-api/wrangler.jsonc`
**Status:** **PENDING OPERATOR AUTHORIZATION (VERDICT A REQUIRED)**

---

> [!IMPORTANT]
> **SAFETY & ISOLATION COMMITMENT CONFIRMATION**:
> In strict compliance with project safety directives, **ZERO remote Cloudflare D1 migrations, ZERO remote Worker deployments, and ZERO remote R2 mutations have been performed during Phase 4, Phase 4.1, or Phase 4.2**.
> All schema migrations, API endpoints, provisional asset isolation mechanisms, real Playwright browser E2E workflows, and non-regression checks were executed exclusively against completely isolated temporary SQLite fixtures (`/tmp/portfolio-isolated-*/...`) and temporary storage directories.
> The remote Cloudflare staging environment remains 100% untouched.
> Remote deployment procedures documented below will be executed ONLY when the operator explicitly grants authorization by selecting **Verdict A**.

---

## 1. Verified Staging Infrastructure Preflight

Before any remote command is issued, the operator session must verify the exact target identities:

| Resource | Identity / Target | Expected State |
| :--- | :--- | :--- |
| **Cloudflare Account ID** | `9791a288e2e99e7f3403590480e3ad6f` | Verified active account |
| **Worker Service** | `kerem-mihci-portfolio-api-staging` | Active Phase 3 Worker |
| **D1 Database Name** | `kerem-portfolio-db-staging` | Populated staging database |
| **D1 Database UUID** | `0efef7a7-cc93-4dc2-8cb7-db28379fe01f` | Exact match in `wrangler.jsonc` |
| **R2 Media Bucket** | `kerem-portfolio-media-staging` | Bound staging media bucket |
| **D1 Migration Ledger** | `d1_migrations` | Migrations `0001` and `0002` applied; `0003` pending |
| **Canonical Projects** | `projects` | Exactly 30 canonical projects + 1 draft (31 total) |
| **Project Media** | `project_media` | Exactly 72 records in staging |
| **Canonical Videos** | `portfolio_videos` | Exactly 21 canonical videos (19 portrait, 2 landscape) |

---

## 2. Authorized Staging Rollout Sequence

Upon receiving explicit operator authorization (**Verdict A**), execute the following sequence:

### Step 1: Pre-Migration Backup & Machine-Readable Deployment Snapshot

Capture an immutable cryptographic backup of the staging D1 database to durable private storage (outside Git) and record the exact active Worker deployment:

```bash
# 1. Enforce restrictive file creation mask for operator session
umask 077

# 2. Establish durable private backup directory outside git workspace
BACKUP_DIR="$HOME/.portfolio-staging-backups/phase4-preflight-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# 3. Capture structured machine-readable snapshot of existing deployments
npx wrangler deployments list \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --json > "$BACKUP_DIR/pre-deployments.json"

# Extract and independently verify current active deployment ID (no positional shell parsing)
PRE_DEPLOY_WORKER_ID=$(node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const deployments = Array.isArray(data) ? data : (data.deployments || []);
  const active = deployments.find(d => d.current) || deployments[0];
  if (!active || !active.id) {
    console.error("FATAL: Unable to resolve active deployment ID from Wrangler output");
    process.exit(1);
  }
  console.log(active.id);
' "$BACKUP_DIR/pre-deployments.json")

test -n "$PRE_DEPLOY_WORKER_ID" || { echo "FATAL: Pre-deployment Worker ID unresolved"; exit 1; }
echo "Pre-Deployment Active Worker ID: $PRE_DEPLOY_WORKER_ID" | tee "$BACKUP_DIR/active-worker-id.txt"

# 4. Export immutable SQL dump of staging D1 to durable backup directory
BACKUP_SQL="$BACKUP_DIR/kerem-portfolio-db-staging-backup.sql"

npx wrangler d1 export kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --output "$BACKUP_SQL"

# 5. Cryptographic integrity and SQLite quick-check validation
test -s "$BACKUP_SQL" || { echo "FATAL: Backup file is empty"; exit 1; }
sqlite3 :memory: < "$BACKUP_SQL" "PRAGMA quick_check;" || { echo "FATAL: Backup SQL syntax corrupted"; exit 1; }
shasum -a 256 "$BACKUP_SQL" > "${BACKUP_SQL}.sha256"

# 6. Verify pre-migration data baseline inside the backup
sqlite3 :memory: <<EOF
.read $BACKUP_SQL
SELECT 'projects_count', count(*) FROM projects;
SELECT 'media_count', count(*) FROM project_media;
SELECT 'videos_count', count(*) FROM portfolio_videos;
EOF
```

---

### Step 2: Additive D1 Schema Migration (Migration 0003)

Execute migration file `0003_personal_gallery_schema.sql` via Cloudflare's migration engine:

```bash
npx wrangler d1 migrations apply kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote
```

#### Post-Migration Schema Verification
Confirm that all 4 new tables, columns (including `asset_status`), and indices exist without modifying any existing tables:

```bash
npx wrangler d1 execute kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'portfolio_gallery%' ORDER BY name;"
```

Expected tables:
1. `portfolio_gallery_assets`
2. `portfolio_gallery_items`
3. `portfolio_gallery_revisions`
4. `portfolio_gallery_translations`

Verify baseline content invariants remain intact:
```bash
npx wrangler d1 execute kerem-portfolio-db-staging \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --remote \
  --command="SELECT 'projects' as tbl, count(*) as cnt FROM projects UNION ALL SELECT 'videos', count(*) FROM portfolio_videos UNION ALL SELECT 'media', count(*) FROM project_media;"
```

---

### Step 3: Cloudflare Staging Worker Deployment

Deploy the hardened Worker code containing the Personal Gallery CMS endpoints:

```bash
npx wrangler deploy \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging
```

Verify newly deployed Worker status and capture new deployment ID:
```bash
npx wrangler deployments list \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging \
  --json > "$BACKUP_DIR/post-deployments.json"
```

---

### Step 4: Staging Real Browser E2E & Non-Destructive QA

Execute the automated staging verification script against the live staging Worker:

1. **Staging Binding & Health Check**:
   - `GET /api/v1/public/health` returns `200 OK` with valid D1 and R2 bindings.
   - `wrangler d1 migrations list` confirms `0003_personal_gallery_schema.sql` is marked applied.

2. **Complete Test-Owned Gallery Lifecycle**:
   - Use stable unique test item ID: `photo-staging-e2e-<timestamp>`.
   - Upload real JPEG image (`POST /api/v1/admin/gallery/upload`), verify dimension extraction and R2 storage.
   - Save draft metadata, confirm adoption of exact `itemId` without duplicate or orphan drafts.
   - Private Preview: Verify anonymous `GET /api/media/gallery/...` returns `404` with `no-store`; authenticated admin preview returns `200 OK`.
   - Explicit Publish: Update status to `published`, confirm anonymous access returns `200 OK`.
   - Stream Reordering: Update `sortOrder` via `POST /api/v1/admin/gallery/reorder`, confirm sequence persistence.
   - Safe Provisional Replacement: Upload replacement image for published item, confirm provisional asset status, anonymous `404` on replacement, anonymous `200` on original active image.
   - Re-publish: Confirm promotion of provisional asset and archiving of historical asset.
   - Rollback: Revert to revision 1, verify snapshot restoration.

3. **Guaranteed Post-Test Resource Cleanup**:
   - Delete test item via `DELETE /api/v1/admin/gallery/:id`.
   - Query remote D1 to verify 0 orphan translation, asset, or revision rows remain for the test ID.
   - Delete exact test R2 storage keys using Wrangler, then execute read-only head inspection to verify objects no longer exist.
   - Never perform bucket-wide or wildcard deletions.

4. **Remote Baseline Invariants**:
   - Confirm 30 canonical projects, 72 media items, and 21 canonical videos in remote staging D1 are 100% intact.

---

## 3. Safe Failure Handling & Non-Destructive Containment Protocol

Should any anomaly occur during rollout or verification:

### Safe Failure Principles
1. **Stop Further Writes Immediately**: Halt all deployment, migration, or seeding commands.
2. **Preserve Deployed Schema and Data**: Do NOT execute destructive DDL (`DROP TABLE`) or bulk database deletions.
3. **Capture Diagnostics**: Record full HTTP responses, Worker error logs (`wrangler tail`), and database quick-check output.
4. **Identify Verified Pre-Deployment Worker**: Use the verified pre-deployment ID recorded in `$BACKUP_DIR/active-worker-id.txt`.
5. **Require Explicit Operator Authorization**: Never roll back automatically without operator confirmation.
6. **Verify Forward-Compatibility Before Rollback**: Never assume an older Worker version can safely handle requests against a newer schema without confirming compatibility.
7. **Database Recovery as Separate Approved Procedure**: Database state corrections must be designed as targeted forward-fixes or isolated recovery operations, never automated full-database restores.

### Worker Rollback Procedure (If Authorized by Operator)
If the Worker deployment fails and the operator explicitly approves rolling back the Worker code:

```bash
# Read pre-deployment Worker ID from verified preflight record
PREV_VERSION=$(cat "$BACKUP_DIR/active-worker-id.txt")

test -n "$PREV_VERSION" || { echo "FATAL: Pre-deployment version not found. Manual inspection required."; exit 1; }

echo "Rolling back Worker to verified pre-deployment ID: $PREV_VERSION"

npx wrangler rollback "$PREV_VERSION" \
  --config cloudflare/portfolio-api/wrangler.jsonc \
  --env staging
```

### Database Anomaly Protocol (Strictly Non-Destructive)
> [!CAUTION]
> **DESTRUCTIVE DDL AND FULL-DATABASE OVERWRITES ARE STRICTLY FORBIDDEN.**
> - **NEVER** execute `DROP TABLE portfolio_gallery_*`. Dropping tables corrupts the `d1_migrations` ledger and destroys revision history.
> - **NEVER** execute a full SQL restore over the active staging database. A full restore would overwrite or delete legitimate project media, video CMS assets, and canonical records added in previous phases.
> - **Additive Schema Invariance**: Migration `0003` is purely additive. It adds new tables without touching existing project or video tables. An unused additive table does NOT degrade existing functionality.
> - **Resolution**: If a schema flaw is detected, resolve it through an additive forward-migration (e.g. `0004_...`) or targeted data reconciliation script reviewed and approved by the operator.

---

## 4. Decision Gate

| Verdict | Meaning | Next Action |
| :--- | :--- | :--- |
| **VERDICT A (Approved)** | Operator approves remote Cloudflare staging rollout | Execute Step 1 through Step 4 autonomously against Cloudflare staging resources. |
| **VERDICT B (Revise)** | Operator requests further local modifications | Adjust local implementation or test criteria before any remote execution. |
| **VERDICT C (Hold)** | Operator pauses rollout | Retain local implementation and postpone remote staging deployment. |
