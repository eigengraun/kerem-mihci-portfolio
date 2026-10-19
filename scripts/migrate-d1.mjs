import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const rootDir = process.cwd();
const dbPath = process.env.LOCAL_D1_DB_PATH
  ? path.resolve(process.env.LOCAL_D1_DB_PATH)
  : path.join(rootDir, ".local-d1", "portfolio.sqlite");

const shouldClean =
  process.argv.includes("--clean") || process.env.CLEAN_MIGRATE === "true";

if (shouldClean && fs.existsSync(dbPath)) {
  try {
    const checkDb = new DatabaseSync(dbPath);
    const revRow = checkDb
      .prepare(
        "SELECT COUNT(*) as count FROM project_revisions WHERE action != 'seed_migration'"
      )
      .get();
    checkDb.close();
    if (Number(revRow?.count || 0) > 0 && process.env.ALLOW_DESTRUCTIVE_TEST_RESET !== "true") {
      throw new Error(
        `Refusing to run --clean on ${dbPath} because it contains ${revRow.count} non-seed editorial revision(s). Use an isolated temporary LOCAL_D1_DB_PATH instead.`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Refusing to run --clean")) {
      throw err;
    }
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = `${dbPath}${suffix}`;
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  }
}

const migrationPath = path.join(
  rootDir,
  "cloudflare",
  "portfolio-api",
  "migrations",
  "0001_initial_schema.sql"
);

// Dynamically load canonical projects from src/data/projects.ts
const projectsTsPath = path.join(rootDir, "src", "data", "projects.ts");
const rawTs = fs.readFileSync(projectsTsPath, "utf-8");

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

const projectsData = new Function(`return (${arrayLiteral});`)();

function normalizeSlug(raw) {
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

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec("PRAGMA foreign_keys = ON;");

const schemaSql = fs.readFileSync(migrationPath, "utf-8");
db.exec(schemaSql);

function runSeedPass(upsertExisting) {
  const now = "2025-01-15T12:00:00.000Z";
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  db.exec("BEGIN TRANSACTION;");
  try {
    for (let idx = 0; idx < projectsData.length; idx++) {
      const p = projectsData[idx];
      const existing = db
        .prepare("SELECT id FROM projects WHERE id = ? OR slug = ?")
        .get(p.id, p.slug);

      if (existing && !upsertExisting) {
        skipped++;
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

      if (!existing) {
        db.prepare(
          `INSERT INTO projects (
            id, slug, status, workspace, featured, featured_order, sort_order,
            client_name, year, live_url, source_url, initials,
            cover_image_url, thumbnail_url, desktop_icon_url, og_image_url,
            desktop_thumbnail_json, desktop_position_x, desktop_position_y,
            window_width, window_height, tags_json,
            created_at, updated_at, published_at, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          p.id,
          p.slug,
          "published",
          p.workspace,
          p.featured ? 1 : 0,
          fOrder,
          sortOrder,
          p.client || "",
          p.year ?? "",
          liveLink,
          null,
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
          now,
          null
        );
        inserted++;
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
        updated++;
      }

      db.prepare(
        `INSERT INTO project_translations (
          id, project_id, locale, title, subtitle, summary, description, role,
          category_label, seo_title, seo_description, deliverables_json, highlights_json, updated_at
        ) VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)
        ON CONFLICT(project_id, locale) DO UPDATE SET
          title = excluded.title,
          subtitle = excluded.subtitle,
          summary = excluded.summary,
          description = excluded.description,
          role = excluded.role,
          category_label = excluded.category_label,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          deliverables_json = excluded.deliverables_json,
          updated_at = excluded.updated_at`
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
          title = excluded.title,
          subtitle = excluded.subtitle,
          summary = excluded.summary,
          description = excluded.description,
          role = excluded.role,
          category_label = excluded.category_label,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          deliverables_json = excluded.deliverables_json,
          updated_at = excluded.updated_at`
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

      const catSlug = normalizeSlug(p.categoryEN || p.categoryTR || p.workspace);
      const catId = `cat-${catSlug}`;
      db.prepare(
        `INSERT OR IGNORE INTO categories (id, slug, workspace, label_tr, label_en, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(catId, catSlug, p.workspace, p.categoryTR, p.categoryEN, idx + 1, now);
      db.prepare(
        `INSERT OR IGNORE INTO project_categories (project_id, category_id) VALUES (?, ?)`
      ).run(p.id, catId);

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

      if (!existing) {
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

  return { inserted, updated, skipped };
}

const pass1 = runSeedPass(false);
const pass2 = runSeedPass(false); // Verify idempotency

const totalProjects = db.prepare("SELECT COUNT(*) as c FROM projects").get().c;
const totalTranslations = db.prepare("SELECT COUNT(*) as c FROM project_translations").get().c;
const totalMedia = db.prepare("SELECT COUNT(*) as c FROM project_media").get().c;
const featuredCount = db
  .prepare("SELECT COUNT(*) as c FROM projects WHERE featured = 1 AND status = 'published'")
  .get().c;

const wsRows = db
  .prepare("SELECT workspace, COUNT(*) as c FROM projects GROUP BY workspace")
  .all();
const d1WorkspaceDistribution = { design: 0, web: 0, "motion-ai": 0 };
for (const r of wsRows) {
  d1WorkspaceDistribution[r.workspace] = Number(r.c);
}

const sourceWorkspaceDistribution = { design: 0, web: 0, "motion-ai": 0 };
for (const p of projectsData) {
  sourceWorkspaceDistribution[p.workspace] = (sourceWorkspaceDistribution[p.workspace] || 0) + 1;
}

// Field-level reconciliation against all 30 canonical projects
const pRows = db.prepare("SELECT * FROM projects ORDER BY sort_order ASC").all();
const tRows = db.prepare("SELECT * FROM project_translations").all();
const mRows = db.prepare("SELECT * FROM project_media ORDER BY sort_order ASC").all();

const fieldDiffs = [];
const canonicalSlugs = new Set(projectsData.map((p) => p.slug));
const nonCanonicalRecords = pRows
  .filter((r) => !canonicalSlugs.has(r.slug))
  .map((r) => r.slug);
const missingRecords = [];

for (const src of projectsData) {
  const row = pRows.find((r) => r.id === src.id);
  if (!row) {
    missingRecords.push(src.slug);
    continue;
  }
  const tr = tRows.find((t) => t.project_id === src.id && t.locale === "tr");
  const en = tRows.find((t) => t.project_id === src.id && t.locale === "en");
  const media = mRows.filter(
    (m) => m.project_id === src.id && (m.kind === "gallery" || m.kind === "video")
  );
  const meta = JSON.parse(row.tags_json || "{}");

  const check = (field, expected, actual) => {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      fieldDiffs.push({ slug: src.slug, field, expected, actual });
    }
  };

  const hydratedFeaturedOrder =
    Number(row.featured_order || 0) > 0 ? Number(row.featured_order) : undefined;
  const hydratedExternalLinks =
    meta.hasExplicitExternalLinks === false ? undefined : meta.externalLinks;
  const hydratedOgImage =
    meta.hasExplicitOgImage === false ? undefined : row.og_image_url || undefined;

  check("id", src.id, row.id);
  check("slug", src.slug, row.slug);
  check("workspace", src.workspace, row.workspace);
  check("titleTR", src.titleTR, tr.title);
  check("titleEN", src.titleEN, en.title);
  check("client", src.client, row.client_name);
  check("year", src.year, row.year !== "" ? row.year : undefined);
  check("featured", src.featured, Boolean(row.featured));
  check("featuredOrder", src.featuredOrder, hydratedFeaturedOrder);
  check("sortOrder", src.sortOrder, row.sort_order);
  check("categoryIds", src.categoryIds, meta.categoryIds);
  check("categoryTR", src.categoryTR, tr.category_label);
  check("categoryEN", src.categoryEN, en.category_label);
  check("projectTypeTR", src.projectTypeTR || null, tr.subtitle);
  check("projectTypeEN", src.projectTypeEN || null, en.subtitle);
  check("servicesTR", src.servicesTR, meta.servicesTR);
  check("servicesEN", src.servicesEN, meta.servicesEN);
  check("services", src.services, meta.services);
  check("tools", src.tools, meta.tools);
  check("roleTR", src.roleTR || null, tr.role);
  check("roleEN", src.roleEN || null, en.role);
  check("externalLinks", src.externalLinks, hydratedExternalLinks);
  check("thumbnail", src.thumbnail || null, row.thumbnail_url);
  check("desktopIcon", src.desktopIcon || null, row.desktop_icon_url);
  check("desktopThumbnail", src.desktopThumbnail || null, row.desktop_thumbnail_json ? JSON.parse(row.desktop_thumbnail_json) : null);
  check("cover", src.cover || null, row.cover_image_url);
  check("ogImage", src.ogImage, hydratedOgImage);
  check("media.count", (src.media || []).length, media.length);
  check(
    "media.paths",
    (src.media || []).map((m) => m.src),
    media.map((m) => m.public_url)
  );
  check("descriptionTR", src.descriptionTR, tr.description !== "" ? tr.description : undefined);
  check("descriptionEN", src.descriptionEN, en.description !== "" ? en.description : undefined);
  check("summaryTR", src.summaryTR || null, tr.summary);
  check("summaryEN", src.summaryEN || null, en.summary);
  check("challengeTR", src.challengeTR, meta.challengeTR);
  check("challengeEN", src.challengeEN, meta.challengeEN);
  check("solutionTR", src.solutionTR, meta.solutionTR);
  check("solutionEN", src.solutionEN, meta.solutionEN);
  check("resultTR", src.resultTR, meta.resultTR);
  check("resultEN", src.resultEN, meta.resultEN);
  if (src.seo) {
    check("seo.titleTR", src.seo.titleTR || null, tr.seo_title);
    check("seo.titleEN", src.seo.titleEN || null, en.seo_title);
    check("seo.descriptionTR", src.seo.descriptionTR || null, tr.seo_description);
    check("seo.descriptionEN", src.seo.descriptionEN || null, en.seo_description);
    check("seo.ogImage", src.seo.ogImage || null, row.og_image_url);
  } else {
    check("hasExplicitSeo", false, Boolean(meta.hasExplicitSeo));
  }
}

db.close();

// Optional: if CLOUDFLARE_CMS_API_URL & CLOUDFLARE_API_SERVICE_TOKEN are provided, also seed the Worker D1
let workerSeedResult = null;
if (process.env.CLOUDFLARE_CMS_API_URL && process.env.CLOUDFLARE_API_SERVICE_TOKEN) {
  const baseUrl = process.env.CLOUDFLARE_CMS_API_URL.replace(/\/$/, "");
  const seedRes = await fetch(`${baseUrl}/api/v1/admin/seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_SERVICE_TOKEN}`
    },
    body: JSON.stringify({
      projects: projectsData,
      upsertExisting: shouldClean,
      forceUnlockSeed: shouldClean,
      allowDestructiveOverwrite: shouldClean,
      lockAfterSeed: true
    })
  });
  workerSeedResult = await seedRes.json();
}

const reconciled =
  totalProjects === projectsData.length &&
  pass2.inserted === 0 &&
  missingRecords.length === 0 &&
  nonCanonicalRecords.length === 0 &&
  fieldDiffs.length === 0;

console.log(
  JSON.stringify(
    {
      ok: reconciled,
      dbPath,
      cleanedBeforeRun: shouldClean,
      canonicalCount: projectsData.length,
      sourceWorkspaceDistribution,
      d1WorkspaceDistribution,
      pass1,
      pass2Idempotency: pass2,
      counts: {
        totalProjects,
        totalTranslations,
        totalMedia,
        featuredCount
      },
      missingRecords,
      nonCanonicalRecords,
      fieldDiffCount: fieldDiffs.length,
      fieldDiffs,
      workerSeedResult,
      reconciled
    },
    null,
    2
  )
);

if (!reconciled) {
  process.exit(1);
}
