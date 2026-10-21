# Portfolio OS Phase 5: Cloudflare Staging Deployment Approval Plan & Operator Runbook

**Project:** Kerem Mıhçı Portfolio OS  
**Repository Branch:** `feature/portfolio-phase5-notes-profile-cv`  
**Current Phase:** Phase 5 — Profile, Notes, Experience, Education, Skills & CV CMS  
**Current Status:** **LOCAL VERIFICATION COMPLETE — STAGING GATE CLOSED**  

---

## 1. Approval Gate Statement

Phase 5 local implementation, integration, automated verification, and browser E2E testing are **100% complete**.

In strict accordance with Portfolio OS safety guidelines:
- **Zero remote mutations** have been performed.
- Migration `0004_profile_notes_cv_schema.sql` has **NOT** been applied to Cloudflare staging D1.
- Cloudflare staging Worker has **NOT** been deployed with Phase 5 code.
- Remote R2 has **NOT** been mutated.
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

## 3. Preflight Preconditions (Mandatory Before Execution)

Before any remote operations commence, the operator must verify:

1. **Git Working Tree Cleanliness**:
   All Phase 5 changes committed to `feature/portfolio-phase5-notes-profile-cv`.
2. **Local Test Health**:
   - `scripts/verify-phase3-video-cms.mjs`: 112/112 PASS
   - `scripts/verify-phase4-gallery-cms.mjs`: 87/87 PASS
   - `scripts/verify-phase5-profile-notes-cms.mjs`: 144/144 PASS
   - `scripts/verify-phase5-browser-e2e.mjs`: 12/12 PASS
   - `npx tsc --noEmit`: 0 errors
   - `npm run lint`: 0 errors
3. **Staging D1 State Verification**:
   Query remote staging D1 to ensure existing data is intact:
   - Projects: 30 canonical published records
   - Videos: 21 canonical published records
   - Gallery: Existing items intact
4. **Staging Backup Export**:
   Export a full SQL dump of staging D1 prior to applying Migration 0004.

---

## 4. Step-by-Step Staging Rollout Procedure

### Step 1: Preflight Backup of Staging D1
Export an isolated, timestamped snapshot of staging D1 to a private location outside git tracking:
```bash
BACKUP_PATH="/tmp/staging-d1-pre-phase5-$(date +%s).sql"
npx wrangler d1 export kerem-portfolio-db-staging --env staging --output "$BACKUP_PATH"
chmod 0600 "$BACKUP_PATH"
shasum -a 256 "$BACKUP_PATH"
```
Verify the backup file exists, is non-empty, permissions are restricted (mode 0600), and SHA-256 digest is safely recorded in the release log.

### Step 2: Apply Migration 0004 to Staging D1
Apply additive migration `0004_profile_notes_cv_schema.sql` to staging D1:
```bash
npx wrangler d1 migrations apply kerem-portfolio-db-staging --env staging --remote
```
Verify output confirms 16 tables and 13 indexes created without errors.

### Step 3: Deploy Phase 5 Cloudflare Worker
Deploy the updated Worker API to staging:
```bash
cd cloudflare/portfolio-api
npx wrangler deploy --env staging
```
Record the deployed Worker version ID and timestamp.

### Step 4: Seed Canonical Profile & Notes Data to Staging D1
> [!IMPORTANT]
> Remote staging seeding is strictly fail-closed by default.
> `scripts/import-profile-notes-to-d1.mjs` explicitly rejects `--remote-staging` and requires separate explicit operator authorization.
> When remote seeding authorization is granted, seed data using verified migration or authorized tooling.
Verify remote data contains authentic canonical entities:
- 1 Profile record (`main`)
- 24 Workspace Notes partitioned across `design`, `web`, and `motion-ai`
- 5 Experience items
- 1 Education item
- 39 Skills across 6 categories
- 2 CV documents (`tr`, `en`) in initial `draft` status

### Step 5: Execute Remote Staging E2E Verification
Run the authenticated staging E2E verification test against the live staging Worker:
- Verify public endpoints return 200 OK.
- Verify unpublished draft CV returns 404 with `no-store`.
- Verify admin endpoints require valid Service Token.
- Verify zero regression across existing 30 projects, 21 videos, and gallery items.

---

## 5. Rollback & Disaster Recovery Runbook

If any step fails or unexpected behavior is observed during staging rollout:

### Plan A: Worker Version Rollback (Non-Destructive)
Roll back the Worker to the last verified Phase 4.2 stable deployment:
```bash
npx wrangler rollback <PHASE4_WORKER_VERSION_ID> --env staging
```
Because Migration 0004 is purely additive (16 new tables with zero changes to existing tables), the Phase 4 Worker immediately resumes normal operation ignoring the additive tables without data loss.

### Plan B: Non-Destructive Database Recovery
If database inconsistencies occur:
1. Immediately cease Worker write operations.
2. In the event of schema rollback necessity, restore from the verified private preflight backup taken in Step 1:
```bash
# Verify preflight backup integrity
shasum -a 256 "$BACKUP_PATH"
# Execute non-destructive restore to staging D1 only under operator authorization
```
3. Destructive operations (such as manual `DROP TABLE` cascades) are strictly prohibited on staging databases to prevent accidental deletion of shared canonical project, video, and gallery records.

---

## 6. Operator Authorization Verdicts

To authorize execution of the staging deployment plan, the user/operator selects one of the following:

- **VERDICT A (Approved):** Operator explicitly approves Phase 5 staging deployment following the steps in Section 4.
- **VERDICT B (Revise):** Operator requests modifications to local implementation, content, or test suites prior to staging rollout.
- **VERDICT C (Hold):** Keep Phase 5 in local verification state; do not deploy to Cloudflare staging.
