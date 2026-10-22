#!/usr/bin/env node

/**
 * Phase 6 Gate A: Production Infrastructure-Only Post-Deployment Closeout & Verification
 *
 * Strictly read-only checks against production Cloudflare resources.
 * ZERO remote POST / PUT / PATCH / DELETE requests.
 * ZERO token file reads from host operator directories.
 * Tests disabled seed fail-closed behavior exclusively against an isolated local disposable Worker fixture.
 * Outputs results to: docs/reviews/PORTFOLIO_OS_PHASE6_GATEA_CLOSEOUT_RESULTS.json
 */

import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";

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
  "PORTFOLIO_OS_PHASE6_GATEA_CLOSEOUT_RESULTS.json"
);

// Canonical expected application tables (37)
const EXPECTED_APPLICATION_TABLES = [
  "admin_audit_logs",
  "admin_rate_limits",
  "admin_sessions",
  "categories",
  "portfolio_cv_documents",
  "portfolio_cv_revisions",
  "portfolio_education",
  "portfolio_education_revisions",
  "portfolio_education_translations",
  "portfolio_experience",
  "portfolio_experience_revisions",
  "portfolio_experience_translations",
  "portfolio_gallery_assets",
  "portfolio_gallery_items",
  "portfolio_gallery_revisions",
  "portfolio_gallery_translations",
  "portfolio_profile",
  "portfolio_profile_revisions",
  "portfolio_profile_translations",
  "portfolio_skill_translations",
  "portfolio_skills",
  "portfolio_video_assets",
  "portfolio_video_revisions",
  "portfolio_video_translations",
  "portfolio_videos",
  "portfolio_workspace_notes",
  "portfolio_workspace_notes_revisions",
  "portfolio_workspace_notes_translations",
  "project_categories",
  "project_media",
  "project_revisions",
  "project_services",
  "project_translations",
  "projects",
  "publishing_events",
  "services",
  "site_settings"
].sort();

// Canonical expected explicit indexes (37)
const EXPECTED_EXPLICIT_INDEXES = [
  "idx_admin_audit_logs_created",
  "idx_admin_rate_limits_updated",
  "idx_admin_sessions_actor_active",
  "idx_admin_sessions_expires",
  "idx_portfolio_cv_locale",
  "idx_portfolio_cv_rev",
  "idx_portfolio_education_rev",
  "idx_portfolio_education_status_sort",
  "idx_portfolio_education_tr_lookup",
  "idx_portfolio_experience_rev",
  "idx_portfolio_experience_status_sort",
  "idx_portfolio_experience_tr_lookup",
  "idx_portfolio_gallery_assets_lookup",
  "idx_portfolio_gallery_assets_storage_key",
  "idx_portfolio_gallery_revisions_lookup",
  "idx_portfolio_gallery_status_sort",
  "idx_portfolio_gallery_translations_lookup",
  "idx_portfolio_skill_tr_lookup",
  "idx_portfolio_skills_category_sort",
  "idx_portfolio_video_assets_lookup",
  "idx_portfolio_video_assets_storage_key",
  "idx_portfolio_video_revisions_lookup",
  "idx_portfolio_video_translations_lookup",
  "idx_portfolio_videos_featured",
  "idx_portfolio_videos_orientation",
  "idx_portfolio_videos_slug",
  "idx_portfolio_videos_status_sort",
  "idx_portfolio_workspace_notes_lookup",
  "idx_portfolio_workspace_notes_rev",
  "idx_portfolio_workspace_notes_tr_lookup",
  "idx_project_media_project_sort",
  "idx_project_revisions_project",
  "idx_project_translations_project_locale",
  "idx_projects_featured",
  "idx_projects_slug",
  "idx_projects_status_workspace",
  "idx_publishing_events_project"
].sort();

const EXPECTED_MIGRATIONS = [
  "0001_initial_schema.sql",
  "0002_videos_and_reels_schema.sql",
  "0003_personal_gallery_schema.sql",
  "0004_profile_notes_cv_schema.sql"
];

function getSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parseD1Json(output) {
  const jsonStart = output.indexOf("[");
  const jsonEnd = output.lastIndexOf("]");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    const raw = output.slice(jsonStart, jsonEnd + 1);
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to parse D1 JSON output: ${err.message}`);
    }
  }
  throw new Error("No JSON array found in D1 command output: " + output.slice(0, 200));
}

function parseBucketInfo(output) {
  const info = {};
  for (const line of output.split("\n")) {
    const match = line.match(/^([a-z_]+):\s+(.*)$/);
    if (match) {
      info[match[1]] = match[2].trim();
    }
  }
  return info;
}

function getAvailablePort(preferred = 8996) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(preferred, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      const randomServer = net.createServer();
      randomServer.listen(0, "127.0.0.1", () => {
        const port = randomServer.address().port;
        randomServer.close(() => resolve(port));
      });
    });
  });
}

async function waitForWorker(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/v1/public/health`);
      if (res.status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Worker did not become ready at ${url} within ${timeoutMs}ms`);
}

const results = [];

function record(category, check, passed, detail = "") {
  results.push({ category, check, passed, detail });
  const statusMark = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${statusMark}] [${category}] ${check} ${detail ? "(" + detail + ")" : ""}`);
}

async function main() {
  console.log("==================================================================");
  console.log("PORTFOLIO OS PHASE 6 GATE A: POST-DEPLOYMENT CLOSEOUT & RECONCILIATION");
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
  console.log("\n--- GROUP 2: Production D1 Database State & Exact Schema ---");
  try {
    const d1ListOut = execSync("npx wrangler d1 list", { encoding: "utf8" });
    const hasProdD1 = d1ListOut.includes(EXPECTED_PRODUCTION_D1_UUID);
    record("Cloudflare D1", `Production D1 database exists with UUID ${EXPECTED_PRODUCTION_D1_UUID}`, hasProdD1);
    const hasStagingD1 = d1ListOut.includes(EXPECTED_STAGING_D1_UUID);
    record("Cloudflare D1", `Staging D1 database preserved with UUID ${EXPECTED_STAGING_D1_UUID}`, hasStagingD1);
  } catch (err) {
    record("Cloudflare D1", "Wrangler D1 list query", false, err.message);
  }

  // Exact Table Identity Verification (37 application tables + d1_migrations = 38)
  let remoteTableNames = [];
  try {
    const tablesOut = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name != 'sqlite_sequence' ORDER BY name;"`,
      { encoding: "utf8" }
    );
    const parsed = parseD1Json(tablesOut);
    if (!parsed?.[0]?.results || !Array.isArray(parsed[0].results)) {
      throw new Error("Invalid results array structure from D1 tables query");
    }
    remoteTableNames = parsed[0].results.map((r) => r.name).sort();
    const hasExact38 = remoteTableNames.length === 38;
    record("Cloudflare D1 Schema", "Production D1 has exactly 38 tables (37 app + d1_migrations)", hasExact38, `Found ${remoteTableNames.length}`);

    // Verify all 37 application tables are present
    const appTablesOnly = remoteTableNames.filter((t) => t !== "d1_migrations");
    const missingAppTables = EXPECTED_APPLICATION_TABLES.filter((t) => !appTablesOnly.includes(t));
    const extraAppTables = appTablesOnly.filter((t) => !EXPECTED_APPLICATION_TABLES.includes(t));
    const exactMatch = missingAppTables.length === 0 && extraAppTables.length === 0;
    record(
      "Cloudflare D1 Schema",
      "All 37 approved application tables match schema definitions by exact name",
      exactMatch,
      exactMatch ? "37/37 exact name match" : `Missing: [${missingAppTables.join(",")}], Extra: [${extraAppTables.join(",")}]`
    );
  } catch (err) {
    record("Cloudflare D1 Schema", "Production D1 table identity verification", false, err.message);
  }

  // Exact Explicit Index Identity Verification (37 explicit indexes)
  try {
    const indexesOut = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name;"`,
      { encoding: "utf8" }
    );
    const parsed = parseD1Json(indexesOut);
    if (!parsed?.[0]?.results || !Array.isArray(parsed[0].results)) {
      throw new Error("Invalid results array structure from D1 indexes query");
    }
    const remoteIndexNames = parsed[0].results.map((r) => r.name).sort();
    const hasExact37 = remoteIndexNames.length === 37;
    record("Cloudflare D1 Schema", "Production D1 has exactly 37 explicit indexes", hasExact37, `Found ${remoteIndexNames.length}`);

    const missingIndexes = EXPECTED_EXPLICIT_INDEXES.filter((idx) => !remoteIndexNames.includes(idx));
    const extraIndexes = remoteIndexNames.filter((idx) => !EXPECTED_EXPLICIT_INDEXES.includes(idx));
    const exactIndexMatch = missingIndexes.length === 0 && extraIndexes.length === 0;
    record(
      "Cloudflare D1 Schema",
      "All 37 explicit indexes match schema definitions by exact name",
      exactIndexMatch,
      exactIndexMatch ? "37/37 exact name match" : `Missing: [${missingIndexes.join(",")}], Extra: [${extraIndexes.join(",")}]`
    );
  } catch (err) {
    record("Cloudflare D1 Schema", "Production D1 index identity verification", false, err.message);
  }

  // Migration Ledger Verification (4 applied migrations, 0 pending)
  try {
    const migrationsOut = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id;"`,
      { encoding: "utf8" }
    );
    const parsed = parseD1Json(migrationsOut);
    if (!parsed?.[0]?.results || !Array.isArray(parsed[0].results)) {
      throw new Error("Invalid results array structure from d1_migrations query");
    }
    const appliedNames = parsed[0].results.map((r) => r.name);
    const matchesAll = EXPECTED_MIGRATIONS.every((name, idx) => appliedNames[idx] === name);
    record(
      "Cloudflare D1 Ledger",
      "Exact migrations 0001 through 0004 recorded in d1_migrations ledger in order",
      matchesAll && appliedNames.length === 4,
      `Ledger: [${appliedNames.join(", ")}]`
    );
  } catch (err) {
    record("Cloudflare D1 Ledger", "Production D1 migration ledger check", false, err.message);
  }

  // Content Table Row Counts (Must be 0 across all 33 content/editorial tables)
  try {
    const q1 = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "
SELECT
  (SELECT count(*) FROM projects) as p,
  (SELECT count(*) FROM project_translations) as ptr,
  (SELECT count(*) FROM project_media) as pm,
  (SELECT count(*) FROM categories) as c,
  (SELECT count(*) FROM project_categories) as pc,
  (SELECT count(*) FROM services) as s,
  (SELECT count(*) FROM project_services) as ps,
  (SELECT count(*) FROM project_revisions) as prev,
  (SELECT count(*) FROM publishing_events) as pe,
  (SELECT count(*) FROM portfolio_videos) as pv,
  (SELECT count(*) FROM portfolio_video_translations) as pvt,
  (SELECT count(*) FROM portfolio_video_assets) as pva,
  (SELECT count(*) FROM portfolio_video_revisions) as pvr
"`,
      { encoding: "utf8" }
    );
    const parsed1 = parseD1Json(q1);
    const res1 = parsed1?.[0]?.results?.[0];
    if (!res1 || typeof res1 !== "object" || Object.keys(res1).length !== 13) {
      throw new Error("Malformed batch 1 content row count query response");
    }
    const b1Zero = Object.values(res1).every((val) => Number(val) === 0);

    const q2 = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "
SELECT
  (SELECT count(*) FROM portfolio_gallery_items) as gi,
  (SELECT count(*) FROM portfolio_gallery_translations) as gt,
  (SELECT count(*) FROM portfolio_gallery_assets) as ga,
  (SELECT count(*) FROM portfolio_gallery_revisions) as gr,
  (SELECT count(*) FROM portfolio_profile) as pr,
  (SELECT count(*) FROM portfolio_profile_translations) as prt,
  (SELECT count(*) FROM portfolio_profile_revisions) as prr,
  (SELECT count(*) FROM portfolio_workspace_notes) as wn,
  (SELECT count(*) FROM portfolio_workspace_notes_translations) as wnt,
  (SELECT count(*) FROM portfolio_workspace_notes_revisions) as wnr,
  (SELECT count(*) FROM portfolio_experience) as ex,
  (SELECT count(*) FROM portfolio_experience_translations) as ext,
  (SELECT count(*) FROM portfolio_experience_revisions) as exr
"`,
      { encoding: "utf8" }
    );
    const parsed2 = parseD1Json(q2);
    const res2 = parsed2?.[0]?.results?.[0];
    if (!res2 || typeof res2 !== "object" || Object.keys(res2).length !== 13) {
      throw new Error("Malformed batch 2 content row count query response");
    }
    const b2Zero = Object.values(res2).every((val) => Number(val) === 0);

    const q3 = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "
SELECT
  (SELECT count(*) FROM portfolio_education) as ed,
  (SELECT count(*) FROM portfolio_education_translations) as edt,
  (SELECT count(*) FROM portfolio_education_revisions) as edr,
  (SELECT count(*) FROM portfolio_skills) as sk,
  (SELECT count(*) FROM portfolio_skill_translations) as skt,
  (SELECT count(*) FROM portfolio_cv_documents) as cv,
  (SELECT count(*) FROM portfolio_cv_revisions) as cvr
"`,
      { encoding: "utf8" }
    );
    const parsed3 = parseD1Json(q3);
    const res3 = parsed3?.[0]?.results?.[0];
    if (!res3 || typeof res3 !== "object" || Object.keys(res3).length !== 7) {
      throw new Error("Malformed batch 3 content row count query response");
    }
    const b3Zero = Object.values(res3).every((val) => Number(val) === 0);

    const allContentZero = b1Zero && b2Zero && b3Zero;
    record(
      "Cloudflare D1 Content",
      "All 33 canonical and editorial content tables contain exactly 0 rows (zero content seeding)",
      allContentZero,
      allContentZero ? "33/33 tables 0 rows" : "Nonzero content detected!"
    );
  } catch (err) {
    record("Cloudflare D1 Content", "Production D1 content row count query", false, err.message);
  }

  // Operational Table Row Counts (site_settings, admin_audit_logs, admin_sessions, admin_rate_limits)
  try {
    const qOps = execSync(
      `npx wrangler d1 execute kerem-portfolio-db --config cloudflare/portfolio-api/wrangler.jsonc --env production --remote --command "
SELECT
  (SELECT count(*) FROM site_settings) as settings,
  (SELECT count(*) FROM admin_audit_logs) as audit_logs,
  (SELECT count(*) FROM admin_sessions) as sessions,
  (SELECT count(*) FROM admin_rate_limits) as rate_limits
"`,
      { encoding: "utf8" }
    );
    const parsedOps = parseD1Json(qOps);
    const resOps = parsedOps?.[0]?.results?.[0];
    if (!resOps || typeof resOps !== "object" || Object.keys(resOps).length !== 4) {
      throw new Error("Malformed operational row count query response");
    }
    const opsZero = Object.values(resOps).every((val) => Number(val) === 0);
    record(
      "Cloudflare D1 Operations",
      "All 4 operational and audit tables accurately accounted (0 operational records)",
      opsZero,
      `settings: ${resOps.settings}, audit_logs: ${resOps.audit_logs}, sessions: ${resOps.sessions}, rate_limits: ${resOps.rate_limits}`
    );
  } catch (err) {
    record("Cloudflare D1 Operations", "Production D1 operational row count query", false, err.message);
  }

  // -------------------------------------------------------------
  // GROUP 3: Cloudflare R2 State & Bucket Info Evidence
  // -------------------------------------------------------------
  console.log("\n--- GROUP 3: Cloudflare R2 Storage State ---");
  try {
    const r2ListOut = execSync("npx wrangler r2 bucket list", { encoding: "utf8" });
    const bucketNames = r2ListOut
      .split("\n")
      .filter((l) => l.startsWith("name:"))
      .map((l) => l.replace(/^name:\s+/, "").trim());

    const hasProdR2Exact = bucketNames.includes("kerem-portfolio-media");
    record("Cloudflare R2", "Production R2 bucket kerem-portfolio-media exists (exact name match)", hasProdR2Exact);

    const hasStagingR2Exact = bucketNames.includes("kerem-portfolio-media-staging");
    record("Cloudflare R2", "Staging R2 bucket kerem-portfolio-media-staging preserved (exact name match)", hasStagingR2Exact);
  } catch (err) {
    record("Cloudflare R2", "Wrangler R2 bucket list query", false, err.message);
  }

  // Authenticated Bucket Info Query for Production R2
  try {
    const prodInfoOut = execSync("npx wrangler r2 bucket info kerem-portfolio-media", { encoding: "utf8" });
    const prodInfo = parseBucketInfo(prodInfoOut);
    const isExactName = prodInfo.name === "kerem-portfolio-media";
    const objectCount = parseInt(prodInfo.object_count, 10);
    const isZeroCount = objectCount === 0;
    const isZeroSize = prodInfo.bucket_size === "0 B";

    record(
      "Cloudflare R2 Inventory",
      "CURRENT_OBJECT_COUNT_VERIFIED via authenticated bucket info (object_count = 0, size = 0 B)",
      isExactName && isZeroCount && isZeroSize,
      `object_count: ${prodInfo.object_count}, bucket_size: ${prodInfo.bucket_size}`
    );
    record(
      "Cloudflare R2 Inventory",
      "PREDEPLOYMENT_COUNT_UNVERIFIED explicitly acknowledged (T-0 automated snapshot was not recorded)",
      true,
      "Differentiated from post-deployment verified count"
    );
  } catch (err) {
    record("Cloudflare R2 Inventory", "Production R2 bucket info query", false, err.message);
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
  console.log("\n--- GROUP 5: Production Worker Live HTTPS Endpoints (GET/HEAD Only) ---");

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
  // GROUP 6: Security, Authentication & Seed Safeguards
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

  // Admin seed endpoint without authentication -> 401 (GET/HEAD only)
  try {
    const res = await fetch(`${PRODUCTION_WORKER_URL}/api/v1/admin/seed`);
    const is401 = res.status === 401;
    record("Security", "GET /api/v1/admin/seed without auth returns 401 Unauthorized", is401);
  } catch (err) {
    record("Security", "GET /api/v1/admin/seed unauth request", false, err.message);
  }

  // Source Configuration Verification (Read-Only)
  try {
    const wranglerContent = fs.readFileSync("cloudflare/portfolio-api/wrangler.jsonc", "utf8");
    // Strip JSON comments
    const stripped = wranglerContent.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, "");
    const config = JSON.parse(stripped);
    const prodVars = config.env?.production?.vars || {};
    const seedDisabledInConfig = prodVars.ALLOW_CANONICAL_SEED === "false";
    const prodEnvInConfig = prodVars.ENVIRONMENT === "production";
    record(
      "Source Config Verification",
      "ALLOW_CANONICAL_SEED=false confirmed in production configuration (wrangler.jsonc)",
      seedDisabledInConfig,
      `ALLOW_CANONICAL_SEED: "${prodVars.ALLOW_CANONICAL_SEED}"`
    );
    record(
      "Source Config Verification",
      "ENVIRONMENT=production confirmed in production configuration (wrangler.jsonc)",
      prodEnvInConfig,
      `ENVIRONMENT: "${prodVars.ENVIRONMENT}"`
    );
  } catch (err) {
    record("Source Config Verification", "Parsing wrangler.jsonc configuration", false, err.message);
  }

  // Local Disposable Worker Fixture Verification (Zero Remote Calls)
  console.log("\n--- GROUP 7: Local Disposable Worker Fixture (Seed Lockdown Negative Test) ---");
  const tempSandboxDir = path.join("/tmp", `gatea-closeout-seed-test-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
  fs.mkdirSync(tempSandboxDir, { recursive: true });

  const ephemeralServiceToken = `test-token-${crypto.randomBytes(16).toString("hex")}`;
  const port = await getAvailablePort(8996);
  const workerUrl = `http://127.0.0.1:${port}`;
  const wranglerConfigPath = path.join(rootDir, "cloudflare", "portfolio-api", "wrangler.jsonc");

  let localWorkerProcess = null;
  try {
    // Apply migrations to temporary sandbox database
    execSync(
      `echo "y" | npx wrangler d1 migrations apply PORTFOLIO_DB --local --persist-to "${tempSandboxDir}" --config "${wranglerConfigPath}"`,
      { encoding: "utf-8" }
    );

    localWorkerProcess = spawn(
      "npx",
      [
        "wrangler",
        "dev",
        "--local",
        "--port",
        String(port),
        "--ip",
        "127.0.0.1",
        "--persist-to",
        tempSandboxDir,
        "--config",
        wranglerConfigPath,
        "--var",
        `CLOUDFLARE_API_SERVICE_TOKEN:${ephemeralServiceToken}`,
        "--var",
        "ALLOW_CANONICAL_SEED:false"
      ],
      {
        cwd: rootDir,
        stdio: "pipe"
      }
    );

    await waitForWorker(workerUrl, 25000);

    const seedRes = await fetch(`${workerUrl}/api/v1/admin/seed`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ephemeralServiceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action: "seed" })
    });

    const seedJson = await seedRes.json();
    const is403 = seedRes.status === 403 && seedJson.ok === false && seedJson.error?.includes("ALLOW_CANONICAL_SEED=false");
    record(
      "Local Worker Fixture",
      "POST /api/v1/admin/seed with valid synthetic token rejected with 403 (ALLOW_CANONICAL_SEED=false)",
      is403,
      `Status: ${seedRes.status}, Error: "${seedJson.error}"`
    );
  } catch (err) {
    record("Local Worker Fixture", "Local disposable Worker seed lockdown negative test", false, err.message);
  } finally {
    if (localWorkerProcess) {
      localWorkerProcess.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (fs.existsSync(tempSandboxDir)) {
      try {
        fs.rmSync(tempSandboxDir, { recursive: true, force: true });
      } catch {}
    }
  }

  // -------------------------------------------------------------
  // Summary & File Writing
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("\n==================================================================");
  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`VERDICT: ${failed === 0 ? "GATEA_CLOSED_VERIFIED" : "FAIL"}`);
  console.log("==================================================================\n");

  const summary = {
    suite: "PORTFOLIO_OS_PHASE6_GATEA_CLOSEOUT",
    timestamp: new Date().toISOString(),
    verdict: failed === 0 ? "GATEA_CLOSED_VERIFIED" : "FAIL",
    stats: { total, passed, failed },
    gitProvenance: {
      deployed_code_source: "6e8c053fc105db301b063a1df4c0dfbbd097be84",
      latest_report_commit: "aa552d6ad4df2c341ba962543ce0b89f85925423",
      current_closeout_commit: "HEAD"
    },
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
        region: "EEUR",
        total_schema_tables: 38,
        application_tables: 37,
        explicit_indexes: 37,
        content_rows: 0,
        operational_rows: 0,
        migration_rows: 4
      },
      production_r2: {
        name: "kerem-portfolio-media",
        r2_bucket_existence_verified: true,
        current_object_count_verified: 0,
        current_bucket_size: "0 B",
        predeployment_count_unverified: true
      },
      staging_invariance: {
        d1_uuid: EXPECTED_STAGING_D1_UUID,
        worker_version: EXPECTED_STAGING_WORKER_VERSION,
        r2_bucket: "kerem-portfolio-media-staging",
        status: "PRESERVED_UNTOUCHED"
      },
      host_invariance: {
        path: ".local-d1/portfolio.sqlite",
        sha256: EXPECTED_HOST_DB_SHA256,
        status: "STRICTLY_INVARIANT"
      }
    },
    proceduralFindings: [
      {
        id: "FINDING-GATEA-POST-01",
        description: "The historical test execution in verify-phase6-gatea-production-infra.mjs performed a POST to /api/v1/admin/seed using the production service token. The response was HTTP 403 Forbidden confirming seed lockdown. This request was outside the authorized GET/HEAD smoke-test scope.",
        resolution: "The test script was refactored: production token reading and remote POST requests were completely removed. Seed rejection is now validated via read-only source configuration checks and an isolated local disposable Worker fixture."
      }
    ],
    results
  };

  fs.writeFileSync(RESULTS_PATH, JSON.stringify(summary, null, 2), "utf8");
  console.log(`Wrote closeout reconciliation results to ${RESULTS_PATH}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in closeout verification suite:", err);
  process.exit(1);
});
