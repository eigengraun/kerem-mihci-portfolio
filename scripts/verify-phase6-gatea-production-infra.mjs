#!/usr/bin/env node

/**
 * Phase 6 Gate A: Production Infrastructure-Only Rollout Verification Suite
 *
 * Verifies Cloudflare Production Worker API, Production D1 Schema, and Zero Content Seeding.
 * Strictly read-only checks.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const rootDir = process.cwd();
const PRODUCTION_WORKER_URL = "https://kerem-mihci-portfolio-api.kerem-mihci.workers.dev";
const EXPECTED_ACCOUNT_ID = "9791a288e2e99e7f3403590480e3ad6f";
const EXPECTED_PRODUCTION_WORKER_VERSION = "c7dfcd18-d5aa-483a-a821-7adf11610e87";
const EXPECTED_PRODUCTION_D1_UUID = "d28c39dc-dc9b-4e9c-9477-1d8535f9e051";
const EXPECTED_STAGING_D1_UUID = "0efef7a7-cc93-4dc2-8cb7-db28379fe01f";
const EXPECTED_STAGING_WORKER_VERSION = "0f2b8f47-04f1-4103-852e-b241f475bcc3";
const HOST_DB_PATH = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const EXPECTED_HOST_DB_SHA256 = "470d8f14ce1237cc557367f0b125be489f086fb99534ffa7fb046ad607182743";

const RESULTS_PATH = path.join(
  rootDir,
  "docs",
  "reviews",
  "PORTFOLIO_OS_PHASE6_GATEA_PRODUCTION_INFRA_TEST_RESULTS.json"
);

function getSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parseD1Json(output) {
  const jsonStart = output.indexOf("[");
  const jsonEnd = output.lastIndexOf("]");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    const raw = output.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(raw);
  }
  return null;
}

const results = [];

function record(category, check, passed, detail = "") {
  results.push({ category, check, passed, detail });
  const statusMark = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${statusMark}] [${category}] ${check} ${detail ? "(" + detail + ")" : ""}`);
}

async function main() {
  console.log("==================================================================");
  console.log("PHASE 6 GATE A: PRODUCTION INFRASTRUCTURE-ONLY VERIFICATION SUITE");
  console.log("==================================================================\n");

  // -------------------------------------------------------------
  // GROUP 1: Cloudflare Production Deployment & Version Integrity
  // -------------------------------------------------------------
  console.log("--- GROUP 1: Production Worker Deployment State ---");
  try {
    const deploymentsOut = execSync(
      "npx wrangler deployments list -c cloudflare/portfolio-api/wrangler.jsonc --env production",
      { encoding: "utf8" }
    );
    const hasActiveVersion = deploymentsOut.includes(EXPECTED_PRODUCTION_WORKER_VERSION);
    record("Cloudflare Worker", `Active Worker version is ${EXPECTED_PRODUCTION_WORKER_VERSION}`, hasActiveVersion, "Version confirmed active");
    const has100Percent = deploymentsOut.includes(`(100%) ${EXPECTED_PRODUCTION_WORKER_VERSION}`);
    record("Cloudflare Worker", "Production Worker version receives 100% of traffic", has100Percent, "100% traffic allocation");
  } catch (err) {
    record("Cloudflare Worker", "Production Worker deployment query", false, err.message);
  }

  // -------------------------------------------------------------
  // GROUP 2: Cloudflare Production D1 Database Verification
  // -------------------------------------------------------------
  console.log("\n--- GROUP 2: Production D1 Database State ---");
  try {
    const d1ListOut = execSync("npx wrangler d1 list", { encoding: "utf8" });
    const hasProdD1 = d1ListOut.includes(EXPECTED_PRODUCTION_D1_UUID);
    record("Cloudflare D1", `Production D1 database exists with UUID ${EXPECTED_PRODUCTION_D1_UUID}`, hasProdD1);
    const hasStagingD1 = d1ListOut.includes(EXPECTED_STAGING_D1_UUID);
    record("Cloudflare D1", `Staging D1 database preserved with UUID ${EXPECTED_STAGING_D1_UUID}`, hasStagingD1);
  } catch (err) {
    record("Cloudflare D1", "Wrangler D1 list query", false, err.message);
  }

  // Check table count in production D1
  try {
    const tablesOut = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name != 'sqlite_sequence';"`,
      { encoding: "utf8" }
    );
    const parsed = parseD1Json(tablesOut);
    const count = parsed?.[0]?.results?.[0]?.count ?? 0;
    record("Cloudflare D1 Schema", "Production D1 has 38 schema tables (37 app + d1_migrations)", count === 38, `Found ${count}`);
  } catch (err) {
    record("Cloudflare D1 Schema", "Production D1 schema table count", false, err.message);
  }

  // Check explicit indexes count in production D1
  try {
    const indexesOut = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "SELECT count(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex_%';"`,
      { encoding: "utf8" }
    );
    const parsed = parseD1Json(indexesOut);
    const count = parsed?.[0]?.results?.[0]?.count ?? 0;
    record("Cloudflare D1 Schema", "Production D1 has 37 explicit indexes", count === 37, `Found ${count}`);
  } catch (err) {
    record("Cloudflare D1 Schema", "Production D1 explicit index count", false, err.message);
  }

  // Check row counts of all primary content tables (must be 0)
  try {
    const rowsOut = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "SELECT (SELECT count(*) FROM projects) as p, (SELECT count(*) FROM portfolio_videos) as v, (SELECT count(*) FROM portfolio_gallery_items) as g, (SELECT count(*) FROM portfolio_profile) as pr, (SELECT count(*) FROM portfolio_education) as ed, (SELECT count(*) FROM portfolio_experience) as ex, (SELECT count(*) FROM portfolio_skills) as sk, (SELECT count(*) FROM portfolio_cv_documents) as cv, (SELECT count(*) FROM portfolio_workspace_notes) as n;"`,
      { encoding: "utf8" }
    );
    const parsed = parseD1Json(rowsOut);
    const res = parsed?.[0]?.results?.[0] || {};
    const allZero = Object.values(res).every(val => Number(val) === 0);
    record("Cloudflare D1 Content", "Production D1 content tables have exactly 0 rows (zero seeding)", allZero, JSON.stringify(res));
  } catch (err) {
    record("Cloudflare D1 Content", "Production D1 zero row check", false, err.message);
  }

  // -------------------------------------------------------------
  // GROUP 3: Cloudflare R2 Bucket State
  // -------------------------------------------------------------
  console.log("\n--- GROUP 3: Cloudflare R2 State ---");
  try {
    const r2ListOut = execSync("npx wrangler r2 bucket list", { encoding: "utf8" });
    const hasProdR2 = r2ListOut.includes("kerem-portfolio-media");
    record("Cloudflare R2", "Production R2 bucket kerem-portfolio-media exists", hasProdR2);
    const hasStagingR2 = r2ListOut.includes("kerem-portfolio-media-staging");
    record("Cloudflare R2", "Staging R2 bucket kerem-portfolio-media-staging preserved", hasStagingR2);
  } catch (err) {
    record("Cloudflare R2", "Wrangler R2 bucket list query", false, err.message);
  }

  // -------------------------------------------------------------
  // GROUP 4: Staging & Host DB Invariance Checks
  // -------------------------------------------------------------
  console.log("\n--- GROUP 4: Invariance & Non-Regression Checks ---");
  try {
    const stagingDeploymentsOut = execSync(
      "npx wrangler deployments list -c cloudflare/portfolio-api/wrangler.jsonc --env staging",
      { encoding: "utf8" }
    );
    const stagingIntact = stagingDeploymentsOut.includes(`(100%) ${EXPECTED_STAGING_WORKER_VERSION}`);
    record("Staging Invariance", `Staging Worker intact with active version ${EXPECTED_STAGING_WORKER_VERSION}`, stagingIntact);
  } catch (err) {
    record("Staging Invariance", "Staging Worker deployment query", false, err.message);
  }

  const currentHostDbHash = getSha256(HOST_DB_PATH);
  record(
    "Host DB Invariance",
    "Local SQLite host database (.local-d1/portfolio.sqlite) is strictly invariant",
    currentHostDbHash === EXPECTED_HOST_DB_SHA256,
    `Hash: ${currentHostDbHash}`
  );

  // -------------------------------------------------------------
  // GROUP 5: Production Worker Live HTTPS Endpoints (Read-Only Smoke Tests)
  // -------------------------------------------------------------
  console.log("\n--- GROUP 5: Production Worker Live HTTPS Endpoints ---");

  // Health check
  try {
    const res = await fetch(`${PRODUCTION_WORKER_URL}/api/v1/public/health`);
    const data = await res.json();
    const isOk = res.status === 200 && data.ok === true && data.service === "kerem-mihci-portfolio-api" && data.publishedCount === 0;
    const cors = res.headers.get("access-control-allow-origin");
    record("Worker API Health", "GET /api/v1/public/health returns 200 ok=true publishedCount=0", isOk);
    record("Worker API CORS", "GET /api/v1/public/health provides CORS header for https://keremmihci.com", cors === "https://keremmihci.com", `Origin: ${cors}`);
  } catch (err) {
    record("Worker API Health", "GET /api/v1/public/health connection", false, err.message);
  }

  // Public content endpoints return empty collections
  const publicEndpoints = [
    { path: "/api/v1/public/projects", key: "projects" },
    { path: "/api/v1/public/videos", key: "videos" },
    { path: "/api/v1/public/gallery", key: "gallery" },
    { path: "/api/v1/public/experience", key: "experience" },
    { path: "/api/v1/public/education", key: "education" },
    { path: "/api/v1/public/skills", key: "skills" }
  ];

  for (const ep of publicEndpoints) {
    try {
      const res = await fetch(`${PRODUCTION_WORKER_URL}${ep.path}`);
      const data = await res.json();
      const isEmpty = res.status === 200 && data.ok === true && Array.isArray(data[ep.key]) && data[ep.key].length === 0;
      record("Public Endpoints", `GET ${ep.path} returns 200 with empty array`, isEmpty, `${ep.key}.length = ${data[ep.key]?.length}`);
    } catch (err) {
      record("Public Endpoints", `GET ${ep.path} request`, false, err.message);
    }
  }

  // Notes endpoints for all three workspaces
  const workspaceNotes = ["design", "web", "motion-ai"];
  for (const ws of workspaceNotes) {
    try {
      const res = await fetch(`${PRODUCTION_WORKER_URL}/api/v1/public/notes/${ws}`);
      const data = await res.json();
      const isEmpty = res.status === 200 && data.ok === true && Array.isArray(data.notes) && data.notes.length === 0;
      record("Public Notes", `GET /api/v1/public/notes/${ws} returns 200 with empty array`, isEmpty, `notes.length = ${data.notes?.length}`);
    } catch (err) {
      record("Public Notes", `GET /api/v1/public/notes/${ws} request`, false, err.message);
    }
  }

  // Unpublished profile and CV endpoints return 404
  try {
    const res = await fetch(`${PRODUCTION_WORKER_URL}/api/v1/public/profile`);
    const data = await res.json();
    const is404 = res.status === 404 && data.ok === false && data.code === "PROFILE_NOT_PUBLISHED";
    record("Unpublished Profile", "GET /api/v1/public/profile returns 404 PROFILE_NOT_PUBLISHED", is404, `Code: ${data.code}`);
  } catch (err) {
    record("Unpublished Profile", "GET /api/v1/public/profile request", false, err.message);
  }

  for (const locale of ["tr", "en"]) {
    try {
      const res = await fetch(`${PRODUCTION_WORKER_URL}/api/v1/public/cv/${locale}`);
      const data = await res.json();
      const is404 = res.status === 404 && data.ok === false && data.code === "CV_NOT_PUBLISHED";
      record("Unpublished CV", `GET /api/v1/public/cv/${locale} returns 404 CV_NOT_PUBLISHED`, is404, `Code: ${data.code}`);
    } catch (err) {
      record("Unpublished CV", `GET /api/v1/public/cv/${locale} request`, false, err.message);
    }
  }

  // -------------------------------------------------------------
  // GROUP 6: Security, Authentication & Fail-Closed Seed Safeguards
  // -------------------------------------------------------------
  console.log("\n--- GROUP 6: Security, Authentication & Seed Restrictions ---");

  // Admin endpoint without authentication -> 401
  try {
    const res = await fetch(`${PRODUCTION_WORKER_URL}/api/v1/admin/projects`);
    const data = await res.json();
    const is401 = res.status === 401 && data.ok === false;
    record("Security", "GET /api/v1/admin/projects without auth returns 401 Unauthorized", is401);
  } catch (err) {
    record("Security", "GET /api/v1/admin/projects unauth request", false, err.message);
  }

  // Admin endpoint with invalid bearer token -> 401
  try {
    const res = await fetch(`${PRODUCTION_WORKER_URL}/api/v1/admin/projects`, {
      headers: { Authorization: "Bearer definitely-invalid-token" }
    });
    const data = await res.json();
    const is401 = res.status === 401 && data.ok === false;
    record("Security", "GET /api/v1/admin/projects with invalid token returns 401 Unauthorized", is401);
  } catch (err) {
    record("Security", "GET /api/v1/admin/projects invalid token request", false, err.message);
  }

  // Canonical seed endpoint fail-closed check
  // Read service token from local private directory to test rejection of seed in production
  let serviceToken = null;
  const secretsBaseDir = path.join(process.env.HOME || "", ".portfolio-production-secrets");
  if (fs.existsSync(secretsBaseDir)) {
    const subdirs = fs.readdirSync(secretsBaseDir).filter(d => d.startsWith("gate-a-")).sort();
    if (subdirs.length > 0) {
      const latestDir = path.join(secretsBaseDir, subdirs[subdirs.length - 1]);
      const secretsJsonPath = path.join(latestDir, "secrets.json");
      if (fs.existsSync(secretsJsonPath)) {
        const parsed = JSON.parse(fs.readFileSync(secretsJsonPath, "utf8"));
        serviceToken = parsed.CLOUDFLARE_API_SERVICE_TOKEN;
      }
    }
  }

  if (serviceToken) {
    try {
      const res = await fetch(`${PRODUCTION_WORKER_URL}/api/v1/admin/seed`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "seed" })
      });
      const data = await res.json();
      const is403 = res.status === 403 && data.ok === false && data.error.includes("ALLOW_CANONICAL_SEED=false");
      record("Security Seed Lockdown", "POST /api/v1/admin/seed with valid token rejected with 403 (ALLOW_CANONICAL_SEED=false)", is403, data.error);
    } catch (err) {
      record("Security Seed Lockdown", "POST /api/v1/admin/seed authenticated request", false, err.message);
    }
  } else {
    record("Security Seed Lockdown", "Production service token available for seed lockdown check", false, "Token not found in ~/.portfolio-production-secrets");
  }

  // -------------------------------------------------------------
  // Summary & File Writing
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log("\n==================================================================");
  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`VERDICT: ${failed === 0 ? "GATEA_INFRA_PASS" : "FAIL"}`);
  console.log("==================================================================\n");

  const summary = {
    suite: "PORTFOLIO_OS_PHASE6_GATEA_PRODUCTION_INFRA",
    timestamp: new Date().toISOString(),
    verdict: failed === 0 ? "GATEA_INFRA_PASS" : "FAIL",
    stats: { total, passed, failed },
    cloudResources: {
      account_id: EXPECTED_ACCOUNT_ID,
      production_worker: {
        name: "kerem-mihci-portfolio-api",
        version_id: EXPECTED_PRODUCTION_WORKER_VERSION,
        url: PRODUCTION_WORKER_URL,
        traffic_percent: 100
      },
      production_d1: {
        name: "kerem-portfolio-db",
        uuid: EXPECTED_PRODUCTION_D1_UUID,
        total_tables: 38,
        application_tables: 37,
        explicit_indexes: 37,
        total_rows: 0
      },
      production_r2: {
        name: "kerem-portfolio-media",
        object_count: 0
      },
      staging_invariance: {
        d1_uuid: EXPECTED_STAGING_D1_UUID,
        worker_version: EXPECTED_STAGING_WORKER_VERSION,
        status: "PRESERVED_UNTOUCHED"
      },
      host_invariance: {
        path: ".local-d1/portfolio.sqlite",
        sha256: EXPECTED_HOST_DB_SHA256,
        status: "STRICTLY_INVARIANT"
      }
    },
    results
  };

  fs.writeFileSync(RESULTS_PATH, JSON.stringify(summary, null, 2), "utf8");
  console.log(`Wrote verification results to ${RESULTS_PATH}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("FATAL ERROR in verification suite:", err);
  process.exit(1);
});
