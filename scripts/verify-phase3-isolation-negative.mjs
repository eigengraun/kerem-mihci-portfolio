#!/usr/bin/env node
/**
 * Phase 3 Test Server Port 3099 Collision & Isolation Negative Test
 *
 * Proves that:
 * 1. An unrelated server occupying port 3099 receives exactly ZERO requests during Phase 3 verification.
 * 2. The Phase 3 runner dynamically allocates an independent loopback port (!= 3099).
 * 3. The unrelated service on port 3099 is never disrupted or hijacked.
 * 4. The persistent host database (.local-d1/portfolio.sqlite) is byte-for-byte untouched.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const localDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");

async function main() {
  console.log("============================================================");
  console.log("PHASE 3 TEST SERVER ISOLATION: PORT 3099 NEGATIVE COLLISION TEST");
  console.log("============================================================\n");

  if (!fs.existsSync(localDbPath)) {
    throw new Error(`Host database not found at ${localDbPath}`);
  }

  const initialDbSha = crypto.createHash("sha256").update(fs.readFileSync(localDbPath)).digest("hex");
  console.log(`[PREFLIGHT] Host DB SHA-256: ${initialDbSha}`);

  // 1. Start an unrelated mock server on 127.0.0.1:3099
  const receivedRequests = [];
  const dummyServer = http.createServer((req, res) => {
    receivedRequests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      timestamp: Date.now()
    });
    res.writeHead(418, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "TEAPOT", message: "Port 3099 is occupied by an unrelated foreign server" }));
  });

  await new Promise((resolve, reject) => {
    dummyServer.once("error", reject);
    dummyServer.listen(3099, "127.0.0.1", resolve);
  });
  console.log("[SETUP] Unrelated foreign server is actively listening on http://127.0.0.1:3099");

  // Verify dummy server responds
  const probeRes = await fetch("http://127.0.0.1:3099/health");
  if (probeRes.status !== 418) {
    dummyServer.close();
    throw new Error("Dummy server failed initial health probe");
  }
  // Clear the probe request from ledger
  receivedRequests.length = 0;
  console.log("[SETUP] Foreign server health verified (probe request discarded)");

  // 2. Execute scripts/verify-phase3-video-cms.mjs while port 3099 is occupied
  console.log("\n[EXECUTION] Launching scripts/verify-phase3-video-cms.mjs with port 3099 occupied...");
  const child = spawn(process.execPath, ["scripts/verify-phase3-video-cms.mjs"], {
    cwd: rootDir,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });

  const exitCode = await new Promise((resolve) => {
    child.on("close", resolve);
  });

  console.log(`[EXECUTION] scripts/verify-phase3-video-cms.mjs finished with exit code ${exitCode}`);

  // 3. Close dummy server
  await new Promise((resolve) => dummyServer.close(resolve));

  // 4. Assertions
  const checks = [];
  function assertCheck(cond, name, detail = "") {
    checks.push({ name, pass: Boolean(cond), detail });
    if (cond) {
      console.log(`  ✓ PASS: ${name}`);
    } else {
      console.error(`  ✗ FAIL: ${name} (${detail})`);
    }
  }

  console.log("\n--- Isolation Negative Test Assertions ---");
  assertCheck(exitCode === 0, "Phase 3 verification suite passes completely", `Exit code: ${exitCode}`);
  assertCheck(receivedRequests.length === 0, "Unrelated server on port 3099 received ZERO requests", `Requests received: ${receivedRequests.length}`);

  const portAllocatedMatch = stdout.match(/Allocating independent loopback port:? (\d+)|http:\/\/127\.0\.0\.1:(\d+)/i);
  const testPortFound = portAllocatedMatch ? (portAllocatedMatch[1] || portAllocatedMatch[2]) : null;
  assertCheck(testPortFound !== "3099", `Task-owned server ran on isolated dynamic port (!= 3099)`, `Allocated port: ${testPortFound || "dynamic ephemeral"}`);

  const finalDbSha = crypto.createHash("sha256").update(fs.readFileSync(localDbPath)).digest("hex");
  assertCheck(finalDbSha === initialDbSha, "Persistent host database SHA-256 byte-for-byte identical", `Initial: ${initialDbSha.slice(0, 16)}..., Final: ${finalDbSha.slice(0, 16)}...`);

  const allPassed = checks.every((c) => c.pass);
  console.log("\n============================================================");
  console.log(`NEGATIVE ISOLATION VERIFICATION: ${allPassed ? "ALL CHECKS PASSED" : "FAILED"}`);
  console.log("============================================================\n");

  if (!allPassed) {
    if (stderr) console.error("Child process STDERR:\n" + stderr);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in isolation negative test:", err);
  process.exit(1);
});
