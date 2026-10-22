#!/usr/bin/env node
/**
 * scripts/import-canonical-projects-to-d1.mjs
 *
 * Deterministic, idempotent, non-destructive import and full relational parity
 * validation tool for the canonical 30 Project records from src/data/projects.ts into D1.
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
 *   --strict / --strict-admission : Enforces complete relational admission contract
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

export function verifyProjectTargetConfiguration(targetEnv = "staging", { allowUnprovisioned = false } = {}) {
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
    const isUnprovisioned = !d1?.database_id || d1?.database_id === "REPLACE_WITH_PRODUCTION_D1_DATABASE_ID" || d1?.database_id.startsWith("local-");
    if (isUnprovisioned && !allowUnprovisioned) {
      throw new Error(`Production D1 database is unprovisioned (found placeholder '${d1?.database_id}').`);
    }
    if (r2?.bucket_name !== APPROVED_PRODUCTION_CONFIG.r2Bucket) {
      throw new Error(`R2 bucket mismatch: expected ${APPROVED_PRODUCTION_CONFIG.r2Bucket}, found ${r2?.bucket_name}`);
    }
    return { workerName, d1, r2, isUnprovisioned };
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

export function getDiskFileSize(relPath, rootDir = ROOT) {
  if (!relPath) return 0;
  const diskPath = path.join(rootDir, "public", relPath.replace(/^\//, ""));
  try {
    if (fs.existsSync(diskPath)) {
      return fs.statSync(diskPath).size;
    }
  } catch {}
  return 0;
}

export function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".webp": return "image/webp";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".svg": return "image/svg+xml";
    case ".mp4": return "video/mp4";
    default: return "image/webp";
  }
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

export function buildExpectedCanonicalProjectRecord(p, rootDir = ROOT) {
  const fOrder = p.featuredOrder ?? 0;
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

  const expectedMedia = (p.media || []).map((m, mIdx) => {
    const byteSize = getDiskFileSize(m.src, rootDir);
    return {
      id: `${p.id}-media-${mIdx + 1}`,
      kind: "gallery",
      media_type: m.type || "image",
      storage_key: m.src.replace(/^\//, ""),
      public_url: m.src,
      filename: path.basename(m.src),
      mime_type: getMimeType(m.src),
      byte_size: byteSize,
      width: m.width ?? null,
      height: m.height ?? null,
      alt_tr: m.altTR || p.titleTR,
      alt_en: m.altEN || p.titleEN,
      caption_tr: m.captionTR ?? null,
      caption_en: m.captionEN ?? null,
      sort_order: mIdx + 1
    };
  });

  const catSlug = normalizeSlug(p.categoryEN || p.categoryTR || p.workspace);

  return {
    parent: {
      id: p.id,
      slug: p.slug,
      status: "published",
      workspace: p.workspace,
      featured: p.featured ? 1 : 0,
      featured_order: fOrder,
      client_name: p.client || "",
      year: String(p.year ?? ""),
      live_url: liveLink,
      initials: p.initials ?? null,
      cover_image_url: p.cover ?? null,
      thumbnail_url: p.thumbnail ?? null,
      desktop_icon_url: p.desktopIcon ?? null,
      og_image_url: p.ogImage ?? p.seo?.ogImage ?? null,
      desktop_thumbnail_json: desktopThumbJson,
      desktop_position_x: p.desktop?.x ?? 25,
      desktop_position_y: p.desktop?.y ?? 25,
      window_width: p.initialWindow?.width ?? 820,
      window_height: p.initialWindow?.height ?? 600,
      tags_json: JSON.stringify(extraMeta)
    },
    tr: {
      locale: "tr",
      title: p.titleTR,
      subtitle: p.projectTypeTR ?? null,
      summary: p.summaryTR ?? null,
      description: p.descriptionTR ?? "",
      role: p.roleTR ?? null,
      category_label: p.categoryTR || "",
      seo_title: p.seo?.titleTR ?? null,
      seo_description: p.seo?.descriptionTR ?? null,
      deliverables_json: JSON.stringify(p.servicesTR || p.services || [])
    },
    en: {
      locale: "en",
      title: p.titleEN,
      subtitle: p.projectTypeEN ?? null,
      summary: p.summaryEN ?? null,
      description: p.descriptionEN ?? "",
      role: p.roleEN ?? null,
      category_label: p.categoryEN || "",
      seo_title: p.seo?.titleEN ?? null,
      seo_description: p.seo?.descriptionEN ?? null,
      deliverables_json: JSON.stringify(p.servicesEN || p.services || [])
    },
    categorySlug: catSlug,
    media: expectedMedia
  };
}

export function getCompositeProjectRecord(db, projectId) {
  const parent = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!parent) return null;

  const tr = db.prepare("SELECT * FROM project_translations WHERE project_id = ? AND locale = 'tr'").get(projectId) || null;
  const en = db.prepare("SELECT * FROM project_translations WHERE project_id = ? AND locale = 'en'").get(projectId) || null;
  const categories = db.prepare(
    "SELECT c.slug, c.label_tr, c.label_en FROM categories c JOIN project_categories pc ON pc.category_id = c.id WHERE pc.project_id = ?"
  ).all(projectId);
  const media = db.prepare(
    "SELECT * FROM project_media WHERE project_id = ? AND kind = 'gallery' ORDER BY sort_order ASC, id ASC"
  ).all(projectId);
  const revisions = db.prepare(
    "SELECT * FROM project_revisions WHERE project_id = ? ORDER BY revision_number ASC"
  ).all(projectId);
  const publishingEvents = db.prepare(
    "SELECT * FROM publishing_events WHERE project_id = ? ORDER BY created_at ASC"
  ).all(projectId);

  return {
    parent,
    tr,
    en,
    categories,
    media,
    revisions,
    publishingEvents
  };
}

export function compareCanonicalWithProjectRecord(c, composite, rootDir = ROOT) {
  const diffs = [];
  const check = (domain, field, expected, actual) => {
    const expStr = JSON.stringify(expected ?? null);
    const actStr = JSON.stringify(actual ?? null);
    if (expStr !== actStr) {
      diffs.push({ domain, field, expected, actual });
    }
  };

  if (!composite || !composite.parent) {
    diffs.push({ domain: "parent", field: "record", expected: c.id, actual: null });
    return diffs;
  }

  const exp = buildExpectedCanonicalProjectRecord(c, rootDir);
  const p = composite.parent;

  // 1. Parent Project Fields
  check("parent", "id", exp.parent.id, p.id);
  check("parent", "slug", exp.parent.slug, p.slug);
  check("parent", "status", exp.parent.status, p.status);
  check("parent", "workspace", exp.parent.workspace, p.workspace);
  check("parent", "featured", exp.parent.featured, p.featured);
  check("parent", "featured_order", exp.parent.featured_order, p.featured_order);
  check("parent", "client_name", exp.parent.client_name, p.client_name);
  check("parent", "year", exp.parent.year, String(p.year ?? ""));
  check("parent", "live_url", exp.parent.live_url, p.live_url);
  check("parent", "initials", exp.parent.initials, p.initials);
  check("parent", "cover_image_url", exp.parent.cover_image_url, p.cover_image_url);
  check("parent", "thumbnail_url", exp.parent.thumbnail_url, p.thumbnail_url);
  check("parent", "desktop_icon_url", exp.parent.desktop_icon_url, p.desktop_icon_url);
  check("parent", "og_image_url", exp.parent.og_image_url, p.og_image_url);
  check("parent", "desktop_thumbnail_json", exp.parent.desktop_thumbnail_json, p.desktop_thumbnail_json);
  check("parent", "desktop_position_x", exp.parent.desktop_position_x, p.desktop_position_x);
  check("parent", "desktop_position_y", exp.parent.desktop_position_y, p.desktop_position_y);
  check("parent", "window_width", exp.parent.window_width, p.window_width);
  check("parent", "window_height", exp.parent.window_height, p.window_height);

  // Compare tags_json normalized
  try {
    const expTags = JSON.parse(exp.parent.tags_json);
    const actTags = JSON.parse(p.tags_json || "{}");
    check("parent", "tags_json", expTags, actTags);
  } catch {
    check("parent", "tags_json", exp.parent.tags_json, p.tags_json);
  }

  // 2. Turkish Translation Fields
  if (!composite.tr) {
    diffs.push({ domain: "translation_tr", field: "row", expected: "present", actual: "missing" });
  } else {
    check("translation_tr", "title", exp.tr.title, composite.tr.title);
    check("translation_tr", "subtitle", exp.tr.subtitle, composite.tr.subtitle);
    check("translation_tr", "summary", exp.tr.summary, composite.tr.summary);
    check("translation_tr", "description", exp.tr.description, composite.tr.description);
    check("translation_tr", "role", exp.tr.role, composite.tr.role);
    check("translation_tr", "category_label", exp.tr.category_label, composite.tr.category_label);
    check("translation_tr", "seo_title", exp.tr.seo_title, composite.tr.seo_title);
    check("translation_tr", "seo_description", exp.tr.seo_description, composite.tr.seo_description);
    check("translation_tr", "deliverables_json", JSON.parse(exp.tr.deliverables_json), JSON.parse(composite.tr.deliverables_json || "[]"));
  }

  // 3. English Translation Fields
  if (!composite.en) {
    diffs.push({ domain: "translation_en", field: "row", expected: "present", actual: "missing" });
  } else {
    check("translation_en", "title", exp.en.title, composite.en.title);
    check("translation_en", "subtitle", exp.en.subtitle, composite.en.subtitle);
    check("translation_en", "summary", exp.en.summary, composite.en.summary);
    check("translation_en", "description", exp.en.description, composite.en.description);
    check("translation_en", "role", exp.en.role, composite.en.role);
    check("translation_en", "category_label", exp.en.category_label, composite.en.category_label);
    check("translation_en", "seo_title", exp.en.seo_title, composite.en.seo_title);
    check("translation_en", "seo_description", exp.en.seo_description, composite.en.seo_description);
    check("translation_en", "deliverables_json", JSON.parse(exp.en.deliverables_json), JSON.parse(composite.en.deliverables_json || "[]"));
  }

  // 4. Category Assignment
  const assignedCategories = (composite.categories || []).map((c) => c.slug);
  if (!assignedCategories.includes(exp.categorySlug)) {
    diffs.push({ domain: "category", field: "categorySlug", expected: exp.categorySlug, actual: assignedCategories });
  }

  // 5. Gallery Media Parity
  const actMedia = composite.media || [];
  check("media", "count", exp.media.length, actMedia.length);

  for (let mIdx = 0; mIdx < exp.media.length; mIdx++) {
    const expItem = exp.media[mIdx];
    const actItem = actMedia[mIdx];
    if (!actItem) {
      diffs.push({ domain: "media", field: `item_${mIdx + 1}`, expected: expItem.storage_key, actual: "missing" });
      continue;
    }
    check("media", `item_${mIdx + 1}_storage_key`, expItem.storage_key, actItem.storage_key);
    check("media", `item_${mIdx + 1}_mime_type`, expItem.mime_type, actItem.mime_type);
    check("media", `item_${mIdx + 1}_alt_tr`, expItem.alt_tr, actItem.alt_tr);
    check("media", `item_${mIdx + 1}_alt_en`, expItem.alt_en, actItem.alt_en);
    check("media", `item_${mIdx + 1}_sort_order`, expItem.sort_order, actItem.sort_order);
  }

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
  try {
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

  // Check duplicate / identity collisions
  const identityConflicts = [];
  for (const c of canonicalProjects) {
    const slugMatch = existingProjectRows.find((r) => r.slug === c.slug);
    const idMatch = existingProjectRows.find((r) => r.id === c.id);

    if (slugMatch && idMatch && slugMatch.id !== idMatch.id) {
      identityConflicts.push({ canonical: c, reason: `Slug '${c.slug}' belongs to id '${slugMatch.id}', but canonical ID is '${c.id}'` });
    } else if (slugMatch && slugMatch.id !== c.id) {
      identityConflicts.push({ canonical: c, reason: `Slug '${c.slug}' already used by non-canonical id '${slugMatch.id}'` });
    } else if (idMatch && idMatch.slug !== c.slug) {
      identityConflicts.push({ canonical: c, reason: `ID '${c.id}' already used by non-canonical slug '${idMatch.slug}'` });
    }
  }

  if (identityConflicts.length > 0 && !isForceActive) {
    console.error(`FATAL: Detected ${identityConflicts.length} identity collision(s) in destination database.`);
    if (isStrictActive) {
      throw new Error(`STRICT_ADMISSION_FAILED: Detected ${identityConflicts.length} identity collisions.`);
    }
  }

  const manifest = [];
  const editorialConflicts = [];

  for (let idx = 0; idx < canonicalProjects.length; idx++) {
    const p = canonicalProjects[idx];
    const existing = existingProjectRows.find((r) => r.id === p.id || r.slug === p.slug);

    let status = "PLANNED_INSERT";
    let diffs = [];

    if (existing) {
      const composite = getCompositeProjectRecord(db, existing.id);
      diffs = compareCanonicalWithProjectRecord(p, composite);

      if (diffs.length === 0) {
        status = "CANONICAL_PARITY";
      } else {
        // Any difference from canonical source is an editorial conflict!
        // Absence of an editorial revision row is NOT proof that data can be overwritten.
        status = "EDITORIAL_CONFLICT";
        const hasRevs = composite?.revisions?.length > 0;
        const nonSeedCount = (composite?.revisions || []).filter((r) => r.action !== "seed_migration").length;
        editorialConflicts.push({
          id: p.id,
          slug: p.slug,
          hasRevisionHistory: hasRevs,
          nonSeedRevsCount: nonSeedCount,
          diffCount: diffs.length,
          diffs
        });
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
          console.warn(`[PRESERVE_DESTINATION] Preserving existing editorial state on project ${p.slug} (${item.diffs.length} diffs).`);
          skippedCount++;
          continue;
        }

        const exp = buildExpectedCanonicalProjectRecord(p);
        const fOrder = exp.parent.featured_order;
        const sortOrder = p.sortOrder ?? idx + 1;
        const tagsJson = exp.parent.tags_json;

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
            String(p.year ?? ""),
            exp.parent.live_url,
            p.initials ?? null,
            p.cover ?? null,
            p.thumbnail ?? null,
            p.desktopIcon ?? null,
            p.ogImage ?? p.seo?.ogImage ?? null,
            exp.parent.desktop_thumbnail_json,
            exp.parent.desktop_position_x,
            exp.parent.desktop_position_y,
            exp.parent.window_width,
            exp.parent.window_height,
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
            String(p.year ?? ""),
            exp.parent.live_url,
            p.initials ?? null,
            p.cover ?? null,
            p.thumbnail ?? null,
            p.desktopIcon ?? null,
            p.ogImage ?? p.seo?.ogImage ?? null,
            exp.parent.desktop_thumbnail_json,
            exp.parent.desktop_position_x,
            exp.parent.desktop_position_y,
            exp.parent.window_width,
            exp.parent.window_height,
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
          exp.tr.title,
          exp.tr.subtitle,
          exp.tr.summary,
          exp.tr.description,
          exp.tr.role,
          exp.tr.category_label,
          exp.tr.seo_title,
          exp.tr.seo_description,
          exp.tr.deliverables_json,
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
          exp.en.title,
          exp.en.subtitle,
          exp.en.summary,
          exp.en.description,
          exp.en.role,
          exp.en.category_label,
          exp.en.seo_title,
          exp.en.seo_description,
          exp.en.deliverables_json,
          now
        );

        // Categories
        const catSlug = exp.categorySlug;
        const catId = `cat-${catSlug}`;
        db.prepare(
          `INSERT OR IGNORE INTO categories (id, slug, workspace, label_tr, label_en, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(catId, catSlug, p.workspace, p.categoryTR, p.categoryEN, idx + 1, now);
        db.prepare(`INSERT OR IGNORE INTO project_categories (project_id, category_id) VALUES (?, ?)`).run(p.id, catId);

        // Project Media with accurate binary byte_size
        db.prepare(`DELETE FROM project_media WHERE project_id = ? AND kind = 'gallery'`).run(p.id);
        for (const item of exp.media) {
          db.prepare(
            `INSERT INTO project_media (
              id, project_id, kind, media_type, storage_key, public_url, filename,
              mime_type, byte_size, width, height, alt_tr, alt_en, caption_tr, caption_en,
              sort_order, created_at, updated_at
            ) VALUES (?, ?, 'gallery', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            item.id,
            p.id,
            item.media_type,
            item.storage_key,
            item.public_url,
            item.filename,
            item.mime_type,
            item.byte_size,
            item.width,
            item.height,
            item.alt_tr,
            item.alt_en,
            item.caption_tr,
            item.caption_en,
            item.sort_order,
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

  // Final Relational Reconciliation & Parity Audit
  const finalProjects = db.prepare(`SELECT * FROM projects ORDER BY sort_order ASC`).all();
  const canonicalSlugs = new Set(canonicalProjects.map((p) => p.slug));
  const missingSlugs = canonicalProjects.filter((p) => !finalProjects.some((r) => r.slug === p.slug)).map((p) => p.slug);
  const nonCanonicalRecords = finalProjects.filter((r) => !canonicalSlugs.has(r.slug));

  let verifiedRelationalParityCount = 0;
  for (const c of canonicalProjects) {
    const row = finalProjects.find((r) => r.slug === c.slug);
    if (!row) continue;
    const comp = getCompositeProjectRecord(db, row.id);
    const d = compareCanonicalWithProjectRecord(c, comp);
    if (d.length === 0) {
      verifiedRelationalParityCount++;
    }
  }

  console.log(`Reconciliation summary:`);
  console.log(`  Total Canonical Expected:       ${canonicalProjects.length}`);
  console.log(`  Full Relational Parity:         ${verifiedRelationalParityCount}/30`);
  console.log(`  Missing Canonical Records:      ${missingSlugs.length}`);
  console.log(`  Non-Canonical Destination Rows: ${nonCanonicalRecords.length}`);
  console.log(`  Editorial Conflicts Detected:   ${editorialConflicts.length}`);
  console.log(`  Identity Collisions Detected:   ${identityConflicts.length}`);
  console.log(`  Inserted: ${insertedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);

  // Strict Admission Gate Enforcement
  if (isStrictActive) {
    console.log("\nEvaluating Strict Project Admission Invariants:");
    const strictErrors = [];

    if (canonicalProjects.length !== 30) {
      strictErrors.push(`Canonical source count mismatch: expected 30, got ${canonicalProjects.length}`);
    }
    if (identityConflicts.length > 0) {
      strictErrors.push(`${identityConflicts.length} identity collision(s) detected`);
    }
    if (missingSlugs.length > 0) {
      strictErrors.push(`${missingSlugs.length} canonical project(s) missing from database: ${missingSlugs.join(", ")}`);
    }
    if (editorialConflicts.length > 0 && !isForceActive) {
      strictErrors.push(`${editorialConflicts.length} unresolved editorial conflict(s) detected`);
    }
    if (nonCanonicalRecords.length > 0) {
      strictErrors.push(`${nonCanonicalRecords.length} unexpected non-canonical record(s) in destination`);
    }
    if (missingAssetsSummary.length > 0) {
      strictErrors.push(`${missingAssetsSummary.length} project(s) have missing local disk assets`);
    }
    if (verifiedRelationalParityCount !== 30 && !isForceActive && editorialConflicts.length === 0) {
      strictErrors.push(`Relational parity incomplete: ${verifiedRelationalParityCount}/30`);
    }

    if (strictErrors.length > 0) {
      console.error("\nFATAL: Strict admission rejected project import preflight:");
      for (const err of strictErrors) {
        console.error(`  - ${err}`);
      }
      throw new Error(`STRICT_ADMISSION_FAILED: ${strictErrors.join("; ")}`);
    }

    console.log("✓ Strict admission gate PASSED (30/30 verified with complete relational parity).");
  }

  return {
    dryRun: isDryRunActive,
    totalCanonical: canonicalProjects.length,
    canonicalParityCount: verifiedRelationalParityCount,
    missingSlugs,
    nonCanonicalRecords: nonCanonicalRecords.map((r) => r.slug),
    editorialConflicts,
    identityConflicts,
    insertedCount,
    updatedCount,
    skippedCount,
    manifest
  };
  } finally {
    if (db) {
      try {
        if (!isDryRunActive) {
          db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
        }
        db.close();
      } catch {}
    }
  }
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
    if (isExecute) {
      console.error("\nFATAL: Production remote execution is strictly NOT_AUTHORIZED.");
      console.error("Gate B release approval has not been granted by the human operator.");
      console.error("Execution halted fail-closed.");
      process.exit(1);
    }

    if (isForce) {
      console.error("FATAL: --force overwrite is strictly prohibited against production. Production seeding must be non-destructive.");
      process.exit(1);
    }

    console.log("Validating production target configuration [CONFIG_PREFLIGHT_ONLY]...");
    verifyProjectTargetConfiguration("production", { allowUnprovisioned: true });

    console.log("\n============================================================");
    console.log("PRODUCTION TARGET STATUS: CONFIG_PREFLIGHT_ONLY");
    console.log("============================================================");
    console.log("  Target Worker:           kerem-mihci-portfolio-api");
    console.log("  Target D1 Database:      kerem-portfolio-db (UNPROVISIONED)");
    console.log("  Remote Data Dry-Run:     NOT_RUN / TARGET_UNPROVISIONED");
    console.log("  Remote Data Parity:      NOT_VERIFIED (No remote database exists)");
    console.log("  Remote Writes:           STRICTLY FORBIDDEN (Zero remote mutations)");
    console.log("============================================================\n");
    process.exit(0);
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
      console.log(`✓ Local execution complete: ${res.canonicalParityCount}/${res.totalCanonical} relational parity.`);
      if (res.missingSlugs.length > 0 || (isStrict && res.editorialConflicts.length > 0)) {
        process.exit(1);
      }
    }).catch((err) => {
      console.error("Local project seed error:", err.message);
      process.exit(1);
    });
  }
}
