#!/usr/bin/env node
/**
 * scripts/import-canonical-videos-to-d1.mjs
 *
 * Deterministic, idempotent import and parity validation script for
 * the canonical 21 PortfolioVideo records from src/data/videos.ts into LOCAL D1 SQLite.
 *
 * Uses native node:sqlite DatabaseSync directly so it runs under standard Node.js.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const dbPath = process.env.LOCAL_D1_DB_PATH
  ? path.resolve(process.env.LOCAL_D1_DB_PATH)
  : path.join(ROOT, ".local-d1", "portfolio.sqlite");

async function main() {
  console.log("=== Canonical 21 Portfolio Video D1 Import & Parity Tool ===");
  console.log("Target Database:", dbPath);

  // 1. Ensure directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // 2. Open DB and run migrations
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  const migration0002 = path.join(ROOT, "cloudflare", "portfolio-api", "migrations", "0002_videos_and_reels_schema.sql");
  if (fs.existsSync(migration0002)) {
    db.exec(fs.readFileSync(migration0002, "utf-8"));
  }
  console.log("✓ Applied migration 0002 (Videos & Reels Schema).");

  // 3. Load canonical videos
  const videosTsPath = path.join(ROOT, "src", "data", "videos.ts");
  const tsContent = fs.readFileSync(videosTsPath, "utf-8");

  const startMarker = "export const videosData: PortfolioVideo[] =";
  const startIdx = tsContent.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error("Could not find videosData array in src/data/videos.ts");
  }

  const arrayBlock = tsContent.slice(startIdx + startMarker.length).trim();
  const endIdx = arrayBlock.lastIndexOf("];");
  if (endIdx === -1) {
    throw new Error("Could not find end of videosData array in src/data/videos.ts");
  }
  const arrayLiteral = arrayBlock.slice(0, endIdx + 1);

  const canonicalVideos = new Function(`return (${arrayLiteral});`)();
  console.log(`Loaded ${canonicalVideos.length} canonical video records from src/data/videos.ts.`);

  if (canonicalVideos.length !== 21) {
    throw new Error(`Expected exactly 21 canonical videos, found ${canonicalVideos.length}`);
  }

  const portraitCount = canonicalVideos.filter((v) => (v.orientation || "portrait") === "portrait").length;
  const landscapeCount = canonicalVideos.filter((v) => v.orientation === "landscape").length;

  console.log(`Orientation breakdown: ${portraitCount} portrait, ${landscapeCount} landscape.`);
  if (portraitCount !== 19 || landscapeCount !== 2) {
    throw new Error(`Expected 19 portrait and 2 landscape videos; found ${portraitCount} portrait, ${landscapeCount} landscape`);
  }

  // 4. Upsert canonical videos into local D1
  const now = new Date().toISOString();
  let insertedCount = 0;
  let updatedCount = 0;

  for (let idx = 0; idx < canonicalVideos.length; idx++) {
    const v = canonicalVideos[idx];
    const existing = db.prepare(`SELECT id, sort_order FROM portfolio_videos WHERE id = ?`).get(v.id);

    const sortOrder = existing ? Number(existing.sort_order || 0) : v.sortOrder || idx + 1;
    const orientation = v.orientation || "portrait";
    const aspectRatio = orientation === "landscape" ? "16:9" : "9:16";

    // Insert or update core video
    db.prepare(
      `INSERT INTO portfolio_videos (
        id, slug, status, orientation, video_type, production_method, ai_assisted,
        client_name, year, duration, aspect_ratio, featured, sort_order,
        autoplay_preview, external_url, project_slug, tools_json, tags_json,
        created_at, updated_at, published_at, archived_at
      ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        status = excluded.status,
        orientation = excluded.orientation,
        video_type = excluded.video_type,
        production_method = excluded.production_method,
        ai_assisted = excluded.ai_assisted,
        client_name = excluded.client_name,
        year = excluded.year,
        duration = excluded.duration,
        aspect_ratio = excluded.aspect_ratio,
        featured = excluded.featured,
        sort_order = excluded.sort_order,
        autoplay_preview = excluded.autoplay_preview,
        external_url = excluded.external_url,
        project_slug = excluded.project_slug,
        tools_json = excluded.tools_json,
        tags_json = excluded.tags_json,
        updated_at = excluded.updated_at`
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
      ) VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(video_id, locale) DO UPDATE SET
        title = excluded.title,
        short_title = excluded.short_title,
        description = excluded.description,
        full_description = excluded.full_description,
        services_json = excluded.services_json,
        updated_at = excluded.updated_at`
    ).run(
      `vtr-${v.id}-tr`,
      v.id,
      v.titleTR || "",
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
      ) VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(video_id, locale) DO UPDATE SET
        title = excluded.title,
        short_title = excluded.short_title,
        description = excluded.description,
        full_description = excluded.full_description,
        services_json = excluded.services_json,
        updated_at = excluded.updated_at`
    ).run(
      `vtr-${v.id}-en`,
      v.id,
      v.titleEN || "",
      v.shortTitleEN || "",
      v.descriptionEN || "",
      v.fullDescriptionEN || "",
      JSON.stringify(v.servicesEN || v.services || []),
      now
    );

    // Poster asset
    db.prepare(
      `INSERT INTO portfolio_video_assets (
        id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, created_at, updated_at
      ) VALUES (?, ?, 'poster', 'local_static', ?, ?, 'image/webp', 0, ?, ?)
      ON CONFLICT(video_id, asset_type) DO UPDATE SET
        storage_mode = excluded.storage_mode,
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        updated_at = excluded.updated_at`
    ).run(
      `vast-${v.id}-poster`,
      v.id,
      `videos/${v.slug}/poster.webp`,
      v.poster,
      now,
      now
    );

    // Video source asset
    const videoSrc = v.src || `/videos/${v.slug}/video.mp4`;
    db.prepare(
      `INSERT INTO portfolio_video_assets (
        id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, created_at, updated_at
      ) VALUES (?, ?, 'video', 'local_static', ?, ?, 'video/mp4', 0, ?, ?)
      ON CONFLICT(video_id, asset_type) DO UPDATE SET
        storage_mode = excluded.storage_mode,
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        updated_at = excluded.updated_at`
    ).run(
      `vast-${v.id}-video`,
      v.id,
      `videos/${v.slug}/video.mp4`,
      videoSrc,
      now,
      now
    );

    // Initial revision snapshot if not present
    const revCount = db
      .prepare(`SELECT COUNT(*) as count FROM portfolio_video_revisions WHERE video_id = ?`)
      .get(v.id);
    if (Number(revCount?.count || 0) === 0) {
      db.prepare(
        `INSERT INTO portfolio_video_revisions (id, video_id, revision_number, action, snapshot_json, actor_email, created_at)
         VALUES (?, ?, 1, 'canonical_seed', ?, 'system-seed@keremmihci.com', ?)`
      ).run(
        `vrev-${crypto.randomUUID()}`,
        v.id,
        JSON.stringify(v),
        now
      );
    }

    if (existing) updatedCount++;
    else insertedCount++;
  }

  console.log(`Database sync: ${insertedCount} inserted, ${updatedCount} updated.`);

  // 5. Query back all videos with translations and assets
  const videoRows = db.prepare(`SELECT * FROM portfolio_videos ORDER BY sort_order ASC, id ASC`).all();
  const translationRows = db.prepare(`SELECT * FROM portfolio_video_translations`).all();
  const assetRows = db.prepare(`SELECT * FROM portfolio_video_assets`).all();

  const trMap = new Map();
  const enMap = new Map();
  for (const t of translationRows) {
    if (t.locale === "tr") trMap.set(String(t.video_id), t);
    if (t.locale === "en") enMap.set(String(t.video_id), t);
  }

  const assetsByVid = new Map();
  for (const a of assetRows) {
    const vid = String(a.video_id);
    if (!assetsByVid.has(vid)) assetsByVid.set(vid, []);
    assetsByVid.get(vid).push(a);
  }

  console.log(`Total videos in D1: ${videoRows.length}`);

  // 6. Comprehensive Parity Validation
  const manifest = {
    generatedAt: new Date().toISOString(),
    canonicalCount: canonicalVideos.length,
    d1Count: videoRows.length,
    portraitCount,
    landscapeCount,
    items: [],
    allFilesPresentOnDisk: true,
    parityPassed: false,
    mismatches: []
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
          bytes: videoStat ? videoStat.size : 0
        },
        poster: {
          path: `/videos/${c.slug}/poster.webp`,
          exists: posterExists,
          bytes: posterStat ? posterStat.size : 0
        }
      },
      fieldDiffs
    });
  }

  manifest.parityPassed =
    manifest.mismatches.length === 0 &&
    manifest.allFilesPresentOnDisk &&
    videoRows.length === 21;

  // 7. Write Parity JSON Report
  const outJsonPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE3_VIDEO_PARITY.json");
  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.writeFileSync(outJsonPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`\nWrote parity report to ${outJsonPath}`);

  if (!manifest.parityPassed) {
    console.error("PARITY FAILED:", manifest.mismatches);
    process.exit(1);
  }

  console.log("\n========================================================");
  console.log("✓ SUCCESS: 21/21 Canonical Videos In D1 with 100% Parity");
  console.log("✓ 19 Portrait, 2 Landscape Videos Verified");
  console.log("✓ All 21 MP4 Files and 21 Posters Verified on Disk");
  console.log("✓ Zero Field Mismatches Across All Bilingual Attributes");
  console.log("========================================================");
}

main().catch((err) => {
  console.error("Import script failed:", err);
  process.exit(1);
});
