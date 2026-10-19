#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Staging Administrator Credential Setup
 *
 * Configures temporary staging credentials in secure, gitignored files
 * with restrictive permissions (0600).
 *
 * Features:
 *   - Interactive email & masked password prompt
 *   - Automated secure generation via --generate flag
 *   - Generates scrypt password hash (scrypt:<16-byte-salt-hex>:<64-byte-key-hex>)
 *   - Generates 64-character HMAC session secret
 *   - Restrictive file permissions (0600: read/write owner only)
 *   - NEVER prints passwords or service tokens to stdout
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const rootDir = process.cwd();
const credentialsPath = path.join(rootDir, ".staging-admin-credentials.local");
const envStagingPath = path.join(rootDir, ".env.staging.local");
const tokenCandidatePaths = [
  path.join(rootDir, "cloudflare", "portfolio-api", ".staging-service-token.tmp"),
  path.join(rootDir, ".staging-service-token.tmp")
];

function resolveServiceToken() {
  if (process.env.CLOUDFLARE_API_SERVICE_TOKEN) {
    return process.env.CLOUDFLARE_API_SERVICE_TOKEN.trim();
  }
  for (const p of tokenCandidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const token = fs.readFileSync(p, "utf-8").trim();
        if (token.length >= 16) return token;
      }
    } catch {
      // ignore
    }
  }
  return "";
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

function writeConfigFiles(email, password, hash, serviceToken) {
  const sessionSecret = crypto.randomBytes(32).toString("hex");

  const credsContent = [
    "# Kerem Mıhçı Portfolio OS — Staging Administrator Credentials",
    "# File permissions: 0600 (Owner read/write only). Gitignored.",
    `# Created: ${new Date().toISOString()}`,
    "",
    `ADMIN_EMAIL=${email.trim()}`,
    `ADMIN_PASSWORD=${password}`,
    `ADMIN_PASSWORD_HASH=${hash}`,
    ""
  ].join("\n");

  fs.writeFileSync(credentialsPath, credsContent, { mode: 0o600 });
  fs.chmodSync(credentialsPath, 0o600);

  const envContent = [
    "# Kerem Mıhçı Portfolio OS — Staging Local Runtime Environment",
    "# File permissions: 0600. Gitignored.",
    `# Generated: ${new Date().toISOString()}`,
    "",
    "NODE_ENV=production",
    "CMS_STORAGE_MODE=staging",
    "CMS_DATA_SOURCE=cloudflare",
    "CLOUDFLARE_CMS_API_URL=https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev",
    `CLOUDFLARE_API_SERVICE_TOKEN=${serviceToken}`,
    `ADMIN_ALLOWED_EMAILS=${email.trim()}`,
    `ADMIN_PASSWORD_HASH=${hash}`,
    `ADMIN_SESSION_SECRET=${sessionSecret}`,
    "ADMIN_TRUSTED_ORIGINS=http://127.0.0.1:3099,http://localhost:3099",
    ""
  ].join("\n");

  fs.writeFileSync(envStagingPath, envContent, { mode: 0o600 });
  fs.chmodSync(envStagingPath, 0o600);

  console.log("✓ Staging administrator configuration saved.");
  console.log(`✓ Restrictive permissions set (0600) on: ${credentialsPath}`);
  console.log(`✓ Staging runtime environment written to: ${envStagingPath}`);
  console.log("\nSecure Login Credentials Location:");
  console.log(`  To retrieve your temporary credentials securely without exposing them in logs, run:`);
  console.log(`  cat ${path.basename(credentialsPath)}\n`);
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    console.log("=== Kerem Mıhçı Portfolio OS: Interactive Staging Admin Setup ===");
    console.log("Enter administrator details for local staging preview.\n");

    const emailInput = await question("Admin Email [staging-admin@local.test]: ");
    const email = emailInput.trim() || "staging-admin@local.test";

    // Hidden password input
    process.stdout.write("Admin Password (min 12 chars, leave empty to auto-generate): ");
    let password = "";
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
      password = await new Promise((resolve) => {
        let input = "";
        const onData = (char) => {
          const c = char.toString();
          if (c === "\n" || c === "\r" || c === "\u0004") {
            process.stdin.removeListener("data", onData);
            process.stdout.write("\n");
            resolve(input);
          } else if (c === "\u0003") {
            process.exit(1);
          } else if (c === "\u0008" || c === "\u007f") {
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write("\b \b");
            }
          } else {
            input += c;
            process.stdout.write("*");
          }
        };
        process.stdin.on("data", onData);
      });
      if (wasRaw !== undefined && process.stdin.setRawMode) {
        process.stdin.setRawMode(wasRaw);
      }
    } else {
      const line = await question("");
      password = line.trim();
    }

    if (!password) {
      password = `StgAdmin-${crypto.randomBytes(12).toString("base64url")}!26`;
      console.log("→ Auto-generated strong random password.");
    } else if (password.length < 12) {
      console.error("Error: Admin password must be at least 12 characters.");
      process.exit(1);
    }

    const serviceToken = resolveServiceToken();
    if (!serviceToken) {
      console.error("Warning: Staging service token could not be found. Staging Worker API calls will fail.");
    }

    const hash = hashPassword(password);
    writeConfigFiles(email, password, hash, serviceToken);
  } finally {
    rl.close();
  }
}

function runGenerate() {
  const email = process.env.ADMIN_EMAIL || "staging-admin@local.test";
  const password = `StgAdmin-${crypto.randomBytes(12).toString("base64url")}!26`;
  const serviceToken = resolveServiceToken();
  const hash = hashPassword(password);
  writeConfigFiles(email, password, hash, serviceToken);
}

const args = process.argv.slice(2);
if (args.includes("--generate") || !process.stdin.isTTY) {
  runGenerate();
} else {
  runInteractive();
}
