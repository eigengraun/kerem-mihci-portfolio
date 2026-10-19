#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Staging Next.js Runner
 *
 * Boots Next.js on port 3099 bound strictly to 127.0.0.1
 * with CMS_STORAGE_MODE=staging and CMS_DATA_SOURCE=cloudflare.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const envStagingPath = path.join(rootDir, ".env.staging.local");

// Load .env.staging.local into process.env if present
if (fs.existsSync(envStagingPath)) {
  const content = fs.readFileSync(envStagingPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Fallback staging environment defaults
process.env.NODE_ENV = "production";
process.env.CMS_STORAGE_MODE = "staging";
process.env.CMS_DATA_SOURCE = "cloudflare";
process.env.PORT = "3099";
process.env.HOSTNAME = "127.0.0.1";

if (!process.env.CLOUDFLARE_CMS_API_URL) {
  process.env.CLOUDFLARE_CMS_API_URL = "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev";
}

if (!process.env.CLOUDFLARE_API_SERVICE_TOKEN) {
  const tokenCandidate = path.join(rootDir, "cloudflare", "portfolio-api", ".staging-service-token.tmp");
  if (fs.existsSync(tokenCandidate)) {
    process.env.CLOUDFLARE_API_SERVICE_TOKEN = fs.readFileSync(tokenCandidate, "utf-8").trim();
  }
}

const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

console.log("=== Launching Next.js CMS Staging Server ===");
console.log("URL:              http://127.0.0.1:3099");
console.log("Admin Dashboard:  http://127.0.0.1:3099/admin");
console.log("Storage Mode:     staging (Real Cloudflare D1 & R2)");
console.log("Worker URL:      ", process.env.CLOUDFLARE_CMS_API_URL);
console.log("Host Binding:     127.0.0.1 (Localhost Only)\n");

const child = spawn(
  process.execPath,
  [nextBin, "start", "-p", "3099", "-H", "127.0.0.1"],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env
  }
);

child.on("error", (err) => {
  console.error("Failed to start Next.js staging server:", err);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
