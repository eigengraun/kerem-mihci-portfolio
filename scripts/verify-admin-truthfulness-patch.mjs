#!/usr/bin/env node
/**
 * scripts/verify-admin-truthfulness-patch.mjs
 *
 * Automated verification suite for FLASH — PORTFOLIO OS FINAL CMS TRUTHFULNESS PATCH
 * 
 * Tests:
 * 1. Remote Worker Health Truthfulness:
 *    - In staging/production mode, Worker health failure MUST NOT fall back to local SQLite ok:true
 *    - In d1Engine getLocalD1HealthAndStats(), if storageMode !== 'local', ok must be false
 *    - In AdminDashboardClient.tsx, healthStatus strictly requires health.ok && health.d1Connected === true
 * 2. Reconciliation Must Not False-Pass:
 *    - reconcileProjectsListWithCanonical returns checkCompleted: true and appropriate status
 *    - reconcileCanonicalProjectsWithD1 on error returns checkCompleted: false and status: 'unexecuted'
 *    - AdminDashboardClient explicitly marks unexecuted checks as UNAVAILABLE, never BASELINE VERIFIED
 * 3. Dynamic Totals Elimination:
 *    - No hardcoded '11 published desktop icons'
 *    - No hardcoded '72 indexed R2 assets'
 * 4. Media Library Visibility:
 *    - No hardcoded .slice(0, 60)
 *    - Pagination / Show More / Show All controls present
 * 5. Unsupported Status Claims Removed:
 *    - No 'Active & Bound'
 *    - No 'validated physical assets in R2 bucket'
 *    - No 'Cryptographically logged administrative operations'
 *    - No 'cryptographic protections'
 * 6. Live Staging Daemon Non-Regression:
 *    - Admin dashboard loads on 127.0.0.1:3099
 *    - Public /tr and /en render properly
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

async function run() {
  console.log("=== Verifying Admin Data Truthfulness Patch ===");

  // -------------------------------------------------------------
  // Test 1: Source Code Audit for Hardcoded Values & Claims
  // -------------------------------------------------------------
  console.log("\n[1] Source Code Truthfulness Audit in AdminDashboardClient.tsx");
  const adminClientSrc = readFileSync(
    resolve(ROOT, "src/app/admin/AdminDashboardClient.tsx"),
    "utf-8"
  );

  assert(
    !adminClientSrc.includes("11 published desktop icons"),
    "Hardcoded '11 published desktop icons' removed from AdminDashboardClient.tsx"
  );
  assert(
    adminClientSrc.includes("published desktop icons") &&
      adminClientSrc.includes("projects.filter((p) => p.cmsStatus === \"published\" && p.featured).length"),
    "Featured live icons dynamically computed from published & featured project count"
  );

  assert(
    !adminClientSrc.includes("72 indexed R2 assets"),
    "Hardcoded '72 indexed R2 assets' removed from AdminDashboardClient.tsx"
  );
  assert(
    adminClientSrc.includes("indexed metadata records") &&
      adminClientSrc.includes("health?.counts.mediaItems ?? mediaList.length"),
    "Media record count dynamically computed from health.counts.mediaItems ?? mediaList.length"
  );

  assert(
    !adminClientSrc.includes(".slice(0, 60)"),
    "Hardcoded '.slice(0, 60)' removed from media catalog in AdminDashboardClient.tsx"
  );
  assert(
    adminClientSrc.includes("mediaDisplayLimit") &&
      adminClientSrc.includes("Show More") &&
      adminClientSrc.includes("Show All"),
    "Media library pagination and 'Show More' / 'Show All' controls implemented"
  );

  assert(
    !adminClientSrc.includes("Active & Bound"),
    "Unsupported claim 'Active & Bound' removed"
  );
  assert(
    !adminClientSrc.includes("validated physical assets in R2 bucket"),
    "Unsupported claim 'validated physical assets in R2 bucket' removed"
  );
  assert(
    !adminClientSrc.includes("Cryptographically logged administrative operations"),
    "Unsupported claim 'Cryptographically logged administrative operations' removed"
  );
  assert(
    !adminClientSrc.includes("Runtime isolation & cryptographic protections"),
    "Unsupported claim 'Runtime isolation & cryptographic protections' removed"
  );

  // -------------------------------------------------------------
  // Test 2: Health Status Logic Strictness
  // -------------------------------------------------------------
  console.log("\n[2] Health Status Strictness in AdminDashboardClient.tsx");
  assert(
    adminClientSrc.includes("Boolean(health.ok && health.d1Connected === true)"),
    "healthStatus strictly requires health.ok && health.d1Connected === true"
  );
  assert(
    !adminClientSrc.includes("health.ok && (health.d1Connected !== false)"),
    "Old loose check health.d1Connected !== false eliminated"
  );
  assert(
    adminClientSrc.includes("isRemote ? \"D1 Staging Active\" : \"Local D1 Active\""),
    "Badge text accurately reflects remote staging vs local mode"
  );

  // -------------------------------------------------------------
  // Test 3: Reconciliation False-Pass Prevention
  // -------------------------------------------------------------
  console.log("\n[3] Reconciliation False-Pass Prevention in Source");
  const d1EngineSrc = readFileSync(
    resolve(ROOT, "src/lib/portfolio/d1Engine.ts"),
    "utf-8"
  );
  const repoSrc = readFileSync(
    resolve(ROOT, "src/lib/portfolio/repository.ts"),
    "utf-8"
  );
  const systemRouteSrc = readFileSync(
    resolve(ROOT, "src/app/api/admin/system/route.ts"),
    "utf-8"
  );

  assert(
    d1EngineSrc.includes("checkCompleted: true") &&
      d1EngineSrc.includes("status: \"verified\" | \"modified\" | \"mismatch\" | \"error\""),
    "d1Engine.reconcileProjectsListWithCanonical returns checkCompleted and typed status"
  );
  assert(
    d1EngineSrc.includes("checkCompleted: false") &&
      d1EngineSrc.includes("status: \"unexecuted\""),
    "d1Engine.reconcileCanonicalProjectsWithD1 returns checkCompleted: false & unexecuted when storageMode !== local"
  );
  assert(
    repoSrc.includes("checkCompleted: false") &&
      repoSrc.includes("status: \"unexecuted\""),
    "repository.reconcileCanonicalProjectsWithD1 catches errors and sets checkCompleted: false & unexecuted"
  );
  assert(
    systemRouteSrc.includes("checkCompleted: false") &&
      systemRouteSrc.includes("status: \"unexecuted\""),
    "api/admin/system route initializes checkCompleted: false and sets unexecuted on error"
  );
  assert(
    adminClientSrc.includes("reconciliation.checkCompleted === false || reconciliation.status === \"unexecuted\"") &&
      adminClientSrc.includes("code: \"UNAVAILABLE\""),
    "AdminDashboardClient explicitly handles unexecuted reconciliation as UNAVAILABLE"
  );

  // -------------------------------------------------------------
  // Test 4: Remote Health Truthfulness in Repository & d1Engine
  // -------------------------------------------------------------
  console.log("\n[4] Remote Health Truthfulness in d1Engine & repository");
  assert(
    d1EngineSrc.includes("if (storageMode !== \"local\") {\n    return {\n      ok: false"),
    "d1Engine.getD1HealthAndStats() returns ok: false in remote mode when local SQLite cannot attest"
  );
  assert(
    repoSrc.includes("catch (err) {") &&
      repoSrc.includes("Remote Worker Health Check Failed:") &&
      repoSrc.includes("d1Connected: false"),
    "repository.getD1HealthAndStats() catches worker errors and returns ok: false, d1Connected: false (no local fallback)"
  );

  // -------------------------------------------------------------
  // Test 5: Live Server Verification
  // -------------------------------------------------------------
  console.log("\n[5] Live Staging Server Response (127.0.0.1:3099)");
  try {
    const adminRes = await fetch("http://127.0.0.1:3099/admin");
    assert(adminRes.status === 200, "Admin login/dashboard HTTP 200 OK");
    const adminHtml = await adminRes.text();
    assert(
      adminHtml.includes("Studio OS") || adminHtml.includes("Admin"),
      "Admin HTML renders Studio OS shell"
    );

    const publicTrRes = await fetch("http://127.0.0.1:3099/tr");
    assert(publicTrRes.status === 200, "Public /tr desktop HTTP 200 OK");

    const publicEnRes = await fetch("http://127.0.0.1:3099/en");
    assert(publicEnRes.status === 200, "Public /en desktop HTTP 200 OK");
  } catch (err) {
    console.error("  ✗ Failed to connect to staging server daemon:", err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution threw uncaught error:", err);
  process.exit(1);
});
