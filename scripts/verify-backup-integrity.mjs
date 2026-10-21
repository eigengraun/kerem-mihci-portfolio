#!/usr/bin/env node

/**
 * scripts/verify-backup-integrity.mjs
 *
 * Cloudflare D1 Staging Backup Validation & Integrity Verifier
 *
 * Validates a SQL export from `wrangler d1 export ...` by restoring it into an
 * isolated temporary SQLite database file and strictly verifying:
 * - Clean SQL execution with -bail (zero syntax or execution errors).
 * - PRAGMA quick_check returns "ok".
 * - PRAGMA integrity_check returns "ok".
 * - Required migration ledger entries (`d1_migrations`).
 * - Canonical record counts:
 *   - projects: exactly 31 (30 canonical + 1 draft)
 *   - project_media: exactly 72 records
 *   - portfolio_videos: exactly 21 canonical videos (19 portrait, 2 landscape)
 * - Safe permissions (0600) and guaranteed temporary file cleanup.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

export function verifyBackupSql(sqlFilePath, options = {}) {
  const {
    expectedProjects = 31,
    expectedMedia = 72,
    expectedVideos = 21,
    minMigrations = 2
  } = options;

  if (!fs.existsSync(sqlFilePath)) {
    throw new Error(`FILE_NOT_FOUND: Backup SQL file does not exist: ${sqlFilePath}`);
  }

  const stat = fs.statSync(sqlFilePath);
  if (stat.size === 0) {
    throw new Error(`EMPTY_FILE: Backup SQL file is empty (0 bytes): ${sqlFilePath}`);
  }

  // Generate isolated test SQLite file
  const testDbDir = path.dirname(sqlFilePath);
  const testDbName = `verify-backup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.sqlite`;
  const testDbPath = path.join(testDbDir, testDbName);

  try {
    // 1. Create empty file with restrictive permissions (0600)
    fs.writeFileSync(testDbPath, "", { mode: 0o600 });

    // 2. Execute SQL with -bail (fail immediately on any syntax or constraint error)
    try {
      execFileSync("sqlite3", ["-bail", testDbPath], {
        input: fs.readFileSync(sqlFilePath),
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf8"
      });
    } catch (execErr) {
      throw new Error(`SQL_RESTORE_FAILED: Failed to execute SQL backup into SQLite: ${execErr.stderr || execErr.message}`);
    }

    // Helper to query SQLite
    const query = (sql) => {
      try {
        const out = execFileSync("sqlite3", ["-bail", testDbPath, sql], {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"]
        });
        return out.trim();
      } catch (err) {
        throw new Error(`QUERY_FAILED (${sql}): ${err.stderr || err.message}`);
      }
    };

    // 3. PRAGMA quick_check
    const quickCheck = query("PRAGMA quick_check;");
    if (quickCheck !== "ok") {
      throw new Error(`QUICK_CHECK_FAILED: PRAGMA quick_check returned: "${quickCheck}" (expected "ok")`);
    }

    // 4. PRAGMA integrity_check
    const integrityCheck = query("PRAGMA integrity_check;");
    if (integrityCheck !== "ok") {
      throw new Error(`INTEGRITY_CHECK_FAILED: PRAGMA integrity_check returned: "${integrityCheck}" (expected "ok")`);
    }

    // 5. Verify required tables exist
    const tablesRaw = query("SELECT name FROM sqlite_master WHERE type='table';");
    const tables = new Set(tablesRaw.split(/\r?\n/).map((t) => t.trim()));

    const requiredTables = ["d1_migrations", "projects", "project_media", "portfolio_videos"];
    for (const reqTable of requiredTables) {
      if (!tables.has(reqTable)) {
        throw new Error(`MISSING_TABLE: Required table "${reqTable}" not found in backup schema`);
      }
    }

    // 6. Verify migration count
    const migrationCount = parseInt(query("SELECT COUNT(*) FROM d1_migrations;"), 10);
    if (isNaN(migrationCount) || migrationCount < minMigrations) {
      throw new Error(
        `MIGRATION_COUNT_MISMATCH: d1_migrations contains ${migrationCount} records (expected at least ${minMigrations})`
      );
    }

    // 7. Verify projects count
    const projectCount = parseInt(query("SELECT COUNT(*) FROM projects;"), 10);
    if (projectCount !== expectedProjects) {
      throw new Error(
        `PROJECT_COUNT_MISMATCH: projects table contains ${projectCount} records (expected exactly ${expectedProjects})`
      );
    }

    // 8. Verify project_media count
    const mediaCount = parseInt(query("SELECT COUNT(*) FROM project_media;"), 10);
    if (mediaCount !== expectedMedia) {
      throw new Error(
        `MEDIA_COUNT_MISMATCH: project_media table contains ${mediaCount} records (expected exactly ${expectedMedia})`
      );
    }

    // 9. Verify portfolio_videos count
    const videoCount = parseInt(query("SELECT COUNT(*) FROM portfolio_videos;"), 10);
    if (videoCount !== expectedVideos) {
      throw new Error(
        `VIDEO_COUNT_MISMATCH: portfolio_videos table contains ${videoCount} records (expected exactly ${expectedVideos})`
      );
    }

    return {
      valid: true,
      tables: Array.from(tables),
      migrationCount,
      projectCount,
      mediaCount,
      videoCount,
      sqlFileSize: stat.size
    };
  } finally {
    // Guaranteed cleanup of temporary SQLite test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  }
}

// ============================================================
// SELF-TEST RUNNER (CLI EXECUTION)
// ============================================================
if (process.argv.includes("--test") || (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1])) && process.argv.length === 2)) {
  console.log("Running Backup Validation self-tests...\n");

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

  const tmpDir = `/tmp/backup-validation-test-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  const buildMockSql = ({
    includeSyntaxError = false,
    missingTable = false,
    projectCount = 31,
    mediaCount = 72,
    videoCount = 21,
    migrationCount = 2
  } = {}) => {
    let sql = "";
    if (!missingTable) {
      sql += `CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TIMESTAMP);\n`;
      for (let i = 1; i <= migrationCount; i++) {
        sql += `INSERT INTO d1_migrations VALUES (${i}, '000${i}_test.sql', CURRENT_TIMESTAMP);\n`;
      }
    }
    sql += `CREATE TABLE projects (id TEXT PRIMARY KEY, title TEXT, is_published INTEGER);\n`;
    for (let i = 1; i <= projectCount; i++) {
      sql += `INSERT INTO projects VALUES ('proj-${i}', 'Project ${i}', 1);\n`;
    }
    sql += `CREATE TABLE project_media (id TEXT PRIMARY KEY, project_id TEXT, storage_key TEXT);\n`;
    for (let i = 1; i <= mediaCount; i++) {
      sql += `INSERT INTO project_media VALUES ('media-${i}', 'proj-1', 'media/proj-1/${i}.webp');\n`;
    }
    sql += `CREATE TABLE portfolio_videos (id TEXT PRIMARY KEY, slug TEXT, orientation TEXT);\n`;
    for (let i = 1; i <= videoCount; i++) {
      sql += `INSERT INTO portfolio_videos VALUES ('vid-${i}', 'vid-${i}', '${i <= 19 ? "portrait" : "landscape"}');\n`;
    }
    if (includeSyntaxError) {
      sql += `THIS IS INVALID SQL SYNTAX THAT WILL CAUSE BAIL ERROR;\n`;
    }
    return sql;
  };

  try {
    // 1. Positive case: valid full backup
    runCase("Positive: Valid complete staging backup passes all checks", () => {
      const sqlFile = path.join(tmpDir, "valid-backup.sql");
      fs.writeFileSync(sqlFile, buildMockSql());
      const res = verifyBackupSql(sqlFile, { expectedProjects: 31, expectedMedia: 72, expectedVideos: 21 });
      if (!res.valid) throw new Error("Expected valid: true");
      if (res.projectCount !== 31) throw new Error(`Expected 31 projects, got ${res.projectCount}`);
    });

    // 2. Negative case: SQL syntax / corruption error
    runCase("Negative: Rejects corrupted/truncated SQL with syntax error", () => {
      const sqlFile = path.join(tmpDir, "corrupted-syntax.sql");
      fs.writeFileSync(sqlFile, buildMockSql({ includeSyntaxError: true }));
      let threw = false;
      try {
        verifyBackupSql(sqlFile);
      } catch (err) {
        threw = err.message.includes("SQL_RESTORE_FAILED");
      }
      if (!threw) throw new Error("Did not reject syntax error");
    });

    // 3. Negative case: Missing required table (d1_migrations)
    runCase("Negative: Rejects backup missing d1_migrations table", () => {
      const sqlFile = path.join(tmpDir, "missing-table.sql");
      fs.writeFileSync(sqlFile, buildMockSql({ missingTable: true }));
      let threw = false;
      try {
        verifyBackupSql(sqlFile);
      } catch (err) {
        threw = err.message.includes("MISSING_TABLE");
      }
      if (!threw) throw new Error("Did not reject missing table");
    });

    // 4. Negative case: Mismatched project count (30 instead of 31)
    runCase("Negative: Rejects unexpected project count (30 vs 31)", () => {
      const sqlFile = path.join(tmpDir, "wrong-projects.sql");
      fs.writeFileSync(sqlFile, buildMockSql({ projectCount: 30 }));
      let threw = false;
      try {
        verifyBackupSql(sqlFile, { expectedProjects: 31 });
      } catch (err) {
        threw = err.message.includes("PROJECT_COUNT_MISMATCH");
      }
      if (!threw) throw new Error("Did not reject project count mismatch");
    });

    // 5. Negative case: Mismatched video count (20 instead of 21)
    runCase("Negative: Rejects unexpected video count (20 vs 21)", () => {
      const sqlFile = path.join(tmpDir, "wrong-videos.sql");
      fs.writeFileSync(sqlFile, buildMockSql({ videoCount: 20 }));
      let threw = false;
      try {
        verifyBackupSql(sqlFile, { expectedVideos: 21 });
      } catch (err) {
        threw = err.message.includes("VIDEO_COUNT_MISMATCH");
      }
      if (!threw) throw new Error("Did not reject video count mismatch");
    });

    // 6. Negative case: Empty SQL file
    runCase("Negative: Rejects empty (0-byte) SQL file", () => {
      const sqlFile = path.join(tmpDir, "empty.sql");
      fs.writeFileSync(sqlFile, "");
      let threw = false;
      try {
        verifyBackupSql(sqlFile);
      } catch (err) {
        threw = err.message.includes("EMPTY_FILE");
      }
      if (!threw) throw new Error("Did not reject empty file");
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\nBackup Validation self-tests: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
} else if (process.argv[2]) {
  // Direct CLI invocation: node scripts/verify-backup-integrity.mjs <file.sql>
  const sqlPath = path.resolve(process.argv[2]);
  console.log(`Verifying D1 backup SQL integrity: ${sqlPath}`);
  try {
    const res = verifyBackupSql(sqlPath);
    console.log(`✓ BACKUP INTEGRITY VERIFIED:`);
    console.log(`  - File size: ${res.sqlFileSize} bytes`);
    console.log(`  - Tables: ${res.tables.join(", ")}`);
    console.log(`  - Migrations: ${res.migrationCount}`);
    console.log(`  - Projects: ${res.projectCount}`);
    console.log(`  - Media items: ${res.mediaCount}`);
    console.log(`  - Videos: ${res.videoCount}`);
    process.exit(0);
  } catch (err) {
    console.error(`✗ BACKUP VERIFICATION FAILED: ${err.message}`);
    process.exit(1);
  }
}
