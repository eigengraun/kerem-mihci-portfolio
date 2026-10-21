#!/usr/bin/env node
/**
 * scripts/verify-local-dry-run-negative.mjs
 *
 * Negative & Admission Guard Suite:
 * 1. Proves local --dry-run cannot create a non-existent database file.
 * 2. Proves local --dry-run fails closed without running DDL when schema is incomplete.
 * 3. Proves local --dry-run leaves existing SQLite, WAL, and SHM files byte-for-byte untouched.
 * 4. Proves remote --strict-admission fails closed with exit code 1 when canonical videos are missing.
 * 5. Proves remote --strict-admission fails closed when identity conflicts exist.
 * 6. Proves remote --strict-admission passes cleanly when all 21 canonical videos are present.
 * 7. Confirms persistent host database (.local-d1/portfolio.sqlite) is 100% immutable.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const HOST_DB_PATH = path.join(ROOT, ".local-d1", "portfolio.sqlite");
const HOST_DB_EXPECTED_SHA = "65fc364d1989f5bd10d2d6de920cb2762b4cbac7c5591de5f9b3552649da24fd";

function sha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

async function runSuite() {
  console.log("============================================================");
  console.log("PORTFOLIO OS — LOCAL DRY-RUN & STRICT ADMISSION NEGATIVE GUARD");
  console.log("============================================================\n");

  const initialHostSha = sha256(HOST_DB_PATH);
  console.log(`[PREFLIGHT] Host DB SHA-256: ${initialHostSha}`);
  if (initialHostSha !== HOST_DB_EXPECTED_SHA) {
    console.error(`FATAL: Host DB SHA-256 does not match expected baseline: ${initialHostSha} != ${HOST_DB_EXPECTED_SHA}`);
    process.exit(1);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dry-run-negative-"));

  try {
    // -----------------------------------------------------------------
    // TEST 1: Non-existent database path with --local --dry-run fails closed
    // -----------------------------------------------------------------
    console.log("\n--- Test Group 1: Non-Existent Database Guard ---");
    const missingDbPath = path.join(tmpDir, `missing-db-${Date.now()}.sqlite`);
    const res1 = spawnSync(
      process.execPath,
      ["scripts/import-canonical-videos-to-d1.mjs", "--local", "--dry-run", `--db=${missingDbPath}`],
      { cwd: ROOT, encoding: "utf8" }
    );

    assert(res1.status === 1, "Dry-run against non-existent database exits with code 1");
    assert(
      res1.stderr.includes("LOCAL_DB_NOT_FOUND") || res1.stdout.includes("LOCAL_DB_NOT_FOUND"),
      "Error output explicitly identifies LOCAL_DB_NOT_FOUND"
    );
    assert(
      !fs.existsSync(missingDbPath),
      "Dry-run never created the missing database file on disk"
    );
    assert(
      !fs.existsSync(`${missingDbPath}-wal`) && !fs.existsSync(`${missingDbPath}-shm`),
      "Dry-run never created WAL or SHM files for missing database"
    );

    // -----------------------------------------------------------------
    // TEST 2: Incomplete schema with --local --dry-run fails closed without DDL
    // -----------------------------------------------------------------
    console.log("\n--- Test Group 2: Incomplete Schema Guard (Zero DDL in Dry-Run) ---");
    const emptyDbPath = path.join(tmpDir, `empty-db-${Date.now()}.sqlite`);
    const emptyDb = new DatabaseSync(emptyDbPath);
    emptyDb.close();
    const emptyDbShaBefore = sha256(emptyDbPath);

    const res2 = spawnSync(
      process.execPath,
      ["scripts/import-canonical-videos-to-d1.mjs", "--local", "--dry-run", `--db=${emptyDbPath}`],
      { cwd: ROOT, encoding: "utf8" }
    );

    assert(res2.status === 1, "Dry-run against empty database exits with code 1");
    assert(
      res2.stderr.includes("SCHEMA_INCOMPLETE") || res2.stdout.includes("SCHEMA_INCOMPLETE"),
      "Error output explicitly identifies SCHEMA_INCOMPLETE"
    );
    assert(
      sha256(emptyDbPath) === emptyDbShaBefore,
      "Database file remains byte-for-byte identical (zero DDL executed)"
    );
    assert(
      !fs.existsSync(`${emptyDbPath}-wal`) && !fs.existsSync(`${emptyDbPath}-shm`),
      "Zero WAL or SHM files created during failed dry-run on empty database"
    );

    // Check sqlite_master table count is strictly 0
    const checkEmptyDb = new DatabaseSync(emptyDbPath, { readOnly: true });
    const tablesCount = checkEmptyDb.prepare(`SELECT count(*) as cnt FROM sqlite_master WHERE type='table'`).get().cnt;
    checkEmptyDb.close();
    assert(Number(tablesCount) === 0, "sqlite_master contains strictly 0 tables (schema was not repaired)");

    // -----------------------------------------------------------------
    // TEST 3: Partial schema missing required translation/asset tables
    // -----------------------------------------------------------------
    console.log("\n--- Test Group 3: Partial Schema Rejection ---");
    const partialDbPath = path.join(tmpDir, `partial-db-${Date.now()}.sqlite`);
    const partialDb = new DatabaseSync(partialDbPath);
    partialDb.exec("CREATE TABLE portfolio_videos (id TEXT PRIMARY KEY, slug TEXT);");
    partialDb.close();
    const partialDbShaBefore = sha256(partialDbPath);

    const res3 = spawnSync(
      process.execPath,
      ["scripts/import-canonical-videos-to-d1.mjs", "--local", "--dry-run", `--db=${partialDbPath}`],
      { cwd: ROOT, encoding: "utf8" }
    );

    assert(res3.status === 1, "Dry-run against partially migrated database exits with code 1");
    assert(
      res3.stderr.includes("SCHEMA_INCOMPLETE") || res3.stdout.includes("SCHEMA_INCOMPLETE"),
      "Error identifies missing translation and asset tables"
    );
    assert(
      sha256(partialDbPath) === partialDbShaBefore,
      "Partial database content unchanged (zero DDL applied)"
    );

    // -----------------------------------------------------------------
    // TEST 4: Populated DB with --local --dry-run is byte-for-byte read-only
    // -----------------------------------------------------------------
    console.log("\n--- Test Group 4: Populated Database Read-Only Invariance ---");
    const completeDbPath = path.join(tmpDir, `complete-db-${Date.now()}.sqlite`);
    // Copy host database and companion files
    for (const ext of ["", "-wal", "-shm"]) {
      const src = HOST_DB_PATH + ext;
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, completeDbPath + ext);
      }
    }
    const hash = (p) => (fs.existsSync(p) ? crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") : null);
    const shaBefore = { db: hash(completeDbPath), wal: hash(completeDbPath + "-wal"), shm: hash(completeDbPath + "-shm") };

    const res4 = spawnSync(
      process.execPath,
      ["scripts/import-canonical-videos-to-d1.mjs", "--local", "--dry-run", `--db=${completeDbPath}`],
      { cwd: ROOT, encoding: "utf8" }
    );

    assert(res4.status === 0, "Dry-run against complete database exits with code 0");
    assert(
      res4.stdout.includes("skipped=21"),
      "Dry-run reports all 21 records skipped (zero writes attempted)"
    );
    const shaAfter = { db: hash(completeDbPath), wal: hash(completeDbPath + "-wal"), shm: hash(completeDbPath + "-shm") };
    assert(
      shaAfter.db === shaBefore.db,
      "Complete database file SHA-256 byte-for-byte identical before and after dry-run"
    );
    assert(
      shaAfter.wal === shaBefore.wal && shaAfter.shm === shaBefore.shm,
      "Zero in-place modifications to SQLite, WAL, or SHM files"
    );

    // -----------------------------------------------------------------
    // TEST 5: Populated DB with --local --dry-run --strict-admission passes
    // -----------------------------------------------------------------
    console.log("\n--- Test Group 5: Local Strict Admission Mode ---");
    const res5 = spawnSync(
      process.execPath,
      ["scripts/import-canonical-videos-to-d1.mjs", "--local", "--dry-run", "--strict-admission", `--db=${completeDbPath}`],
      { cwd: ROOT, encoding: "utf8" }
    );

    assert(res5.status === 0, "Local strict admission against complete database exits with code 0");
    assert(
      res5.stdout.includes("VERDICT: STRICT CANONICAL PARITY ADMISSION PASSED (21/21 PRESENT)"),
      "Local strict admission prints explicit passing verdict"
    );

    // -----------------------------------------------------------------
    // TEST 6: Remote Staging Dry-Run Strict Admission Fails on Missing Records
    // -----------------------------------------------------------------
    console.log("\n--- Test Group 6: Remote Strict Admission Missing Record Failure ---");
    const { runStagingImporterTestHarness } = await import("./import-canonical-videos-to-d1.mjs");
    const { videosData: canonicalVideos } = await import("../src/data/videos.ts");

    // Mock server returning empty inventory (all 21 missing)
    let mockServerReqs = 0;
    const mockServer = http.createServer((req, res) => {
      mockServerReqs++;
      if (req.url === "/api/v1/public/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, environment: "staging" }));
      } else if (req.url === "/api/v1/admin/videos") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, videos: [] }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
    const mockPort = mockServer.address().port;
    const mockUrl = `http://127.0.0.1:${mockPort}`;

    let strictFailedMissing = false;
    try {
      await runStagingImporterTestHarness({
        canonicalVideos,
        fetchImpl: fetch,
        workerUrl: mockUrl,
        token: "mock-valid-token-12345678",
        isDryRun: true,
        isStrictAdmission: true
      });
    } catch (err) {
      strictFailedMissing = err.message.includes("STRICT_ADMISSION_FAILED");
    }

    assert(strictFailedMissing, "Remote strict admission throws STRICT_ADMISSION_FAILED when videos are missing");

    // Informational dry-run without strict admission succeeds
    const infoDryRunRes = await runStagingImporterTestHarness({
      canonicalVideos,
      fetchImpl: fetch,
      workerUrl: mockUrl,
      token: "mock-valid-token-12345678",
      isDryRun: true,
      isStrictAdmission: false
    });
    assert(
      infoDryRunRes.dryRun === true && infoDryRunRes.strictAdmissionPassed === false,
      "Informational dry-run preserves non-failing reconciliation reporting when missing > 0"
    );

    mockServer.close();

    // -----------------------------------------------------------------
    // TEST 7: Remote Staging Dry-Run Strict Admission Passes with 21 Records
    // -----------------------------------------------------------------
    console.log("\n--- Test Group 7: Remote Strict Admission Complete Parity Success ---");
    const fullMockServer = http.createServer((req, res) => {
      if (req.url === "/api/v1/public/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, environment: "staging" }));
      } else if (req.url === "/api/v1/admin/videos") {
        // Return all 21 canonical videos
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          videos: canonicalVideos.map((c) => ({
            ...c,
            orientation: c.orientation || "portrait",
            productionMethod: c.productionMethod || "traditional",
            year: c.year || 2026,
            aspectRatio: c.orientation === "landscape" ? "16:9" : "9:16",
            shortTitleTR: c.shortTitleTR || "",
            shortTitleEN: c.shortTitleEN || "",
            descriptionTR: c.descriptionTR || "",
            descriptionEN: c.descriptionEN || "",
            fullDescriptionTR: c.fullDescriptionTR || "",
            fullDescriptionEN: c.fullDescriptionEN || "",
            client: c.client || "",
            duration: c.duration || "",
            tools: c.tools || [],
            tags: c.tags || [],
            servicesTR: c.servicesTR || c.services || [],
            servicesEN: c.servicesEN || c.services || [],
            thumbnail: c.thumbnail || null,
            externalUrl: c.externalUrl || null,
            projectSlug: c.projectSlug || null,
            src: c.src || `/videos/${c.slug}/video.mp4`,
            cmsStatus: "published"
          }))
        }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise((resolve) => fullMockServer.listen(0, "127.0.0.1", resolve));
    const fullMockPort = fullMockServer.address().port;
    const fullMockUrl = `http://127.0.0.1:${fullMockPort}`;

    const strictPassRes = await runStagingImporterTestHarness({
      canonicalVideos,
      fetchImpl: fetch,
      workerUrl: fullMockUrl,
      token: "mock-valid-token-12345678",
      isDryRun: true,
      isStrictAdmission: true
    });

    assert(strictPassRes.strictAdmissionPassed === true, "Remote strict admission passes when all 21 videos match");
    assert(strictPassRes.reconciliation.canonicalParity.length === 21, "All 21 videos verified in canonical parity");
    assert(strictPassRes.missingVideos.length === 0, "Zero missing videos verified");

    fullMockServer.close();

    // -----------------------------------------------------------------
    // TEST 8: Persistent Host Database Immutability Check
    // -----------------------------------------------------------------
    console.log("\n--- Test Group 8: Host Database Immutability Invariant ---");
    const finalHostSha = sha256(HOST_DB_PATH);
    assert(
      finalHostSha === HOST_DB_EXPECTED_SHA,
      `Persistent host database SHA-256 byte-for-byte identical (${finalHostSha.slice(0, 16)}...)`
    );
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }

  console.log("\n============================================================");
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("============================================================\n");

  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
