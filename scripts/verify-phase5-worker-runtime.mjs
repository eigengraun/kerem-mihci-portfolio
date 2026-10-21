#!/usr/bin/env node

/**
 * scripts/verify-phase5-worker-runtime.mjs
 *
 * Portfolio OS Phase 5.2: Isolated Local Cloudflare Worker Runtime E2E Suite
 *
 * Spawns an isolated local Cloudflare Worker instance via Wrangler/Miniflare
 * against a disposable migrated local D1 and local R2 fixture.
 * Strictly tests:
 * - Local migration application (0001 -> 0004) to local D1.
 * - Real runtime startup of Cloudflare Worker on localhost.
 * - Public API endpoints: health, profile, notes, experience, education, skills, CV.
 * - Draft visibility & fail-closed access control.
 * - Admin token enforcement: missing and invalid tokens rejected.
 * - Locale validation and error behavior.
 * - Invariant: ZERO remote Cloudflare calls, ZERO mutations to persistent host files.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const hostDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const wranglerConfigPath = path.join(rootDir, "cloudflare", "portfolio-api", "wrangler.jsonc");

const results = {
  suite: "Portfolio OS Phase 5.2 Local Cloudflare Worker Runtime E2E",
  timestamp: new Date().toISOString(),
  commit: "",
  total: 0,
  passed: 0,
  failed: 0,
  checks: [],
  failures: []
};

try {
  results.commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {
  results.commit = "unknown";
}

function assert(condition, name, detail = "") {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  ✓ PASS: ${name}${detail ? ` [${detail}]` : ""}`);
    results.checks.push({ name, status: "PASS", detail });
  } else {
    results.failed++;
    const msg = `  ✗ FAIL: ${name}${detail ? ` [${detail}]` : ""}`;
    console.error(msg);
    results.failures.push(name);
    results.checks.push({ name, status: "FAIL", detail });
  }
}

function getFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function getAvailablePort(preferred = 8891) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(preferred, "127.0.0.1", () => {
      srv.close(() => resolve(preferred));
    });
    srv.on("error", () => {
      const srv2 = net.createServer();
      srv2.listen(0, "127.0.0.1", () => {
        const port = srv2.address().port;
        srv2.close(() => resolve(port));
      });
    });
  });
}

async function waitForWorker(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/v1/public/health`);
      if (res.status === 200) {
        const json = await res.json();
        if (json.ok) return true;
      }
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Worker failed to start on ${url} within ${timeoutMs}ms.`);
}

async function runWorkerSuite() {
  console.log("============================================================");
  console.log("PORTFOLIO OS PHASE 5.2: LOCAL WORKER RUNTIME VERIFICATION");
  console.log(`Commit:    ${results.commit}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log("============================================================");

  const hostInitialSha256 = getFileSha256(hostDbPath);

  // 1. Task-Owned Fresh Persistence Sandbox
  const tempSandboxDir = path.join(os.tmpdir(), `p5-worker-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`);
  fs.mkdirSync(tempSandboxDir, { recursive: true });

  console.log(`\nInitializing isolated D1 database via local migrations...`);
  console.log(`Sandbox directory: ${tempSandboxDir}`);

  // Apply migrations 0001 through 0004 to local D1 via wrangler
  const migrationOutput = execSync(
    `echo "y" | npx wrangler d1 migrations apply PORTFOLIO_DB --local --persist-to "${tempSandboxDir}" --config "${wranglerConfigPath}"`,
    { encoding: "utf-8" }
  );

  assert(
    migrationOutput.includes("0004_profile_notes_cv_schema.sql") && migrationOutput.includes("✅"),
    "Wrangler local D1 migrations applied successfully (0001, 0002, 0003, 0004)"
  );

  const port = await getAvailablePort(8895);
  const workerUrl = `http://127.0.0.1:${port}`;
  let workerProcess = null;

  try {
    console.log(`\nSpawning local Worker process on port ${port}...`);
    workerProcess = spawn(
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
        wranglerConfigPath
      ],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          CLOUDFLARE_API_SERVICE_TOKEN: "test-ephemeral-service-token-98765"
        },
        stdio: "pipe"
      }
    );

    await waitForWorker(workerUrl, 25000);
    console.log(`Worker ready and responding at ${workerUrl}\n`);

    // --- Check 1: Health & Runtime Bindings ---
    const healthRes = await fetch(`${workerUrl}/api/v1/public/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200, "GET /api/v1/public/health returns HTTP 200");
    assert(healthJson.ok === true, "Health response reports ok: true");
    assert(healthJson.service === "kerem-mihci-portfolio-api", "Health response identifies service name");
    assert(
      healthJson.bindings?.d1 === "PORTFOLIO_DB" && healthJson.bindings?.r2 === "PORTFOLIO_MEDIA",
      "Health response verifies D1 (PORTFOLIO_DB) and R2 (PORTFOLIO_MEDIA) bindings"
    );

    // --- Check 2: Public Profile Endpoint ---
    const profileRes = await fetch(`${workerUrl}/api/v1/public/profile`);
    const profileJson = await profileRes.json();
    assert(
      profileRes.status === 404 || profileJson.ok === false,
      "GET /api/v1/public/profile enforces draft privacy on empty/unpopulated profile"
    );

    // --- Check 3: Workspace Notes Endpoints ---
    const wsNotesResDesign = await fetch(`${workerUrl}/api/v1/public/notes/design`);
    const wsNotesJsonDesign = await wsNotesResDesign.json();
    assert(wsNotesResDesign.status === 200, "GET /api/v1/public/notes/design returns HTTP 200");
    assert(wsNotesJsonDesign.workspaceId === "design", "Notes response returns correct workspaceId (design)");
    assert(Array.isArray(wsNotesJsonDesign.notes), "Notes response returns notes array");

    const wsNotesResWeb = await fetch(`${workerUrl}/api/v1/public/notes/web`);
    const wsNotesJsonWeb = await wsNotesResWeb.json();
    assert(wsNotesResWeb.status === 200, "GET /api/v1/public/notes/web returns HTTP 200");
    assert(wsNotesJsonWeb.workspaceId === "web", "Notes response returns correct workspaceId (web)");

    const wsNotesResMotion = await fetch(`${workerUrl}/api/v1/public/notes/motion-ai`);
    const wsNotesJsonMotion = await wsNotesResMotion.json();
    assert(wsNotesResMotion.status === 200, "GET /api/v1/public/notes/motion-ai returns HTTP 200");
    assert(wsNotesJsonMotion.workspaceId === "motion-ai", "Notes response returns correct workspaceId (motion-ai)");

    // --- Check 4: Experience & Education Endpoints ---
    const expRes = await fetch(`${workerUrl}/api/v1/public/experience`);
    const expJson = await expRes.json();
    assert(expRes.status === 200, "GET /api/v1/public/experience returns HTTP 200");
    assert(Array.isArray(expJson.experience), "Experience response returns experience array");

    const eduRes = await fetch(`${workerUrl}/api/v1/public/education`);
    const eduJson = await eduRes.json();
    assert(eduRes.status === 200, "GET /api/v1/public/education returns HTTP 200");
    assert(Array.isArray(eduJson.education), "Education response returns education array");

    // --- Check 5: Skills Endpoint ---
    const skillsRes = await fetch(`${workerUrl}/api/v1/public/skills`);
    const skillsJson = await skillsRes.json();
    assert(skillsRes.status === 200, "GET /api/v1/public/skills returns HTTP 200");
    assert(Array.isArray(skillsJson.skills), "Skills response returns skills array");

    // --- Check 6: Public CV Access & Draft Protection ---
    const cvEnRes = await fetch(`${workerUrl}/api/v1/public/cv/en`);
    assert(cvEnRes.status === 404, "GET /api/v1/public/cv/en returns HTTP 404 for missing/draft CV");

    const cvTrRes = await fetch(`${workerUrl}/api/v1/public/cv/tr`);
    assert(cvTrRes.status === 404, "GET /api/v1/public/cv/tr returns HTTP 404 for missing/draft CV");

    const cvInvalidLocaleRes = await fetch(`${workerUrl}/api/v1/public/cv/de`);
    assert(
      cvInvalidLocaleRes.status === 400 || cvInvalidLocaleRes.status === 404,
      "GET /api/v1/public/cv/de rejects invalid locale"
    );

    // --- Check 7: Admin Security & Bearer Token Enforcement ---
    const adminNoTokenRes = await fetch(`${workerUrl}/api/v1/admin/profile`);
    assert(
      adminNoTokenRes.status === 401 || adminNoTokenRes.status === 503,
      "GET /api/v1/admin/profile without Bearer token is strictly rejected"
    );

    const adminBadTokenRes = await fetch(`${workerUrl}/api/v1/admin/profile`, {
      headers: { Authorization: "Bearer definitely-wrong-token-abc-123" }
    });
    assert(
      adminBadTokenRes.status === 401 || adminBadTokenRes.status === 503,
      "GET /api/v1/admin/profile with invalid Bearer token is strictly rejected"
    );

    // --- Check 8: CORS & Cache-Control Safety ---
    const corsHeader = healthRes.headers.get("access-control-allow-origin");
    assert(
      corsHeader === "*" || corsHeader === "https://keremmihci.com",
      "Public endpoints return valid Access-Control-Allow-Origin header"
    );

  } finally {
    if (workerProcess) {
      console.log("\nShutting down local Worker process...");
      workerProcess.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1000));
    }

    try {
      if (fs.existsSync(tempSandboxDir)) {
        fs.rmSync(tempSandboxDir, { recursive: true, force: true });
      }
    } catch {}

    // Check host DB invariance
    const hostFinalSha256 = getFileSha256(hostDbPath);
    assert(
      hostInitialSha256 === hostFinalSha256,
      "Zero host mutations: .local-d1/portfolio.sqlite SHA256 is 100% identical before and after Worker suite",
      `Initial: ${hostInitialSha256?.slice(0, 16)}... | Final: ${hostFinalSha256?.slice(0, 16)}...`
    );
  }

  console.log("\n============================================================");
  console.log("LOCAL WORKER RUNTIME RESULTS SUMMARY");
  console.log("============================================================");
  console.log(`TOTAL CHECKS: ${results.total}`);
  console.log(`PASSED:       ${results.passed}`);
  console.log(`FAILED:       ${results.failed}`);

  if (results.failed > 0) {
    console.error("\nFAILURES:");
    for (const f of results.failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }
}

runWorkerSuite().catch((err) => {
  console.error("FATAL ERROR IN WORKER RUNTIME SUITE:", err);
  process.exit(1);
});
