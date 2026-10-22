#!/usr/bin/env node

/**
 * scripts/verify-staging-seed-disabled.mjs
 *
 * Isolated Local Test for Staging Canonical Seed Protection
 * Verifies that when ALLOW_CANONICAL_SEED="false" (as configured in staging),
 * POST /api/v1/admin/seed fails closed with HTTP 403 Forbidden.
 *
 * Uses synthetic credentials and a disposable temporary SQLite database in /tmp.
 * ZERO remote requests or mutations.
 */

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function getAvailablePort(preferred = 8991) {
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

async function waitForWorker(url, timeoutMs = 20000) {
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

async function runSeedDisabledTest() {
  console.log("============================================================");
  console.log("STAGING CANONICAL SEED DISABLED LOCAL NEGATIVE TEST");
  console.log("============================================================\n");

  const tempSandboxDir = path.join("/tmp", `seed-test-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
  fs.mkdirSync(tempSandboxDir, { recursive: true });

  const ephemeralServiceToken = `test-token-${crypto.randomBytes(16).toString("hex")}`;
  const port = await getAvailablePort(8995);
  const workerUrl = `http://127.0.0.1:${port}`;
  const wranglerConfigPath = path.join(rootDir, "cloudflare", "portfolio-api", "wrangler.jsonc");

  // Apply migrations to temporary sandbox database
  execSync(
    `echo "y" | npx wrangler d1 migrations apply PORTFOLIO_DB --local --persist-to "${tempSandboxDir}" --config "${wranglerConfigPath}"`,
    { encoding: "utf-8" }
  );

  let workerProcess = null;

  try {
    console.log(`Spawning local Worker process on port ${port} with staging config (ALLOW_CANONICAL_SEED=false)...`);
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
    console.log(`Worker ready and responding at ${workerUrl}\n`);

    // 1. Attempt POST /api/v1/admin/seed with valid synthetic credentials
    const seedRes = await fetch(`${workerUrl}/api/v1/admin/seed`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ephemeralServiceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        projects: [{ id: "unauthorized-seed-attempt", slug: "unauthorized-seed-attempt" }]
      })
    });

    const seedJson = await seedRes.json();
    console.log(`POST /api/v1/admin/seed Response: HTTP ${seedRes.status}`);
    console.log("Response Body:", JSON.stringify(seedJson));

    if (seedRes.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden, got HTTP ${seedRes.status}`);
    }
    if (seedJson.ok !== false) {
      throw new Error(`Expected ok: false, got ok: ${seedJson.ok}`);
    }
    if (!seedJson.error?.includes("ALLOW_CANONICAL_SEED=false")) {
      throw new Error(`Expected error citing ALLOW_CANONICAL_SEED=false, got: ${seedJson.error}`);
    }

    console.log("\n✓ PASS: POST /api/v1/admin/seed rejected with HTTP 403 Forbidden");
    console.log("✓ PASS: Error explicitly confirms canonical seed endpoint is disabled");
    console.log("✓ PASS: Zero records seeded\n");

  } finally {
    if (workerProcess) {
      workerProcess.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (fs.existsSync(tempSandboxDir)) {
      try {
        fs.rmSync(tempSandboxDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

runSeedDisabledTest().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
