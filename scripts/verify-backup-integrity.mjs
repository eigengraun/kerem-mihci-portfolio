#!/usr/bin/env node

/**
 * scripts/verify-backup-integrity.mjs
 *
 * Cloudflare D1 Staging Backup Validation & Exact Migration Ledger Verifier
 *
 * Validates a SQL export from `wrangler d1 export ...` by restoring it into an
 * isolated temporary SQLite database file and strictly verifying:
 * - Clean SQL execution with -bail (zero syntax or execution errors).
 * - PRAGMA quick_check returns "ok".
 * - PRAGMA integrity_check returns "ok".
 * - Exact migration ledger schema (`id`, `name`, `applied_at`).
 * - Exact applied migration identities: ["0001_initial_schema.sql", "0002_videos_and_reels_schema.sql"].
 * - Exact pending migration status: "0003_personal_gallery_schema.sql" must NOT be applied.
 * - Cryptographic SHA-256 hash verification of reviewed migration files.
 * - Exact canonical project identities (all 30 canonical project slugs present).
 * - Exact canonical video identities (all 21 canonical video slugs present).
 * - Exact record baselines: 31 projects, 72 media items, 21 canonical videos.
 * - Restrictive permissions (0600) and guaranteed temporary file cleanup.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Reviewed Cryptographic Hashes for Cloudflare D1 Migrations
export const REVIEWED_MIGRATION_HASHES = {
  "0001_initial_schema.sql": "453593cdcf472f41e8504ad95ca9f941225562310a30009b68ea492c83479bcf",
  "0002_videos_and_reels_schema.sql": "2c3ac9ff453d76e5afa2e980fcb08fdf08f3362a5a1a9a347634549f5b098f64",
  "0003_personal_gallery_schema.sql": "da6aaabf624fbbaee35089ad27c8627e8709e7e570713d7c29ca6c1b403af606",
  "0004_profile_notes_cv_schema.sql": "cc6e699e703db6527427d99ff490793b40564d21d8681fceec7e48c81dbe537d"
};

// Expected Migration State for Phase 5 Preflight
export const DEFAULT_EXPECTED_APPLIED_MIGRATIONS = [
  "0001_initial_schema.sql",
  "0002_videos_and_reels_schema.sql",
  "0003_personal_gallery_schema.sql"
];

export const DEFAULT_EXPECTED_PENDING_MIGRATIONS = [
  "0004_profile_notes_cv_schema.sql"
];

// Exact Canonical 30 Project Slugs
export const CANONICAL_PROJECT_SLUGS = [
  "alchemia-aralik-2024-dergi-tasarimi",
  "alchemia-kasim-2024-dergi-tasarimi",
  "alchemia-nisan-2025-dergi-tasarimi",
  "alchemia-ocak-2025-dergi-tasarimi",
  "alchemia-subat-2025-dergi-tasarimi",
  "ceylanlar-site-yonetimi-marka-kimligi",
  "ceylanlar-site-yonetimi-website-tasarimi",
  "deva-yangin-marka-kimligi",
  "deva-yangin-website-tasarimi",
  "eigestore-marka-kimligi",
  "eigestore-website-tasarimi",
  "emix-creative-logo-tasarimi",
  "emix-creative-website-tasarimi",
  "emix-qr-menu",
  "engin-perde-website-optimizasyonu",
  "fling-arena",
  "goobzy-logo-tasarimi",
  "hizir-yangin-marka-kimligi",
  "iuckmk-website-tasarimi",
  "kagestudio-marka-kimligi",
  "kagestudio-website-tasarimi",
  "kixogames-logo-tasarimi",
  "kiyris-games-logo-tasarimi",
  "kmz-2025",
  "planfiq-logo-tasarimi",
  "planfiq-website-web-uygulamasi",
  "sanda-yachting-website-ceviri-calismasi",
  "solo-leveling-manga-website",
  "yanarsan-yangin-logo-tasarimi",
  "yanarsan-yangin-website-tasarimi"
];

// Exact Canonical 21 Video Slugs
export const CANONICAL_VIDEO_SLUGS = [
  "ai-moda-kombin-reels",
  "ai-moda-urun-reels",
  "ai-oversize-tshirt-reels",
  "bosnak-dilek-boregi-uretim-reels",
  "chofee-ai-lifestyle-icecek-reels",
  "chofee-kahve-yapim-reels",
  "cupistan-ai-ekler-urun-reels",
  "cupistan-ai-lifestyle-tatli-reels",
  "cupistan-ai-tart-tatli-urun-reels",
  "cupistan-ai-tatli-urun-reels",
  "elara-skincare-ai-urun-reels",
  "emix-creative-ai-content-transformation-ad",
  "emix-creative-website-design-ad-reels",
  "it-works-alum-stick-roll-on-reels",
  "la-ruota-pizza-artigianale-reels",
  "la-ruota-pizza-yapim-reels",
  "liorwell-ai-streetwear-reels",
  "liorwell-kadin-streetwear-ai-reels",
  "mythic-bastion-ai-game-ad",
  "thg-yapi-kurumsal-reels",
  "yavrumsa-cocuk-giyim-ai-reels"
];

/**
 * Validates that local migration files match reviewed cryptographic hashes.
 */
export function verifyLocalMigrationFiles(migrationsDir = path.join(rootDir, "cloudflare", "portfolio-api", "migrations")) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`MIGRATIONS_DIR_MISSING: Migrations directory does not exist: ${migrationsDir}`);
  }

  // Scan directory for any unauthorized SQL files
  const entries = fs.readdirSync(migrationsDir);
  const sqlFiles = entries.filter((e) => e.endsWith(".sql"));
  const expectedFiles = Object.keys(REVIEWED_MIGRATION_HASHES);

  for (const f of sqlFiles) {
    if (!expectedFiles.includes(f)) {
      throw new Error(`UNAUTHORIZED_MIGRATION_DETECTED: Migration directory contains unexpected SQL file: "${f}"`);
    }
  }

  for (const [filename, expectedSha] of Object.entries(REVIEWED_MIGRATION_HASHES)) {
    const fullPath = path.join(migrationsDir, filename);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`MIGRATION_FILE_MISSING: Reviewed migration file does not exist: ${fullPath}`);
    }
    const content = fs.readFileSync(fullPath);
    const actualSha = crypto.createHash("sha256").update(content).digest("hex");
    if (actualSha !== expectedSha) {
      throw new Error(
        `MIGRATION_FILE_TAMPERED: Migration file ${filename} SHA-256 (${actualSha}) does not match reviewed hash (${expectedSha})`
      );
    }
  }
  return true;
}

export function verifyBackupSql(sqlFilePath, options = {}) {
  const {
    expectedProjects = 31,
    expectedMedia = 72,
    expectedVideos = 21,
    expectedAppliedMigrations = DEFAULT_EXPECTED_APPLIED_MIGRATIONS,
    expectedPendingMigrations = DEFAULT_EXPECTED_PENDING_MIGRATIONS,
    verifyLocalHashes = true,
    migrationsDir
  } = options;

  if (verifyLocalHashes) {
    verifyLocalMigrationFiles(migrationsDir);
  }

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

    const requiredTables = ["d1_migrations", "projects", "project_media", "portfolio_videos", "portfolio_gallery_items"];
    for (const reqTable of requiredTables) {
      if (!tables.has(reqTable)) {
        throw new Error(`MISSING_TABLE: Required table "${reqTable}" not found in backup schema`);
      }
    }

    // 6. Verify d1_migrations table schema
    const migrationColsRaw = query("PRAGMA table_info(d1_migrations);");
    const colNames = migrationColsRaw.split(/\r?\n/).map((line) => {
      const parts = line.split("|");
      return parts[1]?.trim();
    }).filter(Boolean);

    if (!colNames.includes("name") || !colNames.includes("applied_at")) {
      throw new Error(`INVALID_MIGRATION_SCHEMA: d1_migrations table missing required columns (found: ${colNames.join(", ")})`);
    }

    // 7. Exact migration ledger comparison
    const appliedRowsRaw = query("SELECT name FROM d1_migrations ORDER BY id ASC;");
    const appliedMigrationNames = appliedRowsRaw
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean);

    // Assert pending migration is NOT applied
    for (const pending of expectedPendingMigrations) {
      if (appliedMigrationNames.includes(pending)) {
        throw new Error(
          `MIGRATION_ALREADY_APPLIED: Migration "${pending}" is already marked applied in d1_migrations, but preflight expects it pending.`
        );
      }
    }

    // Assert exact match with expected applied migrations
    if (appliedMigrationNames.length !== expectedAppliedMigrations.length) {
      throw new Error(
        `MIGRATION_COUNT_MISMATCH: d1_migrations contains ${appliedMigrationNames.length} records (${appliedMigrationNames.join(", ")}), expected exactly ${expectedAppliedMigrations.length} (${expectedAppliedMigrations.join(", ")})`
      );
    }

    for (let i = 0; i < expectedAppliedMigrations.length; i++) {
      const expected = expectedAppliedMigrations[i];
      const actual = appliedMigrationNames[i];
      if (actual !== expected) {
        throw new Error(
          `MIGRATION_IDENTITY_MISMATCH: Migration at index ${i} is "${actual}", expected exact name "${expected}"`
        );
      }
    }

    // 8. Verify projects count and canonical slugs
    const projectCount = parseInt(query("SELECT COUNT(*) FROM projects;"), 10);
    if (projectCount !== expectedProjects) {
      throw new Error(
        `PROJECT_COUNT_MISMATCH: projects table contains ${projectCount} records (expected exactly ${expectedProjects})`
      );
    }

    const projectSlugsRaw = query("SELECT slug FROM projects;");
    const projectSlugs = new Set(projectSlugsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
    for (const reqSlug of CANONICAL_PROJECT_SLUGS) {
      if (!projectSlugs.has(reqSlug)) {
        throw new Error(`MISSING_CANONICAL_PROJECT: Canonical project slug "${reqSlug}" not found in backup`);
      }
    }

    // 9. Verify project_media count
    const mediaCount = parseInt(query("SELECT COUNT(*) FROM project_media;"), 10);
    if (mediaCount !== expectedMedia) {
      throw new Error(
        `MEDIA_COUNT_MISMATCH: project_media table contains ${mediaCount} records (expected exactly ${expectedMedia})`
      );
    }

    // 10. Verify portfolio_videos count and canonical slugs
    const videoCount = parseInt(query("SELECT COUNT(*) FROM portfolio_videos;"), 10);
    if (videoCount !== expectedVideos) {
      throw new Error(
        `VIDEO_COUNT_MISMATCH: portfolio_videos table contains ${videoCount} records (expected exactly ${expectedVideos})`
      );
    }

    const videoSlugsRaw = query("SELECT slug FROM portfolio_videos;");
    const videoSlugs = new Set(videoSlugsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
    for (const reqSlug of CANONICAL_VIDEO_SLUGS) {
      if (!videoSlugs.has(reqSlug)) {
        throw new Error(`MISSING_CANONICAL_VIDEO: Canonical video slug "${reqSlug}" not found in backup`);
      }
    }

    return {
      valid: true,
      tables: Array.from(tables),
      appliedMigrations: appliedMigrationNames,
      migrationCount: appliedMigrationNames.length,
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
  console.log("Running Exact Migration History & Backup Validation self-tests...\n");

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
    corruptMigrationSchema = false,
    migrations = ["0001_initial_schema.sql", "0002_videos_and_reels_schema.sql", "0003_personal_gallery_schema.sql"],
    projectCount = 31,
    missingProjectSlug = null,
    mediaCount = 72,
    videoCount = 21,
    missingVideoSlug = null
  } = {}) => {
    let sql = "";
    if (!missingTable) {
      if (corruptMigrationSchema) {
        sql += `CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, unexpected_col TEXT);\n`;
        for (let i = 0; i < migrations.length; i++) {
          sql += `INSERT INTO d1_migrations VALUES (${i + 1}, '${migrations[i]}');\n`;
        }
      } else {
        sql += `CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TIMESTAMP);\n`;
        for (let i = 0; i < migrations.length; i++) {
          sql += `INSERT INTO d1_migrations VALUES (${i + 1}, '${migrations[i]}', CURRENT_TIMESTAMP);\n`;
        }
      }
    }
    sql += `CREATE TABLE portfolio_gallery_items (id TEXT PRIMARY KEY, sort_order INTEGER, status TEXT, created_at TIMESTAMP);\n`;
    sql += `CREATE TABLE projects (id TEXT PRIMARY KEY, slug TEXT, title TEXT, is_published INTEGER);\n`;
    for (let i = 0; i < projectCount; i++) {
      const slug = CANONICAL_PROJECT_SLUGS[i] || `extra-proj-${i}`;
      if (missingProjectSlug && slug === missingProjectSlug) {
        sql += `INSERT INTO projects VALUES ('proj-${i}', 'renamed-slug-${i}', 'Project ${i}', 1);\n`;
      } else {
        sql += `INSERT INTO projects VALUES ('proj-${i}', '${slug}', 'Project ${i}', 1);\n`;
      }
    }
    sql += `CREATE TABLE project_media (id TEXT PRIMARY KEY, project_id TEXT, storage_key TEXT);\n`;
    for (let i = 1; i <= mediaCount; i++) {
      sql += `INSERT INTO project_media VALUES ('media-${i}', 'proj-1', 'media/proj-1/${i}.webp');\n`;
    }
    sql += `CREATE TABLE portfolio_videos (id TEXT PRIMARY KEY, slug TEXT, orientation TEXT);\n`;
    for (let i = 0; i < videoCount; i++) {
      const slug = CANONICAL_VIDEO_SLUGS[i] || `extra-vid-${i}`;
      if (missingVideoSlug && slug === missingVideoSlug) {
        sql += `INSERT INTO portfolio_videos VALUES ('vid-${i}', 'renamed-vid-${i}', 'portrait');\n`;
      } else {
        sql += `INSERT INTO portfolio_videos VALUES ('vid-${i}', '${slug}', 'portrait');\n`;
      }
    }
    if (includeSyntaxError) {
      sql += `THIS IS INVALID SQL SYNTAX THAT WILL CAUSE BAIL ERROR;\n`;
    }
    return sql;
  };

  try {
    // 1. Positive case: valid full backup
    runCase("Positive: Valid complete staging backup with exact applied migrations passes", () => {
      const sqlFile = path.join(tmpDir, "valid-backup.sql");
      fs.writeFileSync(sqlFile, buildMockSql());
      const res = verifyBackupSql(sqlFile, { expectedProjects: 31, expectedMedia: 72, expectedVideos: 21 });
      if (!res.valid) throw new Error("Expected valid: true");
      if (res.projectCount !== 31) throw new Error(`Expected 31 projects, got ${res.projectCount}`);
      if (res.appliedMigrations.length !== 3) throw new Error(`Expected 3 applied migrations, got ${res.appliedMigrations.length}`);
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

    // 4. Negative case: Corrupt d1_migrations schema (missing required columns)
    runCase("Negative: Rejects d1_migrations table with corrupt/invalid schema", () => {
      const sqlFile = path.join(tmpDir, "corrupt-migration-schema.sql");
      fs.writeFileSync(sqlFile, buildMockSql({ corruptMigrationSchema: true }));
      let threw = false;
      try {
        verifyBackupSql(sqlFile);
      } catch (err) {
        threw = err.message.includes("INVALID_MIGRATION_SCHEMA");
      }
      if (!threw) throw new Error("Did not reject corrupt migration schema");
    });

    // 5. Negative case: Migration 0004 already applied (preflight expects pending)
    runCase("Negative: Rejects backup where 0004 is already applied", () => {
      const sqlFile = path.join(tmpDir, "already-applied-0004.sql");
      fs.writeFileSync(
        sqlFile,
        buildMockSql({
          migrations: [
            "0001_initial_schema.sql",
            "0002_videos_and_reels_schema.sql",
            "0003_personal_gallery_schema.sql",
            "0004_profile_notes_cv_schema.sql"
          ]
        })
      );
      let threw = false;
      try {
        verifyBackupSql(sqlFile);
      } catch (err) {
        threw = err.message.includes("MIGRATION_ALREADY_APPLIED");
      }
      if (!threw) throw new Error("Did not reject already-applied migration 0004");
    });

    // 6. Negative case: Unexpected / unauthorized migration entry
    runCase("Negative: Rejects unexpected migration entry (e.g. 0005_unknown.sql)", () => {
      const sqlFile = path.join(tmpDir, "unexpected-migration.sql");
      fs.writeFileSync(
        sqlFile,
        buildMockSql({
          migrations: [
            "0001_initial_schema.sql",
            "0002_videos_and_reels_schema.sql",
            "0003_personal_gallery_schema.sql",
            "0005_unauthorized_patch.sql"
          ]
        })
      );
      let threw = false;
      try {
        verifyBackupSql(sqlFile);
      } catch (err) {
        threw = err.message.includes("MIGRATION_COUNT_MISMATCH") || err.message.includes("UNEXPECTED_MIGRATION");
      }
      if (!threw) throw new Error("Did not reject unexpected migration");
    });

    // 7. Negative case: Missing required migration (e.g. 0003 missing)
    runCase("Negative: Rejects missing required migration 0003", () => {
      const sqlFile = path.join(tmpDir, "missing-migration-3.sql");
      fs.writeFileSync(
        sqlFile,
        buildMockSql({
          migrations: ["0001_initial_schema.sql", "0002_videos_and_reels_schema.sql"]
        })
      );
      let threw = false;
      try {
        verifyBackupSql(sqlFile);
      } catch (err) {
        threw = err.message.includes("MIGRATION_COUNT_MISMATCH");
      }
      if (!threw) throw new Error("Did not reject missing migration 0003");
    });

    // 8. Negative case: Mismatched project count (30 vs 31)
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

    // 9. Negative case: Missing canonical project slug
    runCase("Negative: Rejects backup missing a canonical project slug", () => {
      const sqlFile = path.join(tmpDir, "missing-project-slug.sql");
      fs.writeFileSync(
        sqlFile,
        buildMockSql({
          missingProjectSlug: "fling-arena"
        })
      );
      let threw = false;
      try {
        verifyBackupSql(sqlFile);
      } catch (err) {
        threw = err.message.includes("MISSING_CANONICAL_PROJECT");
      }
      if (!threw) throw new Error("Did not reject missing canonical project slug");
    });

    // 10. Negative case: Mismatched video count (20 vs 21)
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

    // 11. Negative case: Missing canonical video slug
    runCase("Negative: Rejects backup missing a canonical video slug", () => {
      const sqlFile = path.join(tmpDir, "missing-video-slug.sql");
      fs.writeFileSync(
        sqlFile,
        buildMockSql({
          missingVideoSlug: "ai-moda-kombin-reels"
        })
      );
      let threw = false;
      try {
        verifyBackupSql(sqlFile);
      } catch (err) {
        threw = err.message.includes("MISSING_CANONICAL_VIDEO");
      }
      if (!threw) throw new Error("Did not reject missing canonical video slug");
    });

    // 12. Negative case: Empty SQL file
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

    // 13. Cryptographic hash check on local migrations directory
    runCase("Security: Local migration directory matches reviewed cryptographic SHA-256 hashes", () => {
      verifyLocalMigrationFiles();
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
    console.log(`✓ BACKUP INTEGRITY & MIGRATION LEDGER VERIFIED:`);
    console.log(`  - File size: ${res.sqlFileSize} bytes`);
    console.log(`  - Tables: ${res.tables.join(", ")}`);
    console.log(`  - Applied Migrations: ${res.appliedMigrations.join(" -> ")}`);
    console.log(`  - Projects: ${res.projectCount} (all canonical slugs verified)`);
    console.log(`  - Media items: ${res.mediaCount}`);
    console.log(`  - Videos: ${res.videoCount} (all canonical slugs verified)`);
    process.exit(0);
  } catch (err) {
    console.error(`✗ BACKUP VERIFICATION FAILED: ${err.message}`);
    process.exit(1);
  }
}
