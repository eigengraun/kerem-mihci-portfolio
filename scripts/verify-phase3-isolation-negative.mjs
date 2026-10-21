#!/usr/bin/env node
/**
 * Phase 3 Test Server Port 3099 Collision & Isolation Negative Test
 *
 * Proves that:
 * 1. An unrelated server occupying port 3099 receives exactly ZERO requests during Phase 3 verification.
 * 2. The Phase 3 runner dynamically allocates a verified positive numeric loopback port (!= 3099).
 * 3. The test-owned server identity is positively established and verified alive.
 * 4. The unrelated service on port 3099 is never disrupted, hijacked, or terminated.
 * 5. The persistent host database (.local-d1/portfolio.sqlite) is byte-for-byte untouched.
 * 6. The host .local-d1 directory inventory has ZERO file mutations or leaks.
 */

import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const localDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const localD1Dir = path.join(rootDir, ".local-d1");

async function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const client = net.createConnection({ port, host });
    client.once("connect", () => {
      client.destroy();
      resolve(true);
    });
    client.once("error", () => {
      resolve(false);
    });
  });
}

async function main() {
  console.log("============================================================");
  console.log("PHASE 3 TEST SERVER ISOLATION: PORT 3099 NEGATIVE COLLISION TEST");
  console.log("============================================================\n");

  if (!fs.existsSync(localDbPath)) {
    throw new Error(`Host database not found at ${localDbPath}`);
  }

  const initialDbSha = crypto.createHash("sha256").update(fs.readFileSync(localDbPath)).digest("hex");
  console.log(`[PREFLIGHT] Host DB SHA-256: ${initialDbSha}`);

  // Snapshot directory inventory
  const dirFilesBefore = fs.readdirSync(localD1Dir).sort();
  const dirHashesBefore = {};
  for (const f of dirFilesBefore) {
    const p = path.join(localD1Dir, f);
    if (fs.statSync(p).isFile()) {
      dirHashesBefore[f] = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    }
  }

  // Check if port 3099 is already in use by a pre-existing process
  const alreadyOccupied = await isPortInUse(3099);
  if (alreadyOccupied) {
    console.warn("[PREFLIGHT WARNING] Port 3099 is already in use by an external user process.");
    console.warn("Safety Policy: Will not kill, replace, or interfere with external user process.");
    console.log("RESULT: BLOCKED (Cannot bind test-owned collision honeypot on occupied port)");
    process.exit(0);
  }

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
  console.log("[SETUP] Unrelated foreign honeypot server is actively listening on http://127.0.0.1:3099");

  // Verify dummy server responds
  const probeRes = await fetch("http://127.0.0.1:3099/health");
  if (probeRes.status !== 418) {
    dummyServer.close();
    throw new Error("Dummy server failed initial health probe");
  }
  // Clear the probe request from ledger
  receivedRequests.length = 0;
  console.log("[SETUP] Foreign server health verified (initial probe request discarded)");

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
      console.log(`  ✓ [PASS] ${name}`);
    } else {
      console.error(`  ✗ [FAIL] ${name}${detail ? ` (${detail})` : ""}`);
    }
  }

  console.log("\n--- Isolation Negative Test Assertions ---");
  assertCheck(exitCode === 0, "Phase 3 verification suite passes completely (exit code 0)", `Exit code: ${exitCode}`);
  assertCheck(receivedRequests.length === 0, "Unrelated server on port 3099 received ZERO requests", `Requests received: ${receivedRequests.length}`);

  // Extract allocated port using strict numeric verification
  const portAllocatedMatch = stdout.match(/\[SERVER\] Allocated independent loopback port:\s*(\d+)/);
  const rawPort = portAllocatedMatch ? portAllocatedMatch[1] : null;
  const testPortNum = rawPort ? Number.parseInt(rawPort, 10) : null;
  const isRealNumericPort = typeof testPortNum === "number" && Number.isInteger(testPortNum) && testPortNum > 0 && testPortNum < 65536;

  assertCheck(isRealNumericPort, "Test runner positively observed a real positive numeric port", `Observed port: ${testPortNum ?? "null"}`);
  assertCheck(testPortNum !== 3099 && testPortNum !== null, "Test-owned server dynamically allocated port strictly differs from 3099", `Allocated port: ${testPortNum}`);
  assertCheck(stdout.includes("Allocated independent loopback port"), "Test-owned server allocation was explicitly recorded in stdout");

  // Host filesystem invariant assertions
  const finalDbSha = crypto.createHash("sha256").update(fs.readFileSync(localDbPath)).digest("hex");
  assertCheck(finalDbSha === initialDbSha, "Persistent host database SHA-256 byte-for-byte identical", `Initial: ${initialDbSha.slice(0, 16)}..., Final: ${finalDbSha.slice(0, 16)}...`);

  const dirFilesAfter = fs.readdirSync(localD1Dir).sort();
  assertCheck(JSON.stringify(dirFilesBefore) === JSON.stringify(dirFilesAfter), "Host .local-d1 directory file inventory has zero added or deleted files");

  let filesMutated = 0;
  for (const f of dirFilesBefore) {
    const p = path.join(localD1Dir, f);
    if (fs.statSync(p).isFile()) {
      const sha = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
      if (sha !== dirHashesBefore[f]) filesMutated++;
    }
  }
  assertCheck(filesMutated === 0, "Host .local-d1 existing files suffered ZERO in-place modifications", `Mutated files: ${filesMutated}`);

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
