# Portfolio OS Phase 5: Cloudflare Staging Deployment Approval Plan & Operator Runbook

**Project:** Kerem Mıhçı Portfolio OS  
**Repository Branch:** `feature/portfolio-phase5-notes-profile-cv`  
**Current Phase:** Phase 5.2 — Final Local Release Readiness & Operator Gate  
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

## 2. Target Staging Infrastructure Identities

| Resource | Target Identity | Verification ID / Details |
| :--- | :--- | :--- |
| **Cloudflare Account** | Eigengraun Studio | `9791a288e2e99e7f3403590480e3ad6f` |
| **Staging Worker** | `kerem-mihci-portfolio-api-staging` | URL: `https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev` |
| **Staging D1 Database** | `kerem-portfolio-db-staging` | UUID: `0efef7a7-cc93-4dc2-8cb7-db28379fe01f` |
| **Staging R2 Bucket** | `kerem-portfolio-media-staging` | Media object storage |
| **Wrangler Configuration**| `cloudflare/portfolio-api/wrangler.jsonc` | Target environment: `staging` |
| **Migration to Apply** | `0004_profile_notes_cv_schema.sql` | Status: `NOT_APPLIED` |

---

## 3. Verified Local Baseline Test Evidence

All required local verification batteries have been executed and verified passing 100%:

| Test Battery | Command | Checks | Status |
| :--- | :--- | :---: | :---: |
| **Phase 5 Functional & API Suite** | `node scripts/verify-phase5-profile-notes-cms.mjs` | **168** | **PASS (168/168)** |
| **Phase 5.2 Real Browser Playwright E2E** | `node scripts/verify-phase5-browser-e2e.mjs` | **60** | **PASS (60/60)** |
| **Phase 5.2 Local Worker Runtime E2E** | `node scripts/verify-phase5-worker-runtime.mjs` | **26** | **PASS (26/26)** |
| **Phase 3 Video CMS Regression** | `node scripts/verify-phase3-video-cms.mjs` | **112** | **PASS (112/112)** |
| **Phase 4 Gallery CMS Regression** | `node scripts/verify-phase4-gallery-cms.mjs` | **87** | **PASS (87/87)** |
| **TypeScript Typecheck** | `npx tsc --noEmit` | N/A | **PASS (0 errors)** |
| **ESLint Static Analysis** | `npm run lint` | N/A | **PASS (0 errors)** |
| **Next.js Webpack Build** | `npm run build` | N/A | **PASS (Clean compile)** |
| **Wrangler Deploy Dry-Run (Local)** | `npx wrangler deploy --dry-run` | N/A | **PASS (0 errors)** |
| **Wrangler Deploy Dry-Run (Staging)** | `npx wrangler deploy --dry-run --env staging` | N/A | **PASS (0 errors)** |
| **Host Database Checksum** | `shasum -a 256 .local-d1/portfolio.sqlite` | N/A | **PASS (`470d8f14ce12...`)** |

---

## 4. Single Fail-Closed Staging Preflight Sequence (Steps A through L)

Before executing any remote mutations, the operator must execute this strict sequence:

### Step A: Verify Exact Reviewed Source Commit
```bash
git rev-parse HEAD
# Expected: 6de5c7d4e30f757c6b99bd970346b3eff44b01bf (or subsequent reviewed commit)
git status --porcelain
# Expected: Clean working tree
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

### Step D: Verify Current Worker Version & Deployment ID
```bash
npx wrangler deployments list --env staging --config cloudflare/portfolio-api/wrangler.jsonc
# Record current active Version ID for instant non-destructive rollback capability
```

### Step E: Verify Migration Inventory and Approved Hashes
```bash
shasum -a 256 cloudflare/portfolio-api/migrations/0004_profile_notes_cv_schema.sql
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
BACKUP_PATH="$HOME/.cloudflare/backups/staging-d1-pre-phase5-$(date +%s).sql"
(umask 077 && npx wrangler d1 export kerem-portfolio-db-staging --env staging --remote --output "$BACKUP_PATH" --config cloudflare/portfolio-api/wrangler.jsonc)
chmod 0600 "$BACKUP_PATH"
shasum -a 256 "$BACKUP_PATH"
```

### Step I: Restore Backup in Isolated SQLite Environment
Verify dump syntax and table structure by importing it into a temporary local SQLite database:
```bash
node -e '
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const sql = fs.readFileSync(process.env.BACKUP_PATH, "utf-8");
const db = new DatabaseSync(":memory:");
db.exec(sql);
console.log("Backup SQL restore verified successfully.");
'
```

### Step J: Verify Identity-Level Canonical Data Preservation
Confirm the backup contains:
- 30 canonical projects
- 21 canonical videos
- 3 canonical gallery items

### Step K: STOP at Explicit Operator Authorization Gate
**HALT EXECUTION.** Present preflight evidence to the operator and await explicit written approval (`VERDICT A`).

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

## 5. Remote Content Seeding Policy: STRICTLY BLOCKED

> [!CAUTION]
> **CONTENT SEEDING IS STRICTLY BLOCKED BY DEFAULT.**
>
> 1. `scripts/import-profile-notes-to-d1.mjs` explicitly rejects `--remote-staging` with exit code 1.
> 2. Applying Migration 0004 does NOT grant authorization to seed or publish personal profile content.
> 3. Profile, education, and career content must remain in draft state until explicit human operator confirmation is obtained via `docs/reviews/PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md`.

---

## 6. Non-Destructive Rollback & Disaster Recovery Runbook

If any anomaly occurs during staging deployment:

### Plan A: Worker Deployment Rollback (Instant & Non-Destructive)
Roll back Worker execution to the recorded pre-deployment Version ID:
```bash
npx wrangler rollback <PREVIOUS_VERSION_ID> --env staging --config cloudflare/portfolio-api/wrangler.jsonc
```
Because Migration 0004 is purely additive (16 new tables, 13 new indexes), the previous Worker immediately resumes normal serving of projects, videos, and gallery without downtime or data corruption.

### Plan B: Non-Destructive Database Point-in-Time Restore
In the event of database inconsistency:
1. Cease all write operations immediately.
2. Destructive `DROP TABLE` commands are **STRICTLY PROHIBITED**.
3. Point-in-time restore is performed strictly using the verified backup captured in Step H under human supervision.

---

## 7. Operator Authorization Gate

| Verdict | Meaning | Action |
| :--- | :--- | :--- |
| **VERDICT A (Approved)** | Operator approves staging rollout | Proceed through Step L in exact sequence |
| **VERDICT B (Revise)** | Operator requests code/test changes | Remain local, address revisions |
| **VERDICT C (Hold)** | Operator keeps Phase 5 local | Gate closed; no remote calls |
