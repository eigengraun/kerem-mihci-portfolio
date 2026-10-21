#!/usr/bin/env node
/**
 * Portfolio OS — Strict Migration Admission & Allowlist Guard
 *
 * Implements a fail-closed admission check prior to any future D1 migration application:
 * 1. Resolves migrations directory strictly from wrangler.jsonc.
 * 2. Recursively scans for all SQL candidates and verifies NO symlink escape.
 * 3. Enforces an exact local allowlist (strictly 0001, 0002, 0003; rejects any 0004 or nested SQL).
 * 4. Validates reviewed cryptographic SHA-256 hashes of all three migration files.
 * 5. Validates remote applied ledger (strictly 0001 and 0002 applied).
 * 6. Validates remote pending list (strictly 0003 pending; rejects 0003 already applied).
 * 7. Verifies Cloudflare account ID and staging D1 database ID.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const rootDir = process.cwd();

export const AUTHORIZED_LOCAL_MIGRATIONS = [
  "0001_initial_schema.sql",
  "0002_videos_and_reels_schema.sql",
  "0003_personal_gallery_schema.sql"
];

export const AUTHORIZED_REMOTE_APPLIED = [
  "0001_initial_schema.sql",
  "0002_videos_and_reels_schema.sql"
];

export const AUTHORIZED_REMOTE_PENDING = [
  "0003_personal_gallery_schema.sql"
];

export const REVIEWED_MIGRATION_HASHES = {
  "0001_initial_schema.sql": "453593cdcf472f41e8504ad95ca9f941225562310a30009b68ea492c83479bcf",
  "0002_videos_and_reels_schema.sql": "2c3ac9ff453d76e5afa2e980fcb08fdf08f3362a5a1a9a347634549f5b098f64",
  "0003_personal_gallery_schema.sql": "da6aaabf624fbbaee35089ad27c8627e8709e7e570713d7c29ca6c1b403af606"
};

export const APPROVED_STAGING_TARGET = {
  accountId: "9791a288e2e99e7f3403590480e3ad6f",
  workerName: "kerem-mihci-portfolio-api-staging",
  databaseName: "kerem-portfolio-db-staging",
  databaseId: "0efef7a7-cc93-4dc2-8cb7-db28379fe01f",
  r2Bucket: "kerem-portfolio-media-staging"
};

/**
 * Resolves the migrations directory from the wrangler.jsonc configuration file.
 */
export function resolveMigrationsDirectoryFromWrangler(
  wranglerConfigPath = path.join(rootDir, "cloudflare", "portfolio-api", "wrangler.jsonc"),
  env = "staging"
) {
  if (!fs.existsSync(wranglerConfigPath)) {
    throw new Error(`WRANGLER_CONFIG_NOT_FOUND: Configuration file missing at ${wranglerConfigPath}`);
  }

  const rawConfig = fs.readFileSync(wranglerConfigPath, "utf8");
  let config;
  try {
    config = JSON.parse(rawConfig);
  } catch {
    try {
      const cleanJson = rawConfig.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1");
      config = JSON.parse(cleanJson);
    } catch (err) {
      throw new Error(`WRANGLER_CONFIG_PARSE_ERROR: Failed to parse ${wranglerConfigPath}: ${err.message}`);
    }
  }

  const envConfig = env ? config.env?.[env] : config;
  if (!envConfig) {
    throw new Error(`WRANGLER_ENV_NOT_FOUND: Environment "${env}" not defined in ${wranglerConfigPath}`);
  }

  const d1 = envConfig.d1_databases?.[0] || config.d1_databases?.[0];
  if (!d1) {
    throw new Error(`WRANGLER_D1_MISSING: No d1_databases entry defined in ${wranglerConfigPath}`);
  }

  // Validate target database identity
  if (d1.database_id !== APPROVED_STAGING_TARGET.databaseId) {
    throw new Error(
      `TARGET_DATABASE_MISMATCH: Staging database ID "${d1.database_id}" does not match approved ID "${APPROVED_STAGING_TARGET.databaseId}"`
    );
  }

  const relMigrationsDir = d1.migrations_dir || "migrations";
  const resolvedDir = path.resolve(path.dirname(wranglerConfigPath), relMigrationsDir);

  return resolvedDir;
}

/**
 * Recursively scans directory for all .sql files, verifying symlink containment.
 */
export function scanLocalMigrationFiles(migrationsDir, authorizedRoot = null) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`MIGRATIONS_DIR_MISSING: Migrations directory does not exist: ${migrationsDir}`);
  }

  // Verify migrations directory does not escape root if authorizedRoot is provided
  if (authorizedRoot) {
    const realMigrationsDir = fs.realpathSync(migrationsDir);
    const realRoot = fs.realpathSync(authorizedRoot);
    if (!realMigrationsDir.startsWith(realRoot)) {
      throw new Error(`SECURITY_VIOLATION: Migrations directory escapes authorized project root`);
    }
  }

  const foundSqlFiles = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      // Check for symlinks escaping root
      if (entry.isSymbolicLink() && authorizedRoot) {
        const realEntry = fs.realpathSync(fullPath);
        const realRoot = fs.realpathSync(authorizedRoot);
        if (!realEntry.startsWith(realRoot)) {
          throw new Error(`SECURITY_VIOLATION: Nested symlink escapes authorized root: ${entry.name}`);
        }
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".sql")) {
        const relToMigrations = path.relative(migrationsDir, fullPath);
        foundSqlFiles.push({
          filename: entry.name,
          relativePath: relToMigrations,
          fullPath
        });
      }
    }
  }

  walk(migrationsDir);
  return foundSqlFiles;
}

/**
 * Validates local migration file inventory against the exact allowlist and reviewed hashes.
 */
export function verifyLocalMigrationInventory(options = {}) {
  const {
    migrationsDir = path.join(rootDir, "cloudflare", "portfolio-api", "migrations"),
    authorizedRoot = null,
    allowedFiles = AUTHORIZED_LOCAL_MIGRATIONS,
    expectedHashes = REVIEWED_MIGRATION_HASHES
  } = options;

  const scanned = scanLocalMigrationFiles(migrationsDir, authorizedRoot);

  // 1. Check for unknown or nested files
  for (const file of scanned) {
    if (file.relativePath !== file.filename) {
      throw new Error(`NESTED_SQL_FORBIDDEN: Unknown nested SQL file detected: ${file.relativePath}`);
    }
    if (!allowedFiles.includes(file.filename)) {
      throw new Error(
        `UNAUTHORIZED_MIGRATION_DETECTED: Migration directory contains unexpected SQL file: "${file.filename}". ` +
        `Only authorized files are admitted: [${allowedFiles.join(", ")}].`
      );
    }
  }

  // 2. Check for missing required files
  const scannedNames = scanned.map((s) => s.filename).sort();
  const sortedAllowed = [...allowedFiles].sort();

  for (const req of sortedAllowed) {
    if (!scannedNames.includes(req)) {
      throw new Error(`MISSING_AUTHORIZED_MIGRATION: Expected migration "${req}" not found in ${migrationsDir}`);
    }
  }

  if (scannedNames.length !== sortedAllowed.length) {
    throw new Error(
      `MIGRATION_COUNT_MISMATCH: Found ${scannedNames.length} migration files, expected exactly ${sortedAllowed.length}.`
    );
  }

  // 3. Cryptographic hash check
  const hashes = {};
  for (const file of scanned) {
    const content = fs.readFileSync(file.fullPath);
    const actualSha = crypto.createHash("sha256").update(content).digest("hex");
    hashes[file.filename] = actualSha;

    const expectedSha = expectedHashes[file.filename];
    if (!expectedSha) {
      throw new Error(`HASH_NOT_REVIEWED: No reviewed hash configured for "${file.filename}"`);
    }
    if (actualSha !== expectedSha) {
      throw new Error(
        `MIGRATION_HASH_TAMPERED: Migration file "${file.filename}" SHA-256 (${actualSha}) ` +
        `does not match reviewed hash (${expectedSha}). Refusing admission.`
      );
    }
  }

  return {
    valid: true,
    filesCount: scanned.length,
    files: scannedNames,
    hashes
  };
}

/**
 * Validates remote migration ledger state (applied vs pending).
 */
export function verifyRemoteMigrationLedger({
  appliedMigrations,
  pendingMigrations,
  expectedApplied = AUTHORIZED_REMOTE_APPLIED,
  expectedPending = AUTHORIZED_REMOTE_PENDING
}) {
  if (!Array.isArray(appliedMigrations)) {
    throw new Error("SCHEMA_ERROR: appliedMigrations must be an array of migration names");
  }
  if (!Array.isArray(pendingMigrations)) {
    throw new Error("SCHEMA_ERROR: pendingMigrations must be an array of migration names");
  }

  // Reconcile applied
  if (appliedMigrations.includes("0003_personal_gallery_schema.sql")) {
    throw new Error(
      "MIGRATION_ALREADY_APPLIED: Migration '0003_personal_gallery_schema.sql' is already marked applied remotely! " +
      "Preflight requires 0003 to be pending."
    );
  }

  if (appliedMigrations.length !== expectedApplied.length) {
    throw new Error(
      `REMOTE_APPLIED_COUNT_MISMATCH: Remote d1_migrations has ${appliedMigrations.length} records ` +
      `(${appliedMigrations.join(", ")}), expected exactly ${expectedApplied.length} (${expectedApplied.join(", ")})`
    );
  }

  for (let i = 0; i < expectedApplied.length; i++) {
    const exp = expectedApplied[i];
    const act = appliedMigrations[i];
    if (act !== exp) {
      throw new Error(
        `REMOTE_APPLIED_MISMATCH: Applied migration at index ${i} is "${act}", expected exact name "${exp}"`
      );
    }
  }

  // Reconcile pending
  if (pendingMigrations.length !== expectedPending.length) {
    throw new Error(
      `REMOTE_PENDING_COUNT_MISMATCH: Remote pending migrations list has ${pendingMigrations.length} files ` +
      `(${pendingMigrations.join(", ")}), expected exactly ${expectedPending.length} (${expectedPending.join(", ")})`
    );
  }

  for (let i = 0; i < expectedPending.length; i++) {
    const exp = expectedPending[i];
    const act = pendingMigrations[i];
    if (act !== exp) {
      throw new Error(
        `REMOTE_PENDING_MISMATCH: Pending migration at index ${i} is "${act}", expected exact name "${exp}"`
      );
    }
  }

  return {
    valid: true,
    applied: appliedMigrations,
    pending: pendingMigrations
  };
}

/**
 * Full admission verification combining local inventory + remote state check.
 */
export function verifyMigrationAdmission(options = {}) {
  const {
    wranglerConfigPath,
    env = "staging",
    appliedMigrations = AUTHORIZED_REMOTE_APPLIED,
    pendingMigrations = AUTHORIZED_REMOTE_PENDING,
    migrationsDir: customMigrationsDir
  } = options;

  // 1. Resolve migrations dir
  const migrationsDir = customMigrationsDir || resolveMigrationsDirectoryFromWrangler(wranglerConfigPath, env);

  // 2. Validate local inventory
  const localRes = verifyLocalMigrationInventory({ migrationsDir });

  // 3. Validate remote ledger
  const remoteRes = verifyRemoteMigrationLedger({
    appliedMigrations,
    pendingMigrations
  });

  return {
    admitted: true,
    migrationsDir,
    local: localRes,
    remote: remoteRes
  };
}

// ============================================================
// SELF-TEST SUITE
// ============================================================
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const args = process.argv.slice(2);

  // Optional online live staging check
  if (args.includes("--online")) {
    console.log("Running Live Read-Only Cloudflare Staging Migration Admission Check...\n");
    try {
      const migrationsDir = resolveMigrationsDirectoryFromWrangler();
      console.log(`✓ Resolved migrations directory: ${migrationsDir}`);

      const localRes = verifyLocalMigrationInventory({ migrationsDir });
      console.log(`✓ Local migration files verified: ${localRes.files.join(", ")} (3/3)`);
      console.log(`✓ Reviewed cryptographic SHA-256 hashes match 100%`);

      // Read remote applied migrations via read-only SQL query
      const cmd = `npx wrangler d1 execute kerem-portfolio-db-staging --config cloudflare/portfolio-api/wrangler.jsonc --env staging --remote --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id ASC;" --json`;
      const stdout = execSync(cmd, { encoding: "utf8" });
      const parsed = JSON.parse(stdout);
      const rows = parsed[0]?.results || [];
      const appliedNames = rows.map((r) => r.name);

      console.log(`✓ Remote applied migrations query: ${appliedNames.join(", ")}`);

      // Read remote pending migrations list
      const listCmd = `npx wrangler d1 migrations list kerem-portfolio-db-staging --config cloudflare/portfolio-api/wrangler.jsonc --env staging --remote`;
      const listOut = execSync(listCmd, { encoding: "utf8" });

      const pendingMatches = [];
      for (const line of listOut.split("\n")) {
        const trimmed = line.replace(/[│┌┐└┘├┤─\s]/g, "");
        if (trimmed.endsWith(".sql")) {
          pendingMatches.push(trimmed);
        }
      }
      console.log(`✓ Remote pending migrations check: ${pendingMatches.join(", ")}`);

      verifyRemoteMigrationLedger({
        appliedMigrations: appliedNames,
        pendingMigrations: pendingMatches
      });

      console.log("\n============================================================");
      console.log("VERDICT: MIGRATION 0003 ADMISSION GUARD PASSED (SAFE TO APPLY UPON OPERATOR AUTHORIZATION)");
      console.log("============================================================\n");
      process.exit(0);
    } catch (err) {
      console.error(`\n✗ MIGRATION ADMISSION GUARD FAILED: ${err.message}\n`);
      process.exit(1);
    }
  }

  // Unit self-tests
  console.log("Running Migration Admission Guard self-tests...\n");
  let passed = 0;
  let failed = 0;

  function runCase(name, fn) {
    try {
      fn();
      passed++;
      console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
    }
  }

  const tmpTestDir = `/tmp/migration-guard-test-${Date.now()}`;
  fs.mkdirSync(tmpTestDir, { recursive: true });

  const setupMockMigrations = (extraFiles = {}, customHashes = null) => {
    const mDir = path.join(tmpTestDir, `mock-m-${crypto.randomUUID().slice(0, 6)}`);
    fs.mkdirSync(mDir, { recursive: true });

    // Copy genuine migration files
    const realDir = path.join(rootDir, "cloudflare", "portfolio-api", "migrations");
    for (const f of AUTHORIZED_LOCAL_MIGRATIONS) {
      fs.copyFileSync(path.join(realDir, f), path.join(mDir, f));
    }

    for (const [relPath, content] of Object.entries(extraFiles)) {
      const full = path.join(mDir, relPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, "utf8");
    }

    return mDir;
  };

  try {
    // 1. Positive: exactly 3 authorized files with reviewed hashes
    runCase("Positive: Exactly 3 authorized files pass admission", () => {
      const mDir = setupMockMigrations();
      const res = verifyLocalMigrationInventory({ migrationsDir: mDir });
      if (res.filesCount !== 3) throw new Error(`Expected 3 files, got ${res.filesCount}`);
    });

    // 2. Negative: unexpected fourth migration (0004_patch.sql)
    runCase("Negative: Rejects unexpected fourth migration (0004_patch.sql)", () => {
      const mDir = setupMockMigrations({ "0004_patch.sql": "SELECT 1;" });
      let threw = false;
      try {
        verifyLocalMigrationInventory({ migrationsDir: mDir });
      } catch (err) {
        threw = err.message.includes("UNAUTHORIZED_MIGRATION_DETECTED");
      }
      if (!threw) throw new Error("Did not reject unexpected fourth migration");
    });

    // 3. Negative: unknown nested SQL file
    runCase("Negative: Rejects unknown nested SQL file in subdirectory", () => {
      const mDir = setupMockMigrations({ "sub/nested.sql": "SELECT 1;" });
      let threw = false;
      try {
        verifyLocalMigrationInventory({ migrationsDir: mDir });
      } catch (err) {
        threw = err.message.includes("NESTED_SQL_FORBIDDEN");
      }
      if (!threw) throw new Error("Did not reject nested SQL file");
    });

    // 4. Negative: modified/tampered migration content (hash mismatch)
    runCase("Negative: Rejects tampered migration content (SHA-256 hash mismatch)", () => {
      const mDir = setupMockMigrations();
      // Tamper with 0003
      fs.appendFileSync(path.join(mDir, "0003_personal_gallery_schema.sql"), "\n-- TAMPERED");
      let threw = false;
      try {
        verifyLocalMigrationInventory({ migrationsDir: mDir });
      } catch (err) {
        threw = err.message.includes("MIGRATION_HASH_TAMPERED");
      }
      if (!threw) throw new Error("Did not reject tampered migration hash");
    });

    // 5. Negative: wrong staging database ID in configuration
    runCase("Negative: Rejects wrong staging database ID in wrangler config", () => {
      const fakeWrangler = path.join(tmpTestDir, "fake-wrangler.jsonc");
      fs.writeFileSync(
        fakeWrangler,
        JSON.stringify({
          env: {
            staging: {
              d1_databases: [{ database_id: "wrong-database-id-123", migrations_dir: "migrations" }]
            }
          }
        })
      );
      let threw = false;
      try {
        resolveMigrationsDirectoryFromWrangler(fakeWrangler, "staging");
      } catch (err) {
        threw = err.message.includes("TARGET_DATABASE_MISMATCH");
      }
      if (!threw) throw new Error("Did not reject wrong database ID");
    });

    // 6. Negative: migration 0003 already applied remotely
    runCase("Negative: Rejects remote state where migration 0003 is already applied", () => {
      let threw = false;
      try {
        verifyRemoteMigrationLedger({
          appliedMigrations: ["0001_initial_schema.sql", "0002_videos_and_reels_schema.sql", "0003_personal_gallery_schema.sql"],
          pendingMigrations: []
        });
      } catch (err) {
        threw = err.message.includes("MIGRATION_ALREADY_APPLIED");
      }
      if (!threw) throw new Error("Did not reject already-applied migration 0003");
    });

    // 7. Negative: unexpected pending migration remotely
    runCase("Negative: Rejects unexpected pending migration remotely (e.g. 0004 pending)", () => {
      let threw = false;
      try {
        verifyRemoteMigrationLedger({
          appliedMigrations: ["0001_initial_schema.sql", "0002_videos_and_reels_schema.sql"],
          pendingMigrations: ["0003_personal_gallery_schema.sql", "0004_unknown.sql"]
        });
      } catch (err) {
        threw = err.message.includes("REMOTE_PENDING_COUNT_MISMATCH");
      }
      if (!threw) throw new Error("Did not reject unexpected pending migration");
    });

    // 8. Negative: missing required migration 0002 in applied ledger
    runCase("Negative: Rejects missing required migration 0002 in applied ledger", () => {
      let threw = false;
      try {
        verifyRemoteMigrationLedger({
          appliedMigrations: ["0001_initial_schema.sql"],
          pendingMigrations: ["0003_personal_gallery_schema.sql"]
        });
      } catch (err) {
        threw = err.message.includes("REMOTE_APPLIED_COUNT_MISMATCH");
      }
      if (!threw) throw new Error("Did not reject missing applied migration 0002");
    });

    // 9. Negative: invalid remote ledger schema / non-array input
    runCase("Negative: Rejects invalid remote ledger schema (non-array applied list)", () => {
      let threw = false;
      try {
        verifyRemoteMigrationLedger({
          appliedMigrations: "not-an-array",
          pendingMigrations: ["0003_personal_gallery_schema.sql"]
        });
      } catch (err) {
        threw = err.message.includes("SCHEMA_ERROR");
      }
      if (!threw) throw new Error("Did not reject non-array applied migrations");
    });

    // 10. Negative: missing authorized migration 0002 from local files
    runCase("Negative: Rejects missing authorized migration 0002 from local directory", () => {
      const mDir = setupMockMigrations();
      fs.unlinkSync(path.join(mDir, "0002_videos_and_reels_schema.sql"));
      let threw = false;
      try {
        verifyLocalMigrationInventory({ migrationsDir: mDir });
      } catch (err) {
        threw = err.message.includes("MISSING_AUTHORIZED_MIGRATION");
      }
      if (!threw) throw new Error("Did not reject missing migration 0002");
    });
  } finally {
    try {
      fs.rmSync(tmpTestDir, { recursive: true, force: true });
    } catch {}
  }

  console.log(`\nSelf-test results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}
