#!/usr/bin/env node
/**
 * Staging Worker URL Override Security Negative Test
 *
 * Verifies that:
 * 1. Supplying an unintended or malicious Worker URL override via environment variables
 *    (e.g. TEST_MOCK_STAGING_WORKER_URL, STAGING_WORKER_URL, WORKER_URL) is strictly refused
 *    by the real remote-staging CLI before any network operation or token resolution.
 * 2. An unintended endpoint receives ZERO HTTP requests (no traffic diverted).
 * 3. No Cloudflare bearer token or secret credentials are ever transmitted.
 * 4. The approved immutable staging target configuration cannot be silently bypassed.
 * 5. Execution fails closed with exit code 1.
 */

import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";

const rootDir = process.cwd();

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

async function runProcess(cmd, args, envOverrides = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: rootDir,
      env: { ...process.env, ...envOverrides },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
    child.on("error", (err) => {
      resolve({ status: 1, stdout, stderr, error: err });
    });
  });
}

async function main() {
  console.log("============================================================");
  console.log("SECURITY VERIFICATION: STAGING WORKER URL OVERRIDE GUARD");
  console.log("============================================================\n");

  const receivedRequests = [];
  const trackingServer = http.createServer((req, res) => {
    receivedRequests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      timestamp: Date.now()
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });

  const trackingPort = await getFreePort();
  await new Promise((resolve) => trackingServer.listen(trackingPort, "127.0.0.1", resolve));
  const attackerUrl = `http://127.0.0.1:${trackingPort}`;
  console.log(`[SETUP] Attacker tracking honeypot listening on ${attackerUrl}`);

  const SENSITIVE_CANARY_TOKEN = "canary-secret-token-super-confidential-do-not-leak-998877";

  const checks = [];
  function assertCheck(cond, name, detail = "") {
    checks.push({ name, pass: Boolean(cond), detail });
    if (cond) {
      console.log(`  ✓ [PASS] ${name}`);
    } else {
      console.error(`  ✗ [FAIL] ${name}${detail ? ` (${detail})` : ""}`);
    }
  }

  try {
    // ------------------------------------------------------------
    // TEST 1: TEST_MOCK_STAGING_WORKER_URL override attempt
    // ------------------------------------------------------------
    const res1 = await runProcess("node", ["scripts/import-canonical-videos-to-d1.mjs", "--remote-staging", "--dry-run"], {
      TEST_MOCK_STAGING_WORKER_URL: attackerUrl,
      CLOUDFLARE_API_SERVICE_TOKEN: SENSITIVE_CANARY_TOKEN
    });

    assertCheck(res1.status === 1, "CLI aborts with exit code 1 when TEST_MOCK_STAGING_WORKER_URL is supplied", `Status: ${res1.status}`);
    assertCheck(
      res1.stderr.includes("Unsafe Worker URL override detected in environment variable \"TEST_MOCK_STAGING_WORKER_URL\""),
      "CLI error message explicitly identifies forbidden environment override variable"
    );
    assertCheck(receivedRequests.length === 0, "Attacker endpoint received exactly ZERO requests (zero networking before exit)", `Received: ${receivedRequests.length}`);

    // Verify token was never leaked in stdout or stderr
    assertCheck(!res1.stdout.includes(SENSITIVE_CANARY_TOKEN) && !res1.stderr.includes(SENSITIVE_CANARY_TOKEN), "Sensitive bearer service token is never echoed or logged");

    // ------------------------------------------------------------
    // TEST 2: STAGING_WORKER_URL generic override attempt
    // ------------------------------------------------------------
    delete process.env.TEST_MOCK_STAGING_WORKER_URL;
    const res2 = await runProcess("node", ["scripts/import-canonical-videos-to-d1.mjs", "--remote-staging", "--dry-run"], {
      STAGING_WORKER_URL: attackerUrl,
      CLOUDFLARE_API_SERVICE_TOKEN: SENSITIVE_CANARY_TOKEN
    });

    assertCheck(res2.status === 1, "CLI aborts with exit code 1 when STAGING_WORKER_URL is supplied");
    assertCheck(receivedRequests.length === 0, "Zero requests transmitted during STAGING_WORKER_URL attempt");

    // ------------------------------------------------------------
    // TEST 3: Unrecognized CLI argument attempt (--url=...)
    // ------------------------------------------------------------
    const res3 = await runProcess("node", ["scripts/import-canonical-videos-to-d1.mjs", "--remote-staging", `--url=${attackerUrl}`], {
      CLOUDFLARE_API_SERVICE_TOKEN: SENSITIVE_CANARY_TOKEN
    });

    assertCheck(res3.status === 1, "CLI aborts with exit code 1 on unrecognized argument attempt (--url=...)");
    assertCheck(receivedRequests.length === 0, "Zero requests transmitted during CLI flag attempt");

    // ------------------------------------------------------------
    // TEST 4: Honeypot remains untouched throughout entire execution
    // ------------------------------------------------------------
    assertCheck(receivedRequests.length === 0, "Total requests received by honeypot across all negative tests is strictly 0");

  } finally {
    await new Promise((resolve) => trackingServer.close(resolve));
  }

  const allPassed = checks.every((c) => c.pass);
  console.log("\n============================================================");
  console.log(`URL OVERRIDE SECURITY NEGATIVE TEST: ${allPassed ? "ALL CHECKS PASSED" : "FAILED"}`);
  console.log("============================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in URL override negative test:", err);
  process.exit(1);
});
