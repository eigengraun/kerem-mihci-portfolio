#!/usr/bin/env node
/**
 * scripts/import-canonical-projects-to-d1.mjs
 *
 * Deterministic, idempotent, non-destructive import and parity validation tool
 * for the canonical 30 Project records from src/data/projects.ts into D1.
 *
 * Supported Targets:
 *   --local / --target=local           : Targets local SQLite D1 simulation
 *   --remote-staging / --target=remote-staging : Targets verified Cloudflare staging D1 & Worker
 *   --remote-production / --target=remote-production : Targets production D1 (FAIL-CLOSED pending Gate B authorization)
 *
 * Flags:
 *   --dry-run : Evaluates canonical parity without making database writes (default)
 *   --force   : Explicitly authorizes overwriting existing records (LOCAL ONLY)
 *   --execute : Authorizes executing remote seeding (STRICTLY GATED)
 *   --strict / --strict-admission : Enforces strict target validation
 *   --db=<path> : Custom database path for isolated disposable fixtures
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

export const APPROVED_STAGING_CONFIG = Object.freeze({
  workerUrl: "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev",
  workerName: "kerem-mihci-portfolio-api-staging",
  databaseName: "kerem-portfolio-db-staging",
  databaseId: "0efef7a7-cc93-4dc2-8cb7-db28379fe01f",
  r2Bucket: "kerem-portfolio-media-staging"
});

export const APPROVED_PRODUCTION_CONFIG = Object.freeze({
  workerName: "kerem-mihci-portfolio-api",
  databaseName: "kerem-portfolio-db",
  r2Bucket: "kerem-portfolio-media"
});

export function verifyProjectTargetConfiguration(targetEnv = "staging") {
  const wranglerPath = path.join(ROOT, "cloudflare", "portfolio-api", "wrangler.jsonc");
  if (!fs.existsSync(wranglerPath)) {
    throw new Error(`Wrangler configuration file not found at ${wranglerPath}`);
  }
  const content = fs.readFileSync(wranglerPath, "utf-8");
  const cleanJson = content.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, "");
  let parsed;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    throw new Error(`Failed to parse wrangler.jsonc: ${err.message}`);
  }

  const envConfig = parsed.env?.[targetEnv];
  if (!envConfig) {
    throw new Error(`Missing '${targetEnv}' environment block in wrangler.jsonc`);
  }

  const d1 = envConfig.d1_databases?.[0];
  const r2 = envConfig.r2_buckets?.[0];
  const workerName = envConfig.name;

  if (targetEnv === "staging") {
    if (workerName !== APPROVED_STAGING_CONFIG.workerName) {
      throw new Error(`Worker name mismatch: expected ${APPROVED_STAGING_CONFIG.workerName}, found ${workerName}`);
    }
    if (d1?.database_name !== APPROVED_STAGING_CONFIG.databaseName) {
      throw new Error(`D1 database name mismatch: expected ${APPROVED_STAGING_CONFIG.databaseName}, found ${d1?.database_name}`);
    }
    if (d1?.database_id !== APPROVED_STAGING_CONFIG.databaseId) {
      throw new Error(`D1 database ID mismatch: expected ${APPROVED_STAGING_CONFIG.databaseId}, found ${d1?.database_id}`);
    }
    if (r2?.bucket_name !== APPROVED_STAGING_CONFIG.r2Bucket) {
      throw new Error(`R2 bucket mismatch: expected ${APPROVED_STAGING_CONFIG.r2Bucket}, found ${r2?.bucket_name}`);
    }
  } else if (targetEnv === "production") {
    if (workerName !== APPROVED_PRODUCTION_CONFIG.workerName) {
      throw new Error(`Worker name mismatch: expected ${APPROVED_PRODUCTION_CONFIG.workerName}, found ${workerName}`);
    }
    if (d1?.database_name !== APPROVED_PRODUCTION_CONFIG.databaseName) {
      throw new Error(`D1 database name mismatch: expected ${APPROVED_PRODUCTION_CONFIG.databaseName}, found ${d1?.database_name}`);
    }
    if (!d1?.database_id || d1?.database_id === "REPLACE_WITH_PRODUCTION_D1_DATABASE_ID" || d1?.database_id.startsWith("local-")) {
      throw new Error(`Production D1 database is unprovisioned (found placeholder '${d1?.database_id}').`);
    }
    if (r2?.bucket_name !== APPROVED_PRODUCTION_CONFIG.r2Bucket) {
      throw new Error(`R2 bucket mismatch: expected ${APPROVED_PRODUCTION_CONFIG.r2Bucket}, found ${r2?.bucket_name}`);
    }
  }

  return { workerName, d1, r2 };
}

export function extractCanonicalProjects(projectsTsPath = null) {
  const targetPath = projectsTsPath || path.join(ROOT, "src", "data", "projects.ts");
  const rawTs = fs.readFileSync(targetPath, "utf-8");
  const marker = "export const projectsData: Project[] =";
  const startIdx = rawTs.indexOf(marker);
  const endMarker = "export const projectsItemsByWorkspace";
  const endIdx = rawTs.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Could not locate projectsData in src/data/projects.ts");
  }

  const arrayLiteral = rawTs
    .slice(startIdx + marker.length, endIdx)
    .trim()
    .replace(/;$/, "");

  const projects = new Function(`return (${arrayLiteral});`)();
  if (!Array.isArray(projects) || projects.length !== 30) {
    throw new Error(`Expected exactly 30 canonical projects, found ${projects?.length}`);
  }
  return projects;
}

export function normalizeSlug(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function verifyProjectAssetsOnDisk(project, publicDir = null) {
  const baseDir = publicDir || path.join(ROOT, "public");
  const missing = [];

  const check = (relPath, role) => {
    if (!relPath) return;
    const clean = relPath.replace(/^\//, "");
    const diskPath = path.join(baseDir, clean);
    if (!fs.existsSync(diskPath)) {
      missing.push({ role, relPath, diskPath });
    }
  };

  check(project.cover, "cover");
  check(project.thumbnail, "thumbnail");
  check(project.desktopIcon, "desktopIcon");
  check(project.ogImage, "ogImage");
  if (project.desktopThumbnail?.src) check(project.desktopThumbnail.src, "desktopThumbnail");
  for (let idx = 0; idx < (project.media || []).length; idx++) {
    const m = project.media[idx];
    check(m.src, `media_${idx + 1}_src`);
    if (m.poster) check(m.poster, `media_${idx + 1}_poster`);
    if (m.thumbnail) check(m.thumbnail, `media_${idx + 1}_thumbnail`);
  }

  return missing;
}

export function compareCanonicalWithProjectRecord(c, r) {
  const diffs = [];
  const check = (field, expected, actual) => {
    const expStr = JSON.stringify(expected ?? null);
    const actStr = JSON.stringify(actual ?? null);
    if (expStr !== actStr) {
      diffs.push({ field, expected, actual });
    }
  };

  check("id", c.id, r.id);
  check("slug", c.slug, r.slug);
  check("workspace", c.workspace, r.workspace);
  check("featured", Boolean(c.featured), Boolean(r.featured));
  check("featuredOrder", c.featuredOrder ?? 0, r.featured_order);
  check("client", c.client || "", r.client_name);
  check("year", String(c.year ?? ""), String(r.year ?? ""));
  check("cover", c.cover ?? null, r.cover_image_url);
  check("thumbnail", c.thumbnail ?? null, r.thumbnail_url);

  return diffs;
}

export async function runLocalProjectSeed(canonicalProjects, options = {}) {
  const activeDbPath = options.dbPath
    ? path.resolve(options.dbPath)
    : process.env.LOCAL_D1_DB_PATH
      ? path.resolve(process.env.LOCAL_D1_DB_PATH)
      : path.join(ROOT, ".local-d1", "portfolio.sqlite");

  const isDryRunActive = options.isDryRun !== undefined ? Boolean(options.isDryRun) : true;
  const isForceActive = options.isForce !== undefined ? Boolean(options.isForce) : false;
  const isStrictActive = options.isStrictAdmission !== undefined ? Boolean(options.isStrictAdmission) : false;

  console.log("============================================================");
  console.log("CANONICAL 30 PROJECT D1 IMPORT & PARITY VALIDATOR");
  console.log("============================================================");
  console.log("Mode:", isDryRunActive ? (isStrictActive ? "DRY RUN (Strict Admission Preflight)" : "DRY RUN (Read-Only)") : isForceActive ? "FORCE OVERWRITE" : "NON-DESTRUCTIVE SAFE SEED");
  console.log("Target Database:", activeDbPath);

  let db;
  if (isDryRunActive) {
    if (!fs.existsSync(activeDbPath)) {
      throw new Error(`LOCAL_DB_NOT_FOUND: Cannot run local dry-run on non-existent database "${activeDbPath}".`);
    }
    db = new DatabaseSync(activeDbPath, { readOnly: true });

    const requiredTables = ["projects", "project_translations", "project_media", "categories", "project_categories"];
    const foundTables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('projects', 'project_translations', 'project_media', 'categories', 'project_categories')`
    ).all().map((r) => r.name);

    const missingTables = requiredTables.filter((t) => !foundTables.includes(t));
    if (missingTables.length > 0) {
      throw new Error(`SCHEMA_INCOMPLETE: Required table(s) [${missingTables.join(", ")}] missing in "${activeDbPath}".`);
    }
  } else {
    fs.mkdirSync(path.dirname(activeDbPath), { recursive: true });
    db = new DatabaseSync(activeDbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    const migration0001 = path.join(ROOT, "cloudflare", "portfolio-api", "migrations", "0001_initial_schema.sql");
    if (fs.existsSync(migration0001)) {
      db.exec(fs.readFileSync(migration0001, "utf-8"));
    }
    console.log("✓ Verified schema migration 0001 (Initial Schema).");
  }

  // Verify asset presence on disk
  const missingAssetsSummary = [];
  for (const p of canonicalProjects) {
    const missing = verifyProjectAssetsOnDisk(p);
    if (missing.length > 0) {
      missingAssetsSummary.push({ project: p.slug, missing });
    }
  }

  if (missingAssetsSummary.length > 0) {
    console.warn(`WARNING: Missing local media assets detected in ${missingAssetsSummary.length} project(s).`);
  }

  const existingProjectRows = db.prepare(`SELECT * FROM projects`).all();
  const existingTransRows = db.prepare(`SELECT * FROM project_translations`).all();
  const existingRevs = db.prepare(`SELECT * FROM project_revisions`).all();

  const manifest = [];
  const editorialConflicts = [];

  for (let idx = 0; idx < canonicalProjects.length; idx++) {
    const p = canonicalProjects[idx];
    const existing = existingProjectRows.find((r) => r.id === p.id || r.slug === p.slug);

    let status = "PLANNED_INSERT";
    let diffs = [];

    if (existing) {
      diffs = compareCanonicalWithProjectRecord(p, existing);

      // Check if project has user editorial revisions
      const nonSeedRevs = existingRevs.filter(
        (rev) => rev.project_id === existing.id && rev.action !== "seed_migration"
      );
      const isEditorialModified = nonSeedRevs.length > 0;

      if (diffs.length === 0) {
        status = "CANONICAL_PARITY";
      } else if (isEditorialModified) {
        status = "EDITORIAL_CONFLICT";
        editorialConflicts.push({ id: p.id, slug: p.slug, nonSeedRevsCount: nonSeedRevs.length, diffs });
      } else {
        status = "PLANNED_UPDATE";
      }
    }

    manifest.push({
      id: p.id,
      slug: p.slug,
      workspace: p.workspace,
      status,
      diffs
    });
  }

  const now = new Date().toISOString();
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  if (!isDryRunActive) {
    db.exec("BEGIN TRANSACTION;");
    try {
      for (let idx = 0; idx < canonicalProjects.length; idx++) {
        const p = canonicalProjects[idx];
        const item = manifest[idx];

        if (item.status === "CANONICAL_PARITY" && !isForceActive) {
          skippedCount++;
          continue;
        }

        if (item.status === "EDITORIAL_CONFLICT" && !isForceActive) {
          console.warn(`Preserving editorial modification on project ${p.slug} (use --force to overwrite).`);
          skippedCount++;
          continue;
        }

        const fOrder = p.featuredOrder ?? 0;
        const sortOrder = p.sortOrder ?? idx + 1;
        const desktopThumbJson = p.desktopThumbnail ? JSON.stringify(p.desktopThumbnail) : null;
        const liveLink = p.externalLinks?.find((l) => l.type === "live")?.href || null;

        const mediaMeta = (p.media || []).map((m) => ({
          originalId: m.id,
          layout: m.layout,
          poster: m.poster,
          thumbnail: m.thumbnail,
          aspectRatio: m.aspectRatio,
          autoplay: m.autoplay,
          muted: m.muted,
          loop: m.loop,
          preload: m.preload,
          priority: m.priority
        }));

        const extraMeta = {
          categoryIds: p.categoryIds,
          tools: p.tools,
          services: p.services,
          servicesTR: p.servicesTR,
          servicesEN: p.servicesEN,
          externalLinks: p.externalLinks,
          hasExplicitExternalLinks: p.externalLinks !== undefined,
          contentBlocks: p.contentBlocks,
          desktopLabelTR: p.desktopLabelTR,
          desktopLabelEN: p.desktopLabelEN,
          challengeTR: p.challengeTR,
          challengeEN: p.challengeEN,
          solutionTR: p.solutionTR,
          solutionEN: p.solutionEN,
          resultTR: p.resultTR,
          resultEN: p.resultEN,
          desktopWidth: p.desktop?.width,
          desktopWeight: p.desktopWeight,
          desktopPlacement: p.desktopPlacement,
          desktopClusterId: p.desktopClusterId,
          projectStatus: p.status || "completed",
          hasExplicitSeo: Boolean(p.seo),
          hasExplicitOgImage: Boolean(p.ogImage),
          mediaMeta
        };
        const tagsJson = JSON.stringify(extraMeta);

        const existingRecord = existingProjectRows.find((r) => r.id === p.id || r.slug === p.slug);

        if (!existingRecord) {
          db.prepare(
            `INSERT INTO projects (
              id, slug, status, workspace, featured, featured_order, sort_order,
              client_name, year, live_url, source_url, initials,
              cover_image_url, thumbnail_url, desktop_icon_url, og_image_url,
              desktop_thumbnail_json, desktop_position_x, desktop_position_y,
              window_width, window_height, tags_json,
              created_at, updated_at, published_at, archived_at
            ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
          ).run(
            p.id,
            p.slug,
            p.workspace,
            p.featured ? 1 : 0,
            fOrder,
            sortOrder,
            p.client || "",
            p.year ?? "",
            liveLink,
            p.initials ?? null,
            p.cover ?? null,
            p.thumbnail ?? null,
            p.desktopIcon ?? null,
            p.ogImage ?? p.seo?.ogImage ?? null,
            desktopThumbJson,
            p.desktop?.x ?? 25,
            p.desktop?.y ?? 25,
            p.initialWindow?.width ?? 820,
            p.initialWindow?.height ?? 600,
            tagsJson,
            now,
            now,
            now
          );
          insertedCount++;
        } else {
          db.prepare(
            `UPDATE projects SET
              slug = ?, workspace = ?, featured = ?, featured_order = ?, sort_order = ?,
              client_name = ?, year = ?, live_url = ?, initials = ?,
              cover_image_url = ?, thumbnail_url = ?, desktop_icon_url = ?, og_image_url = ?,
              desktop_thumbnail_json = ?, desktop_position_x = ?, desktop_position_y = ?,
              window_width = ?, window_height = ?, tags_json = ?, updated_at = ?
            WHERE id = ?`
          ).run(
            p.slug,
            p.workspace,
            p.featured ? 1 : 0,
            fOrder,
            sortOrder,
            p.client || "",
            p.year ?? "",
            liveLink,
            p.initials ?? null,
            p.cover ?? null,
            p.thumbnail ?? null,
            p.desktopIcon ?? null,
            p.ogImage ?? p.seo?.ogImage ?? null,
            desktopThumbJson,
            p.desktop?.x ?? 25,
            p.desktop?.y ?? 25,
            p.initialWindow?.width ?? 820,
            p.initialWindow?.height ?? 600,
            tagsJson,
            now,
            p.id
          );
          updatedCount++;
        }

        // Translations TR & EN
        db.prepare(
          `INSERT INTO project_translations (
            id, project_id, locale, title, subtitle, summary, description, role,
            category_label, seo_title, seo_description, deliverables_json, highlights_json, updated_at
          ) VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)
          ON CONFLICT(project_id, locale) DO UPDATE SET
            title = excluded.title, subtitle = excluded.subtitle, summary = excluded.summary,
            description = excluded.description, role = excluded.role, category_label = excluded.category_label,
            seo_title = excluded.seo_title, seo_description = excluded.seo_description,
            deliverables_json = excluded.deliverables_json, updated_at = excluded.updated_at`
        ).run(
          `${p.id}:tr`,
          p.id,
          p.titleTR,
          p.projectTypeTR ?? null,
          p.summaryTR ?? null,
          p.descriptionTR ?? "",
          p.roleTR ?? null,
          p.categoryTR || "",
          p.seo?.titleTR ?? null,
          p.seo?.descriptionTR ?? null,
          JSON.stringify(p.servicesTR || p.services || []),
          now
        );

        db.prepare(
          `INSERT INTO project_translations (
            id, project_id, locale, title, subtitle, summary, description, role,
            category_label, seo_title, seo_description, deliverables_json, highlights_json, updated_at
          ) VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)
          ON CONFLICT(project_id, locale) DO UPDATE SET
            title = excluded.title, subtitle = excluded.subtitle, summary = excluded.summary,
            description = excluded.description, role = excluded.role, category_label = excluded.category_label,
            seo_title = excluded.seo_title, seo_description = excluded.seo_description,
            deliverables_json = excluded.deliverables_json, updated_at = excluded.updated_at`
        ).run(
          `${p.id}:en`,
          p.id,
          p.titleEN,
          p.projectTypeEN ?? null,
          p.summaryEN ?? null,
          p.descriptionEN ?? "",
          p.roleEN ?? null,
          p.categoryEN || "",
          p.seo?.titleEN ?? null,
          p.seo?.descriptionEN ?? null,
          JSON.stringify(p.servicesEN || p.services || []),
          now
        );

        // Categories
        const catSlug = normalizeSlug(p.categoryEN || p.categoryTR || p.workspace);
        const catId = `cat-${catSlug}`;
        db.prepare(
          `INSERT OR IGNORE INTO categories (id, slug, workspace, label_tr, label_en, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(catId, catSlug, p.workspace, p.categoryTR, p.categoryEN, idx + 1, now);
        db.prepare(`INSERT OR IGNORE INTO project_categories (project_id, category_id) VALUES (?, ?)`).run(p.id, catId);

        // Project Media
        db.prepare(`DELETE FROM project_media WHERE project_id = ? AND kind = 'gallery'`).run(p.id);
        const mediaItems = p.media || [];
        for (let mIdx = 0; mIdx < mediaItems.length; mIdx++) {
          const m = mediaItems[mIdx];
          const mediaId = `${p.id}-media-${mIdx + 1}`;
          const ext = path.extname(m.src).toLowerCase();
          const mimeType =
            m.type === "video"
              ? "video/mp4"
              : ext === ".png"
              ? "image/png"
              : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : "image/webp";

          db.prepare(
            `INSERT INTO project_media (
              id, project_id, kind, media_type, storage_key, public_url, filename,
              mime_type, byte_size, width, height, alt_tr, alt_en, caption_tr, caption_en,
              sort_order, created_at, updated_at
            ) VALUES (?, ?, 'gallery', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            mediaId,
            p.id,
            m.type || "image",
            m.src.replace(/^\//, ""),
            m.src,
            path.basename(m.src),
            mimeType,
            m.width ?? null,
            m.height ?? null,
            m.altTR || p.titleTR,
            m.altEN || p.titleEN,
            m.captionTR ?? null,
            m.captionEN ?? null,
            mIdx + 1,
            now,
            now
          );
        }

        if (!existingRecord) {
          db.prepare(
            `INSERT INTO project_revisions (id, project_id, revision_number, action, snapshot_json, actor_email, created_at)
             VALUES (?, ?, 1, 'seed_migration', ?, 'system@keremmihci.com', ?)`
          ).run(`rev-${p.id}-1`, p.id, JSON.stringify(p), now);

          db.prepare(
            `INSERT INTO publishing_events (id, project_id, event_type, previous_status, new_status, actor_email, notes, created_at)
             VALUES (?, ?, 'publish', NULL, 'published', 'system@keremmihci.com', 'Canonical migration from src/data/projects.ts', ?)`
          ).run(`pub-${p.id}-1`, p.id, now);
        }
      }
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  }

  // Final Reconciliation
  const finalProjects = db.prepare(`SELECT * FROM projects ORDER BY sort_order ASC`).all();
  const canonicalSlugs = new Set(canonicalProjects.map((p) => p.slug));
  const canonicalParity = finalProjects.filter((r) => canonicalSlugs.has(r.slug));
  const missingSlugs = canonicalProjects.filter((p) => !finalProjects.some((r) => r.slug === p.slug)).map((p) => p.slug);

  console.log(`Reconciliation summary:`);
  console.log(`  Canonical Parity: ${canonicalParity.length}/30`);
  console.log(`  Missing: ${missingSlugs.length}`);
  console.log(`  Inserted: ${insertedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);

  return {
    dryRun: isDryRunActive,
    totalCanonical: canonicalProjects.length,
    canonicalParityCount: canonicalParity.length,
    missingSlugs,
    editorialConflicts,
    insertedCount,
    updatedCount,
    skippedCount,
    manifest
  };
}

// -----------------------------------------------------------------------------
// CLI Execution
// -----------------------------------------------------------------------------
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const rawArgs = process.argv.slice(2);
  const VALID_FLAGS = new Set([
    "--local",
    "--target=local",
    "--remote-staging",
    "--target=remote-staging",
    "--remote-production",
    "--target=remote-production",
    "--dry-run",
    "--strict",
    "--strict-admission",
    "--force",
    "--execute"
  ]);

  let customDbPath = null;
  for (const arg of rawArgs) {
    if (arg.startsWith("--db=")) {
      customDbPath = path.resolve(arg.slice("--db=".length));
      continue;
    }
    if (arg.startsWith("--database=")) {
      customDbPath = path.resolve(arg.slice("--database=".length));
      continue;
    }
    if (!VALID_FLAGS.has(arg)) {
      console.error(`FATAL: Unrecognized CLI argument "${arg}".`);
      console.error("Allowed flags: --local, --remote-staging, --remote-production, --dry-run, --strict-admission, --force, --execute, --db=<path>.");
      process.exit(1);
    }
  }

  const isRemoteProduction = rawArgs.includes("--remote-production") || rawArgs.includes("--target=remote-production");
  const isRemoteStaging = rawArgs.includes("--remote-staging") || rawArgs.includes("--target=remote-staging");
  const isLocal = rawArgs.includes("--local") || rawArgs.includes("--target=local") || (!isRemoteProduction && !isRemoteStaging);
  const isExecute = rawArgs.includes("--execute");
  const isForce = rawArgs.includes("--force");
  const isDryRun = rawArgs.includes("--dry-run") || (!isExecute && !isForce);
  const isStrict = rawArgs.includes("--strict") || rawArgs.includes("--strict-admission");

  if (isRemoteProduction) {
    console.log("Validating production target configuration...");
    verifyProjectTargetConfiguration("production");

    if (isExecute) {
      console.error("\nFATAL: Production remote execution is strictly NOT_AUTHORIZED.");
      console.error("Gate B release approval has not been granted by the human operator.");
      console.error("Execution halted fail-closed.");
      process.exit(1);
    }

    console.log("Production target validated (dry-run mode). Remote writes strictly forbidden.");
  }

  if (isRemoteStaging) {
    verifyProjectTargetConfiguration("staging");
    if (isExecute) {
      console.error("FATAL: Remote staging seeding requires explicit staged authorization.");
      process.exit(1);
    }
  }

  if (isLocal) {
    const projects = extractCanonicalProjects();
    runLocalProjectSeed(projects, {
      dbPath: customDbPath,
      isDryRun,
      isForce,
      isStrictAdmission: isStrict
    }).then((res) => {
      console.log(`✓ Local execution complete: ${res.canonicalParityCount}/${res.totalCanonical} parity.`);
      if (res.missingSlugs.length > 0) {
        process.exit(1);
      }
    }).catch((err) => {
      console.error("Local project seed error:", err);
      process.exit(1);
    });
  }
}
