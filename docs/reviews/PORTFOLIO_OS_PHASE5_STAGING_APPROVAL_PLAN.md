# Portfolio OS Phase 5: Cloudflare Staging Deployment Approval Plan & Operator Runbook

**Project:** Kerem Mıhçı Portfolio OS  
**Repository Branch:** `feature/portfolio-phase5-notes-profile-cv`  
**Current Phase:** Phase 5.2 — Final Content Provenance, Hardened Runbook & Operator Gate
**Current Status:** **LOCAL VERIFICATION COMPLETE — STAGING GATE CLOSED**  

---

## 1. Approval Gate Statement

Phase 5 / 5.2 local implementation, integration, automated verification, local Worker runtime execution, and Playwright Chromium E2E testing are **100% complete**.

In strict accordance with Portfolio OS safety guidelines:
- **Zero remote mutations** have been performed.
- Migration `0004_profile_notes_cv_schema.sql` has **NOT** been applied to Cloudflare staging D1.
- Cloudflare staging Worker has **NOT** been deployed with Phase 5 code.
- Remote R2 has **NOT** been mutated.
- Remote content seeding remains **STRICTLY BLOCKED** (importer CLI enforces fail-closed exit 1 on `--remote-staging`).
- The `main` branch has **NOT** been merged or pushed.

This runbook defines the exact sequence of operational steps required to deploy Phase 5 to Cloudflare staging once explicit operator authorization is granted.

---

## 2. Target Staging Infrastructure Identities & Baseline Disambiguation

### Target Infrastructure Identities
| Resource | Target Identity | Verification ID / Details |
| :--- | :--- | :--- |
| **Cloudflare Account** | Eigengraun Studio | `9791a288e2e99e7f3403590480e3ad6f` |
| **Staging Worker** | `kerem-mihci-portfolio-api-staging` | URL: `https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev` |
| **Staging D1 Database** | `kerem-portfolio-db-staging` | UUID: `0efef7a7-cc93-4dc2-8cb7-db28379fe01f` |
| **Staging R2 Bucket** | `kerem-portfolio-media-staging` | Media object storage |
| **Wrangler Configuration**| `cloudflare/portfolio-api/wrangler.jsonc` | Target environment: `staging` |
| **Pending Migration** | `0004_profile_notes_cv_schema.sql` | Status: `NOT_APPLIED` |

### Disambiguation: Local Canonical vs Remote Staging Database Baseline
Operators must never confuse the local test database with the remote staging database.

| Entity Type | Historical Local Sandbox (`.local-d1`) | Historical Remote Staging (`kerem-portfolio-db-staging`) | Governance Rule |
| :--- | :---: | :---: | :--- |
| **Projects** | 30 canonical records | **31 records** (30 canonical + 1 test draft) | Reference only; do NOT normalize |
| **Project Media** | 70 canonical media | **72 media records** | Reference only; preserve intact |
| **Videos** | 21 canonical videos | **21 canonical videos** | Exact match |
| **Gallery Items** | 3 local preview items | **0 records** (cleaned post Phase 4 closeout) | Staging gallery was cleaned up |
| **Profile & Notes**| 73 seeded local records | **0 records** (unmigrated pre-0004) | Seeding blocked fail-closed |

> [!IMPORTANT]
> These counts are historical baselines. Before executing any future staging deployment, the operator must execute fresh read-only queries (Step D & Step J) to establish current live counts. If unexplained drift is detected, **HALT EXECUTION IMMEDIATELY**.

---

## 3. Exact Migration Inventory & Admission Cryptographic Hashes

For admission to Cloudflare staging, the migrations directory `cloudflare/portfolio-api/migrations/` must contain exactly the following four migrations:

| File Name | SHA-256 Checksum | Expected Remote Status |
| :--- | :--- | :---: |
| `0001_initial_schema.sql` | `453593cdcf472f41e8504ad95ca9f941225562310a30009b68ea492c83479bcf` | **Applied** |
| `0002_videos_and_reels_schema.sql` | `2c3ac9ff453d76e5afa2e980fcb08fdf08f3362a5a1a9a347634549f5b098f64` | **Applied** |
| `0003_personal_gallery_schema.sql` | `da6aaabf624fbbaee35089ad27c8627e8709e7e570713d7c29ca6c1b403af606` | **Applied** |
| `0004_profile_notes_cv_schema.sql` | `cc6e699e703db6527427d99ff490793b40564d21d8681fceec7e48c81dbe537d` | **Pending (Only)** |

Any missing, altered, or additional migration file violates admission policy and must cause an immediate abort.

---

## 4. Verified Local Baseline Test Evidence (786 Automated Checks)

All required local verification batteries have been executed and verified passing 100%:

| Test Battery | Command | Checks | Status |
| :--- | :--- | :---: | :---: |
| **Phase 5 Functional & Schema Suite** | `node scripts/verify-phase5-profile-notes-cms.mjs` | **168** | **PASS (168/168)** |
| **Phase 5.2 Browser Playwright E2E** | `node scripts/verify-phase5-browser-e2e.mjs` | **60** | **PASS (60/60)** |
| **Phase 5.2 Local Worker Runtime E2E** | `node scripts/verify-phase5-worker-runtime.mjs` | **48** | **PASS (48/48)** |
| **Phase 5.2 Content Parity & Provenance** | `node scripts/verify-phase5-content-parity.mjs` | **311** | **PASS (311/311)** |
| **Phase 3 Video CMS Regression** | `node scripts/verify-phase3-video-cms.mjs` | **112** | **PASS (112/112)** |
| **Phase 4 Gallery CMS Regression** | `node scripts/verify-phase4-gallery-cms.mjs` | **87** | **PASS (87/87)** |
| **TypeScript Typecheck** | `npx tsc --noEmit` | N/A | **PASS (0 errors)** |
| **ESLint Static Analysis** | `npm run lint` | N/A | **PASS (0 errors)** |
| **Next.js Webpack Build** | `npm run build` | N/A | **PASS (Clean compile)** |
| **Wrangler Deploy Dry-Run (Local)** | `npx wrangler deploy --dry-run` | N/A | **PASS (0 errors)** |
| **Wrangler Deploy Dry-Run (Staging)** | `npx wrangler deploy --dry-run --env staging` | N/A | **PASS (0 errors)** |
| **Host Database Checksum** | `shasum -a 256 .local-d1/portfolio.sqlite` | N/A | **PASS (`470d8f14ce12...`)** |
| **Total Automated Checks** | — | **786** | **PASS (786/786)** |

---

## 5. Single Fail-Closed Staging Preflight Sequence (Steps A through L)

Before executing any remote mutations, the operator must execute this strict sequence:

### Step A: Verify Exact Reviewed Source Commit
```bash
git rev-parse HEAD
# Verify working tree is clean
git status --porcelain
```

### Step B: Verify Cloudflare Staging Account Identity
```bash
npx wrangler whoami
# Verify account ID matches 9791a288e2e99e7f3403590480e3ad6f
```

### Step C: Verify Worker, D1 UUID, and R2 Bucket Bindings
Inspect `cloudflare/portfolio-api/wrangler.jsonc` under `"env.staging"`:
- D1 DB Name: `kerem-portfolio-db-staging`
- D1 Database ID: `0efef7a7-cc93-4dc2-8cb7-db28379fe01f`
- R2 Bucket: `kerem-portfolio-media-staging`

### Step D: Query Live Remote Inventory & Active Serving Version
```bash
# Query active version
npx wrangler deployments list --env staging --config cloudflare/portfolio-api/wrangler.jsonc
# Record current active Version ID for audit log

# Fresh live read-only count queries on remote staging D1:
npx wrangler d1 execute kerem-portfolio-db-staging --env staging --remote --config cloudflare/portfolio-api/wrangler.jsonc --command "SELECT count(*) AS project_count FROM projects;"
npx wrangler d1 execute kerem-portfolio-db-staging --env staging --remote --config cloudflare/portfolio-api/wrangler.jsonc --command "SELECT count(*) AS video_count FROM portfolio_videos;"
npx wrangler d1 execute kerem-portfolio-db-staging --env staging --remote --config cloudflare/portfolio-api/wrangler.jsonc --command "SELECT count(*) AS gallery_count FROM portfolio_gallery_items;"
```

### Step E: Verify Migration Inventory and Approved Hashes
```bash
shasum -a 256 cloudflare/portfolio-api/migrations/*.sql
# Verify 0001, 0002, 0003, and 0004 match Section 3 exactly
```

### Step F: Confirm Migrations 0001, 0002, 0003 are Applied on Remote D1
```bash
npx wrangler d1 migrations list kerem-portfolio-db-staging --env staging --remote --config cloudflare/portfolio-api/wrangler.jsonc
```

### Step G: Confirm ONLY Migration 0004 is Pending
Ensure no other migrations are listed as unapplied.

### Step H: Take Fresh Private Remote D1 Backup
Export a full SQL dump to durable private storage outside git tracking with restricted permissions (`umask 077`):
```bash
mkdir -p ~/.cloudflare/backups && chmod 0700 ~/.cloudflare/backups
export BACKUP_PATH="$HOME/.cloudflare/backups/staging-d1-pre-phase5-$(date +%s).sql"
(umask 077 && npx wrangler d1 export kerem-portfolio-db-staging --env staging --remote --output "$BACKUP_PATH" --config cloudflare/portfolio-api/wrangler.jsonc)
chmod 0600 "$BACKUP_PATH"
shasum -a 256 "$BACKUP_PATH"
```

### Step I: Restore and Verify Backup in Isolated SQLite Fixture
Verify dump syntax, table structure, and data integrity by importing the export into an isolated in-memory SQLite database:
```bash
node -e '
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");

const backupPath = process.env.BACKUP_PATH;
if (!backupPath || !fs.existsSync(backupPath)) {
  console.error("FATAL: BACKUP_PATH environment variable not set or file missing.");
  process.exit(1);
}

const sql = fs.readFileSync(backupPath, "utf-8");
const db = new DatabaseSync(":memory:");
db.exec(sql);

// 1. Integrity check
const integrity = db.prepare("PRAGMA integrity_check;").get();
if (integrity.integrity_check !== "ok") {
  console.error("FATAL: SQLite integrity check failed:", integrity);
  process.exit(1);
}

// 2. Migration ledger validation
const appliedMigrations = db.prepare("SELECT name FROM d1_migrations ORDER BY id ASC;").all().map(r => r.name);
console.log("Verified Applied Migrations:", appliedMigrations);
if (!appliedMigrations.includes("0001_initial_schema.sql") ||
    !appliedMigrations.includes("0002_videos_and_reels_schema.sql") ||
    !appliedMigrations.includes("0003_personal_gallery_schema.sql")) {
  console.error("FATAL: Missing baseline migrations in backup.");
  process.exit(1);
}

// 3. Record count verification
const projectsCount = db.prepare("SELECT count(*) as c FROM projects;").get().c;
const videosCount = db.prepare("SELECT count(*) as c FROM portfolio_videos;").get().c;
const galleryCount = db.prepare("SELECT count(*) as c FROM portfolio_gallery_items;").get().c;

console.log(`Verified Backup Counts: Projects=${projectsCount}, Videos=${videosCount}, Gallery=${galleryCount}`);
if (projectsCount < 30 || videosCount !== 21) {
  console.error("FATAL: Canonical data mismatch in backup dump.");
  process.exit(1);
}

console.log("✓ Backup verified 100% syntactically, structurally, and relationally sound.");
'

# Or run the comprehensive automated verifier directly:
node scripts/verify-backup-integrity.mjs "$BACKUP_PATH"
```

### Step J: Verify Fail-Closed Empty/Draft Behavior
Confirm that public unseeded endpoints return healthy empty states without marking the public site degraded:
- Unseeded profile returns 404 with structured code `PROFILE_NOT_PUBLISHED` and `Cache-Control: no-store`.
- Unseeded CV returns 404 with structured code `CV_NOT_PUBLISHED` and `Cache-Control: no-store`.
- Next.js frontend handles empty profile gracefully without setting `isDegraded: true`.

### Step K: STOP at Explicit Operator Authorization Gate
**HALT EXECUTION.** Present preflight evidence, backup verification logs, and checklist sign-off to the operator and await explicit written approval (`VERDICT A`).

### Step L: Execution (Only After Separate Approval)
1. **Apply Migration 0004 to Staging D1:**
   ```bash
   npx wrangler d1 migrations apply kerem-portfolio-db-staging --env staging --remote --config cloudflare/portfolio-api/wrangler.jsonc
   ```
2. **Deploy Phase 5 Worker API to Staging:**
   ```bash
   npx wrangler deploy --env staging --config cloudflare/portfolio-api/wrangler.jsonc
   ```
3. **Execute Post-Deployment Staging Smoke & Verification Battery.**

---

## 6. Remote Content Seeding Policy: STRICTLY BLOCKED

> [!CAUTION]
> **REMOTE CONTENT SEEDING IS STRICTLY BLOCKED BY DEFAULT.**
>
> 1. `scripts/import-profile-notes-to-d1.mjs` explicitly rejects `--remote-staging` with exit code 1.
> 2. Applying Migration 0004 does NOT grant authorization to seed or publish personal profile content.
> 3. Profile, education, and career content must remain in draft state until explicit human operator confirmation is obtained via `docs/reviews/PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md`.
> 4. Do NOT present remote content seeding as implemented, tested, or authorized.

---

## 7. Rollback & Disaster Recovery Runbook

If any anomaly occurs during staging deployment:

### Plan A: Worker Deployment Rollback (Subject to Schema Compatibility)
> [!WARNING]
> Worker rollback is **NOT** unconditionally safe. Before executing a rollback:
> 1. Verify that the previous Worker Version ID exists and is recorded.
> 2. Confirm that Migration 0004 schema changes (16 new tables, 13 new indexes) are purely additive and do NOT alter columns or tables required by the previous Worker version.
> 3. Execute rollback only with explicit operator authorization:
>    ```bash
>    npx wrangler rollback <PREVIOUS_VERSION_ID> --env staging --config cloudflare/portfolio-api/wrangler.jsonc
>    ```

### Plan B: Non-Destructive Database Point-in-Time Restore
In the event of database inconsistency:
1. Cease all write operations immediately.
2. **NEVER attempt full SQL restore against a populated remote D1 database.**
3. Destructive commands (`DROP TABLE`, manual cascading deletes) are **STRICTLY FORBIDDEN**.
4. In the event of catastrophic data corruption, follow Cloudflare D1 point-in-time recovery (PITR) procedures or isolated table-by-table reconstruction using the verified private backup taken in Step H.

---

## 8. Operator Authorization Gate

| Verdict | Meaning | Action |
| :--- | :--- | :--- |
| **VERDICT A (Approved)** | Operator approves staging rollout | Proceed through Step L in exact sequence |
| **VERDICT B (Revise)** | Operator requests code/test changes | Remain local, address revisions |
| **VERDICT C (Hold)** | Operator keeps Phase 5 local | Gate closed; no remote calls |
