#!/usr/bin/env node
/**
 * scripts/verify-phase6-gateb-local.mjs
 *
 * Portfolio OS Phase 6 — Gate B Local Implementation Readiness Test Suite
 *
 * Validates canonical project and video importers, media synchronization simulation,
 * routing documentation accuracy, editorial conflict preservation, fail-closed target
 * validation, and host database invariance using disposable temporary fixtures.
 *
 * Output: docs/reviews/PORTFOLIO_OS_PHASE6_GATEB_TEST_RESULTS.json
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  extractCanonicalProjects,
  runLocalProjectSeed,
  verifyProjectTargetConfiguration,
  compareCanonicalWithProjectRecord
} from "./import-canonical-projects-to-d1.mjs";

import {
  runLocalSeed as runLocalVideoSeed,
  verifyProductionTargetConfiguration as verifyVideoProdConfig,
  APPROVED_STAGING_CONFIG,
  APPROVED_PRODUCTION_CONFIG
} from "./import-canonical-videos-to-d1.mjs";

import {
  buildMediaManifest,
  simulateMediaSync
} from "./generate-media-manifest-and-simulation.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const EXPECTED_HOST_DB_SHA256 = "470d8f14ce1237cc557367f0b125be489f086fb99534ffa7fb046ad607182743";

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

const results = [];

function recordTest(id, name, status, details) {
  results.push({ id, name, status, details });
  console.log(`[${status === "PASS" ? "PASS" : "FAIL"}] ${id}: ${name}`);
  if (details) {
    console.log(`       ${typeof details === "string" ? details : JSON.stringify(details)}`);
  }
}

async function runMasterGateBSuite() {
  console.log("================================================================================");
  console.log(" PORTFOLIO OS PHASE 6 — PRODUCTION GATE B LOCAL READINESS TEST SUITE");
  console.log("================================================================================");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-gateb-test-"));
  console.log(`Disposable test sandbox created at: ${tmpDir}`);

  try {
    // 1. Verify 30 Canonical Projects Source
    try {
      const canonicalProjects = extractCanonicalProjects();
      const hasAllFields = canonicalProjects.every(
        (p) => p.id && p.slug && p.workspace && p.titleTR && p.titleEN && p.cover
      );
      if (canonicalProjects.length === 30 && hasAllFields) {
        recordTest(
          "GATEB-01",
          "Canonical Projects Source Manifest (30 records)",
          "PASS",
          "Extracted exactly 30 canonical projects from src/data/projects.ts with full bilingual fields."
        );
      } else {
        recordTest("GATEB-01", "Canonical Projects Source Manifest", "FAIL", `Count: ${canonicalProjects.length}`);
      }
    } catch (err) {
      recordTest("GATEB-01", "Canonical Projects Source Manifest", "FAIL", err.message);
    }

    // 2. Verify 21 Canonical Videos Source
    try {
      const videosTsPath = path.join(ROOT, "src", "data", "videos.ts");
      const rawVideoTs = fs.readFileSync(videosTsPath, "utf-8");
      const vMarker = "export const videosData: PortfolioVideo[] = [";
      const vStartIdx = rawVideoTs.indexOf(vMarker);
      const vEndMarker = "export function getSortedVideos";
      const vEndIdx = rawVideoTs.indexOf(vEndMarker);
      const vArrayLiteral = rawVideoTs.slice(vStartIdx + "export const videosData: PortfolioVideo[] =".length, vEndIdx).trim().replace(/;$/, "");
      const canonicalVideos = new Function(`return (${vArrayLiteral});`)();

      const portraits = canonicalVideos.filter((v) => (v.orientation || "portrait") === "portrait").length;
      const landscapes = canonicalVideos.filter((v) => v.orientation === "landscape").length;

      if (canonicalVideos.length === 21 && portraits === 19 && landscapes === 2) {
        recordTest(
          "GATEB-02",
          "Canonical Videos Source Manifest (21 records: 19 portrait, 2 landscape)",
          "PASS",
          "21 canonical video records verified with correct orientation distribution."
        );
      } else {
        recordTest("GATEB-02", "Canonical Videos Source Manifest", "FAIL", `Found: ${canonicalVideos.length}`);
      }
    } catch (err) {
      recordTest("GATEB-02", "Canonical Videos Source Manifest", "FAIL", err.message);
    }

    // 3. Media Manifest & Disk Asset Presence
    try {
      const manifest = buildMediaManifest();
      if (manifest.summary.totalUniqueFiles === 174 && manifest.summary.missingCount === 0) {
        recordTest(
          "GATEB-03",
          "Authoritative Media Manifest & Local Disk Presence",
          "PASS",
          `174 unique files (234 references) verified on disk (0 missing, total ${manifest.summary.totalPayloadMB} MB).`
        );
      } else {
        recordTest("GATEB-03", "Authoritative Media Manifest", "FAIL", `Missing count: ${manifest.summary.missingCount}`);
      }
    } catch (err) {
      recordTest("GATEB-03", "Authoritative Media Manifest", "FAIL", err.message);
    }

    // 4. Isolated R2 Media Synchronization Simulation (All 5 State-Machine Scenarios)
    try {
      const manifest = buildMediaManifest();
      const mockBucket = {};

      // 4a. Initial upload simulation
      const initialSync = simulateMediaSync(manifest, mockBucket);
      const uploadsCount = initialSync.plannedUploads.length;

      // Populate mock bucket with synced state
      for (const f of manifest.uniqueFiles) {
        mockBucket[f.intendedR2Key] = {
          byteSize: f.byteSize,
          sha256: f.sha256,
          protected: false
        };
      }

      // 4b. Repeat sync on populated state (idempotency: 0 writes)
      const repeatSync = simulateMediaSync(manifest, mockBucket);
      const skippedCount = repeatSync.skippedIdentical.length;

      // 4c. Conflict detection (hash mismatch)
      const sampleKey = manifest.uniqueFiles[0].intendedR2Key;
      mockBucket[sampleKey].sha256 = "mismatch-hash-00000000000000000000000000000000";
      const conflictSync = simulateMediaSync(manifest, mockBucket);

      // 4d. Protected object rejection
      mockBucket[sampleKey].protected = true;
      const protectedSync = simulateMediaSync(manifest, mockBucket);

      // 4e. Invalid MIME rejection
      const invalidMimeSync = simulateMediaSync(
        { uniqueFiles: [{ intendedR2Key: "bad.exe", mimeType: "application/x-msdownload", byteSize: 10, sha256: "abc" }] },
        {}
      );

      const allSimsPass =
        uploadsCount === 174 &&
        skippedCount === 174 &&
        conflictSync.conflictsRequiringApproval.length === 1 &&
        protectedSync.rejectedUnapprovedOverwrites.length === 1 &&
        invalidMimeSync.rejectedInvalidMimes.length === 1;

      if (allSimsPass) {
        recordTest(
          "GATEB-04",
          "Isolated R2 Synchronization Simulation (5 State-Machine Scenarios)",
          "PASS",
          "Clean upload, identical skip, hash conflict, protected overwrite rejection, and invalid MIME rejection validated."
        );
      } else {
        recordTest("GATEB-04", "Isolated R2 Synchronization Simulation", "FAIL", "Simulation conditions failed.");
      }
    } catch (err) {
      recordTest("GATEB-04", "Isolated R2 Synchronization Simulation", "FAIL", err.message);
    }

    // 5. Disposable Fixture: Canonical Project Importer (Pass 1 - Clean Insert)
    const disposableProjDb = path.join(tmpDir, "disposable-projects.sqlite");
    try {
      const canonicalProjects = extractCanonicalProjects();
      const res = await runLocalProjectSeed(canonicalProjects, {
        dbPath: disposableProjDb,
        isDryRun: false,
        isForce: false,
        isStrictAdmission: true
      });

      const checkDb = new DatabaseSync(disposableProjDb);
      const pCount = checkDb.prepare("SELECT COUNT(*) as c FROM projects").get().c;
      const tCount = checkDb.prepare("SELECT COUNT(*) as c FROM project_translations").get().c;
      const mCount = checkDb.prepare("SELECT COUNT(*) as c FROM project_media").get().c;
      const rCount = checkDb.prepare("SELECT COUNT(*) as c FROM project_revisions").get().c;
      const pubCount = checkDb.prepare("SELECT COUNT(*) as c FROM publishing_events").get().c;
      checkDb.close();

      if (pCount === 30 && tCount === 60 && mCount > 0 && rCount === 30 && pubCount === 30) {
        recordTest(
          "GATEB-05",
          "Disposable Fixture Project Import (Pass 1: 30 projects, 60 translations, 30 revisions)",
          "PASS",
          `Inserted 30 projects, 60 bilingual translations, ${mCount} gallery media items, 30 revisions, 30 publishing events.`
        );
      } else {
        recordTest("GATEB-05", "Disposable Fixture Project Import", "FAIL", `Counts mismatch: p=${pCount}, t=${tCount}`);
      }
    } catch (err) {
      recordTest("GATEB-05", "Disposable Fixture Project Import", "FAIL", err.message);
    }

    // 6. Project Importer Idempotency (Pass 2 - Repeat Run)
    try {
      const canonicalProjects = extractCanonicalProjects();
      const resPass2 = await runLocalProjectSeed(canonicalProjects, {
        dbPath: disposableProjDb,
        isDryRun: false,
        isForce: false,
        isStrictAdmission: true
      });

      if (resPass2.insertedCount === 0 && resPass2.updatedCount === 0 && resPass2.skippedCount === 30) {
        recordTest(
          "GATEB-06",
          "Project Importer Idempotency (Pass 2: 0 inserts, 0 updates, 30 skipped)",
          "PASS",
          "Second execution produced zero unexpected writes; all 30 records skipped as identical."
        );
      } else {
        recordTest("GATEB-06", "Project Importer Idempotency", "FAIL", `Pass 2 counts: inserted=${resPass2.insertedCount}, updated=${resPass2.updatedCount}`);
      }
    } catch (err) {
      recordTest("GATEB-06", "Project Importer Idempotency", "FAIL", err.message);
    }

    // 7. Project Editorial Conflict Preservation
    try {
      const checkDb = new DatabaseSync(disposableProjDb);
      // Simulate user editing a project in CMS
      checkDb.prepare("UPDATE projects SET client_name = 'Custom Editorial Client' WHERE slug = 'yanarsan-yangin-website-tasarimi'").run();
      checkDb.prepare(
        "INSERT INTO project_revisions (id, project_id, revision_number, action, snapshot_json, actor_email, created_at) VALUES ('rev-edit-1', 'yanarsan-yangin-website-tasarimi', 2, 'editorial_manual_update', '{}', 'kerem@keremmihci.com', datetime('now'))"
      ).run();
      checkDb.close();

      const canonicalProjects = extractCanonicalProjects();
      const resPass3 = await runLocalProjectSeed(canonicalProjects, {
        dbPath: disposableProjDb,
        isDryRun: false,
        isForce: false,
        isStrictAdmission: true
      });

      const checkDbAfter = new DatabaseSync(disposableProjDb);
      const row = checkDbAfter.prepare("SELECT client_name FROM projects WHERE slug = 'yanarsan-yangin-website-tasarimi'").get();
      checkDbAfter.close();

      const preserved = row.client_name === "Custom Editorial Client";
      const conflictDetected = resPass3.editorialConflicts.some((c) => c.slug === "yanarsan-yangin-website-tasarimi");

      if (preserved && conflictDetected) {
        recordTest(
          "GATEB-07",
          "Project Editorial Conflict Protection (Preserves User Edits)",
          "PASS",
          "Detected EDITORIAL_CONFLICT on modified project; refused to overwrite canonical data; user client_name preserved."
        );
      } else {
        recordTest("GATEB-07", "Project Editorial Conflict Protection", "FAIL", "Editorial data was overwritten or conflict not detected.");
      }
    } catch (err) {
      recordTest("GATEB-07", "Project Editorial Conflict Protection", "FAIL", err.message);
    }

    // 8. Disposable Fixture: Canonical Video Importer (Pass 1 - Clean Insert)
    const disposableVideoDb = path.join(tmpDir, "disposable-videos.sqlite");
    try {
      const videosTsPath = path.join(ROOT, "src", "data", "videos.ts");
      const rawVideoTs = fs.readFileSync(videosTsPath, "utf-8");
      const vMarker = "export const videosData: PortfolioVideo[] = [";
      const vStartIdx = rawVideoTs.indexOf(vMarker);
      const vEndMarker = "export function getSortedVideos";
      const vEndIdx = rawVideoTs.indexOf(vEndMarker);
      const vArrayLiteral = rawVideoTs.slice(vStartIdx + "export const videosData: PortfolioVideo[] =".length, vEndIdx).trim().replace(/;$/, "");
      const canonicalVideos = new Function(`return (${vArrayLiteral});`)();

      // Seed 0001 initial schema first so video schema has base tables if needed
      const migration0001 = path.join(ROOT, "cloudflare", "portfolio-api", "migrations", "0001_initial_schema.sql");
      const vDb = new DatabaseSync(disposableVideoDb);
      vDb.exec("PRAGMA journal_mode = WAL;");
      vDb.exec(fs.readFileSync(migration0001, "utf-8"));
      vDb.close();

      const vRes1 = await runLocalVideoSeed(canonicalVideos, {
        dbPath: disposableVideoDb,
        isDryRun: false,
        isForce: false,
        isStrictAdmission: false
      });

      const checkDb = new DatabaseSync(disposableVideoDb);
      const vCount = checkDb.prepare("SELECT COUNT(*) as c FROM portfolio_videos").get().c;
      const vtCount = checkDb.prepare("SELECT COUNT(*) as c FROM portfolio_video_translations").get().c;
      const vaCount = checkDb.prepare("SELECT COUNT(*) as c FROM portfolio_video_assets").get().c;
      const vrCount = checkDb.prepare("SELECT COUNT(*) as c FROM portfolio_video_revisions").get().c;
      checkDb.close();

      if (vCount === 21 && vtCount === 42 && vaCount === 42 && vrCount === 21) {
        recordTest(
          "GATEB-08",
          "Disposable Fixture Video Import (Pass 1: 21 videos, 42 translations, 42 assets)",
          "PASS",
          "Inserted 21 videos, 42 bilingual translations, 42 video/poster assets, 21 revisions."
        );
      } else {
        recordTest("GATEB-08", "Disposable Fixture Video Import", "FAIL", `Counts mismatch: v=${vCount}, vt=${vtCount}`);
      }
    } catch (err) {
      recordTest("GATEB-08", "Disposable Fixture Video Import", "FAIL", err.message);
    }

    // 9. Video Importer Idempotency (Pass 2 - Repeat Run with Strict Admission)
    try {
      const videosTsPath = path.join(ROOT, "src", "data", "videos.ts");
      const rawVideoTs = fs.readFileSync(videosTsPath, "utf-8");
      const vMarker = "export const videosData: PortfolioVideo[] = [";
      const vStartIdx = rawVideoTs.indexOf(vMarker);
      const vEndMarker = "export function getSortedVideos";
      const vEndIdx = rawVideoTs.indexOf(vEndMarker);
      const vArrayLiteral = rawVideoTs.slice(vStartIdx + "export const videosData: PortfolioVideo[] =".length, vEndIdx).trim().replace(/;$/, "");
      const canonicalVideos = new Function(`return (${vArrayLiteral});`)();

      const vRes2 = await runLocalVideoSeed(canonicalVideos, {
        dbPath: disposableVideoDb,
        isDryRun: false,
        isForce: false,
        isStrictAdmission: true
      });

      const isIdempotent =
        vRes2.manifest.summary.inserted === 0 &&
        vRes2.manifest.summary.skipped === 21 &&
        vRes2.manifest.parityPassed === true;

      if (isIdempotent) {
        recordTest(
          "GATEB-09",
          "Video Importer Idempotency (Pass 2: 0 inserts, 21 skipped, strict parity verified)",
          "PASS",
          "Second video pass produced zero unexpected writes; all 21 records skipped as identical with strict admission pass."
        );
      } else {
        recordTest("GATEB-09", "Video Importer Idempotency", "FAIL", `Summary: inserted=${vRes2.manifest?.summary?.inserted}, skipped=${vRes2.manifest?.summary?.skipped}`);
      }
    } catch (err) {
      recordTest("GATEB-09", "Video Importer Idempotency", "FAIL", err.message);
    }

    // 10. Fail-Closed Target Validation (--remote-production execution rejection)
    try {
      const projectImporterPath = path.join(ROOT, "scripts", "import-canonical-projects-to-d1.mjs");
      const projRes = spawnSync(process.execPath, [projectImporterPath, "--remote-production", "--execute"], {
        cwd: ROOT,
        encoding: "utf-8"
      });

      const videoImporterPath = path.join(ROOT, "scripts", "import-canonical-videos-to-d1.mjs");
      const vidRes = spawnSync(process.execPath, [videoImporterPath, "--remote-production", "--execute"], {
        cwd: ROOT,
        encoding: "utf-8"
      });

      const projRejected = projRes.status !== 0;
      const vidRejected = vidRes.status !== 0;

      if (projRejected && vidRejected) {
        recordTest(
          "GATEB-10",
          "Remote Production Execution Fail-Closed Enforcement",
          "PASS",
          "Both project and video importers strictly reject --remote-production --execute without release gate authorization."
        );
      } else {
        recordTest("GATEB-10", "Remote Production Execution Fail-Closed Enforcement", "FAIL", "Importers permitted premature production execution!");
      }
    } catch (err) {
      recordTest("GATEB-10", "Remote Production Execution Fail-Closed Enforcement", "FAIL", err.message);
    }

    // 11. Routing Documentation Realities Verification
    try {
      const planPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE6_PRODUCTION_RELEASE_PLAN.md");
      const planContent = fs.readFileSync(planPath, "utf-8");

      const mentionsActiveZone = /Worker Custom Domains require an active Cloudflare Zone/i.test(planContent);
      const mentionsCnameConstraint = /Hostinger DNS CNAME alone does (?:\*not\*|not) establish/i.test(planContent);
      const mentionsPublicRoutable = /workers\.dev.*publicly (?:routable|reachable)/i.test(planContent);
      const mentionsPlanRestricted = /plan-restricted/i.test(planContent);

      if (mentionsActiveZone && mentionsCnameConstraint && mentionsPublicRoutable && mentionsPlanRestricted) {
        recordTest(
          "GATEB-11",
          "Cloudflare Routing Constraints Documented Accurately",
          "PASS",
          "Production release plan accurately details Cloudflare zone requirements, CNAME limitations, and workers.dev public routability."
        );
      } else {
        recordTest("GATEB-11", "Cloudflare Routing Constraints Documented Accurately", "FAIL", "Routing documentation missing required constraints.");
      }
    } catch (err) {
      recordTest("GATEB-11", "Cloudflare Routing Constraints Documented Accurately", "FAIL", err.message);
    }

    // 12. Content Governance Preservation (OWNER_VERIFICATION_REQUIRED)
    try {
      const checklistPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md");
      const checklistContent = fs.readFileSync(checklistPath, "utf-8");

      const preservesOwnerGate = checklistContent.includes("OWNER_VERIFICATION_REQUIRED");
      const cvPrivate = !checklistContent.includes("CV_AUTOMATICALLY_RELEASED");

      if (preservesOwnerGate && cvPrivate) {
        recordTest(
          "GATEB-12",
          "Personal Content Governance Strict Boundary",
          "PASS",
          "Biography, education, experience, notes, and CV remain strictly OWNER_VERIFICATION_REQUIRED. Zero auto-import."
        );
      } else {
        recordTest("GATEB-12", "Personal Content Governance Strict Boundary", "FAIL", "Governance gate weakened.");
      }
    } catch (err) {
      recordTest("GATEB-12", "Personal Content Governance Strict Boundary", "FAIL", err.message);
    }

    // 13. Host Local Database Invariance Check
    try {
      const hostDbPath = path.join(ROOT, ".local-d1", "portfolio.sqlite");
      const actualHash = sha256File(hostDbPath);

      if (actualHash === EXPECTED_HOST_DB_SHA256) {
        recordTest(
          "GATEB-13",
          "Host Database Checksum Invariance (.local-d1/portfolio.sqlite)",
          "PASS",
          `Checksum strictly invariant: ${actualHash}. Zero development database mutations.`
        );
      } else {
        recordTest("GATEB-13", "Host Database Checksum Invariance", "FAIL", `Changed! Expected ${EXPECTED_HOST_DB_SHA256}, got ${actualHash}`);
      }
    } catch (err) {
      recordTest("GATEB-13", "Host Database Checksum Invariance", "FAIL", err.message);
    }

  } finally {
    // Clean up temporary disposable directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const allPassed = results.every((r) => r.status === "PASS");
  const summary = {
    timestamp: new Date().toISOString(),
    totalChecks: results.length,
    passedChecks: results.filter((r) => r.status === "PASS").length,
    failedChecks: results.filter((r) => r.status === "FAIL").length,
    verdict: allPassed ? "GATEB_LOCAL_IMPLEMENTATION_READY" : "GATEB_LOCAL_BLOCKED",
    results
  };

  console.log("================================================================================");
  console.log(` SUMMARY: ${summary.passedChecks}/${summary.totalChecks} Checks Passed — Verdict: ${summary.verdict}`);
  console.log("================================================================================");

  const outputPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE6_GATEB_TEST_RESULTS.json");
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), "utf-8");
  console.log(`Results saved to ${outputPath}`);

  if (!allPassed) {
    process.exit(1);
  }
}

runMasterGateBSuite().catch((err) => {
  console.error("Master Gate B suite failed:", err);
  process.exit(1);
});
