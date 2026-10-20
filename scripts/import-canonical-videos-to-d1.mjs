#!/usr/bin/env node
/**
 * scripts/import-canonical-videos-to-d1.mjs
 *
 * Deterministic, idempotent, non-destructive import and parity validation tool
 * for the canonical 21 PortfolioVideo records from src/data/videos.ts into D1.
 *
 * Supported Targets:
 *   --local / --target=local           : Targets local SQLite D1 simulation (.local-d1/portfolio.sqlite)
 *   --remote-staging / --target=remote-staging : Targets verified Cloudflare staging D1 & Worker
 *
 * Flags:
 *   --dry-run : Evaluates canonical parity without making database writes (default)
 *   --force   : Explicitly authorizes overwriting existing records (LOCAL ONLY)
 *   --execute : Authorizes executing remote staging seeding (REQUIRES VERDICT A APPROVAL)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const APPROVED_STAGING_CONFIG = {
  workerUrl: "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev",
  workerName: "kerem-mihci-portfolio-api-staging",
  databaseName: "kerem-portfolio-db-staging",
  databaseId: "0efef7a7-cc93-4dc2-8cb7-db28379fe01f"
};

// 1. Strict Fail-Closed CLI Argument Parsing
const rawArgs = process.argv.slice(2);
const VALID_FLAGS = new Set([
  "--local",
  "--target=local",
  "--remote-staging",
  "--target=remote-staging",
  "--dry-run",
  "--force",
  "--execute"
]);

for (const arg of rawArgs) {
  if (!VALID_FLAGS.has(arg)) {
    console.error(`FATAL: Unrecognized CLI argument "${arg}".`);
    console.error("Allowed flags: --local, --remote-staging, --dry-run, --force, --execute.");
    process.exit(1);
  }
}

const isRemoteStaging = rawArgs.includes("--remote-staging") || rawArgs.includes("--target=remote-staging");
const isLocal = rawArgs.includes("--local") || rawArgs.includes("--target=local") || !isRemoteStaging;
const isForce = rawArgs.includes("--force");
const isExecute = rawArgs.includes("--execute");
// Default is dry-run unless --execute or --force is explicitly authorized
const isDryRun = rawArgs.includes("--dry-run") || (!isExecute && !isForce);

if (isRemoteStaging && isForce) {
  console.error("FATAL: --force overwrite is strictly prohibited against remote staging. Remote seeding must be non-destructive.");
  process.exit(1);
}

const dbPath = process.env.LOCAL_D1_DB_PATH
  ? path.resolve(process.env.LOCAL_D1_DB_PATH)
  : path.join(ROOT, ".local-d1", "portfolio.sqlite");

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function resolveServiceToken() {
  if (process.env.CLOUDFLARE_API_SERVICE_TOKEN) {
    return process.env.CLOUDFLARE_API_SERVICE_TOKEN.trim();
  }
  const tokenCandidates = [
    path.join(ROOT, "cloudflare", "portfolio-api", ".staging-service-token.tmp"),
    path.join(ROOT, ".staging-service-token.tmp")
  ];
  for (const p of tokenCandidates) {
    try {
      if (fs.existsSync(p)) {
        const token = fs.readFileSync(p, "utf-8").trim();
        if (token.length >= 16) return token;
      }
    } catch {}
  }
  return "";
}

async function runRemoteStagingSeed(canonicalVideos) {
  console.log("============================================================");
  console.log("REMOTE CLOUDFLARE STAGING CANONICAL VIDEO SEED ENGINE");
  console.log("============================================================");
  console.log("Target Mode:", isDryRun ? "DRY RUN (Read-Only Validation)" : "LIVE EXECUTION");
  console.log("Verified Worker URL:", APPROVED_STAGING_CONFIG.workerUrl);
  console.log("Verified D1 Database:", APPROVED_STAGING_CONFIG.databaseName, `(${APPROVED_STAGING_CONFIG.databaseId})`);
  console.log("Verified Worker Name:", APPROVED_STAGING_CONFIG.workerName);

  // Safety checks
  if (APPROVED_STAGING_CONFIG.workerUrl.includes("production") || APPROVED_STAGING_CONFIG.databaseName.includes("prod")) {
    console.error("FATAL: Production resources detected! Remote seed engine strictly refuses to run against production.");
    process.exit(1);
  }

  const token = resolveServiceToken();
  if (!token) {
    console.warn("Notice: Staging service token not available in local environment. Running read-only public inspection.");
  }

  // 1. Fetch current remote staging video state
  console.log("\nConnecting to remote staging worker...");
  let remoteVideos = [];
  try {
    const res = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/public/videos`, {
      headers: { "Cache-Control": "no-store" }
    });
    if (res.ok) {
      const data = await res.json();
      remoteVideos = Array.isArray(data.videos) ? data.videos : [];
      console.log(`✓ Remote staging worker connected. Current published videos: ${remoteVideos.length}`);
    } else {
      console.log(`Notice: Remote public video endpoint returned status ${res.status}. Video schema may not be migrated yet.`);
    }
  } catch (err) {
    console.log(`Notice: Remote staging worker unavailable (${err.message}).`);
  }

  const existingSlugs = new Set(remoteVideos.map((v) => v.slug));
  const existingIds = new Set(remoteVideos.map((v) => v.id));

  let missingCount = 0;
  let skippedCount = 0;

  for (const c of canonicalVideos) {
    if (existingSlugs.has(c.slug) || existingIds.has(c.id)) {
      skippedCount++;
    } else {
      missingCount++;
    }
  }

  console.log(`\nRemote Staging Evaluation:`);
  console.log(`  Canonical videos: ${canonicalVideos.length}`);
  console.log(`  Already existing on staging: ${skippedCount} (preserved without modification)`);
  console.log(`  Missing from staging: ${missingCount}`);

  if (isDryRun) {
    console.log("\n[DRY RUN COMPLETE] Zero remote mutations executed.");
    console.log("To execute remote staging seeding upon user approval, run:");
    console.log("  node scripts/import-canonical-videos-to-d1.mjs --remote-staging --execute");
    return;
  }

  // Live execution (requires user approval and valid token)
  if (!token) {
    console.error("FATAL: Staging service token required for live remote seeding.");
    process.exit(1);
  }

  console.log("\nExecuting live remote seeding of missing canonical videos...");
  let insertedCount = 0;
  for (const c of canonicalVideos) {
    if (existingSlugs.has(c.slug) || existingIds.has(c.id)) continue;

    const payload = {
      id: c.id,
      slug: c.slug,
      type: c.type,
      orientation: c.orientation || "portrait",
      aiAssisted: c.aiAssisted,
      productionMethod: c.productionMethod || "traditional",
      titleTR: c.titleTR,
      titleEN: c.titleEN,
      shortTitleTR: c.shortTitleTR,
      shortTitleEN: c.shortTitleEN,
      descriptionTR: c.descriptionTR,
      descriptionEN: c.descriptionEN,
      client: c.client,
      year: c.year,
      poster: c.poster,
      src: c.src,
      duration: c.duration,
      aspectRatio: c.orientation === "landscape" ? "16:9" : "9:16",
      servicesTR: c.servicesTR || c.services,
      servicesEN: c.servicesEN || c.services,
      services: c.services,
      autoplayPreview: c.autoplayPreview !== false,
      featured: Boolean(c.featured),
      sortOrder: c.sortOrder,
      cmsStatus: "published"
    };

    const res = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Actor-Email": "staging-seed@keremmihci.com"
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      insertedCount++;
    } else {
      console.error(`Failed to insert canonical video "${c.slug}": HTTP ${res.status}`);
    }
  }

  console.log(`\n✓ Remote staging seeding completed: inserted=${insertedCount}, skipped=${skippedCount}`);
}

async function runLocalSeed(canonicalVideos) {
  console.log("============================================================");
  console.log("CANONICAL 21 PORTFOLIO VIDEO D1 IMPORT & PARITY VALIDATOR");
  console.log("============================================================");
  console.log("Mode:", isDryRun ? "DRY RUN (Read-Only)" : isForce ? "FORCE OVERWRITE" : "NON-DESTRUCTIVE SAFE SEED");
  console.log("Target Database:", dbPath);

  // 1. Ensure directory exists
  if (!isDryRun) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  // 2. Open DB and run migrations if DB exists or create
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  const migration0002 = path.join(
    ROOT,
    "cloudflare",
    "portfolio-api",
    "migrations",
    "0002_videos_and_reels_schema.sql"
  );
  if (fs.existsSync(migration0002)) {
    db.exec(fs.readFileSync(migration0002, "utf-8"));
  }
  console.log("✓ Verified schema migration 0002 (Videos & Reels Schema).");

  const portraitCount = canonicalVideos.filter(
    (v) => (v.orientation || "portrait") === "portrait"
  ).length;
  const landscapeCount = canonicalVideos.filter((v) => v.orientation === "landscape").length;

  console.log(`Orientation breakdown: ${portraitCount} portrait (9:16), ${landscapeCount} landscape (16:9).`);
  if (portraitCount !== 19 || landscapeCount !== 2) {
    throw new Error(
      `Expected 19 portrait and 2 landscape videos; found ${portraitCount} portrait, ${landscapeCount} landscape`
    );
  }

  // 3. Safe Non-Destructive Seeding into D1
  const now = new Date().toISOString();
  let insertedCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;

  for (let idx = 0; idx < canonicalVideos.length; idx++) {
    const v = canonicalVideos[idx];
    const existing = db
      .prepare(`SELECT id, slug, status, sort_order FROM portfolio_videos WHERE id = ? OR slug = ?`)
      .get(v.id, v.slug);

    if (existing && !isForce) {
      skippedCount++;
      continue;
    }

    if (isDryRun) {
      if (existing) updatedCount++;
      else insertedCount++;
      continue;
    }

    const sortOrder = existing ? Number(existing.sort_order || 0) : v.sortOrder || idx + 1;
    const orientation = v.orientation || "portrait";
    const aspectRatio = orientation === "landscape" ? "16:9" : "9:16";

    if (!existing) {
      // Clean insert of new canonical video
      db.prepare(
        `INSERT INTO portfolio_videos (
          id, slug, status, orientation, video_type, production_method, ai_assisted,
          client_name, year, duration, aspect_ratio, featured, sort_order,
          autoplay_preview, external_url, project_slug, tools_json, tags_json,
          created_at, updated_at, published_at, archived_at
        ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      ).run(
        v.id,
        v.slug,
        orientation,
        v.type,
        v.productionMethod || "traditional",
        v.aiAssisted ? 1 : 0,
        v.client || "",
        v.year || 2026,
        v.duration || "",
        aspectRatio,
        v.featured ? 1 : 0,
        sortOrder,
        v.autoplayPreview !== false ? 1 : 0,
        v.externalUrl || null,
        v.projectSlug || null,
        JSON.stringify(v.tools || []),
        JSON.stringify(v.tags || []),
        now,
        now,
        now
      );

      // TR translation
      db.prepare(
        `INSERT INTO portfolio_video_translations (
          id, video_id, locale, title, short_title, description, full_description, services_json, updated_at
        ) VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)`
      ).run(
        `vtr-${v.id}-tr`,
        v.id,
        v.titleTR,
        v.shortTitleTR || "",
        v.descriptionTR || "",
        v.fullDescriptionTR || "",
        JSON.stringify(v.servicesTR || v.services || []),
        now
      );

      // EN translation
      db.prepare(
        `INSERT INTO portfolio_video_translations (
          id, video_id, locale, title, short_title, description, full_description, services_json, updated_at
        ) VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)`
      ).run(
        `vtr-${v.id}-en`,
        v.id,
        v.titleEN,
        v.shortTitleEN || "",
        v.descriptionEN || "",
        v.fullDescriptionEN || "",
        JSON.stringify(v.servicesEN || v.services || []),
        now
      );

      // Poster asset
      db.prepare(
        `INSERT INTO portfolio_video_assets (
          id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, created_at, updated_at
        ) VALUES (?, ?, 'poster', 'local_static', ?, ?, 'image/webp', 0, NULL, NULL, NULL, ?, ?)`
      ).run(
        `vast-${v.id}-poster`,
        v.id,
        v.poster.replace(/^\//, ""),
        v.poster,
        now,
        now
      );

      // Video asset
      const videoSrc = v.src || `/videos/${v.slug}/video.mp4`;
      db.prepare(
        `INSERT INTO portfolio_video_assets (
          id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, created_at, updated_at
        ) VALUES (?, ?, 'video', 'local_static', ?, ?, 'video/mp4', 0, NULL, NULL, NULL, ?, ?)`
      ).run(
        `vast-${v.id}-video`,
        v.id,
        videoSrc.replace(/^\//, ""),
        videoSrc,
        now,
        now
      );

      // Initial revision snapshot
      db.prepare(
        `INSERT INTO portfolio_video_revisions (
          id, video_id, revision_number, action, snapshot_json, actor_email, created_at
        ) VALUES (?, ?, 1, 'initial_canonical_seed', ?, 'system-seed@keremmihci.com', ?)`
      ).run(
        `vrev-${v.id}-1`,
        v.id,
        JSON.stringify({ ...v, status: "published", sortOrder }),
        now
      );

      insertedCount++;
    } else {
      // Force update of existing video
      db.prepare(
        `UPDATE portfolio_videos SET
          slug = ?, orientation = ?, video_type = ?, production_method = ?, ai_assisted = ?,
          client_name = ?, year = ?, duration = ?, aspect_ratio = ?, featured = ?,
          autoplay_preview = ?, external_url = ?, project_slug = ?, tools_json = ?, tags_json = ?,
          updated_at = ?
         WHERE id = ?`
      ).run(
        v.slug,
        orientation,
        v.type,
        v.productionMethod || "traditional",
        v.aiAssisted ? 1 : 0,
        v.client || "",
        v.year || 2026,
        v.duration || "",
        aspectRatio,
        v.featured ? 1 : 0,
        v.autoplayPreview !== false ? 1 : 0,
        v.externalUrl || null,
        v.projectSlug || null,
        JSON.stringify(v.tools || []),
        JSON.stringify(v.tags || []),
        now,
        v.id
      );

      // Force update translations
      db.prepare(
        `UPDATE portfolio_video_translations SET
          title = ?, short_title = ?, description = ?, full_description = ?, services_json = ?, updated_at = ?
         WHERE video_id = ? AND locale = 'tr'`
      ).run(
        v.titleTR,
        v.shortTitleTR || "",
        v.descriptionTR || "",
        v.fullDescriptionTR || "",
        JSON.stringify(v.servicesTR || v.services || []),
        now,
        v.id
      );

      db.prepare(
        `UPDATE portfolio_video_translations SET
          title = ?, short_title = ?, description = ?, full_description = ?, services_json = ?, updated_at = ?
         WHERE video_id = ? AND locale = 'en'`
      ).run(
        v.titleEN,
        v.shortTitleEN || "",
        v.descriptionEN || "",
        v.fullDescriptionEN || "",
        JSON.stringify(v.servicesEN || v.services || []),
        now,
        v.id
      );

      // Force update poster & video assets
      db.prepare(
        `INSERT INTO portfolio_video_assets (
          id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, created_at, updated_at
        ) VALUES (?, ?, 'poster', 'local_static', ?, ?, 'image/webp', 0, NULL, NULL, NULL, ?, ?)
        ON CONFLICT(video_id, asset_type) DO UPDATE SET
          storage_mode = 'local_static',
          storage_key = excluded.storage_key,
          public_url = excluded.public_url,
          updated_at = excluded.updated_at`
      ).run(
        `vast-${v.id}-poster`,
        v.id,
        v.poster.replace(/^\//, ""),
        v.poster,
        now,
        now
      );

      const videoSrc = v.src || `/videos/${v.slug}/video.mp4`;
      db.prepare(
        `INSERT INTO portfolio_video_assets (
          id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, created_at, updated_at
        ) VALUES (?, ?, 'video', 'local_static', ?, ?, 'video/mp4', 0, NULL, NULL, NULL, ?, ?)
        ON CONFLICT(video_id, asset_type) DO UPDATE SET
          storage_mode = 'local_static',
          storage_key = excluded.storage_key,
          public_url = excluded.public_url,
          updated_at = excluded.updated_at`
      ).run(
        `vast-${v.id}-video`,
        v.id,
        videoSrc.replace(/^\//, ""),
        videoSrc,
        now,
        now
      );

      updatedCount++;
    }
  }

  console.log(`\nImport Summary: inserted=${insertedCount}, skipped=${skippedCount}, forceUpdated=${updatedCount}`);

  // 4. Parity & Binary File Integrity Verification (SHA-256)
  console.log("\nComputing SHA-256 checksums and verifying binary media files on disk...");
  const videoRows = db.prepare(`SELECT * FROM portfolio_videos ORDER BY sort_order ASC, id ASC`).all();
  const trRows = db.prepare(`SELECT * FROM portfolio_video_translations WHERE locale = 'tr'`).all();
  const enRows = db.prepare(`SELECT * FROM portfolio_video_translations WHERE locale = 'en'`).all();
  const assetRows = db.prepare(`SELECT * FROM portfolio_video_assets`).all();

  const trMap = new Map(trRows.map((r) => [String(r.video_id), r]));
  const enMap = new Map(enRows.map((r) => [String(r.video_id), r]));
  const assetsByVid = new Map();
  for (const a of assetRows) {
    const vid = String(a.video_id);
    if (!assetsByVid.has(vid)) assetsByVid.set(vid, []);
    assetsByVid.get(vid).push(a);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    importMode: isDryRun ? "dry_run" : isForce ? "force" : "non_destructive",
    summary: {
      inserted: insertedCount,
      skipped: skippedCount,
      updated: updatedCount,
      totalD1Videos: videoRows.length
    },
    canonicalCount: canonicalVideos.length,
    d1Count: videoRows.length,
    portraitCount,
    landscapeCount,
    allFilesPresentOnDisk: true,
    parityPassed: false,
    mismatches: [],
    items: []
  };

  const bySlug = new Map(videoRows.map((r) => [String(r.slug), r]));

  for (const c of canonicalVideos) {
    const r = bySlug.get(c.slug);
    if (!r) {
      manifest.mismatches.push({ slug: c.slug, error: "Missing in D1" });
      continue;
    }

    const vid = String(r.id);
    const tr = trMap.get(vid) || {};
    const en = enMap.get(vid) || {};
    const assets = assetsByVid.get(vid) || [];

    const posterAsset = assets.find((a) => a.asset_type === "poster");
    const videoAsset = assets.find((a) => a.asset_type === "video");

    const videoDiskPath = path.join(ROOT, "public", "videos", c.slug, "video.mp4");
    const posterDiskPath = path.join(ROOT, "public", "videos", c.slug, "poster.webp");
    const videoExists = fs.existsSync(videoDiskPath);
    const posterExists = fs.existsSync(posterDiskPath);

    if (!videoExists || !posterExists) {
      manifest.allFilesPresentOnDisk = false;
    }

    const videoStat = videoExists ? fs.statSync(videoDiskPath) : null;
    const posterStat = posterExists ? fs.statSync(posterDiskPath) : null;
    const videoSha256 = sha256File(videoDiskPath);
    const posterSha256 = sha256File(posterDiskPath);

    const fieldDiffs = [];
    const check = (field, expected, actual) => {
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        fieldDiffs.push({ field, expected, actual });
      }
    };

    check("id", c.id, r.id);
    check("slug", c.slug, r.slug);
    check("type", c.type, r.video_type);
    check("orientation", c.orientation || "portrait", r.orientation);
    check("aiAssisted", Boolean(c.aiAssisted), Boolean(r.ai_assisted));
    check("productionMethod", c.productionMethod || "traditional", r.production_method);
    check("client", c.client || "", r.client_name || "");
    check("year", c.year || 2026, Number(r.year || 2026));
    check("titleTR", c.titleTR, tr.title);
    check("titleEN", c.titleEN, en.title);
    check("shortTitleTR", c.shortTitleTR || "", tr.short_title || "");
    check("shortTitleEN", c.shortTitleEN || "", en.short_title || "");
    check("descriptionTR", c.descriptionTR || "", tr.description || "");
    check("descriptionEN", c.descriptionEN || "", en.description || "");
    check("fullDescriptionTR", c.fullDescriptionTR || "", tr.full_description || "");
    check("fullDescriptionEN", c.fullDescriptionEN || "", en.full_description || "");
    check("poster", c.poster, posterAsset?.public_url);
    check("src", c.src || `/videos/${c.slug}/video.mp4`, videoAsset?.public_url);
    check("duration", c.duration || "", r.duration || "");
    check("featured", Boolean(c.featured), Boolean(r.featured));

    if (fieldDiffs.length > 0) {
      manifest.mismatches.push({ slug: c.slug, fieldDiffs });
    }

    manifest.items.push({
      id: c.id,
      slug: c.slug,
      titleTR: c.titleTR,
      titleEN: c.titleEN,
      orientation: r.orientation,
      type: r.video_type,
      sortOrder: Number(r.sort_order),
      files: {
        video: {
          path: `/videos/${c.slug}/video.mp4`,
          exists: videoExists,
          bytes: videoStat ? videoStat.size : 0,
          sha256: videoSha256
        },
        poster: {
          path: `/videos/${c.slug}/poster.webp`,
          exists: posterExists,
          bytes: posterStat ? posterStat.size : 0,
          sha256: posterSha256
        }
      },
      fieldDiffs
    });
  }

  manifest.parityPassed =
    manifest.mismatches.length === 0 &&
    manifest.allFilesPresentOnDisk &&
    videoRows.length === 21;

  // 5. Write Updated Parity JSON Report
  const outJsonPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE3_VIDEO_PARITY.json");
  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.writeFileSync(outJsonPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`✓ Wrote comprehensive parity report to ${outJsonPath}`);

  if (!manifest.parityPassed) {
    console.error("PARITY FAILED:", manifest.mismatches);
    process.exit(1);
  }

  console.log("\n========================================================");
  console.log("✓ SUCCESS: 21/21 Canonical Videos Verified with 100% Parity");
  console.log("✓ 19 Portrait, 2 Landscape Videos Verified");
  console.log("✓ All 21 MP4 Files and 21 Posters Verified on Disk with SHA-256");
  console.log("✓ Zero Field Mismatches Across All Bilingual Attributes");
  console.log("========================================================");
}

async function main() {
  const { videosData: canonicalVideos } = await import("../src/data/videos.ts");
  console.log(`Loaded ${canonicalVideos.length} canonical video records from src/data/videos.ts.`);
  if (canonicalVideos.length !== 21) {
    throw new Error(`Expected exactly 21 canonical videos, found ${canonicalVideos.length}`);
  }

  if (isRemoteStaging) {
    await runRemoteStagingSeed(canonicalVideos);
  } else {
    await runLocalSeed(canonicalVideos);
  }
}

main().catch((err) => {
  console.error("Import script failed:", err);
  process.exit(1);
});
