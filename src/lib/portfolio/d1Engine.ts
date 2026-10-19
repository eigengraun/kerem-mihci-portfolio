import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import {
  projectsData,
  type DesktopThumbnailConfig,
  type ProjectCategoryId,
  type ProjectContentBlock,
  type ProjectExternalLink,
  type ProjectMediaItem,
  type WorkspaceId
} from "@/data/projects";
import {
  type CmsAuditLogRecord,
  type CmsMediaRecord,
  type CmsProjectRecord,
  type CmsPublishStatus,
  type CmsPublishingEventRecord,
  type CmsRevisionRecord,
  type UpsertProjectInput,
  normalizeSlug
} from "./types";

interface SqliteStatement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

interface ExtraProjectMetadataJson {
  categoryIds?: ProjectCategoryId[];
  tags?: string[];
  tools?: string[];
  servicesTR?: string[];
  servicesEN?: string[];
  externalLinks?: ProjectExternalLink[];
  contentBlocks?: ProjectContentBlock[];
  desktopLabelTR?: string;
  desktopLabelEN?: string;
  challengeTR?: string;
  challengeEN?: string;
  solutionTR?: string;
  solutionEN?: string;
  resultTR?: string;
  resultEN?: string;
  desktopWidth?: number;
}

const requireNode = createRequire(import.meta.url);

function getDbFilePath(): string {
  if (process.env.LOCAL_D1_DB_PATH) {
    return path.resolve(process.env.LOCAL_D1_DB_PATH);
  }
  return path.join(process.cwd(), ".local-d1", "portfolio.sqlite");
}

export function getLocalR2DirPath(): string {
  if (process.env.LOCAL_R2_DIR_PATH) {
    return path.resolve(process.env.LOCAL_R2_DIR_PATH);
  }
  return path.join(process.cwd(), ".local-r2");
}

const SCHEMA_SQL_FALLBACK = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  workspace TEXT NOT NULL DEFAULT 'design' CHECK (workspace IN ('design', 'web', 'motion-ai')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  featured_order INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  client_name TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '2025',
  live_url TEXT,
  source_url TEXT,
  initials TEXT,
  cover_image_url TEXT,
  thumbnail_url TEXT,
  desktop_icon_url TEXT,
  og_image_url TEXT,
  desktop_thumbnail_json TEXT,
  desktop_position_x REAL NOT NULL DEFAULT 25,
  desktop_position_y REAL NOT NULL DEFAULT 25,
  window_width INTEGER NOT NULL DEFAULT 820,
  window_height INTEGER NOT NULL DEFAULT 600,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS project_translations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('tr', 'en')),
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  summary TEXT,
  description TEXT NOT NULL DEFAULT '',
  role TEXT,
  category_label TEXT NOT NULL DEFAULT '',
  seo_title TEXT,
  seo_description TEXT,
  deliverables_json TEXT NOT NULL DEFAULT '[]',
  highlights_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, locale)
);
CREATE TABLE IF NOT EXISTS project_media (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'gallery' CHECK (kind IN ('cover', 'thumbnail', 'desktop_icon', 'og_image', 'gallery', 'video')),
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'image/webp',
  byte_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt_tr TEXT NOT NULL DEFAULT '',
  alt_en TEXT NOT NULL DEFAULT '',
  caption_tr TEXT,
  caption_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  workspace TEXT NOT NULL DEFAULT 'design' CHECK (workspace IN ('design', 'web', 'motion-ai')),
  label_tr TEXT NOT NULL,
  label_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_categories (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, category_id)
);
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label_tr TEXT NOT NULL,
  label_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_services (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, service_id)
);
CREATE TABLE IF NOT EXISTS project_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publishing_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('publish', 'unpublish', 'archive', 'draft_saved', 'rollback')),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status_workspace ON projects(status, workspace, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(status, workspace, featured, featured_order);
CREATE INDEX IF NOT EXISTS idx_project_translations_project_locale ON project_translations(project_id, locale);
CREATE INDEX IF NOT EXISTS idx_project_media_project_sort ON project_media(project_id, kind, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_revisions_project ON project_revisions(project_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_publishing_events_project ON publishing_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
`;

let cachedDb: SqliteDatabase | null = null;
let cachedDbPath: string | null = null;

export function getD1Database(): SqliteDatabase {
  const dbPath = getDbFilePath();
  if (cachedDb && cachedDbPath === dbPath && fs.existsSync(dbPath)) {
    return cachedDb;
  }

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { DatabaseSync } = requireNode("node:sqlite") as {
    DatabaseSync: new (p: string) => SqliteDatabase;
  };
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA foreign_keys = ON;");

  const migrationPath = path.join(
    process.cwd(),
    "cloudflare",
    "portfolio-api",
    "migrations",
    "0001_initial_schema.sql"
  );
  const schemaSql = fs.existsSync(migrationPath)
    ? fs.readFileSync(migrationPath, "utf-8")
    : SCHEMA_SQL_FALLBACK;
  db.exec(schemaSql);

  const countRow = db.prepare("SELECT COUNT(*) as count FROM projects").get();
  const existingCount = Number(countRow?.count ?? 0);
  if (existingCount === 0) {
    seedCanonicalProjects(db, { upsertExisting: false });
  }

  cachedDb = db;
  cachedDbPath = dbPath;
  return db;
}

export function seedCanonicalProjects(
  db: SqliteDatabase,
  options: { upsertExisting?: boolean } = {}
): { inserted: number; updated: number; totalCanonical: number } {
  const upsert = Boolean(options.upsertExisting);
  const now = "2025-01-15T12:00:00.000Z";
  let inserted = 0;
  let updated = 0;

  const featuredCounter: Record<string, number> = { design: 0, web: 0, "motion-ai": 0 };

  db.exec("BEGIN TRANSACTION;");
  try {
    for (let idx = 0; idx < projectsData.length; idx++) {
      const p = projectsData[idx];
      const existing = db
        .prepare("SELECT id FROM projects WHERE id = ? OR slug = ?")
        .get(p.id, p.slug);

      if (existing && !upsert) {
        continue;
      }

      const fOrder = p.featuredOrder ?? (p.featured ? ++featuredCounter[p.workspace] : 0);
      const sortOrder = p.sortOrder ?? idx + 1;
      const desktopThumbJson = p.desktopThumbnail ? JSON.stringify(p.desktopThumbnail) : null;

      const liveLink = p.externalLinks?.find((l) => l.type === "live")?.href || null;
      const extraMeta: ExtraProjectMetadataJson = {
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
          p.year || "2025",
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

      // Translations TR & EN
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

      // Categories
      const catSlug = normalizeSlug(p.categoryEN || p.categoryTR || p.workspace);
      const catId = `cat-${catSlug}`;
      db.prepare(
        `INSERT OR IGNORE INTO categories (id, slug, workspace, label_tr, label_en, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(catId, catSlug, p.workspace, p.categoryTR, p.categoryEN, idx + 1, now);
      db.prepare(
        `INSERT OR IGNORE INTO project_categories (project_id, category_id) VALUES (?, ?)`
      ).run(p.id, catId);

      // Gallery Media
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

  return {
    inserted,
    updated,
    totalCanonical: projectsData.length
  };
}

function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapRowsToCmsProjects(
  projectRows: Record<string, unknown>[],
  translationRows: Record<string, unknown>[],
  mediaRows: Record<string, unknown>[]
): CmsProjectRecord[] {
  const trMap = new Map<string, Record<string, unknown>>();
  const enMap = new Map<string, Record<string, unknown>>();

  for (const row of translationRows) {
    const pid = String(row.project_id);
    if (row.locale === "tr") trMap.set(pid, row);
    if (row.locale === "en") enMap.set(pid, row);
  }

  const mediaMap = new Map<string, ProjectMediaItem[]>();
  for (const row of mediaRows) {
    if (!row.project_id) continue;
    const pid = String(row.project_id);
    const kind = String(row.kind || "gallery");
    if (kind !== "gallery" && kind !== "video") continue;
    if (!mediaMap.has(pid)) mediaMap.set(pid, []);
    mediaMap.get(pid)!.push({
      id: String(row.id),
      type: row.media_type === "video" ? "video" : "image",
      src: String(row.public_url),
      width: row.width ? Number(row.width) : undefined,
      height: row.height ? Number(row.height) : undefined,
      altTR: row.alt_tr ? String(row.alt_tr) : undefined,
      altEN: row.alt_en ? String(row.alt_en) : undefined,
      captionTR: row.caption_tr ? String(row.caption_tr) : undefined,
      captionEN: row.caption_en ? String(row.caption_en) : undefined
    });
  }

  return projectRows.map((row) => {
    const id = String(row.id);
    const tr = trMap.get(id) || {};
    const en = enMap.get(id) || {};
    const desktopThumbnail = parseJsonSafe<DesktopThumbnailConfig | undefined>(
      row.desktop_thumbnail_json,
      undefined
    );
    const parsedMeta = parseJsonSafe<ExtraProjectMetadataJson | string[]>(row.tags_json, {});
    const extra: ExtraProjectMetadataJson = Array.isArray(parsedMeta)
      ? { tags: parsedMeta }
      : parsedMeta;

    const deliverablesTR = parseJsonSafe<string[]>(tr.deliverables_json, []);
    const deliverablesEN = parseJsonSafe<string[]>(en.deliverables_json, []);
    const highlightsTR = parseJsonSafe<string[]>(tr.highlights_json, []);
    const highlightsEN = parseJsonSafe<string[]>(en.highlights_json, []);

    const seoTitleTR = tr.seo_title ? String(tr.seo_title) : undefined;
    const seoTitleEN = en.seo_title ? String(en.seo_title) : undefined;
    const seoDescTR = tr.seo_description ? String(tr.seo_description) : undefined;
    const seoDescEN = en.seo_description ? String(en.seo_description) : undefined;
    const ogImg = row.og_image_url ? String(row.og_image_url) : undefined;

    const hasSeo = Boolean(seoTitleTR || seoTitleEN || seoDescTR || seoDescEN || ogImg);
    const workspace = (row.workspace as WorkspaceId) || "design";
    const defaultCategory: ProjectCategoryId =
      workspace === "web"
        ? "website"
        : workspace === "motion-ai"
        ? "video-production"
        : "graphic-design";

    const liveUrl = row.live_url ? String(row.live_url) : undefined;
    const externalLinks: ProjectExternalLink[] =
      extra.externalLinks && extra.externalLinks.length > 0
        ? extra.externalLinks
        : liveUrl
        ? [
            {
              id: `${id}-live`,
              type: "live",
              labelTR: "Canlı Siteyi Ziyaret Et",
              labelEN: "Visit Live Website",
              href: liveUrl
            }
          ]
        : [];

    return {
      id,
      slug: String(row.slug),
      cmsStatus: (row.status as CmsPublishStatus) || "draft",
      status: "completed",
      workspace,
      workspaceId: workspace,
      categoryIds:
        extra.categoryIds && extra.categoryIds.length > 0
          ? extra.categoryIds
          : [defaultCategory],
      featured: Number(row.featured) === 1,
      featuredOrder: Number(row.featured_order || 0),
      sortOrder: Number(row.sort_order || 0),
      titleTR: String(tr.title || row.slug),
      titleEN: String(en.title || tr.title || row.slug),
      desktopLabelTR: extra.desktopLabelTR,
      desktopLabelEN: extra.desktopLabelEN,
      subtitleTR: tr.subtitle ? String(tr.subtitle) : undefined,
      subtitleEN: en.subtitle ? String(en.subtitle) : undefined,
      projectTypeTR: tr.subtitle ? String(tr.subtitle) : undefined,
      projectTypeEN: en.subtitle ? String(en.subtitle) : undefined,
      categoryTR: String(tr.category_label || ""),
      categoryEN: String(en.category_label || tr.category_label || ""),
      client: String(row.client_name || ""),
      year: String(row.year || "2025"),
      summaryTR: tr.summary ? String(tr.summary) : undefined,
      summaryEN: en.summary ? String(en.summary) : undefined,
      descriptionTR: String(tr.description || ""),
      descriptionEN: String(en.description || tr.description || ""),
      challengeTR: extra.challengeTR,
      challengeEN: extra.challengeEN,
      solutionTR: extra.solutionTR,
      solutionEN: extra.solutionEN,
      resultTR: extra.resultTR,
      resultEN: extra.resultEN,
      roleTR: tr.role ? String(tr.role) : undefined,
      roleEN: en.role ? String(en.role) : undefined,
      servicesTR: extra.servicesTR || deliverablesTR,
      servicesEN: extra.servicesEN || deliverablesEN,
      tools: extra.tools,
      externalLinks,
      contentBlocks: extra.contentBlocks,
      deliverablesTR,
      deliverablesEN,
      highlightsTR,
      highlightsEN,
      tags: extra.tags || [],
      liveUrl,
      sourceUrl: row.source_url ? String(row.source_url) : undefined,
      initials: row.initials ? String(row.initials) : undefined,
      cover: row.cover_image_url ? String(row.cover_image_url) : undefined,
      thumbnail: row.thumbnail_url ? String(row.thumbnail_url) : undefined,
      desktopIcon: row.desktop_icon_url ? String(row.desktop_icon_url) : undefined,
      ogImage: ogImg,
      desktopThumbnail,
      seo: hasSeo
        ? {
            titleTR: seoTitleTR,
            titleEN: seoTitleEN,
            descriptionTR: seoDescTR,
            descriptionEN: seoDescEN,
            ogImage: ogImg
          }
        : undefined,
      media: mediaMap.get(id) || [],
      desktop: {
        x: Number(row.desktop_position_x ?? 25),
        y: Number(row.desktop_position_y ?? 25),
        width: extra.desktopWidth
      },
      initialWindow: {
        width: Number(row.window_width ?? 820),
        height: Number(row.window_height ?? 600)
      },
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      publishedAt: row.published_at ? String(row.published_at) : null,
      archivedAt: row.archived_at ? String(row.archived_at) : null
    };
  });
}

export function listPublishedProjectsFromD1(): CmsProjectRecord[] {
  const db = getD1Database();
  const projectRows = db
    .prepare(
      `SELECT * FROM projects WHERE status = 'published' ORDER BY sort_order ASC, created_at DESC`
    )
    .all();
  if (projectRows.length === 0) return [];
  const translationRows = db.prepare(`SELECT * FROM project_translations`).all();
  const mediaRows = db.prepare(`SELECT * FROM project_media ORDER BY sort_order ASC`).all();
  return mapRowsToCmsProjects(projectRows, translationRows, mediaRows);
}

export function getPublishedProjectBySlugFromD1(slug: string): CmsProjectRecord | null {
  const db = getD1Database();
  const row = db
    .prepare(`SELECT * FROM projects WHERE slug = ? AND status = 'published'`)
    .get(slug);
  if (!row) return null;
  const pid = String(row.id);
  const translationRows = db
    .prepare(`SELECT * FROM project_translations WHERE project_id = ?`)
    .all(pid);
  const mediaRows = db
    .prepare(`SELECT * FROM project_media WHERE project_id = ? ORDER BY sort_order ASC`)
    .all(pid);
  const mapped = mapRowsToCmsProjects([row], translationRows, mediaRows);
  return mapped[0] || null;
}

export function listAllProjectsForAdminFromD1(): CmsProjectRecord[] {
  const db = getD1Database();
  const projectRows = db
    .prepare(`SELECT * FROM projects ORDER BY sort_order ASC, updated_at DESC`)
    .all();
  if (projectRows.length === 0) return [];
  const translationRows = db.prepare(`SELECT * FROM project_translations`).all();
  const mediaRows = db.prepare(`SELECT * FROM project_media ORDER BY sort_order ASC`).all();
  return mapRowsToCmsProjects(projectRows, translationRows, mediaRows);
}

export function getProjectByIdOrSlugForAdminFromD1(idOrSlug: string): CmsProjectRecord | null {
  const db = getD1Database();
  const row = db
    .prepare(`SELECT * FROM projects WHERE id = ? OR slug = ? LIMIT 1`)
    .get(idOrSlug, idOrSlug);
  if (!row) return null;
  const pid = String(row.id);
  const translationRows = db
    .prepare(`SELECT * FROM project_translations WHERE project_id = ?`)
    .all(pid);
  const mediaRows = db
    .prepare(`SELECT * FROM project_media WHERE project_id = ? ORDER BY sort_order ASC`)
    .all(pid);
  const mapped = mapRowsToCmsProjects([row], translationRows, mediaRows);
  return mapped[0] || null;
}

export function upsertProjectInD1(
  input: UpsertProjectInput & { status?: string },
  actorEmail: string,
  actionLabel = "update"
): CmsProjectRecord {
  const db = getD1Database();
  const cleanSlug = normalizeSlug(input.slug || input.titleEN || input.titleTR);
  if (!cleanSlug) {
    throw new Error("Project slug is required.");
  }

  const existingById = input.id
    ? db.prepare(`SELECT * FROM projects WHERE id = ?`).get(input.id)
    : undefined;
  const existingBySlug = db.prepare(`SELECT * FROM projects WHERE slug = ?`).get(cleanSlug);

  if (existingBySlug && existingById && String(existingBySlug.id) !== String(existingById.id)) {
    throw new Error(`Slug "${cleanSlug}" is already in use by another project.`);
  }
  if (existingBySlug && !existingById && actionLabel === "create") {
    throw new Error(`Slug "${cleanSlug}" is already in use.`);
  }

  const existing = existingById || existingBySlug;
  const projectId = existing ? String(existing.id) : input.id || cleanSlug;
  const now = new Date().toISOString();

  const prevStatus = existing ? (String(existing.status) as CmsPublishStatus) : null;
  const rawRequestedStatus = input.cmsStatus || (input.status as CmsPublishStatus | undefined);
  const nextStatus: CmsPublishStatus =
    rawRequestedStatus && ["draft", "published", "archived"].includes(rawRequestedStatus)
      ? rawRequestedStatus
      : prevStatus || "draft";

  if (nextStatus === "published") {
    if (!input.titleTR?.trim() || !input.titleEN?.trim()) {
      throw new Error("Both Turkish and English titles are required before publishing.");
    }
    if (
      !(input.descriptionTR?.trim() || input.summaryTR?.trim()) ||
      !(input.descriptionEN?.trim() || input.summaryEN?.trim())
    ) {
      throw new Error("Both Turkish and English descriptions are required before publishing.");
    }
  }

  const maxSortRow = db
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) as maxSort FROM projects`)
    .get();
  const sortOrder =
    input.sortOrder ??
    (existing ? Number(existing.sort_order || 0) : Number(maxSortRow?.maxSort || 0) + 1);
  const featuredOrder =
    input.featuredOrder ?? (existing ? Number(existing.featured_order || 0) : 0);

  const cover = input.cover ?? (existing?.cover_image_url ? String(existing.cover_image_url) : null);
  const thumbnail =
    input.thumbnail ?? cover ?? (existing?.thumbnail_url ? String(existing.thumbnail_url) : null);
  const desktopIcon =
    input.desktopIcon ??
    thumbnail ??
    (existing?.desktop_icon_url ? String(existing.desktop_icon_url) : null);
  const ogImage =
    input.ogImage ??
    input.seo?.ogImage ??
    cover ??
    (existing?.og_image_url ? String(existing.og_image_url) : null);

  const desktopThumbnail: DesktopThumbnailConfig | null =
    input.desktopThumbnail !== undefined
      ? input.desktopThumbnail
      : existing?.desktop_thumbnail_json
      ? parseJsonSafe<DesktopThumbnailConfig | null>(existing.desktop_thumbnail_json, null)
      : thumbnail
      ? { src: thumbnail, width: 120, height: 90, scale: 1.0 }
      : null;

  const existingMeta = existing?.tags_json
    ? parseJsonSafe<ExtraProjectMetadataJson>(existing.tags_json, {})
    : {};
  const extraMeta: ExtraProjectMetadataJson = {
    ...existingMeta,
    categoryIds: input.categoryIds ?? existingMeta.categoryIds,
    tags: input.tags ?? existingMeta.tags ?? [],
    tools: input.tools ?? existingMeta.tools,
    servicesTR: input.servicesTR ?? existingMeta.servicesTR,
    servicesEN: input.servicesEN ?? existingMeta.servicesEN,
    externalLinks: input.externalLinks ?? existingMeta.externalLinks,
    contentBlocks: input.contentBlocks ?? existingMeta.contentBlocks,
    desktopLabelTR: input.desktopLabelTR ?? existingMeta.desktopLabelTR,
    desktopLabelEN: input.desktopLabelEN ?? existingMeta.desktopLabelEN,
    challengeTR: input.challengeTR ?? existingMeta.challengeTR,
    challengeEN: input.challengeEN ?? existingMeta.challengeEN,
    solutionTR: input.solutionTR ?? existingMeta.solutionTR,
    solutionEN: input.solutionEN ?? existingMeta.solutionEN,
    resultTR: input.resultTR ?? existingMeta.resultTR,
    resultEN: input.resultEN ?? existingMeta.resultEN,
    desktopWidth: input.desktop?.width ?? existingMeta.desktopWidth
  };

  const publishedAt =
    nextStatus === "published"
      ? existing?.published_at
        ? String(existing.published_at)
        : now
      : existing?.published_at
      ? String(existing.published_at)
      : null;

  const archivedAt =
    nextStatus === "archived"
      ? now
      : nextStatus === "published" || nextStatus === "draft"
      ? null
      : existing?.archived_at
      ? String(existing.archived_at)
      : null;

  db.exec("BEGIN TRANSACTION;");
  try {
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
        projectId,
        cleanSlug,
        nextStatus,
        input.workspace || "design",
        input.featured ? 1 : 0,
        featuredOrder,
        sortOrder,
        input.client || "",
        input.year || "2025",
        input.liveUrl || null,
        input.sourceUrl || null,
        input.initials || cleanSlug.slice(0, 2).toUpperCase(),
        cover,
        thumbnail,
        desktopIcon,
        ogImage,
        desktopThumbnail ? JSON.stringify(desktopThumbnail) : null,
        input.desktop?.x ?? 28,
        input.desktop?.y ?? 28,
        input.initialWindow?.width ?? 820,
        input.initialWindow?.height ?? 600,
        JSON.stringify(extraMeta),
        now,
        now,
        publishedAt,
        archivedAt
      );
    } else {
      db.prepare(
        `UPDATE projects SET
          slug = ?, status = ?, workspace = ?, featured = ?, featured_order = ?, sort_order = ?,
          client_name = ?, year = ?, live_url = ?, source_url = ?, initials = ?,
          cover_image_url = ?, thumbnail_url = ?, desktop_icon_url = ?, og_image_url = ?,
          desktop_thumbnail_json = ?, desktop_position_x = ?, desktop_position_y = ?,
          window_width = ?, window_height = ?, tags_json = ?,
          updated_at = ?, published_at = ?, archived_at = ?
        WHERE id = ?`
      ).run(
        cleanSlug,
        nextStatus,
        input.workspace || "design",
        input.featured ? 1 : 0,
        featuredOrder,
        sortOrder,
        input.client || "",
        input.year || "2025",
        input.liveUrl || null,
        input.sourceUrl || null,
        input.initials || cleanSlug.slice(0, 2).toUpperCase(),
        cover,
        thumbnail,
        desktopIcon,
        ogImage,
        desktopThumbnail ? JSON.stringify(desktopThumbnail) : null,
        input.desktop?.x ?? Number(existing.desktop_position_x ?? 28),
        input.desktop?.y ?? Number(existing.desktop_position_y ?? 28),
        input.initialWindow?.width ?? Number(existing.window_width ?? 820),
        input.initialWindow?.height ?? Number(existing.window_height ?? 600),
        JSON.stringify(extraMeta),
        now,
        publishedAt,
        archivedAt,
        projectId
      );
    }

    // Upsert TR translation
    db.prepare(
      `INSERT INTO project_translations (
        id, project_id, locale, title, subtitle, summary, description, role,
        category_label, seo_title, seo_description, deliverables_json, highlights_json, updated_at
      ) VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        highlights_json = excluded.highlights_json,
        updated_at = excluded.updated_at`
    ).run(
      `${projectId}:tr`,
      projectId,
      input.titleTR || cleanSlug,
      input.subtitleTR ?? null,
      input.summaryTR ?? null,
      input.descriptionTR || input.summaryTR || "",
      input.roleTR ?? null,
      input.categoryTR || "",
      input.seo?.titleTR ?? null,
      input.seo?.descriptionTR ?? null,
      JSON.stringify(input.deliverablesTR || input.servicesTR || []),
      JSON.stringify(input.highlightsTR || []),
      now
    );

    // Upsert EN translation
    db.prepare(
      `INSERT INTO project_translations (
        id, project_id, locale, title, subtitle, summary, description, role,
        category_label, seo_title, seo_description, deliverables_json, highlights_json, updated_at
      ) VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        highlights_json = excluded.highlights_json,
        updated_at = excluded.updated_at`
    ).run(
      `${projectId}:en`,
      projectId,
      input.titleEN || input.titleTR || cleanSlug,
      input.subtitleEN ?? null,
      input.summaryEN ?? null,
      input.descriptionEN || input.summaryEN || input.descriptionTR || "",
      input.roleEN ?? null,
      input.categoryEN || input.categoryTR || "",
      input.seo?.titleEN ?? null,
      input.seo?.descriptionEN ?? null,
      JSON.stringify(input.deliverablesEN || input.servicesEN || []),
      JSON.stringify(input.highlightsEN || []),
      now
    );

    // Update gallery media if provided
    if (Array.isArray(input.media)) {
      db.prepare(`DELETE FROM project_media WHERE project_id = ? AND kind = 'gallery'`).run(
        projectId
      );
      for (let i = 0; i < input.media.length; i++) {
        const m = input.media[i];
        if (!m?.src) continue;
        const mId = `media-${projectId}-${i + 1}-${crypto.randomUUID().slice(0, 6)}`;
        db.prepare(
          `INSERT INTO project_media (
            id, project_id, kind, media_type, storage_key, public_url, filename,
            mime_type, byte_size, width, height, alt_tr, alt_en, caption_tr, caption_en,
            sort_order, created_at, updated_at
          ) VALUES (?, ?, 'gallery', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          mId,
          projectId,
          m.type === "video" ? "video" : "image",
          m.src.replace(/^\//, ""),
          m.src,
          path.basename(m.src),
          m.type === "video" ? "video/mp4" : "image/webp",
          m.width ?? null,
          m.height ?? null,
          m.altTR || input.titleTR || cleanSlug,
          m.altEN || input.titleEN || cleanSlug,
          m.captionTR ?? null,
          m.captionEN ?? null,
          i + 1,
          now,
          now
        );
      }
    }

    // Record revision
    const revRow = db
      .prepare(
        `SELECT COALESCE(MAX(revision_number), 0) as maxRev FROM project_revisions WHERE project_id = ?`
      )
      .get(projectId);
    const nextRev = Number(revRow?.maxRev || 0) + 1;

    db.prepare(
      `INSERT INTO project_revisions (id, project_id, revision_number, action, snapshot_json, actor_email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `rev-${projectId}-${nextRev}-${crypto.randomUUID().slice(0, 6)}`,
      projectId,
      nextRev,
      existing ? actionLabel : "create",
      JSON.stringify(input),
      actorEmail,
      now
    );

    if (!existing || prevStatus !== nextStatus) {
      const eventType =
        nextStatus === "published"
          ? "publish"
          : nextStatus === "archived"
          ? "archive"
          : prevStatus === "published" && nextStatus === "draft"
          ? "unpublish"
          : "draft_saved";
      db.prepare(
        `INSERT INTO publishing_events (id, project_id, event_type, previous_status, new_status, actor_email, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `pub-${crypto.randomUUID()}`,
        projectId,
        eventType,
        prevStatus,
        nextStatus,
        actorEmail,
        `Status set to ${nextStatus}`,
        now
      );
    }

    db.prepare(
      `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
       VALUES (?, ?, ?, 'project', ?, ?, ?)`
    ).run(
      `audit-${crypto.randomUUID()}`,
      actorEmail,
      existing ? `project_${actionLabel}` : "project_create",
      projectId,
      JSON.stringify({ slug: cleanSlug, status: nextStatus, workspace: input.workspace }),
      now
    );

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }

  const saved = getProjectByIdOrSlugForAdminFromD1(projectId);
  if (!saved) {
    throw new Error("Failed to read project after upsert.");
  }
  return saved;
}

export function updateProjectStatusInD1(
  idOrSlug: string,
  newStatus: CmsPublishStatus,
  actorEmail: string,
  notes?: string
): CmsProjectRecord {
  const existing = getProjectByIdOrSlugForAdminFromD1(idOrSlug);
  if (!existing) {
    throw new Error(`Project "${idOrSlug}" not found.`);
  }

  const actionLabel =
    newStatus === "published"
      ? "publish"
      : newStatus === "archived"
      ? "archive"
      : existing.cmsStatus === "published"
      ? "unpublish"
      : "status_change";

  return upsertProjectInD1(
    {
      ...existing,
      cmsStatus: newStatus
    },
    actorEmail,
    notes ? `${actionLabel}:${notes}` : actionLabel
  );
}

export function deleteProjectInD1(
  idOrSlug: string,
  actorEmail: string
): { deletedId: string; slug: string } {
  const db = getD1Database();
  const existing = db
    .prepare(`SELECT id, slug FROM projects WHERE id = ? OR slug = ? LIMIT 1`)
    .get(idOrSlug, idOrSlug);
  if (!existing) {
    throw new Error(`Project "${idOrSlug}" not found.`);
  }
  const projectId = String(existing.id);
  const slug = String(existing.slug);
  const now = new Date().toISOString();

  db.exec("BEGIN TRANSACTION;");
  try {
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);
    db.prepare(
      `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
       VALUES (?, ?, 'project_delete', 'project', ?, ?, ?)`
    ).run(`audit-${crypto.randomUUID()}`, actorEmail, projectId, JSON.stringify({ slug }), now);
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }

  return { deletedId: projectId, slug };
}

export function updateFeaturedOrderingInD1(
  workspace: WorkspaceId,
  featuredItems: { id: string; featured: boolean; featuredOrder: number }[],
  actorEmail: string
): void {
  const db = getD1Database();
  const now = new Date().toISOString();

  db.exec("BEGIN TRANSACTION;");
  try {
    for (const item of featuredItems) {
      db.prepare(
        `UPDATE projects SET featured = ?, featured_order = ?, updated_at = ? WHERE id = ? AND workspace = ?`
      ).run(item.featured ? 1 : 0, item.featuredOrder, now, item.id, workspace);
    }
    db.prepare(
      `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
       VALUES (?, ?, 'featured_order_update', 'workspace', ?, ?, ?)`
    ).run(
      `audit-${crypto.randomUUID()}`,
      actorEmail,
      workspace,
      JSON.stringify({ count: featuredItems.length }),
      now
    );
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

export function listProjectRevisionsFromD1(projectId: string): CmsRevisionRecord[] {
  const db = getD1Database();
  const rows = db
    .prepare(
      `SELECT * FROM project_revisions WHERE project_id = ? ORDER BY revision_number DESC LIMIT 50`
    )
    .all(projectId);
  return rows.map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    revisionNumber: Number(r.revision_number),
    action: String(r.action),
    snapshotJson: String(r.snapshot_json),
    actorEmail: String(r.actor_email),
    createdAt: String(r.created_at)
  }));
}

export function rollbackProjectRevisionInD1(
  projectId: string,
  revisionNumber: number,
  actorEmail: string
): CmsProjectRecord {
  const db = getD1Database();
  const row = db
    .prepare(
      `SELECT * FROM project_revisions WHERE project_id = ? AND revision_number = ? LIMIT 1`
    )
    .get(projectId, revisionNumber);
  if (!row) {
    throw new Error(`Revision #${revisionNumber} not found for project ${projectId}.`);
  }
  const snapshot = JSON.parse(String(row.snapshot_json)) as UpsertProjectInput;
  return upsertProjectInD1(
    { ...snapshot, id: projectId },
    actorEmail,
    `rollback_rev_${revisionNumber}`
  );
}

export function listAuditLogsFromD1(limit = 50): CmsAuditLogRecord[] {
  const db = getD1Database();
  const rows = db
    .prepare(`SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?`)
    .all(limit);
  return rows.map((r) => ({
    id: String(r.id),
    actorEmail: String(r.actor_email),
    action: String(r.action),
    entityType: String(r.entity_type),
    entityId: r.entity_id ? String(r.entity_id) : null,
    detailsJson: r.details_json ? String(r.details_json) : null,
    ipAddress: r.ip_address ? String(r.ip_address) : null,
    createdAt: String(r.created_at)
  }));
}

export function listPublishingEventsFromD1(limit = 50): CmsPublishingEventRecord[] {
  const db = getD1Database();
  const rows = db
    .prepare(`SELECT * FROM publishing_events ORDER BY created_at DESC LIMIT ?`)
    .all(limit);
  return rows.map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    eventType: String(r.event_type) as CmsPublishingEventRecord["eventType"],
    previousStatus: r.previous_status ? String(r.previous_status) : null,
    newStatus: String(r.new_status),
    actorEmail: String(r.actor_email),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at)
  }));
}

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "image/gif",
  "video/mp4",
  "video/webm"
]);

export function uploadMediaToR2AndD1(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  projectId?: string | null;
  projectSlug?: string;
  kind?: CmsMediaRecord["kind"];
  altTR?: string;
  altEN?: string;
  captionTR?: string;
  captionEN?: string;
  actorEmail: string;
}): CmsMediaRecord {
  const {
    buffer,
    filename,
    mimeType,
    projectId = null,
    projectSlug = "general",
    kind = "gallery",
    altTR = "",
    altEN = "",
    captionTR,
    captionEN,
    actorEmail
  } = params;

  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

  const isVideo = mimeType.startsWith("video/");
  const maxBytes = isVideo ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
  if (buffer.byteLength > maxBytes) {
    throw new Error(`File size (${buffer.byteLength} bytes) exceeds limit (${maxBytes} bytes).`);
  }
  if (buffer.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }

  const safeSlug = normalizeSlug(projectSlug) || "general";
  const safeFilename = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const shortUuid = crypto.randomUUID().slice(0, 8);
  const storageKey = `projects/${safeSlug}/${kind}/${yyyy}/${mm}/${shortUuid}-${safeFilename}`;

  const r2Root = getLocalR2DirPath();
  const fullFilePath = path.join(r2Root, storageKey);
  fs.mkdirSync(path.dirname(fullFilePath), { recursive: true });
  fs.writeFileSync(fullFilePath, buffer);

  const publicBase = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const publicUrl = publicBase ? `${publicBase}/${storageKey}` : `/api/media/${storageKey}`;
  const mediaId = `media-${crypto.randomUUID()}`;
  const isoNow = now.toISOString();

  const db = getD1Database();
  db.prepare(
    `INSERT INTO project_media (
      id, project_id, kind, media_type, storage_key, public_url, filename,
      mime_type, byte_size, alt_tr, alt_en, caption_tr, caption_en,
      sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    mediaId,
    projectId,
    kind,
    isVideo ? "video" : "image",
    storageKey,
    publicUrl,
    safeFilename,
    mimeType,
    buffer.byteLength,
    altTR,
    altEN,
    captionTR ?? null,
    captionEN ?? null,
    isoNow,
    isoNow
  );

  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, 'media_upload', 'project_media', ?, ?, ?)`
  ).run(
    `audit-${crypto.randomUUID()}`,
    actorEmail,
    mediaId,
    JSON.stringify({ storageKey, publicUrl, byteSize: buffer.byteLength, mimeType }),
    isoNow
  );

  return {
    id: mediaId,
    projectId,
    kind,
    mediaType: isVideo ? "video" : "image",
    storageKey,
    publicUrl,
    filename: safeFilename,
    mimeType,
    byteSize: buffer.byteLength,
    altTR,
    altEN,
    captionTR: captionTR ?? null,
    captionEN: captionEN ?? null,
    sortOrder: 0,
    createdAt: isoNow,
    updatedAt: isoNow
  };
}

export function listMediaFromD1(projectId?: string): CmsMediaRecord[] {
  const db = getD1Database();
  const rows = projectId
    ? db
        .prepare(
          `SELECT * FROM project_media WHERE project_id = ? ORDER BY created_at DESC, sort_order ASC`
        )
        .all(projectId)
    : db.prepare(`SELECT * FROM project_media ORDER BY created_at DESC LIMIT 300`).all();

  return rows.map((r) => ({
    id: String(r.id),
    projectId: r.project_id ? String(r.project_id) : null,
    kind: String(r.kind) as CmsMediaRecord["kind"],
    mediaType: (r.media_type === "video" ? "video" : "image") as "image" | "video",
    storageKey: String(r.storage_key),
    publicUrl: String(r.public_url),
    filename: String(r.filename),
    mimeType: String(r.mime_type),
    byteSize: Number(r.byte_size || 0),
    width: r.width ? Number(r.width) : null,
    height: r.height ? Number(r.height) : null,
    altTR: String(r.alt_tr || ""),
    altEN: String(r.alt_en || ""),
    captionTR: r.caption_tr ? String(r.caption_tr) : null,
    captionEN: r.caption_en ? String(r.caption_en) : null,
    sortOrder: Number(r.sort_order || 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at)
  }));
}

export function deleteMediaFromD1AndR2(
  mediaId: string,
  actorEmail: string
): { deletedId: string } {
  const db = getD1Database();
  const row = db.prepare(`SELECT * FROM project_media WHERE id = ?`).get(mediaId);
  if (!row) {
    throw new Error(`Media record "${mediaId}" not found.`);
  }
  const storageKey = String(row.storage_key);
  const r2FilePath = path.join(getLocalR2DirPath(), storageKey);
  if (fs.existsSync(r2FilePath)) {
    try {
      fs.unlinkSync(r2FilePath);
    } catch {
      // ignore
    }
  }

  const now = new Date().toISOString();
  db.prepare(`DELETE FROM project_media WHERE id = ?`).run(mediaId);
  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, 'media_delete', 'project_media', ?, ?, ?)`
  ).run(`audit-${crypto.randomUUID()}`, actorEmail, mediaId, JSON.stringify({ storageKey }), now);

  return { deletedId: mediaId };
}

export function getD1HealthAndStats() {
  const db = getD1Database();
  const statusRows = db
    .prepare(`SELECT status, COUNT(*) as count FROM projects GROUP BY status`)
    .all();
  const workspaceRows = db
    .prepare(
      `SELECT workspace, status, COUNT(*) as count FROM projects GROUP BY workspace, status`
    )
    .all();
  const featuredRow = db
    .prepare(`SELECT COUNT(*) as count FROM projects WHERE featured = 1 AND status = 'published'`)
    .get();
  const mediaRow = db.prepare(`SELECT COUNT(*) as count FROM project_media`).get();
  const translationRow = db.prepare(`SELECT COUNT(*) as count FROM project_translations`).get();

  const statusMap: Record<string, number> = { published: 0, draft: 0, archived: 0 };
  for (const r of statusRows) {
    statusMap[String(r.status)] = Number(r.count);
  }

  const remoteConfigured = Boolean(
    process.env.CLOUDFLARE_CMS_API_URL && process.env.CLOUDFLARE_API_SERVICE_TOKEN
  );

  return {
    ok: true,
    mode: remoteConfigured ? "cloudflare-remote-with-d1-mirror" : "local-d1-sqlite",
    dbPath: getDbFilePath(),
    r2Path: getLocalR2DirPath(),
    remoteWorkerUrl: process.env.CLOUDFLARE_CMS_API_URL || null,
    remoteServiceTokenConfigured: Boolean(process.env.CLOUDFLARE_API_SERVICE_TOKEN),
    counts: {
      total: statusMap.published + statusMap.draft + statusMap.archived,
      published: statusMap.published,
      draft: statusMap.draft,
      archived: statusMap.archived,
      featuredPublished: Number(featuredRow?.count || 0),
      mediaItems: Number(mediaRow?.count || 0),
      translations: Number(translationRow?.count || 0)
    },
    workspaceBreakdown: workspaceRows.map((r) => ({
      workspace: String(r.workspace),
      status: String(r.status),
      count: Number(r.count)
    }))
  };
}

export function reconcileCanonicalProjectsWithD1() {
  const d1Projects = listAllProjectsForAdminFromD1();
  const bySlug = new Map(d1Projects.map((p) => [p.slug, p]));
  const missingSlugs: string[] = [];
  const fieldMismatches: {
    slug: string;
    field: string;
    expected: unknown;
    actual: unknown;
  }[] = [];

  for (const canonical of projectsData) {
    const found = bySlug.get(canonical.slug);
    if (!found) {
      missingSlugs.push(canonical.slug);
      continue;
    }
    if (found.workspace !== canonical.workspace) {
      fieldMismatches.push({
        slug: canonical.slug,
        field: "workspace",
        expected: canonical.workspace,
        actual: found.workspace
      });
    }
    if (found.titleTR !== canonical.titleTR) {
      fieldMismatches.push({
        slug: canonical.slug,
        field: "titleTR",
        expected: canonical.titleTR,
        actual: found.titleTR
      });
    }
    if (found.titleEN !== canonical.titleEN) {
      fieldMismatches.push({
        slug: canonical.slug,
        field: "titleEN",
        expected: canonical.titleEN,
        actual: found.titleEN
      });
    }
  }

  return {
    canonicalCount: projectsData.length,
    d1TotalCount: d1Projects.length,
    missingSlugs,
    fieldMismatches,
    reconciled: missingSlugs.length === 0 && fieldMismatches.length === 0
  };
}
