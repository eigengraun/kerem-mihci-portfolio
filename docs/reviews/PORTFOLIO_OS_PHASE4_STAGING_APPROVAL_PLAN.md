# Portfolio OS Phase 4: Cloudflare Staging Deployment & Approval Plan

**Author:** Antigravity Autonomous Agent
**Branch:** `feature/cloudflare-cms-dashboard`
**Current Local Head:** Phase 4.2.2 Hardened Operator Safety
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

## 1. Operator Session & Environment Initialization

To guarantee fail-closed execution and prevent any undefined variable errors, initialize the operator environment at the start of the deployment session.

```bash
# 1. Enforce strict shell error handling
set -euo pipefail

# 2. Enforce restrictive file creation mask for operator session (private backups)
umask 077

# 3. Establish verified repository and configuration paths
REPO_ROOT="$(pwd)"
WRANGLER_CONFIG="$REPO_ROOT/cloudflare/portfolio-api/wrangler.jsonc"
test -f "$WRANGLER_CONFIG" || { echo "FATAL: wrangler.jsonc not found at $WRANGLER_CONFIG"; exit 1; }

# 4. Target identity parameters (must match approved staging config)
ACCOUNT_ID="9791a288e2e99e7f3403590480e3ad6f"
WORKER_NAME="kerem-mihci-portfolio-api-staging"
DB_NAME="kerem-portfolio-db-staging"
DB_ID="0efef7a7-cc93-4dc2-8cb7-db28379fe01f"
R2_BUCKET="kerem-portfolio-media-staging"
WORKER_URL="https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev"

# 5. Establish durable private backup directory outside git workspace BEFORE any gate execution
BACKUP_DIR="$HOME/.portfolio-staging-backups/phase4-preflight-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
echo "Initialized secure backup directory: $BACKUP_DIR"
```

---

## 2. Local Dry-Run Rehearsal (Offline / Mock Sandbox)

Prior to connecting to remote infrastructure, the operator can locally rehearse every validation tool in an offline sandbox with synthetic fixtures:

```bash
# A. Local Migration Admission Guard unit self-tests (synthetic fixtures)
node scripts/verify-migration-admission.mjs --test
# Expected: 10 / 10 PASS

# B. Real Local Migration Inventory & SHA-256 hash check
node scripts/verify-migration-admission.mjs --local
# Expected: 3 / 3 files verified, SHA-256 hashes match 100%, target DB ID verified

# C. Worker Rollback Version-ID Resolution unit test suite
node scripts/resolve-worker-rollback-version.mjs
# Expected: 17 / 17 PASS (positive, negative, format validation)

# D. Backup Integrity Verification sandbox unit tests
node scripts/verify-backup-integrity.mjs
# Expected: 13 / 13 PASS (checksum, invariants, corrupt SQL handling)

# E. Staging URL Override Security Negative Guard
node scripts/verify-staging-url-override-negative.mjs
# Expected: 9 / 9 PASS (fails closed, zero network requests, tokens protected)

# F. Phase 3 Test Isolation & Port Allocation Negative Guard
node scripts/verify-phase3-isolation-negative.mjs
# Expected: 8 / 8 PASS (port 3099 protected, .local-d1 untouched)
```

---

## 3. Verified Staging Infrastructure Preflight Gates (A through I)

Before any remote mutation or migration is permitted, execute the complete preflight sequence Gates A through I in strict order. All gates use `$BACKUP_DIR` created in Section 1:

### Gate A: Target & Account Verification
Verify all target identities against Cloudflare configuration:

| Resource | Identity / Target | Expected State |
| :--- | :--- | :--- |
| **Cloudflare Account ID** | `9791a288e2e99e7f3403590480e3ad6f` | Verified active account |
| **Worker Service** | `kerem-mihci-portfolio-api-staging` | Active Phase 3 Worker |
| **D1 Database Name** | `kerem-portfolio-db-staging` | Populated staging database |
| **D1 Database UUID** | `0efef7a7-cc93-4dc2-8cb7-db28379fe01f` | Exact match in `wrangler.jsonc` |
| **R2 Media Bucket** | `kerem-portfolio-media-staging` | Bound staging media bucket |

```bash
# Verify Wrangler authentication and active account
npx wrangler whoami
```

---

### Gate B: Active Worker Rollback Version-ID Resolution & Cross-Check
Before deploying new Worker code, capture machine-readable status and historical deployment list, and resolve the exact rollback target Version ID:

```bash
# Capture authoritative snapshots into $BACKUP_DIR
npx wrangler deployments status --config "$WRANGLER_CONFIG" --env staging --json > "$BACKUP_DIR/pre-deployments-status.json"
npx wrangler deployments list --config "$WRANGLER_CONFIG" --env staging --json > "$BACKUP_DIR/pre-deployments-list.json"

# Resolve active Worker VERSION ID (fails closed on discrepancy, split traffic, or missing current flag)
node scripts/resolve-worker-rollback-version.mjs \
  --status-json "$BACKUP_DIR/pre-deployments-status.json" \
  --list-json "$BACKUP_DIR/pre-deployments-list.json" \
  --output "$BACKUP_DIR/active-worker-version-id.txt"

PRE_DEPLOY_VERSION_ID=$(cat "$BACKUP_DIR/active-worker-version-id.txt")
test -n "$PRE_DEPLOY_VERSION_ID" || { echo "FATAL: Pre-deployment Worker Version ID unresolved"; exit 1; }
echo "Pre-Deployment Verified Rollback Target (Version ID): $PRE_DEPLOY_VERSION_ID"
```

---

### Gate C: Migration Directory Inventory & Allowlist Guard
Scan local migrations directory recursively. Ensure strictly only the 3 authorized migration files exist and their cryptographic SHA-256 hashes match:

```bash
node scripts/verify-migration-admission.mjs --local
```
*Pass Criteria:* Exactly `0001_initial_schema.sql`, `0002_videos_and_reels_schema.sql`, and `0003_personal_gallery_schema.sql` present. Zero extra, nested, or unreviewed files. Target database ID matches `0efef7a7-cc93-4dc2-8cb7-db28379fe01f`.

---

### Gate D: Remote D1 Migration Ledger Verification
Reconcile remote Cloudflare D1 migration table (`d1_migrations`):

```bash
node scripts/verify-migration-admission.mjs --online
```
*Pass Criteria:* Remote ledger strictly has `0001` and `0002` applied; `0003_personal_gallery_schema.sql` is strictly pending. Rejects if `0003` is already applied or if any unknown migration is pending.

---

### Gate E: Pre-Migration D1 Backup Export
Export full remote database dump to the isolated directory outside git with restricted permissions (`umask 077`):

```bash
BACKUP_SQL="$BACKUP_DIR/kerem-portfolio-db-staging-backup.sql"
npx wrangler d1 export "$DB_NAME" \
  --config "$WRANGLER_CONFIG" \
  --env staging \
  --remote \
  --output "$BACKUP_SQL"

test -s "$BACKUP_SQL" || { echo "FATAL: Backup file is empty"; exit 1; }
shasum -a 256 "$BACKUP_SQL" > "${BACKUP_SQL}.sha256"
echo "Database backup successfully exported and hashed: $BACKUP_SQL"
```

---

### Gate F: Pre-Migration Backup Integrity Verification
Restore the SQL backup into an isolated in-memory SQLite sandbox, verify SQL syntax, integrity check, and baseline invariants:

```bash
node scripts/verify-backup-integrity.mjs "$BACKUP_SQL"
```
*Pass Criteria:*
- Clean PRAGMA integrity_check.
- Contains 31 projects (30 canonical published + 1 draft).
- Contains 72 project media items.
- Contains 21 canonical videos (19 portrait, 2 landscape).
- Migration 0003 table structure does NOT yet exist in backup.

---

### Gate G: Canonical Video Parity Check (Remote Dry Run)
Run read-only dry-run reconciliation against remote staging Worker:

```bash
node scripts/import-canonical-videos-to-d1.mjs --remote-staging --dry-run
```
*Pass Criteria:* Confirms all 21 canonical videos present in remote staging with 100% field parity. Zero missing, zero conflicting identities.

---

### Gate H: Final Reconfirmation of Pending Migrations
Directly inspect remote D1 migration engine status via Wrangler CLI:

```bash
npx wrangler d1 migrations list "$DB_NAME" \
  --config "$WRANGLER_CONFIG" \
  --env staging \
  --remote
```
*Pass Criteria:* Output confirms strictly `0003_personal_gallery_schema.sql` is pending.

---

### Gate I: Fail-Stop Policy
If ANY check from Gate A through Gate H fails, **STOP IMMEDIATELY**.
- Do NOT proceed to `wrangler d1 migrations apply`.
- Do NOT deploy Worker code.
- Report the specific gate failure and retain all diagnostic logs in `$BACKUP_DIR`.

---

## 4. Decision Gate (HALT POINT)

**Current Deployment Gate Status:** ⛔ **BLOCKED** — All local tests and preflight verifications passed; remote execution halted pending Operator Verdict A.

| Verdict | Meaning | Next Action |
| :--- | :--- | :--- |
| **VERDICT A (Approved)** | Operator approves remote Cloudflare staging rollout | Proceed to Section 5 (Authorized Staging Rollout Sequence) against Cloudflare staging resources. |
| **VERDICT B (Revise)** | Operator requests further local modifications | Adjust local implementation or test criteria before any remote execution. |
| **VERDICT C (Hold)** | Operator pauses rollout | Retain local implementation and postpone remote staging deployment. |

---

## 5. Authorized Staging Rollout Sequence (Verdict A Required)

Upon receiving explicit operator authorization (**Verdict A**), execute the following sequence in order:

### Step 1: Pre-Deployment Verification Check
Ensure preflight artifacts from Gates B, E, and F are present and verified in `$BACKUP_DIR`:

```bash
test -d "$BACKUP_DIR" || { echo "FATAL: BACKUP_DIR does not exist. Run Section 1 & 3 preflight first."; exit 1; }
test -s "$BACKUP_DIR/active-worker-version-id.txt" || { echo "FATAL: active-worker-version-id.txt missing"; exit 1; }
test -s "$BACKUP_DIR/kerem-portfolio-db-staging-backup.sql" || { echo "FATAL: backup SQL missing"; exit 1; }
echo "Preflight artifacts verified in $BACKUP_DIR. Proceeding with migration."
```

---

### Step 2: Additive D1 Schema Migration (Migration 0003)

Execute migration file `0003_personal_gallery_schema.sql` via Cloudflare's migration engine:

```bash
npx wrangler d1 migrations apply "$DB_NAME" \
  --config "$WRANGLER_CONFIG" \
  --env staging \
  --remote
```

#### Post-Migration Schema Verification
Confirm that all 4 new tables, columns (including `asset_status`), and indices exist without modifying any existing tables:

```bash
npx wrangler d1 execute "$DB_NAME" \
  --config "$WRANGLER_CONFIG" \
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
npx wrangler d1 execute "$DB_NAME" \
  --config "$WRANGLER_CONFIG" \
  --env staging \
  --remote \
  --command="SELECT 'projects' as tbl, count(*) as cnt FROM projects UNION ALL SELECT 'videos', count(*) FROM portfolio_videos UNION ALL SELECT 'media', count(*) FROM project_media;"
```
Expected counts:
- `projects`: 31
- `videos`: 21
- `media`: 72

---

### Step 3: Cloudflare Staging Worker Deployment

Deploy the hardened Worker code containing the Personal Gallery CMS endpoints:

```bash
npx wrangler deploy \
  --config "$WRANGLER_CONFIG" \
  --env staging
```

Verify newly deployed Worker status and capture new deployment ID:
```bash
npx wrangler deployments list \
  --config "$WRANGLER_CONFIG" \
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

## 6. Safe Failure Handling & Non-Destructive Containment Protocol

Should any anomaly occur during rollout or verification:

### Safe Failure Principles
1. **Stop Further Writes Immediately**: Halt all deployment, migration, or seeding commands.
2. **Preserve Deployed Schema and Data**: Do NOT execute destructive DDL (`DROP TABLE`) or bulk database deletions.
3. **Capture Diagnostics**: Record full HTTP responses, Worker error logs (`wrangler tail`), and database quick-check output.
4. **Identify Verified Pre-Deployment Worker**: Use the verified pre-deployment ID recorded in `$BACKUP_DIR/active-worker-version-id.txt`.
5. **Require Explicit Operator Authorization**: Never roll back automatically without operator confirmation.
6. **Verify Forward-Compatibility Before Rollback**: Never assume an older Worker version can safely handle requests against a newer schema without confirming compatibility.
7. **Database Recovery as Separate Approved Procedure**: Database state corrections must be designed as targeted forward-fixes or isolated recovery operations, never automated full-database restores.

### Worker Rollback Procedure (If Authorized by Operator)
If the Worker deployment fails and the operator explicitly approves rolling back the Worker code:

> [!IMPORTANT]
> `wrangler rollback <version-id>` strictly requires a **Version ID UUID** (returned in `wrangler deployments status` or `deployments list` versions array). It **fails closed** if given a Deployment ID.

```bash
set -euo pipefail

# 1. Read and validate pre-deployment Worker Version ID from verified preflight record
PREV_VERSION_ID=$(cat "$BACKUP_DIR/active-worker-version-id.txt")

node scripts/resolve-worker-rollback-version.mjs --validate "$PREV_VERSION_ID" || {
  echo "FATAL: Pre-deployment Version ID validation failed. Manual inspection required.";
  exit 1;
}

echo "Rolling back Worker to verified pre-deployment Version ID: $PREV_VERSION_ID"

# 2. Execute rollback using exact Version ID UUID
npx wrangler rollback "$PREV_VERSION_ID" \
  --config "$WRANGLER_CONFIG" \
  --env staging
```

### Database Anomaly Protocol (Strictly Non-Destructive)
> [!CAUTION]
> **DESTRUCTIVE DDL AND FULL-DATABASE OVERWRITES ARE STRICTLY FORBIDDEN.**
> - **NEVER** execute `DROP TABLE portfolio_gallery_*`. Dropping tables corrupts the `d1_migrations` ledger and destroys revision history.
> - **NEVER** execute a full SQL restore over the active staging database. A full restore would overwrite or delete legitimate project media, video CMS assets, and canonical records added in previous phases.
> - **Additive Schema Invariance**: Migration `0003` is purely additive. It adds new tables without touching existing project or video tables. An unused additive table does NOT degrade existing functionality.
> - **Resolution**: If a schema flaw is detected, resolve it through an additive forward-migration (e.g. `0004_...`) or targeted data reconciliation script reviewed and approved by the operator.
