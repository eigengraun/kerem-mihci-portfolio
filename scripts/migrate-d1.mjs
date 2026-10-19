import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const rootDir = process.cwd();
const dbPath = process.env.LOCAL_D1_DB_PATH
  ? path.resolve(process.env.LOCAL_D1_DB_PATH)
  : path.join(rootDir, ".local-d1", "portfolio.sqlite");

const migrationPath = path.join(
  rootDir,
  "cloudflare",
  "portfolio-api",
  "migrations",
  "0001_initial_schema.sql"
);

// Dynamically load canonical projects from src/data/projects.ts via stripped TypeScript evaluation
const projectsTsPath = path.join(rootDir, "src", "data", "projects.ts");
const rawTs = fs.readFileSync(projectsTsPath, "utf-8");

// Extract projectsData array from src/data/projects.ts
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
  const featuredCounter = { design: 0, web: 0, "motion-ai": 0 };

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

      const fOrder = p.featuredOrder ?? (p.featured ? ++featuredCounter[p.workspace] : 0);
      const sortOrder = p.sortOrder ?? idx + 1;
      const desktopThumbJson = p.desktopThumbnail ? JSON.stringify(p.desktopThumbnail) : null;
      const liveLink = p.externalLinks?.find((l) => l.type === "live")?.href || null;

      const extraMeta = {
        categoryIds: p.categoryIds,
        tools: p.tools,
        servicesTR: p.servicesTR || p.services,
        servicesEN: p.servicesEN || p.services,
        externalLinks: p.externalLinks,
        contentBlocks: p.contentBlocks,
        desktopLabelTR: p.desktopLabelTR,
        desktopLabelEN: p.desktopLabelEN,
        challengeTR: p.challengeTR,
        challengeEN: p.challengeEN,
        solutionTR: p.solutionTR,
        solutionEN: p.solutionEN,
        resultTR: p.resultTR,
        resultEN: p.resultEN,
        desktopWidth: p.desktop?.width
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
          p.year || "2025",
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
        p.descriptionTR || p.summaryTR || "",
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
        p.descriptionEN || p.summaryEN || "",
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

console.log(
  JSON.stringify(
    {
      ok: true,
      dbPath,
      canonicalCount: projectsData.length,
      pass1,
      pass2Idempotency: pass2,
      counts: {
        totalProjects,
        totalTranslations,
        totalMedia,
        featuredCount
      },
      reconciled: totalProjects >= projectsData.length && pass2.inserted === 0
    },
    null,
    2
  )
);
db.close();
