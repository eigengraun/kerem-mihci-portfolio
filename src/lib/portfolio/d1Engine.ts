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
  type ProjectMediaLayout,
  type ProjectStatus,
  type WorkspaceId
} from "../../data/projects";
import {
  videosData,
  type VideoType,
  type VideoOrientation,
  type ProductionMethod
} from "../../data/videos";
import {
  CmsStorageUnavailableError,
  type CmsAuditLogRecord,
  type CmsDataSource,
  type CmsMediaRecord,
  type CmsProjectRecord,
  type CmsPublishStatus,
  type CmsPublishingEventRecord,
  type CmsRevisionRecord,
  type CmsStorageMode,
  type UpsertProjectInput,
  type CmsVideoRecord,
  type CmsVideoAssetRecord,
  type CmsVideoRevisionRecord,
  type UpsertVideoInput,
  type CmsGalleryItem,
  type CmsGalleryAssetRecord,
  type CmsGalleryRevisionRecord,
  type UpsertGalleryItemInput,
  normalizeSlug,
  validateMediaFileSignature,
  validateVideoAssetSignature,
  validateGalleryImageSignature
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

interface MediaItemMeta {
  originalId?: string;
  layout?: ProjectMediaLayout;
  poster?: string;
  thumbnail?: string;
  aspectRatio?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
  priority?: boolean;
}

interface ExtraProjectMetadataJson {
  categoryIds?: ProjectCategoryId[];
  tags?: string[];
  tools?: string[];
  services?: string[];
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
  desktopWeight?: "small" | "normal" | "large";
  desktopPlacement?: { x: number; y: number };
  desktopClusterId?: string;
  projectStatus?: ProjectStatus;
  hasExplicitSeo?: boolean;
  hasExplicitExternalLinks?: boolean;
  hasExplicitOgImage?: boolean;
  mediaMeta?: MediaItemMeta[];
}

const requireNode = createRequire(import.meta.url);

export function getCmsStorageMode(): CmsStorageMode {
  const raw = (process.env.CMS_STORAGE_MODE || "").trim().toLowerCase();
  if (raw === "local" || raw === "staging" || raw === "production") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "production" : "local";
}

export function getCmsDataSource(): CmsDataSource {
  const raw = (process.env.CMS_DATA_SOURCE || "").trim().toLowerCase();
  if (raw === "legacy") return "legacy";
  if (raw === "cloudflare") return "cloudflare";
  // In production when Cloudflare Worker URL is not yet configured, default to legacy read mode
  if (getCmsStorageMode() === "production" && !process.env.CLOUDFLARE_CMS_API_URL) {
    return "legacy";
  }
  return "cloudflare";
}

export function assertLocalSimulationAllowed(operation: string): void {
  const mode = getCmsStorageMode();
  if (mode !== "local") {
    throw new CmsStorageUnavailableError(
      `[CMS Fail-Closed] Operation "${operation}" blocked: local SQLite/R2 simulation is strictly disabled when CMS_STORAGE_MODE="${mode}". Configure CLOUDFLARE_CMS_API_URL and CLOUDFLARE_API_SERVICE_TOKEN.`
    );
  }
}

export function getDbFilePath(): string {
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
  year TEXT NOT NULL DEFAULT '',
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
CREATE TABLE IF NOT EXISTS admin_sessions (
  jti_hash TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  csrf_token_hash TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  revoked_reason TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  last_seen_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_rate_limits (
  scope_key TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status_workspace ON projects(status, workspace, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(status, workspace, featured, featured_order);
CREATE INDEX IF NOT EXISTS idx_project_translations_project_locale ON project_translations(project_id, locale);
CREATE INDEX IF NOT EXISTS idx_project_media_project_sort ON project_media(project_id, kind, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_revisions_project ON project_revisions(project_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_publishing_events_project ON publishing_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_actor_active ON admin_sessions(actor_email, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_rate_limits_updated ON admin_rate_limits(updated_at);

-- Videos & Reels Schema (Additive)
CREATE TABLE IF NOT EXISTS portfolio_videos (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  orientation TEXT NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait', 'landscape')),
  video_type TEXT NOT NULL DEFAULT 'reel' CHECK (video_type IN ('ai-reel', 'reel', 'video')),
  production_method TEXT NOT NULL DEFAULT 'traditional' CHECK (production_method IN ('traditional', 'ai-assisted', 'hybrid')),
  ai_assisted INTEGER NOT NULL DEFAULT 0 CHECK (ai_assisted IN (0, 1)),
  client_name TEXT NOT NULL DEFAULT '',
  year INTEGER NOT NULL DEFAULT 2026,
  duration TEXT NOT NULL DEFAULT '',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  autoplay_preview INTEGER NOT NULL DEFAULT 1 CHECK (autoplay_preview IN (0, 1)),
  external_url TEXT,
  project_slug TEXT,
  tools_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS portfolio_video_translations (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES portfolio_videos(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('tr', 'en')),
  title TEXT NOT NULL DEFAULT '',
  short_title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  full_description TEXT NOT NULL DEFAULT '',
  services_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  UNIQUE(video_id, locale)
);
CREATE TABLE IF NOT EXISTS portfolio_video_assets (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES portfolio_videos(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('video', 'poster', 'thumbnail')),
  storage_mode TEXT NOT NULL DEFAULT 'local_static' CHECK (storage_mode IN ('local_static', 'r2', 'external')),
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'video/mp4',
  byte_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(video_id, asset_type)
);
CREATE TABLE IF NOT EXISTS portfolio_video_revisions (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES portfolio_videos(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_slug ON portfolio_videos(slug);
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_status_sort ON portfolio_videos(status, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_featured ON portfolio_videos(status, featured, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_orientation ON portfolio_videos(status, orientation);
CREATE INDEX IF NOT EXISTS idx_portfolio_video_translations_lookup ON portfolio_video_translations(video_id, locale);
CREATE INDEX IF NOT EXISTS idx_portfolio_video_assets_lookup ON portfolio_video_assets(video_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_portfolio_video_assets_storage_key ON portfolio_video_assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_portfolio_video_revisions_lookup ON portfolio_video_revisions(video_id, revision_number DESC);

-- Personal Gallery Schema (Additive)
CREATE TABLE IF NOT EXISTS portfolio_gallery_items (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  year TEXT,
  location TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS portfolio_gallery_translations (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES portfolio_gallery_items(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('tr', 'en')),
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE(item_id, locale)
);
CREATE TABLE IF NOT EXISTS portfolio_gallery_assets (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES portfolio_gallery_items(id) ON DELETE CASCADE,
  storage_mode TEXT NOT NULL DEFAULT 'local_static' CHECK (storage_mode IN ('local_static', 'r2', 'external')),
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/webp' CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(item_id)
);
CREATE TABLE IF NOT EXISTS portfolio_gallery_revisions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES portfolio_gallery_items(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_status_sort ON portfolio_gallery_items(status, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_translations_lookup ON portfolio_gallery_translations(item_id, locale);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_assets_lookup ON portfolio_gallery_assets(item_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_assets_storage_key ON portfolio_gallery_assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_revisions_lookup ON portfolio_gallery_revisions(item_id, revision_number DESC);
`;

let cachedDb: SqliteDatabase | null = null;
let cachedDbPath: string | null = null;

export function getD1Database(): SqliteDatabase {
  assertLocalSimulationAllowed("getD1Database");

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

  const migrationsDir = path.join(
    process.cwd(),
    "cloudflare",
    "portfolio-api",
    "migrations"
  );
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      db.exec(sql);
    }
  } else {
    db.exec(SCHEMA_SQL_FALLBACK);
  }

  // Non-destructive compatibility check for admin_sessions (preserve all existing sessions)
  try {
    const sessionTableCols = db
      .prepare("PRAGMA table_info(admin_sessions)")
      .all() as { name: string }[];
    const colNames = new Set(sessionTableCols.map((c) => c.name));
    if (sessionTableCols.length > 0 && !colNames.has("actor_email")) {
      db.exec("ALTER TABLE admin_sessions ADD COLUMN actor_email TEXT;");
      if (colNames.has("email")) {
        db.exec("UPDATE admin_sessions SET actor_email = email WHERE actor_email IS NULL;");
      }
      if (!colNames.has("role")) {
        db.exec("ALTER TABLE admin_sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'owner';");
      }
      if (!colNames.has("ip_hash")) {
        db.exec("ALTER TABLE admin_sessions ADD COLUMN ip_hash TEXT;");
      }
      db.exec("CREATE INDEX IF NOT EXISTS idx_admin_sessions_actor_active ON admin_sessions(actor_email, revoked_at, expires_at);");
    }
  } catch {
    // Non-destructive compatibility check
  }

  // Cache DB handle immediately to prevent recursive initialization
  cachedDb = db;
  cachedDbPath = dbPath;

  const countRow = db.prepare("SELECT COUNT(*) as count FROM projects").get() as
    | { count: number }
    | undefined;
  const existingCount = Number(countRow?.count ?? 0);
  if (existingCount === 0) {
    seedCanonicalProjects(db, { upsertExisting: false });
  }

  // Note: portfolio_videos is explicitly seeded via operator command or seedCanonicalVideosInLocalD1().
  // Legitimate empty CMS databases remain empty; no unexpected data writes on read-only requests.

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

      const fOrder = typeof p.featuredOrder === "number" ? p.featuredOrder : 0;
      const sortOrder = p.sortOrder ?? idx + 1;
      const desktopThumbJson = p.desktopThumbnail ? JSON.stringify(p.desktopThumbnail) : null;

      const liveLink = p.externalLinks?.find((l) => l.type === "live")?.href || null;
      const mediaMeta: MediaItemMeta[] = (p.media || []).map((m) => ({
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

      const extraMeta: ExtraProjectMetadataJson = {
        categoryIds: p.categoryIds,
        tools: p.tools,
        services: p.services,
        servicesTR: p.servicesTR,
        servicesEN: p.servicesEN,
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
        desktopWidth: p.desktop?.width,
        desktopWeight: p.desktopWeight,
        desktopPlacement: p.desktopPlacement,
        desktopClusterId: p.desktopClusterId,
        projectStatus: p.status || "completed",
        hasExplicitSeo: Boolean(p.seo),
        hasExplicitExternalLinks: p.externalLinks !== undefined,
        hasExplicitOgImage: p.ogImage !== undefined,
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

export function mapRowsToCmsProjects(
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

  const rawMediaByProject = new Map<string, Record<string, unknown>[]>();
  for (const row of mediaRows) {
    if (!row.project_id) continue;
    const pid = String(row.project_id);
    const kind = String(row.kind || "gallery");
    if (kind !== "gallery" && kind !== "video") continue;
    if (!rawMediaByProject.has(pid)) rawMediaByProject.set(pid, []);
    rawMediaByProject.get(pid)!.push(row);
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

    const showSeo =
      extra.hasExplicitSeo !== undefined
        ? extra.hasExplicitSeo
        : Boolean(seoTitleTR || seoTitleEN || seoDescTR || seoDescEN || ogImg);
    const workspace = (row.workspace as WorkspaceId) || "design";
    const defaultCategory: ProjectCategoryId =
      workspace === "web"
        ? "website"
        : workspace === "motion-ai"
        ? "video-production"
        : "graphic-design";

    const liveUrl = row.live_url ? String(row.live_url) : undefined;
    const externalLinks: ProjectExternalLink[] | undefined =
      extra.hasExplicitExternalLinks === false
        ? undefined
        : extra.externalLinks !== undefined
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

    const pMediaRows = rawMediaByProject.get(id) || [];
    const mediaMetaList = extra.mediaMeta || [];
    const media: ProjectMediaItem[] = pMediaRows.map((mRow, idx) => {
      const mMeta = mediaMetaList[idx] || {};
      const item: ProjectMediaItem = {
        id: mMeta.originalId || String(mRow.id),
        type: mRow.media_type === "video" ? "video" : "image",
        src: String(mRow.public_url)
      };
      if (mRow.alt_tr) item.altTR = String(mRow.alt_tr);
      if (mRow.alt_en) item.altEN = String(mRow.alt_en);
      if (mRow.caption_tr) item.captionTR = String(mRow.caption_tr);
      if (mRow.caption_en) item.captionEN = String(mRow.caption_en);
      if (mMeta.layout) item.layout = mMeta.layout;
      if (mRow.width !== null && mRow.width !== undefined) item.width = Number(mRow.width);
      if (mRow.height !== null && mRow.height !== undefined) item.height = Number(mRow.height);
      if (mMeta.poster) item.poster = mMeta.poster;
      if (mMeta.thumbnail) item.thumbnail = mMeta.thumbnail;
      if (mMeta.aspectRatio) item.aspectRatio = mMeta.aspectRatio;
      if (mMeta.autoplay !== undefined) item.autoplay = mMeta.autoplay;
      if (mMeta.muted !== undefined) item.muted = mMeta.muted;
      if (mMeta.loop !== undefined) item.loop = mMeta.loop;
      if (mMeta.preload) item.preload = mMeta.preload;
      if (mMeta.priority !== undefined) item.priority = mMeta.priority;
      return item;
    });

    const rawYear = row.year !== null && row.year !== undefined ? String(row.year) : "";
    const rawDescTR =
      tr.description !== null && tr.description !== undefined ? String(tr.description) : "";
    const rawDescEN =
      en.description !== null && en.description !== undefined ? String(en.description) : "";
    const rawFeaturedOrder = Number(row.featured_order || 0);

    return {
      id,
      slug: String(row.slug),
      cmsStatus: (row.status as CmsPublishStatus) || "draft",
      status: extra.projectStatus || "completed",
      workspace,
      workspaceId: workspace,
      categoryIds:
        extra.categoryIds && extra.categoryIds.length > 0
          ? extra.categoryIds
          : [defaultCategory],
      featured: Number(row.featured) === 1,
      featuredOrder: rawFeaturedOrder > 0 ? rawFeaturedOrder : undefined,
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
      year: rawYear !== "" ? rawYear : undefined,
      summaryTR: tr.summary ? String(tr.summary) : undefined,
      summaryEN: en.summary ? String(en.summary) : undefined,
      descriptionTR: rawDescTR !== "" ? rawDescTR : undefined,
      descriptionEN: rawDescEN !== "" ? rawDescEN : undefined,
      challengeTR: extra.challengeTR,
      challengeEN: extra.challengeEN,
      solutionTR: extra.solutionTR,
      solutionEN: extra.solutionEN,
      resultTR: extra.resultTR,
      resultEN: extra.resultEN,
      roleTR: tr.role ? String(tr.role) : undefined,
      roleEN: en.role ? String(en.role) : undefined,
      services: extra.services,
      servicesTR: extra.servicesTR || deliverablesTR,
      servicesEN: extra.servicesEN || deliverablesEN,
      tools: extra.tools ?? [],
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
      ogImage: extra.hasExplicitOgImage === false ? undefined : ogImg,
      desktopThumbnail,
      seo: showSeo
        ? {
            titleTR: seoTitleTR,
            titleEN: seoTitleEN,
            descriptionTR: seoDescTR,
            descriptionEN: seoDescEN,
            ogImage: ogImg
          }
        : undefined,
      media,
      desktop: {
        x: Number(row.desktop_position_x ?? 25),
        y: Number(row.desktop_position_y ?? 25),
        ...(extra.desktopWidth !== undefined ? { width: extra.desktopWidth } : {})
      },
      desktopWeight: extra.desktopWeight,
      desktopPlacement: extra.desktopPlacement,
      desktopClusterId: extra.desktopClusterId,
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

  const mediaMeta: MediaItemMeta[] | undefined = Array.isArray(input.media)
    ? input.media.map((m) => ({
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
      }))
    : existingMeta.mediaMeta;

  const extraMeta: ExtraProjectMetadataJson = {
    ...existingMeta,
    categoryIds: input.categoryIds ?? existingMeta.categoryIds,
    tags: input.tags ?? existingMeta.tags ?? [],
    tools: input.tools ?? existingMeta.tools,
    services: input.services ?? existingMeta.services,
    servicesTR: input.servicesTR ?? existingMeta.servicesTR,
    servicesEN: input.servicesEN ?? existingMeta.servicesEN,
    externalLinks: input.externalLinks ?? existingMeta.externalLinks,
    hasExplicitExternalLinks:
      input.externalLinks !== undefined
        ? true
        : existingMeta.hasExplicitExternalLinks ?? false,
    contentBlocks: input.contentBlocks ?? existingMeta.contentBlocks,
    desktopLabelTR: input.desktopLabelTR ?? existingMeta.desktopLabelTR,
    desktopLabelEN: input.desktopLabelEN ?? existingMeta.desktopLabelEN,
    challengeTR: input.challengeTR ?? existingMeta.challengeTR,
    challengeEN: input.challengeEN ?? existingMeta.challengeEN,
    solutionTR: input.solutionTR ?? existingMeta.solutionTR,
    solutionEN: input.solutionEN ?? existingMeta.solutionEN,
    resultTR: input.resultTR ?? existingMeta.resultTR,
    resultEN: input.resultEN ?? existingMeta.resultEN,
    desktopWidth: input.desktop?.width ?? existingMeta.desktopWidth,
    desktopWeight: input.desktopWeight ?? existingMeta.desktopWeight,
    projectStatus: input.projectStatus ?? existingMeta.projectStatus ?? "completed",
    hasExplicitSeo: input.seo !== undefined ? Boolean(input.seo) : existingMeta.hasExplicitSeo ?? false,
    hasExplicitOgImage:
      input.ogImage !== undefined
        ? Boolean(input.ogImage)
        : existingMeta.hasExplicitOgImage ?? false,
    mediaMeta
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

  const yearStr = input.year !== undefined ? input.year : existing ? String(existing.year ?? "") : "";

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
        yearStr,
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
        yearStr,
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
      input.subtitleTR ?? input.projectTypeTR ?? null,
      input.summaryTR ?? null,
      input.descriptionTR ?? "",
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
      input.subtitleEN ?? input.projectTypeEN ?? null,
      input.summaryEN ?? null,
      input.descriptionEN ?? "",
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

    // Associate any unassociated project_media rows for this project slug/id
    db.prepare(
      `UPDATE project_media SET project_id = ? WHERE (project_id IS NULL OR project_id = '') AND (storage_key LIKE ? OR storage_key LIKE ?)`
    ).run(projectId, `projects/${cleanSlug}/%`, `projects/${projectId}/%`);

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
    db.prepare(`DELETE FROM project_media WHERE project_id = ? AND kind = 'gallery'`).run(projectId);
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
  customStorageKey?: string;
  simulateD1Error?: boolean;
}): CmsMediaRecord {
  assertLocalSimulationAllowed("uploadMediaToR2AndD1");

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
    actorEmail,
    customStorageKey,
    simulateD1Error = false
  } = params;

  const sigCheck = validateMediaFileSignature(buffer, mimeType, filename);
  if (!sigCheck.valid) {
    throw new Error(sigCheck.error || "Invalid media file.");
  }

  const isVideo = mimeType.startsWith("video/");
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
  const storageKey =
    customStorageKey && !customStorageKey.includes("..") && !customStorageKey.startsWith("/")
      ? customStorageKey
      : `projects/${safeSlug}/${kind}/${yyyy}/${mm}/${shortUuid}-${safeFilename}`;

  const r2Root = path.resolve(getLocalR2DirPath());
  const fullFilePath = path.resolve(r2Root, storageKey);
  if (!fullFilePath.startsWith(r2Root + path.sep)) {
    throw new Error("Invalid media storage path.");
  }
  if (fs.existsSync(fullFilePath)) {
    throw new Error("Storage key collision detected; please retry upload.");
  }
  fs.mkdirSync(path.dirname(fullFilePath), { recursive: true });
  fs.writeFileSync(fullFilePath, buffer);

  const publicBase = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const publicUrl = publicBase ? `${publicBase}/${storageKey}` : `/api/media/${storageKey}`;
  const mediaId = `media-${crypto.randomUUID()}`;
  const isoNow = now.toISOString();

  let resolvedProjectId = projectId;
  const db = getD1Database();
  if (!resolvedProjectId && safeSlug && safeSlug !== "general") {
    const foundProj = db
      .prepare(`SELECT id FROM projects WHERE slug = ? OR id = ? LIMIT 1`)
      .get(safeSlug, safeSlug) as { id?: string } | undefined;
    if (foundProj?.id) {
      resolvedProjectId = String(foundProj.id);
    }
  }

  db.exec("BEGIN TRANSACTION;");
  try {
    if (resolvedProjectId) {
      const existingProj = db
        .prepare(`SELECT id FROM projects WHERE id = ? LIMIT 1`)
        .get(resolvedProjectId);
      if (!existingProj) {
        throw new Error(`Referenced project "${resolvedProjectId}" does not exist.`);
      }
    }
    if (simulateD1Error) {
      throw new Error("Simulated D1 write failure after R2 upload.");
    }

    db.prepare(
      `INSERT INTO project_media (
        id, project_id, kind, media_type, storage_key, public_url, filename,
        mime_type, byte_size, alt_tr, alt_en, caption_tr, caption_en,
        sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      mediaId,
      resolvedProjectId,
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
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    if (fs.existsSync(fullFilePath)) {
      try {
        fs.unlinkSync(fullFilePath);
      } catch {
        // ignore
      }
    }
    throw err;
  }

  return {
    id: mediaId,
    projectId: resolvedProjectId,
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

export function isMediaKeyPubliclyAccessibleInLocalD1(storageKey: string): boolean {
  const db = getD1Database();
  const row = db
    .prepare(
      `SELECT pm.id, pm.project_id, p.status as project_status
       FROM project_media pm
       INNER JOIN projects p ON pm.project_id = p.id
       WHERE pm.storage_key = ?
       LIMIT 1`
    )
    .get(storageKey) as
    | { id: string; project_id: string; project_status: string }
    | undefined;

  if (row && row.project_id && row.project_status === "published") {
    return true;
  }

  // Check video assets
  try {
    const videoRow = db
      .prepare(
        `SELECT pva.id, pv.status as video_status
         FROM portfolio_video_assets pva
         INNER JOIN portfolio_videos pv ON pva.video_id = pv.id
         WHERE pva.storage_key = ?
         LIMIT 1`
      )
      .get(storageKey) as { id: string; video_status: string } | undefined;

    if (videoRow && videoRow.video_status === "published") {
      return true;
    }
  } catch {
    // continue
  }

  // Check gallery assets
  try {
    const galleryRow = db
      .prepare(
        `SELECT pga.id, pgi.status as item_status
         FROM portfolio_gallery_assets pga
         INNER JOIN portfolio_gallery_items pgi ON pga.item_id = pgi.id
         WHERE pga.storage_key = ?
         LIMIT 1`
      )
      .get(storageKey) as { id: string; item_status: string } | undefined;

    return Boolean(galleryRow && galleryRow.item_status === "published");
  } catch {
    return false;
  }
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
  assertLocalSimulationAllowed("deleteMediaFromD1AndR2");
  const db = getD1Database();
  const row = db.prepare(`SELECT * FROM project_media WHERE id = ?`).get(mediaId);
  if (!row) {
    throw new Error(`Media record "${mediaId}" not found.`);
  }
  const storageKey = String(row.storage_key);
  const r2Root = path.resolve(getLocalR2DirPath());
  const r2FilePath = path.resolve(r2Root, storageKey);
  if (r2FilePath.startsWith(r2Root + path.sep) && fs.existsSync(r2FilePath)) {
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
  const storageMode = getCmsStorageMode();
  const dataSource = getCmsDataSource();
  const remoteConfigured = Boolean(
    process.env.CLOUDFLARE_CMS_API_URL && process.env.CLOUDFLARE_API_SERVICE_TOKEN
  );

  if (storageMode !== "local") {
    return {
      ok: false,
      mode: `cloudflare-${storageMode}`,
      storageMode,
      dataSource,
      d1Connected: false,
      r2Connected: false,
      error: "Remote Cloudflare Worker health check must be queried through repository.getD1HealthAndStats()",
      dbPath: null,
      r2Path: null,
      remoteWorkerUrl: process.env.CLOUDFLARE_CMS_API_URL || null,
      remoteServiceTokenConfigured: Boolean(process.env.CLOUDFLARE_API_SERVICE_TOKEN),
      counts: {
        total: 0,
        published: 0,
        draft: 0,
        archived: 0,
        featuredPublished: 0,
        mediaItems: 0,
        translations: 0,
        totalVideos: 0,
        publishedVideos: 0,
        draftVideos: 0,
        archivedVideos: 0,
        portraitVideos: 0,
        landscapeVideos: 0,
        aiAssistedVideos: 0,
        totalGalleryItems: 0,
        publishedGalleryItems: 0,
        draftGalleryItems: 0,
        archivedGalleryItems: 0
      },
      workspaceBreakdown: []
    };
  }

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

  const videoCounts = {
    totalVideos: 0,
    publishedVideos: 0,
    draftVideos: 0,
    archivedVideos: 0,
    portraitVideos: 0,
    landscapeVideos: 0,
    aiAssistedVideos: 0
  };

  try {
    const videoStatusRows = db
      .prepare(
        `SELECT status, orientation, ai_assisted, COUNT(*) as count
         FROM portfolio_videos
         GROUP BY status, orientation, ai_assisted`
      )
      .all() as { status: string; orientation: string; ai_assisted: number; count: number }[];

    for (const r of videoStatusRows) {
      const c = Number(r.count || 0);
      videoCounts.totalVideos += c;
      if (r.status === "published") videoCounts.publishedVideos += c;
      if (r.status === "draft") videoCounts.draftVideos += c;
      if (r.status === "archived") videoCounts.archivedVideos += c;
      if (r.orientation === "portrait") videoCounts.portraitVideos += c;
      if (r.orientation === "landscape") videoCounts.landscapeVideos += c;
      if (Number(r.ai_assisted) === 1) videoCounts.aiAssistedVideos += c;
    }
  } catch {
    // portfolio_videos table not yet created
  }

  const galleryCounts = {
    totalGalleryItems: 0,
    publishedGalleryItems: 0,
    draftGalleryItems: 0,
    archivedGalleryItems: 0
  };

  try {
    const galleryStatusRows = db
      .prepare(
        `SELECT status, COUNT(*) as count
         FROM portfolio_gallery_items
         GROUP BY status`
      )
      .all() as { status: string; count: number }[];

    for (const r of galleryStatusRows) {
      const c = Number(r.count || 0);
      galleryCounts.totalGalleryItems += c;
      if (r.status === "published") galleryCounts.publishedGalleryItems += c;
      if (r.status === "draft") galleryCounts.draftGalleryItems += c;
      if (r.status === "archived") galleryCounts.archivedGalleryItems += c;
    }
  } catch {
    // portfolio_gallery_items table not yet created
  }

  return {
    ok: true,
    mode: remoteConfigured ? "cloudflare-worker-local" : "local-d1-sqlite",
    storageMode,
    dataSource,
    d1Connected: true,
    r2Connected: true,
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
      translations: Number(translationRow?.count || 0),
      ...videoCounts,
      ...galleryCounts
    },
    workspaceBreakdown: workspaceRows.map((r) => ({
      workspace: String(r.workspace),
      status: String(r.status),
      count: Number(r.count)
    }))
  };
}

export function reconcileProjectsListWithCanonical(d1Projects: CmsProjectRecord[]) {
  const bySlug = new Map(d1Projects.map((p) => [p.slug, p]));
  const canonicalSlugSet = new Set(projectsData.map((p) => p.slug));
  const missingSlugs: string[] = [];
  const nonCanonicalSlugs = d1Projects
    .filter((p) => !canonicalSlugSet.has(p.slug))
    .map((p) => p.slug);
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

    const check = (field: string, expected: unknown, actual: unknown) => {
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        fieldMismatches.push({
          slug: canonical.slug,
          field,
          expected,
          actual
        });
      }
    };

    check("id", canonical.id, found.id);
    check("slug", canonical.slug, found.slug);
    check("workspace", canonical.workspace, found.workspace);
    check("titleTR", canonical.titleTR, found.titleTR);
    check("titleEN", canonical.titleEN, found.titleEN);
    check("client", canonical.client, found.client);
    check("year", canonical.year, found.year);
    check("featured", canonical.featured, found.featured);
    check("featuredOrder", canonical.featuredOrder, found.featuredOrder);
    check("sortOrder", canonical.sortOrder, found.sortOrder);
    check("categoryIds", canonical.categoryIds, found.categoryIds);
    check("categoryTR", canonical.categoryTR, found.categoryTR);
    check("categoryEN", canonical.categoryEN, found.categoryEN);
    check("projectTypeTR", canonical.projectTypeTR, found.projectTypeTR);
    check("projectTypeEN", canonical.projectTypeEN, found.projectTypeEN);
    check("servicesTR", canonical.servicesTR, found.servicesTR);
    check("servicesEN", canonical.servicesEN, found.servicesEN);
    check("services", canonical.services, found.services);
    check("tools", canonical.tools, found.tools);
    check("roleTR", canonical.roleTR, found.roleTR);
    check("roleEN", canonical.roleEN, found.roleEN);
    check("externalLinks", canonical.externalLinks, found.externalLinks);
    check("thumbnail", canonical.thumbnail, found.thumbnail);
    check("desktopIcon", canonical.desktopIcon, found.desktopIcon);
    check("desktopThumbnail", canonical.desktopThumbnail, found.desktopThumbnail);
    check("cover", canonical.cover, found.cover);
    check("ogImage", canonical.ogImage, found.ogImage);
    check("media.count", (canonical.media || []).length, (found.media || []).length);
    check(
      "media.paths",
      (canonical.media || []).map((m) => m.src),
      (found.media || []).map((m) => m.src)
    );
    check("media.items", canonical.media || [], found.media || []);
    check("summaryTR", canonical.summaryTR, found.summaryTR);
    check("summaryEN", canonical.summaryEN, found.summaryEN);
    check("descriptionTR", canonical.descriptionTR, found.descriptionTR);
    check("descriptionEN", canonical.descriptionEN, found.descriptionEN);
    check("challengeTR", canonical.challengeTR, found.challengeTR);
    check("challengeEN", canonical.challengeEN, found.challengeEN);
    check("solutionTR", canonical.solutionTR, found.solutionTR);
    check("solutionEN", canonical.solutionEN, found.solutionEN);
    check("resultTR", canonical.resultTR, found.resultTR);
    check("resultEN", canonical.resultEN, found.resultEN);
    check("seo", canonical.seo, found.seo);
  }

  const status: "verified" | "modified" | "mismatch" | "error" =
    missingSlugs.length > 0
      ? "error"
      : fieldMismatches.length > 0
      ? "modified"
      : "verified";

  return {
    checkCompleted: true,
    status,
    canonicalCount: projectsData.length,
    d1TotalCount: d1Projects.length,
    missingSlugs,
    nonCanonicalSlugs,
    fieldMismatches,
    reconciled:
      missingSlugs.length === 0 &&
      nonCanonicalSlugs.length === 0 &&
      fieldMismatches.length === 0
  };
}

export function reconcileCanonicalProjectsWithD1() {
  if (getCmsStorageMode() !== "local") {
    return {
      checkCompleted: false,
      status: "unexecuted" as const,
      canonicalCount: projectsData.length,
      d1TotalCount: 0,
      missingSlugs: [],
      nonCanonicalSlugs: [],
      fieldMismatches: [],
      reconciled: false,
      error: "Remote reconciliation must be performed through repository.reconcileCanonicalProjectsWithD1()"
    };
  }
  const d1Projects = listAllProjectsForAdminFromD1();
  return reconcileProjectsListWithCanonical(d1Projects);
}

export function reconcileVideosListWithCanonical(d1Videos: CmsVideoRecord[]) {
  const bySlug = new Map(d1Videos.map((v) => [v.slug, v]));
  const canonicalSlugSet = new Set(videosData.map((v) => v.slug));
  const missingSlugs: string[] = [];
  const nonCanonicalSlugs = d1Videos
    .filter((v) => !canonicalSlugSet.has(v.slug))
    .map((v) => v.slug);
  const fieldMismatches: {
    slug: string;
    field: string;
    expected: unknown;
    actual: unknown;
  }[] = [];

  for (const canonical of videosData) {
    const found = bySlug.get(canonical.slug);
    if (!found) {
      missingSlugs.push(canonical.slug);
      continue;
    }

    const check = (field: string, expected: unknown, actual: unknown) => {
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        fieldMismatches.push({
          slug: canonical.slug,
          field,
          expected,
          actual
        });
      }
    };

    check("id", canonical.id, found.id);
    check("slug", canonical.slug, found.slug);
    check("type", canonical.type, found.type);
    check("orientation", canonical.orientation || "portrait", found.orientation);
    check("aiAssisted", Boolean(canonical.aiAssisted), Boolean(found.aiAssisted));
    check("productionMethod", canonical.productionMethod || "traditional", found.productionMethod);
    check("client", canonical.client || "", found.client || "");
    check("year", canonical.year || 2026, found.year || 2026);
    check("titleTR", canonical.titleTR, found.titleTR);
    check("titleEN", canonical.titleEN, found.titleEN);
    check("shortTitleTR", canonical.shortTitleTR, found.shortTitleTR);
    check("shortTitleEN", canonical.shortTitleEN, found.shortTitleEN);
    check("descriptionTR", canonical.descriptionTR, found.descriptionTR);
    check("descriptionEN", canonical.descriptionEN, found.descriptionEN);
    check("fullDescriptionTR", canonical.fullDescriptionTR, found.fullDescriptionTR);
    check("fullDescriptionEN", canonical.fullDescriptionEN, found.fullDescriptionEN);
    check("servicesTR", canonical.servicesTR, found.servicesTR);
    check("servicesEN", canonical.servicesEN, found.servicesEN);
    check("poster", canonical.poster, found.poster);
    check("src", canonical.src || `/videos/${canonical.slug}/video.mp4`, found.src);
    check("duration", canonical.duration, found.duration);
    check("featured", Boolean(canonical.featured), Boolean(found.featured));
    check("sortOrder", canonical.sortOrder, found.sortOrder);
  }

  const status: "verified" | "modified" | "mismatch" | "error" =
    missingSlugs.length > 0
      ? "error"
      : fieldMismatches.length > 0
      ? "modified"
      : "verified";

  return {
    checkCompleted: true,
    status,
    canonicalCount: videosData.length,
    d1TotalCount: d1Videos.length,
    missingSlugs,
    nonCanonicalSlugs,
    fieldMismatches,
    reconciled:
      missingSlugs.length === 0 &&
      nonCanonicalSlugs.length === 0 &&
      fieldMismatches.length === 0
  };
}

export function reconcileCanonicalVideosWithD1() {
  if (getCmsStorageMode() !== "local") {
    return {
      checkCompleted: false,
      status: "unexecuted" as const,
      canonicalCount: videosData.length,
      d1TotalCount: 0,
      missingSlugs: [],
      nonCanonicalSlugs: [],
      fieldMismatches: [],
      reconciled: false,
      error: "Remote video reconciliation must be performed through repository.reconcileCanonicalVideosWithD1()"
    };
  }
  const d1Videos = listAllVideosForAdminFromD1();
  return reconcileVideosListWithCanonical(d1Videos);
}

// ============================================================
// DURABLE D1 ADMIN SESSIONS & RATE LIMITING (LOCAL SQLITE D1)
// ============================================================

export interface DurableSessionRecord {
  jtiHash: string;
  actorEmail: string;
  role: string;
  csrfTokenHash: string;
  issuedAt: number;
  expiresAt: number;
  revokedAt: number | null;
  revokedReason: string | null;
}

export function createDurableAdminSessionInLocalD1(params: {
  jtiHash: string;
  actorEmail: string;
  role: string;
  csrfTokenHash: string;
  issuedAt: number;
  expiresAt: number;
  ipHash?: string | null;
  userAgent?: string | null;
}): void {
  const db = getD1Database();
  const nowSec = Math.floor(Date.now() / 1000);
  // Prune expired sessions older than 24h past expiry
  db.prepare(`DELETE FROM admin_sessions WHERE expires_at < ?`).run(nowSec - 86400);

  db.prepare(
    `INSERT INTO admin_sessions (
      jti_hash, actor_email, role, csrf_token_hash, issued_at, expires_at,
      revoked_at, revoked_reason, ip_hash, user_agent, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
    ON CONFLICT(jti_hash) DO UPDATE SET
      actor_email = excluded.actor_email,
      role = excluded.role,
      csrf_token_hash = excluded.csrf_token_hash,
      issued_at = excluded.issued_at,
      expires_at = excluded.expires_at,
      revoked_at = NULL,
      revoked_reason = NULL,
      last_seen_at = excluded.last_seen_at`
  ).run(
    params.jtiHash,
    params.actorEmail,
    params.role,
    params.csrfTokenHash,
    params.issuedAt,
    params.expiresAt,
    params.ipHash ?? null,
    (params.userAgent || "").slice(0, 250) || null,
    nowSec
  );
}

export function verifyDurableAdminSessionInLocalD1(jtiHash: string): {
  valid: boolean;
  reason?: string;
  session?: DurableSessionRecord;
} {
  const db = getD1Database();
  const nowSec = Math.floor(Date.now() / 1000);
  // Opportunistic expired cleanup
  db.prepare(`DELETE FROM admin_sessions WHERE expires_at < ? AND revoked_at IS NULL`).run(
    nowSec - 86400
  );

  const row = db
    .prepare(`SELECT * FROM admin_sessions WHERE jti_hash = ? LIMIT 1`)
    .get(jtiHash);
  if (!row) {
    return { valid: false, reason: "session_not_found" };
  }

  const revokedAt =
    row.revoked_at !== null && row.revoked_at !== undefined ? Number(row.revoked_at) : null;
  const expiresAt = Number(row.expires_at);

  if (revokedAt !== null) {
    return { valid: false, reason: "session_revoked" };
  }
  if (expiresAt <= nowSec) {
    return { valid: false, reason: "session_expired" };
  }

  db.prepare(`UPDATE admin_sessions SET last_seen_at = ? WHERE jti_hash = ?`).run(
    nowSec,
    jtiHash
  );

  return {
    valid: true,
    session: {
      jtiHash: String(row.jti_hash),
      actorEmail: String(row.actor_email),
      role: String(row.role),
      csrfTokenHash: String(row.csrf_token_hash),
      issuedAt: Number(row.issued_at),
      expiresAt,
      revokedAt: null,
      revokedReason: null
    }
  };
}

export function revokeDurableAdminSessionInLocalD1(params: {
  jtiHash?: string;
  actorEmail?: string;
  revokeAllForActor?: boolean;
  reason?: string;
}): { revokedCount: number } {
  const db = getD1Database();
  const nowSec = Math.floor(Date.now() / 1000);
  const reason = params.reason || "user_logout";

  let revokedCount = 0;
  if (params.revokeAllForActor && params.actorEmail) {
    const res = db
      .prepare(
        `UPDATE admin_sessions
         SET revoked_at = ?, revoked_reason = ?
         WHERE actor_email = ? AND revoked_at IS NULL`
      )
      .run(nowSec, reason, params.actorEmail);
    revokedCount += Number(res.changes || 0);
  }
  if (params.jtiHash) {
    const res = db
      .prepare(
        `UPDATE admin_sessions
         SET revoked_at = ?, revoked_reason = ?
         WHERE jti_hash = ? AND revoked_at IS NULL`
      )
      .run(nowSec, reason, params.jtiHash);
    revokedCount += Number(res.changes || 0);
  }

  return { revokedCount };
}

const MAX_RATE_LIMIT_BUCKETS = 1000;

export function checkDurableLoginRateLimitInLocalD1(params: {
  scopeKeys: string[];
  nowMs?: number;
}): { allowed: boolean; retryAfterSec: number; remainingAttempts: number } {
  const db = getD1Database();
  const nowMs = params.nowMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // Prune expired buckets
  db.prepare(
    `DELETE FROM admin_rate_limits
     WHERE (locked_until <= ? AND window_started_at <= ?)`
  ).run(nowSec, nowSec - 900);

  let worstRetryAfter = 0;
  let minRemaining = 5;

  for (const key of params.scopeKeys) {
    const row = db
      .prepare(`SELECT * FROM admin_rate_limits WHERE scope_key = ? LIMIT 1`)
      .get(key);
    if (!row) continue;

    const lockedUntil = Number(row.locked_until || 0);
    const windowStartedAt = Number(row.window_started_at || 0);
    const attemptCount = Number(row.attempt_count || 0);

    if (lockedUntil > nowSec) {
      const retry = Math.max(1, lockedUntil - nowSec);
      if (retry > worstRetryAfter) worstRetryAfter = retry;
      minRemaining = 0;
      continue;
    }

    if (nowSec - windowStartedAt > 900) {
      db.prepare(`DELETE FROM admin_rate_limits WHERE scope_key = ?`).run(key);
      continue;
    }

    const rem = Math.max(0, 5 - attemptCount);
    if (rem < minRemaining) minRemaining = rem;
  }

  if (worstRetryAfter > 0) {
    return { allowed: false, retryAfterSec: worstRetryAfter, remainingAttempts: 0 };
  }

  return { allowed: true, retryAfterSec: 0, remainingAttempts: minRemaining };
}

export function recordDurableFailedLoginInLocalD1(params: {
  scopeKeys: string[];
  nowMs?: number;
  windowSec?: number;
  maxAttempts?: number;
  lockoutSec?: number;
}): { locked: boolean; retryAfterSec: number; remainingAttempts: number } {
  const db = getD1Database();
  const nowMs = params.nowMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const windowSec = params.windowSec ?? 15 * 60;
  const maxAttempts = params.maxAttempts ?? 5;
  const lockoutSec = params.lockoutSec ?? 15 * 60;

  // Enforce bounded table size (prevent unbounded growth DoS)
  db.prepare(
    `DELETE FROM admin_rate_limits
     WHERE (locked_until <= ? AND window_started_at <= ?)`
  ).run(nowSec, nowSec - windowSec);

  const countRow = db
    .prepare(`SELECT COUNT(*) as count FROM admin_rate_limits`)
    .get();
  if (Number(countRow?.count || 0) >= MAX_RATE_LIMIT_BUCKETS) {
    db.prepare(
      `DELETE FROM admin_rate_limits
       WHERE scope_key IN (
         SELECT scope_key FROM admin_rate_limits
         ORDER BY updated_at ASC
         LIMIT 200
       )`
    ).run();
  }

  let anyLocked = false;
  let maxRetrySec = 0;
  let minRemaining = maxAttempts;

  for (const key of params.scopeKeys) {
    const existing = db
      .prepare(`SELECT * FROM admin_rate_limits WHERE scope_key = ? LIMIT 1`)
      .get(key);

    let count = 1;
    let windowStart = nowSec;
    let lockedUntil = 0;

    if (existing) {
      const prevWindow = Number(existing.window_started_at || 0);
      const prevLocked = Number(existing.locked_until || 0);
      if (nowSec - prevWindow <= windowSec && prevLocked <= nowSec) {
        count = Number(existing.attempt_count || 0) + 1;
        windowStart = prevWindow;
      } else if (prevLocked > nowSec) {
        count = Number(existing.attempt_count || 0) + 1;
        windowStart = prevWindow;
        lockedUntil = prevLocked;
      }
    }

    if (count >= maxAttempts && lockedUntil <= nowSec) {
      lockedUntil = nowSec + lockoutSec;
    }

    db.prepare(
      `INSERT INTO admin_rate_limits (scope_key, attempt_count, window_started_at, locked_until, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(scope_key) DO UPDATE SET
         attempt_count = excluded.attempt_count,
         window_started_at = excluded.window_started_at,
         locked_until = excluded.locked_until,
         updated_at = excluded.updated_at`
    ).run(key, count, windowStart, lockedUntil, nowSec);

    if (lockedUntil > nowSec) {
      anyLocked = true;
      const retry = Math.max(1, lockedUntil - nowSec);
      if (retry > maxRetrySec) maxRetrySec = retry;
      minRemaining = 0;
    } else {
      const rem = Math.max(0, maxAttempts - count);
      if (rem < minRemaining) minRemaining = rem;
    }
  }

  return { locked: anyLocked, retryAfterSec: maxRetrySec, remainingAttempts: minRemaining };
}

export function clearDurableLoginRateLimitInLocalD1(scopeKeys: string[]): void {
  const db = getD1Database();
  for (const key of scopeKeys) {
    db.prepare(`DELETE FROM admin_rate_limits WHERE scope_key = ?`).run(key);
  }
}

// ============================================================
// VIDEOS & REELS CMS ENGINE (LOCAL SQLITE D1)
// ============================================================

export function mapRowsToCmsVideos(
  videoRows: Record<string, unknown>[],
  translationRows: Record<string, unknown>[],
  assetRows: Record<string, unknown>[]
): CmsVideoRecord[] {
  const trMap = new Map<string, Record<string, unknown>>();
  const enMap = new Map<string, Record<string, unknown>>();

  for (const row of translationRows) {
    const vid = String(row.video_id);
    if (row.locale === "tr") trMap.set(vid, row);
    if (row.locale === "en") enMap.set(vid, row);
  }

  const assetsByVideo = new Map<string, CmsVideoAssetRecord[]>();
  for (const row of assetRows) {
    const vid = String(row.video_id);
    if (!assetsByVideo.has(vid)) assetsByVideo.set(vid, []);
    assetsByVideo.get(vid)!.push({
      id: String(row.id),
      videoId: vid,
      assetType: String(row.asset_type) as "video" | "poster" | "thumbnail",
      storageMode: String(row.storage_mode) as "local_static" | "r2" | "external",
      storageKey: String(row.storage_key),
      publicUrl: String(row.public_url),
      mimeType: String(row.mime_type || "video/mp4"),
      byteSize: Number(row.byte_size || 0),
      width: row.width !== null && row.width !== undefined ? Number(row.width) : null,
      height: row.height !== null && row.height !== undefined ? Number(row.height) : null,
      durationSeconds: row.duration_seconds !== null && row.duration_seconds !== undefined ? Number(row.duration_seconds) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    });
  }

  return videoRows.map((row) => {
    const id = String(row.id);
    const tr = trMap.get(id) || {};
    const en = enMap.get(id) || {};
    const assets = assetsByVideo.get(id) || [];

    const videoAsset = assets.find((a) => a.assetType === "video");
    const posterAsset = assets.find((a) => a.assetType === "poster");
    const thumbAsset = assets.find((a) => a.assetType === "thumbnail");

    const tools = parseJsonSafe<string[]>(row.tools_json, []);
    const tags = parseJsonSafe<string[]>(row.tags_json, []);
    const servicesTR = parseJsonSafe<string[]>(tr.services_json, []);
    const servicesEN = parseJsonSafe<string[]>(en.services_json, []);

    const orientation = (row.orientation as VideoOrientation) || "portrait";
    const videoType = (row.video_type as VideoType) || "reel";
    const productionMethod = (row.production_method as ProductionMethod) || "traditional";

    const record: CmsVideoRecord = {
      id,
      slug: String(row.slug),
      type: videoType,
      orientation,
      aiAssisted: Boolean(row.ai_assisted),
      productionMethod,
      titleTR: String(tr.title || ""),
      titleEN: String(en.title || ""),
      shortTitleTR: tr.short_title ? String(tr.short_title) : undefined,
      shortTitleEN: en.short_title ? String(en.short_title) : undefined,
      descriptionTR: tr.description ? String(tr.description) : undefined,
      descriptionEN: en.description ? String(en.description) : undefined,
      fullDescriptionTR: tr.full_description ? String(tr.full_description) : undefined,
      fullDescriptionEN: en.full_description ? String(en.full_description) : undefined,
      client: row.client_name ? String(row.client_name) : undefined,
      year: row.year ? Number(row.year) : undefined,
      poster: posterAsset?.publicUrl || `/videos/${row.slug}/poster.webp`,
      thumbnail: thumbAsset?.publicUrl,
      src: videoAsset?.publicUrl || `/videos/${row.slug}/video.mp4`,
      duration: row.duration ? String(row.duration) : undefined,
      aspectRatio: String(row.aspect_ratio || (orientation === "portrait" ? "9:16" : "16:9")),
      servicesTR: servicesTR.length > 0 ? servicesTR : undefined,
      servicesEN: servicesEN.length > 0 ? servicesEN : undefined,
      services: servicesTR.length > 0 ? servicesTR : undefined,
      tools: tools.length > 0 ? tools : undefined,
      tags: tags.length > 0 ? tags : undefined,
      autoplayPreview: row.autoplay_preview !== null ? Boolean(row.autoplay_preview) : true,
      externalUrl: row.external_url ? String(row.external_url) : undefined,
      projectSlug: row.project_slug ? String(row.project_slug) : undefined,
      featured: Boolean(row.featured),
      sortOrder: Number(row.sort_order || 0),
      cmsStatus: (row.status as CmsPublishStatus) || "draft",
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      publishedAt: row.published_at ? String(row.published_at) : null,
      archivedAt: row.archived_at ? String(row.archived_at) : null,
      assets
    };

    return record;
  });
}

export function listAllVideosForAdminFromD1(): CmsVideoRecord[] {
  assertLocalSimulationAllowed("listAllVideosForAdminFromD1");
  const db = getD1Database();
  const videoRows = db
    .prepare(`SELECT * FROM portfolio_videos ORDER BY sort_order ASC, id ASC`)
    .all();
  if (videoRows.length === 0) return [];

  const videoIds = videoRows.map((r) => String(r.id));
  const placeholders = videoIds.map(() => "?").join(",");

  const translationRows = db
    .prepare(`SELECT * FROM portfolio_video_translations WHERE video_id IN (${placeholders})`)
    .all(...videoIds);
  const assetRows = db
    .prepare(`SELECT * FROM portfolio_video_assets WHERE video_id IN (${placeholders})`)
    .all(...videoIds);

  return mapRowsToCmsVideos(videoRows, translationRows, assetRows);
}

export function listPublishedVideosFromD1(): CmsVideoRecord[] {
  assertLocalSimulationAllowed("listPublishedVideosFromD1");
  const db = getD1Database();
  const videoRows = db
    .prepare(
      `SELECT * FROM portfolio_videos WHERE status = 'published' ORDER BY sort_order ASC, id ASC`
    )
    .all();
  if (videoRows.length === 0) return [];

  const videoIds = videoRows.map((r) => String(r.id));
  const placeholders = videoIds.map(() => "?").join(",");

  const translationRows = db
    .prepare(`SELECT * FROM portfolio_video_translations WHERE video_id IN (${placeholders})`)
    .all(...videoIds);
  const assetRows = db
    .prepare(`SELECT * FROM portfolio_video_assets WHERE video_id IN (${placeholders})`)
    .all(...videoIds);

  return mapRowsToCmsVideos(videoRows, translationRows, assetRows);
}

export function getVideoByIdFromD1(id: string): CmsVideoRecord | null {
  assertLocalSimulationAllowed("getVideoByIdFromD1");
  const db = getD1Database();
  const row = db.prepare(`SELECT * FROM portfolio_videos WHERE id = ? LIMIT 1`).get(id);
  if (!row) return null;

  const translationRows = db
    .prepare(`SELECT * FROM portfolio_video_translations WHERE video_id = ?`)
    .all(id);
  const assetRows = db
    .prepare(`SELECT * FROM portfolio_video_assets WHERE video_id = ?`)
    .all(id);

  const mapped = mapRowsToCmsVideos([row], translationRows, assetRows);
  return mapped[0] || null;
}

export function getVideoBySlugFromD1(slug: string): CmsVideoRecord | null {
  assertLocalSimulationAllowed("getVideoBySlugFromD1");
  const db = getD1Database();
  const row = db.prepare(`SELECT * FROM portfolio_videos WHERE slug = ? LIMIT 1`).get(slug);
  if (!row) return null;

  const videoId = String(row.id);
  const translationRows = db
    .prepare(`SELECT * FROM portfolio_video_translations WHERE video_id = ?`)
    .all(videoId);
  const assetRows = db
    .prepare(`SELECT * FROM portfolio_video_assets WHERE video_id = ?`)
    .all(videoId);

  const mapped = mapRowsToCmsVideos([row], translationRows, assetRows);
  return mapped[0] || null;
}

export function upsertVideoInD1(
  input: UpsertVideoInput & { status?: string },
  actorEmail: string,
  actionLabel = "update"
): CmsVideoRecord {
  assertLocalSimulationAllowed("upsertVideoInD1");
  const db = getD1Database();
  const cleanSlug = normalizeSlug(input.slug || input.titleEN || input.titleTR);
  if (!cleanSlug) {
    throw new Error("Video slug is required.");
  }

  const existingById = input.id
    ? db.prepare(`SELECT * FROM portfolio_videos WHERE id = ?`).get(input.id)
    : undefined;
  const existingBySlug = db.prepare(`SELECT * FROM portfolio_videos WHERE slug = ?`).get(cleanSlug);

  if (actionLabel === "create") {
    if (existingById) {
      const err = new Error(`Video with ID "${input.id}" already exists.`) as Error & { statusCode: number; code: string };
      err.statusCode = 409;
      err.code = "CONFLICT";
      throw err;
    }
    if (existingBySlug) {
      const err = new Error(`Video with slug "${cleanSlug}" already exists.`) as Error & { statusCode: number; code: string };
      err.statusCode = 409;
      err.code = "CONFLICT";
      throw err;
    }
  } else {
    if (existingBySlug && existingById && String(existingBySlug.id) !== String(existingById.id)) {
      const err = new Error(`Slug "${cleanSlug}" is already in use by another video.`) as Error & { statusCode: number; code: string };
      err.statusCode = 409;
      err.code = "CONFLICT";
      throw err;
    }
    if (existingBySlug && !existingById) {
      const err = new Error(`Slug "${cleanSlug}" is already in use.`) as Error & { statusCode: number; code: string };
      err.statusCode = 409;
      err.code = "CONFLICT";
      throw err;
    }
    if (!existingById && !existingBySlug) {
      const err = new Error("Video not found.") as Error & { statusCode: number; code: string };
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
  }

  const existing = actionLabel === "create" ? null : (existingById || existingBySlug);
  const videoId = existing ? String(existing.id) : input.id || cleanSlug;
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
      !(input.descriptionTR?.trim() || input.fullDescriptionTR?.trim()) ||
      !(input.descriptionEN?.trim() || input.fullDescriptionEN?.trim())
    ) {
      throw new Error("Both Turkish and English descriptions are required before publishing.");
    }
    if (!input.poster?.trim() || !input.src?.trim()) {
      throw new Error("Both poster image and video source are required before publishing.");
    }
  }

  const maxSortRow = db
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) as maxSort FROM portfolio_videos`)
    .get();
  const sortOrder =
    input.sortOrder !== undefined
      ? Number(input.sortOrder)
      : existing
      ? Number(existing.sort_order || 0)
      : Number(maxSortRow?.maxSort || 0) + 1;

  const orientation = input.orientation || (existing?.orientation as VideoOrientation) || "portrait";
  const videoType = input.type || (existing?.video_type as VideoType) || "reel";
  const productionMethod = input.productionMethod || (existing?.production_method as ProductionMethod) || "traditional";
  const aiAssisted = input.aiAssisted !== undefined ? (input.aiAssisted ? 1 : 0) : existing ? Number(existing.ai_assisted) : 0;
  const clientName = input.client !== undefined ? input.client : existing?.client_name ? String(existing.client_name) : "";
  const year = input.year !== undefined ? Number(input.year) : existing?.year ? Number(existing.year) : 2026;
  const duration = input.duration !== undefined ? input.duration : existing?.duration ? String(existing.duration) : "";
  const aspectRatio = input.aspectRatio || (existing?.aspect_ratio ? String(existing.aspect_ratio) : orientation === "portrait" ? "9:16" : "16:9");
  const featured = input.featured !== undefined ? (input.featured ? 1 : 0) : existing ? Number(existing.featured) : 0;
  const autoplayPreview = input.autoplayPreview !== undefined ? (input.autoplayPreview ? 1 : 0) : existing ? Number(existing.autoplay_preview) : 1;
  const externalUrl = input.externalUrl !== undefined ? input.externalUrl : existing?.external_url ? String(existing.external_url) : null;
  const projectSlug = input.projectSlug !== undefined ? input.projectSlug : existing?.project_slug ? String(existing.project_slug) : null;
  const toolsJson = JSON.stringify(input.tools || (existing?.tools_json ? JSON.parse(String(existing.tools_json)) : []));
  const tagsJson = JSON.stringify(input.tags || (existing?.tags_json ? JSON.parse(String(existing.tags_json)) : []));

  const createdAt = existing ? String(existing.created_at) : now;
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
      ? existing?.archived_at
        ? String(existing.archived_at)
        : now
      : null;

  // Save revision snapshot before mutating if existing
  if (existing) {
    const prevFull = getVideoByIdFromD1(videoId);
    if (prevFull) {
      const maxRevRow = db
        .prepare(`SELECT COALESCE(MAX(revision_number), 0) as maxRev FROM portfolio_video_revisions WHERE video_id = ?`)
        .get(videoId);
      const nextRev = Number(maxRevRow?.maxRev || 0) + 1;
      db.prepare(
        `INSERT INTO portfolio_video_revisions (id, video_id, revision_number, action, snapshot_json, actor_email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `vrev-${crypto.randomUUID()}`,
        videoId,
        nextRev,
        actionLabel,
        JSON.stringify(prevFull),
        actorEmail,
        now
      );
    }
  }

  // Upsert portfolio_videos
  if (actionLabel === "create") {
    db.prepare(
      `INSERT INTO portfolio_videos (
        id, slug, status, orientation, video_type, production_method, ai_assisted,
        client_name, year, duration, aspect_ratio, featured, sort_order,
        autoplay_preview, external_url, project_slug, tools_json, tags_json,
        created_at, updated_at, published_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      videoId,
      cleanSlug,
      nextStatus,
      orientation,
      videoType,
      productionMethod,
      aiAssisted,
      clientName,
      year,
      duration,
      aspectRatio,
      featured,
      sortOrder,
      autoplayPreview,
      externalUrl,
      projectSlug,
      toolsJson,
      tagsJson,
      createdAt,
      now,
      publishedAt,
      archivedAt
    );
  } else {
    db.prepare(
      `UPDATE portfolio_videos SET
        slug = ?,
        status = ?,
        orientation = ?,
        video_type = ?,
        production_method = ?,
        ai_assisted = ?,
        client_name = ?,
        year = ?,
        duration = ?,
        aspect_ratio = ?,
        featured = ?,
        sort_order = ?,
        autoplay_preview = ?,
        external_url = ?,
        project_slug = ?,
        tools_json = ?,
        tags_json = ?,
        updated_at = ?,
        published_at = ?,
        archived_at = ?
      WHERE id = ?`
    ).run(
      cleanSlug,
      nextStatus,
      orientation,
      videoType,
      productionMethod,
      aiAssisted,
      clientName,
      year,
      duration,
      aspectRatio,
      featured,
      sortOrder,
      autoplayPreview,
      externalUrl,
      projectSlug,
      toolsJson,
      tagsJson,
      now,
      publishedAt,
      archivedAt,
      videoId
    );
  }

  // Upsert translations
  const servicesTRJson = JSON.stringify(input.servicesTR || input.services || []);
  const servicesENJson = JSON.stringify(input.servicesEN || input.services || []);

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
    `vtr-${videoId}-tr`,
    videoId,
    input.titleTR || "",
    input.shortTitleTR || "",
    input.descriptionTR || "",
    input.fullDescriptionTR || "",
    servicesTRJson,
    now
  );

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
    `vtr-${videoId}-en`,
    videoId,
    input.titleEN || "",
    input.shortTitleEN || "",
    input.descriptionEN || "",
    input.fullDescriptionEN || "",
    servicesENJson,
    now
  );

  // Upsert assets if provided
  if (input.poster) {
    const isLocal = input.poster.startsWith("/videos/");
    const storageMode = isLocal ? "local_static" : input.poster.startsWith("/api/media/") ? "r2" : "external";
    const storageKey = isLocal
      ? input.poster.replace(/^\//, "")
      : input.poster.replace(/^\/api\/media\//, "");

    db.prepare(
      `INSERT INTO portfolio_video_assets (
        id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, created_at, updated_at
      ) VALUES (?, ?, 'poster', ?, ?, ?, 'image/webp', 0, ?, ?)
      ON CONFLICT(video_id, asset_type) DO UPDATE SET
        storage_mode = excluded.storage_mode,
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        updated_at = excluded.updated_at`
    ).run(
      `vast-${videoId}-poster`,
      videoId,
      storageMode,
      storageKey,
      input.poster,
      now,
      now
    );
  }

  if (input.src) {
    const isLocal = input.src.startsWith("/videos/");
    const storageMode = isLocal ? "local_static" : input.src.startsWith("/api/media/") ? "r2" : "external";
    const storageKey = isLocal
      ? input.src.replace(/^\//, "")
      : input.src.replace(/^\/api\/media\//, "");

    db.prepare(
      `INSERT INTO portfolio_video_assets (
        id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, created_at, updated_at
      ) VALUES (?, ?, 'video', ?, ?, ?, 'video/mp4', 0, ?, ?)
      ON CONFLICT(video_id, asset_type) DO UPDATE SET
        storage_mode = excluded.storage_mode,
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        updated_at = excluded.updated_at`
    ).run(
      `vast-${videoId}-video`,
      videoId,
      storageMode,
      storageKey,
      input.src,
      now,
      now
    );
  }

  if (input.thumbnail) {
    const isLocal = input.thumbnail.startsWith("/videos/");
    const storageMode = isLocal ? "local_static" : input.thumbnail.startsWith("/api/media/") ? "r2" : "external";
    const storageKey = isLocal
      ? input.thumbnail.replace(/^\//, "")
      : input.thumbnail.replace(/^\/api\/media\//, "");

    db.prepare(
      `INSERT INTO portfolio_video_assets (
        id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, created_at, updated_at
      ) VALUES (?, ?, 'thumbnail', ?, ?, ?, 'image/webp', 0, ?, ?)
      ON CONFLICT(video_id, asset_type) DO UPDATE SET
        storage_mode = excluded.storage_mode,
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        updated_at = excluded.updated_at`
    ).run(
      `vast-${videoId}-thumb`,
      videoId,
      storageMode,
      storageKey,
      input.thumbnail,
      now,
      now
    );
  }

  // Audit log entry
  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, ?, 'portfolio_video', ?, ?, ?)`
  ).run(
    `audit-${crypto.randomUUID()}`,
    actorEmail,
    actionLabel === "create" ? "video_create" : `video_${actionLabel}`,
    videoId,
    JSON.stringify({ slug: cleanSlug, status: nextStatus, titleTR: input.titleTR }),
    now
  );

  const updated = getVideoByIdFromD1(videoId);
  if (!updated) {
    throw new Error(`Failed to retrieve video "${videoId}" after upsert.`);
  }
  return updated;
}

export function deleteVideoFromD1(id: string, actorEmail: string): { deletedId: string } {
  assertLocalSimulationAllowed("deleteVideoFromD1");
  const db = getD1Database();
  const existing = getVideoByIdFromD1(id);
  if (!existing) {
    throw new Error(`Video with id "${id}" not found.`);
  }

  const now = new Date().toISOString();
  db.prepare(`DELETE FROM portfolio_videos WHERE id = ?`).run(id);

  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, 'video_delete', 'portfolio_video', ?, ?, ?)`
  ).run(
    `audit-${crypto.randomUUID()}`,
    actorEmail,
    id,
    JSON.stringify({ slug: existing.slug, titleTR: existing.titleTR }),
    now
  );

  return { deletedId: id };
}

export function updateVideoOrderingInD1(
  orderings: { id: string; sortOrder: number }[],
  actorEmail: string
): { updatedCount: number } {
  assertLocalSimulationAllowed("updateVideoOrderingInD1");
  const db = getD1Database();
  const now = new Date().toISOString();
  let count = 0;

  for (const item of orderings) {
    const res = db
      .prepare(`UPDATE portfolio_videos SET sort_order = ?, updated_at = ? WHERE id = ?`)
      .run(Number(item.sortOrder), now, String(item.id));
    if (Number(res.changes) > 0) count++;
  }

  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, 'videos_reorder', 'portfolio_videos', 'bulk', ?, ?)`
  ).run(`audit-${crypto.randomUUID()}`, actorEmail, JSON.stringify({ updatedCount: count }), now);

  return { updatedCount: count };
}

export function listVideoRevisionsFromD1(videoId: string): CmsVideoRevisionRecord[] {
  assertLocalSimulationAllowed("listVideoRevisionsFromD1");
  const db = getD1Database();
  const rows = db
    .prepare(
      `SELECT * FROM portfolio_video_revisions WHERE video_id = ? ORDER BY revision_number DESC LIMIT 50`
    )
    .all(videoId);

  return rows.map((r) => ({
    id: String(r.id),
    videoId: String(r.video_id),
    revisionNumber: Number(r.revision_number),
    action: String(r.action),
    snapshotJson: String(r.snapshot_json),
    actorEmail: String(r.actor_email),
    createdAt: String(r.created_at)
  }));
}

export function rollbackVideoRevisionInD1(
  videoId: string,
  revisionNumber: number,
  actorEmail: string
): CmsVideoRecord {
  assertLocalSimulationAllowed("rollbackVideoRevisionInD1");
  const db = getD1Database();
  const row = db
    .prepare(
      `SELECT * FROM portfolio_video_revisions WHERE video_id = ? AND revision_number = ? LIMIT 1`
    )
    .get(videoId, revisionNumber);

  if (!row) {
    throw new Error(`Revision #${revisionNumber} for video "${videoId}" not found.`);
  }

  const snapshot = parseJsonSafe<CmsVideoRecord | null>(row.snapshot_json, null);
  if (!snapshot) {
    throw new Error(`Failed to parse snapshot for revision #${revisionNumber}.`);
  }

  return upsertVideoInD1(
    {
      ...snapshot,
      id: snapshot.id,
      slug: snapshot.slug,
      cmsStatus: snapshot.cmsStatus,
      poster: snapshot.poster,
      src: snapshot.src,
      thumbnail: snapshot.thumbnail
    },
    actorEmail,
    `rollback_rev_${revisionNumber}`
  );
}

export function seedCanonicalVideosInLocalD1(force = false): {
  insertedCount: number;
  skippedCount: number;
  totalVideos: number;
} {
  assertLocalSimulationAllowed("seedCanonicalVideosInLocalD1");
  const db = getD1Database();
  let insertedCount = 0;
  let skippedCount = 0;

  for (let idx = 0; idx < videosData.length; idx++) {
    const v = videosData[idx];
    const existing = db.prepare(`SELECT id FROM portfolio_videos WHERE id = ?`).get(v.id);

    if (existing && !force) {
      skippedCount++;
      continue;
    }

    upsertVideoInD1(
      {
        id: v.id,
        slug: v.slug,
        cmsStatus: "published",
        type: v.type,
        orientation: v.orientation || "portrait",
        aiAssisted: v.aiAssisted,
        productionMethod: v.productionMethod || "traditional",
        titleTR: v.titleTR,
        titleEN: v.titleEN,
        shortTitleTR: v.shortTitleTR,
        shortTitleEN: v.shortTitleEN,
        descriptionTR: v.descriptionTR,
        descriptionEN: v.descriptionEN,
        fullDescriptionTR: v.fullDescriptionTR,
        fullDescriptionEN: v.fullDescriptionEN,
        client: v.client,
        year: v.year,
        poster: v.poster,
        thumbnail: v.thumbnail,
        src: v.src || `/videos/${v.slug}/video.mp4`,
        duration: v.duration,
        aspectRatio: v.orientation === "landscape" ? "16:9" : "9:16",
        servicesTR: v.servicesTR,
        servicesEN: v.servicesEN,
        services: v.services,
        tools: v.tools,
        tags: v.tags,
        autoplayPreview: v.autoplayPreview,
        externalUrl: v.externalUrl,
        projectSlug: v.projectSlug,
        featured: v.featured,
        sortOrder: v.sortOrder || idx + 1
      },
      "system-seed@keremmihci.com",
      "canonical_seed"
    );
    insertedCount++;
  }

  return {
    insertedCount,
    skippedCount,
    totalVideos: videosData.length
  };
}

export function uploadVideoAssetToStorageAndD1(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  videoId?: string | null;
  videoSlug: string;
  assetType: "video" | "poster" | "thumbnail";
  actorEmail: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}): CmsVideoAssetRecord {
  assertLocalSimulationAllowed("uploadVideoAssetToStorageAndD1");

  const {
    buffer,
    filename,
    mimeType,
    videoId: initialVideoId = null,
    videoSlug,
    assetType,
    actorEmail,
    width = null,
    height = null,
    durationSeconds = null
  } = params;

  // Strict signature, format, and size validation
  const sigCheck = validateVideoAssetSignature(buffer, mimeType, filename, assetType);
  if (!sigCheck.valid) {
    throw new Error(sigCheck.error || "Invalid video asset.");
  }

  const cleanSlug = normalizeSlug(videoSlug) || "new-video";
  const ext =
    path.extname(filename).toLowerCase() ||
    (mimeType.startsWith("video/") ? ".mp4" : ".webp");
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const storageKey = `videos/${cleanSlug}/${assetType}-${Date.now()}-${randomSuffix}${ext}`;
  const publicUrl = `/api/media/${storageKey}`;

  // Write new file to local R2 simulation storage
  const r2Root = path.resolve(getLocalR2DirPath());
  const r2FilePath = path.resolve(r2Root, storageKey);
  if (!r2FilePath.startsWith(r2Root + path.sep)) {
    throw new Error("Invalid storage destination key.");
  }

  fs.mkdirSync(path.dirname(r2FilePath), { recursive: true });
  fs.writeFileSync(r2FilePath, buffer);

  const db = getD1Database();
  const now = new Date().toISOString();

  let targetVideoId = initialVideoId;

  try {
    // 1. Resolve or establish target video identity
    if (targetVideoId) {
      const existing = db
        .prepare(`SELECT id, slug FROM portfolio_videos WHERE id = ?`)
        .get(targetVideoId);
      if (!existing) {
        db.prepare(
          `INSERT INTO portfolio_videos (id, slug, status, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?)`
        ).run(targetVideoId, cleanSlug, now, now);
      }
    } else {
      const existingBySlug = db
        .prepare(`SELECT id FROM portfolio_videos WHERE slug = ?`)
        .get(cleanSlug);
      if (existingBySlug?.id) {
        targetVideoId = String(existingBySlug.id);
      } else {
        targetVideoId = `vid-${cleanSlug}`;
        db.prepare(
          `INSERT INTO portfolio_videos (id, slug, status, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?)`
        ).run(targetVideoId, cleanSlug, now, now);
      }
    }

    // 2. Check if an asset of this type already exists for replacement
    const existingAsset = db
      .prepare(`SELECT * FROM portfolio_video_assets WHERE video_id = ? AND asset_type = ?`)
      .get(targetVideoId, assetType) as Record<string, unknown> | undefined;

    // 3. Atomically upsert asset record
    const assetId = existingAsset?.id
      ? String(existingAsset.id)
      : `vast-${targetVideoId}-${assetType}`;
    db.prepare(
      `INSERT INTO portfolio_video_assets (
        id, video_id, asset_type, storage_mode, storage_key, public_url,
        mime_type, byte_size, width, height, duration_seconds, created_at, updated_at
      ) VALUES (?, ?, ?, 'r2', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(video_id, asset_type) DO UPDATE SET
        storage_mode = 'r2',
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        mime_type = excluded.mime_type,
        byte_size = excluded.byte_size,
        width = excluded.width,
        height = excluded.height,
        duration_seconds = excluded.duration_seconds,
        updated_at = excluded.updated_at`
    ).run(
      assetId,
      targetVideoId,
      assetType,
      storageKey,
      publicUrl,
      mimeType,
      buffer.byteLength,
      width,
      height,
      durationSeconds,
      existingAsset?.created_at ? String(existingAsset.created_at) : now,
      now
    );

    // 4. Update parent video updated_at timestamp
    db.prepare(`UPDATE portfolio_videos SET updated_at = ? WHERE id = ?`).run(now, targetVideoId);

    // 5. Audit log
    db.prepare(
      `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
       VALUES (?, ?, 'video_asset_upload', 'portfolio_video_assets', ?, ?, ?)`
    ).run(
      `audit-${crypto.randomUUID()}`,
      actorEmail,
      assetId,
      JSON.stringify({
        videoId: targetVideoId,
        assetType,
        storageKey,
        byteSize: buffer.byteLength
      }),
      now
    );

    // 6. Asset Retention Policy: Retain previous asset binary on disk / storage.
    // Historical asset binaries are required for point-in-time video revision rollback.
    // Immediate unlinking on replacement would destroy media integrity when restoring earlier snapshots.

    return {
      id: assetId,
      videoId: targetVideoId,
      assetType,
      storageMode: "r2",
      storageKey,
      publicUrl,
      mimeType,
      byteSize: buffer.byteLength,
      width,
      height,
      durationSeconds,
      createdAt: existingAsset?.created_at ? String(existingAsset.created_at) : now,
      updatedAt: now
    };
  } catch (err) {
    if (fs.existsSync(r2FilePath)) {
      try {
        fs.unlinkSync(r2FilePath);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

// ============================================================
// Personal Gallery Functions (Additive Phase 4)
// ============================================================

export function mapRowsToCmsGalleryItems(
  itemRows: Record<string, unknown>[],
  translationRows: Record<string, unknown>[],
  assetRows: Record<string, unknown>[]
): CmsGalleryItem[] {
  const translationsByItemId = new Map<string, { tr?: Record<string, unknown>; en?: Record<string, unknown> }>();
  for (const tr of translationRows) {
    const itemId = String(tr.item_id);
    const entry = translationsByItemId.get(itemId) || {};
    if (tr.locale === "tr") entry.tr = tr;
    if (tr.locale === "en") entry.en = tr;
    translationsByItemId.set(itemId, entry);
  }

  const assetsByItemId = new Map<string, CmsGalleryAssetRecord>();
  for (const ar of assetRows) {
    const itemId = String(ar.item_id);
    assetsByItemId.set(itemId, {
      id: String(ar.id),
      itemId,
      storageMode: (ar.storage_mode as "local_static" | "r2" | "external") || "local_static",
      storageKey: String(ar.storage_key || ""),
      publicUrl: String(ar.public_url || ""),
      mimeType: String(ar.mime_type || "image/webp"),
      byteSize: Number(ar.byte_size || 0),
      width: ar.width !== null && ar.width !== undefined ? Number(ar.width) : null,
      height: ar.height !== null && ar.height !== undefined ? Number(ar.height) : null,
      createdAt: String(ar.created_at || ""),
      updatedAt: String(ar.updated_at || "")
    });
  }

  return itemRows.map((r) => {
    const itemId = String(r.id);
    const trs = translationsByItemId.get(itemId) || {};
    const asset = assetsByItemId.get(itemId) || null;

    const altTR = trs.tr ? String(trs.tr.alt_text || "") : "";
    const altEN = trs.en ? String(trs.en.alt_text || "") : "";
    const captionTR = trs.tr && trs.tr.caption ? String(trs.tr.caption) : undefined;
    const captionEN = trs.en && trs.en.caption ? String(trs.en.caption) : undefined;

    const hasCaption = Boolean(captionTR || captionEN);

    const item: CmsGalleryItem = {
      id: itemId,
      cmsStatus: (r.status as CmsPublishStatus) || "draft",
      sortOrder: Number(r.sort_order ?? 0),
      src: asset?.publicUrl || "",
      alt: {
        tr: altTR,
        en: altEN
      },
      ...(hasCaption ? { caption: { tr: captionTR || "", en: captionEN || "" } } : {}),
      ...(r.year ? { year: String(r.year) } : {}),
      ...(r.location ? { location: String(r.location) } : {}),
      createdAt: String(r.created_at || ""),
      updatedAt: String(r.updated_at || ""),
      publishedAt: r.published_at ? String(r.published_at) : null,
      archivedAt: r.archived_at ? String(r.archived_at) : null,
      asset
    };

    return item;
  });
}

export function listAllGalleryItemsForAdminFromD1(): CmsGalleryItem[] {
  assertLocalSimulationAllowed("listAllGalleryItemsForAdminFromD1");
  const db = getD1Database();
  const itemRows = db
    .prepare(`SELECT * FROM portfolio_gallery_items ORDER BY sort_order ASC, id ASC`)
    .all();
  if (itemRows.length === 0) return [];

  const itemIds = itemRows.map((r) => String(r.id));
  const placeholders = itemIds.map(() => "?").join(",");

  const translationRows = db
    .prepare(`SELECT * FROM portfolio_gallery_translations WHERE item_id IN (${placeholders})`)
    .all(...itemIds);
  const assetRows = db
    .prepare(`SELECT * FROM portfolio_gallery_assets WHERE item_id IN (${placeholders})`)
    .all(...itemIds);

  return mapRowsToCmsGalleryItems(itemRows, translationRows, assetRows);
}

export function listPublishedGalleryItemsFromD1(): CmsGalleryItem[] {
  assertLocalSimulationAllowed("listPublishedGalleryItemsFromD1");
  const db = getD1Database();
  const itemRows = db
    .prepare(
      `SELECT * FROM portfolio_gallery_items WHERE status = 'published' ORDER BY sort_order ASC, id ASC`
    )
    .all();
  if (itemRows.length === 0) return [];

  const itemIds = itemRows.map((r) => String(r.id));
  const placeholders = itemIds.map(() => "?").join(",");

  const translationRows = db
    .prepare(`SELECT * FROM portfolio_gallery_translations WHERE item_id IN (${placeholders})`)
    .all(...itemIds);
  const assetRows = db
    .prepare(`SELECT * FROM portfolio_gallery_assets WHERE item_id IN (${placeholders})`)
    .all(...itemIds);

  return mapRowsToCmsGalleryItems(itemRows, translationRows, assetRows);
}

export function getGalleryItemByIdFromD1(id: string): CmsGalleryItem | null {
  assertLocalSimulationAllowed("getGalleryItemByIdFromD1");
  const db = getD1Database();
  const row = db.prepare(`SELECT * FROM portfolio_gallery_items WHERE id = ? LIMIT 1`).get(id);
  if (!row) return null;

  const translationRows = db
    .prepare(`SELECT * FROM portfolio_gallery_translations WHERE item_id = ?`)
    .all(id);
  const assetRows = db
    .prepare(`SELECT * FROM portfolio_gallery_assets WHERE item_id = ?`)
    .all(id);

  const mapped = mapRowsToCmsGalleryItems([row], translationRows, assetRows);
  return mapped[0] || null;
}

export function upsertGalleryItemInD1(
  input: UpsertGalleryItemInput & { status?: string },
  actorEmail: string,
  actionLabel = "update"
): CmsGalleryItem {
  assertLocalSimulationAllowed("upsertGalleryItemInD1");
  const db = getD1Database();

  const existingById = input.id
    ? db.prepare(`SELECT * FROM portfolio_gallery_items WHERE id = ?`).get(input.id)
    : undefined;

  if (actionLabel === "create") {
    if (existingById) {
      const err = new Error(`Gallery item with ID "${input.id}" already exists.`) as Error & { statusCode: number; code: string };
      err.statusCode = 409;
      err.code = "CONFLICT";
      throw err;
    }
  } else {
    if (!existingById) {
      const err = new Error("Gallery item not found.") as Error & { statusCode: number; code: string };
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
  }

  const itemId = existingById ? String(existingById.id) : (input.id || `gal-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`);
  const now = new Date().toISOString();

  const prevStatus = existingById ? (String(existingById.status) as CmsPublishStatus) : null;
  const rawRequestedStatus = input.cmsStatus || (input.status as CmsPublishStatus | undefined);
  const nextStatus: CmsPublishStatus =
    rawRequestedStatus && ["draft", "published", "archived"].includes(rawRequestedStatus)
      ? rawRequestedStatus
      : prevStatus || "draft";

  if (nextStatus === "published") {
    if (!input.altTR?.trim() || !input.altEN?.trim()) {
      throw new Error("Both Turkish and English alt text are required before publishing.");
    }
    // Must have a valid image source (either from asset or input.src)
    const existingAsset = db.prepare(`SELECT id, public_url FROM portfolio_gallery_assets WHERE item_id = ?`).get(itemId);
    if (!input.src?.trim() && !existingAsset && !input.asset?.publicUrl) {
      throw new Error("A valid image is required before publishing.");
    }
  }

  // Calculate default sort order if appending
  let finalSortOrder = typeof input.sortOrder === "number" ? input.sortOrder : (existingById ? Number(existingById.sort_order ?? 0) : 0);
  if (actionLabel === "create" && typeof input.sortOrder !== "number") {
    const maxOrderRow = db.prepare(`SELECT MAX(sort_order) as max_order FROM portfolio_gallery_items`).get() as { max_order: number | null } | undefined;
    finalSortOrder = typeof maxOrderRow?.max_order === "number" ? maxOrderRow.max_order + 1 : 0;
  }

  let publishedAt: string | null = existingById ? (existingById.published_at as string | null) : null;
  let archivedAt: string | null = existingById ? (existingById.archived_at as string | null) : null;

  if (nextStatus === "published" && prevStatus !== "published") {
    publishedAt = now;
    archivedAt = null;
  } else if (nextStatus === "archived") {
    archivedAt = now;
  } else if (nextStatus === "draft") {
    archivedAt = null;
  }

  // Atomically persist item and translations
  db.prepare(
    `INSERT INTO portfolio_gallery_items (
      id, status, sort_order, year, location, created_at, updated_at, published_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      sort_order = excluded.sort_order,
      year = excluded.year,
      location = excluded.location,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at,
      archived_at = excluded.archived_at`
  ).run(
    itemId,
    nextStatus,
    finalSortOrder,
    input.year || null,
    input.location || null,
    existingById ? String(existingById.created_at) : now,
    now,
    publishedAt,
    archivedAt
  );

  // Translations
  db.prepare(
    `INSERT INTO portfolio_gallery_translations (id, item_id, locale, alt_text, caption, updated_at)
     VALUES (?, ?, 'tr', ?, ?, ?)
     ON CONFLICT(item_id, locale) DO UPDATE SET
       alt_text = excluded.alt_text,
       caption = excluded.caption,
       updated_at = excluded.updated_at`
  ).run(
    `gtr-${itemId}-tr`,
    itemId,
    input.altTR || "",
    input.captionTR || "",
    now
  );

  db.prepare(
    `INSERT INTO portfolio_gallery_translations (id, item_id, locale, alt_text, caption, updated_at)
     VALUES (?, ?, 'en', ?, ?, ?)
     ON CONFLICT(item_id, locale) DO UPDATE SET
       alt_text = excluded.alt_text,
       caption = excluded.caption,
       updated_at = excluded.updated_at`
  ).run(
    `gtr-${itemId}-en`,
    itemId,
    input.altEN || "",
    input.captionEN || "",
    now
  );

  // If asset provided in input, upsert it
  if (input.asset && input.asset.storageKey) {
    db.prepare(
      `INSERT INTO portfolio_gallery_assets (
        id, item_id, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id) DO UPDATE SET
        storage_mode = excluded.storage_mode,
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        mime_type = excluded.mime_type,
        byte_size = excluded.byte_size,
        width = excluded.width,
        height = excluded.height,
        updated_at = excluded.updated_at`
    ).run(
      input.asset.id || `gast-${itemId}`,
      itemId,
      input.asset.storageMode || "r2",
      input.asset.storageKey,
      input.asset.publicUrl || `/api/media/${input.asset.storageKey}`,
      input.asset.mimeType || "image/webp",
      input.asset.byteSize || 0,
      input.asset.width ?? null,
      input.asset.height ?? null,
      now,
      now
    );
  }

  // Fetch updated item to record snapshot and revision
  const updatedItem = getGalleryItemByIdFromD1(itemId);
  if (!updatedItem) {
    throw new Error(`Failed to retrieve gallery item "${itemId}" after upsert.`);
  }

  // Revisions tracking
  const lastRevRow = db
    .prepare(`SELECT MAX(revision_number) as max_rev FROM portfolio_gallery_revisions WHERE item_id = ?`)
    .get(itemId) as { max_rev: number | null } | undefined;
  const nextRevNumber = (lastRevRow?.max_rev ?? 0) + 1;

  db.prepare(
    `INSERT INTO portfolio_gallery_revisions (id, item_id, revision_number, action, snapshot_json, actor_email, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `grev-${itemId}-${nextRevNumber}`,
    itemId,
    nextRevNumber,
    actionLabel,
    JSON.stringify(updatedItem),
    actorEmail,
    now
  );

  // Audit log
  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, ?, 'gallery_item', ?, ?, ?)`
  ).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    actionLabel,
    itemId,
    JSON.stringify({ status: nextStatus, sortOrder: finalSortOrder }),
    now
  );

  return updatedItem;
}

export function deleteGalleryItemFromD1(id: string, actorEmail: string): { deletedId: string } {
  assertLocalSimulationAllowed("deleteGalleryItemFromD1");
  const db = getD1Database();
  const existing = db.prepare(`SELECT id, status FROM portfolio_gallery_items WHERE id = ?`).get(id);
  if (!existing) {
    const err = new Error(`Gallery item "${id}" not found.`) as Error & { statusCode: number; code: string };
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const now = new Date().toISOString();
  db.prepare(`DELETE FROM portfolio_gallery_items WHERE id = ?`).run(id);

  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, 'delete', 'gallery_item', ?, ?, ?)`
  ).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    id,
    JSON.stringify({ deletedId: id }),
    now
  );

  return { deletedId: id };
}

export function updateGalleryOrderingInD1(
  items: Array<{ id: string; sortOrder: number }>,
  actorEmail: string
): { updated: number } {
  assertLocalSimulationAllowed("updateGalleryOrderingInD1");
  const db = getD1Database();
  const now = new Date().toISOString();

  let updatedCount = 0;
  for (const item of items) {
    const res = db
      .prepare(`UPDATE portfolio_gallery_items SET sort_order = ?, updated_at = ? WHERE id = ?`)
      .run(item.sortOrder, now, item.id);
    if (res.changes > 0) {
      updatedCount += 1;
    }
  }

  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, 'reorder', 'gallery_item', null, ?, ?)`
  ).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    JSON.stringify({ count: updatedCount }),
    now
  );

  return { updated: updatedCount };
}

export function listGalleryRevisionsFromD1(itemId: string): CmsGalleryRevisionRecord[] {
  assertLocalSimulationAllowed("listGalleryRevisionsFromD1");
  const db = getD1Database();
  const rows = db
    .prepare(
      `SELECT * FROM portfolio_gallery_revisions WHERE item_id = ? ORDER BY revision_number DESC`
    )
    .all(itemId);

  return rows.map((r) => ({
    id: String(r.id),
    itemId: String(r.item_id),
    revisionNumber: Number(r.revision_number),
    action: String(r.action),
    snapshotJson: String(r.snapshot_json),
    actorEmail: String(r.actor_email),
    createdAt: String(r.created_at)
  }));
}

export function rollbackGalleryRevisionInD1(
  itemId: string,
  revisionNumber: number,
  actorEmail: string
): CmsGalleryItem {
  assertLocalSimulationAllowed("rollbackGalleryRevisionInD1");
  const db = getD1Database();
  const revRow = db
    .prepare(
      `SELECT * FROM portfolio_gallery_revisions WHERE item_id = ? AND revision_number = ? LIMIT 1`
    )
    .get(itemId, revisionNumber) as Record<string, unknown> | undefined;

  if (!revRow) {
    const err = new Error(`Revision ${revisionNumber} for gallery item "${itemId}" not found.`) as Error & { statusCode: number; code: string };
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const snapshot: CmsGalleryItem = JSON.parse(String(revRow.snapshot_json));
  const restored = upsertGalleryItemInD1(
    {
      id: snapshot.id,
      cmsStatus: snapshot.cmsStatus,
      src: snapshot.src,
      altTR: snapshot.alt?.tr || "",
      altEN: snapshot.alt?.en || "",
      captionTR: snapshot.caption?.tr,
      captionEN: snapshot.caption?.en,
      year: snapshot.year,
      location: snapshot.location,
      sortOrder: snapshot.sortOrder,
      asset: snapshot.asset ? snapshot.asset : undefined
    },
    actorEmail,
    "rollback"
  );

  return restored;
}

export function uploadGalleryAssetToStorageAndD1(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  itemId?: string | null;
  actorEmail: string;
  width?: number | null;
  height?: number | null;
}): CmsGalleryAssetRecord {
  assertLocalSimulationAllowed("uploadGalleryAssetToStorageAndD1");

  const {
    buffer,
    filename,
    mimeType,
    itemId: initialItemId = null,
    actorEmail,
    width = null,
    height = null
  } = params;

  // Strict signature, format, and size validation
  const sigCheck = validateGalleryImageSignature(buffer, mimeType, filename);
  if (!sigCheck.valid) {
    throw new Error(sigCheck.error || "Invalid gallery image asset.");
  }

  const cleanItemId = initialItemId ? normalizeSlug(initialItemId) || "new-item" : `gal-${Date.now()}`;
  const ext =
    path.extname(filename).toLowerCase() ||
    (mimeType === "image/png" ? ".png" : mimeType === "image/jpeg" ? ".jpg" : ".webp");
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const storageKey = `gallery/${cleanItemId}/${Date.now()}-${randomSuffix}${ext}`;
  const publicUrl = `/api/media/${storageKey}`;

  // Write new file to local R2 simulation storage
  const r2Root = path.resolve(getLocalR2DirPath());
  const r2FilePath = path.resolve(r2Root, storageKey);
  if (!r2FilePath.startsWith(r2Root + path.sep)) {
    throw new Error("Invalid storage destination key.");
  }

  fs.mkdirSync(path.dirname(r2FilePath), { recursive: true });
  fs.writeFileSync(r2FilePath, buffer);

  const db = getD1Database();
  const now = new Date().toISOString();

  let targetItemId = initialItemId;

  try {
    // 1. Resolve or establish target gallery item identity
    if (targetItemId) {
      const existing = db
        .prepare(`SELECT id FROM portfolio_gallery_items WHERE id = ?`)
        .get(targetItemId);
      if (!existing) {
        db.prepare(
          `INSERT INTO portfolio_gallery_items (id, status, sort_order, created_at, updated_at) VALUES (?, 'draft', 0, ?, ?)`
        ).run(targetItemId, now, now);
      }
    } else {
      targetItemId = cleanItemId;
      db.prepare(
        `INSERT INTO portfolio_gallery_items (id, status, sort_order, created_at, updated_at) VALUES (?, 'draft', 0, ?, ?)`
      ).run(targetItemId, now, now);
    }

    // 2. Check if an asset already exists for replacement
    const existingAsset = db
      .prepare(`SELECT * FROM portfolio_gallery_assets WHERE item_id = ?`)
      .get(targetItemId) as Record<string, unknown> | undefined;

    // 3. Atomically upsert asset record
    const assetId = existingAsset?.id ? String(existingAsset.id) : `gast-${targetItemId}`;
    db.prepare(
      `INSERT INTO portfolio_gallery_assets (
        id, item_id, storage_mode, storage_key, public_url,
        mime_type, byte_size, width, height, created_at, updated_at
      ) VALUES (?, ?, 'r2', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id) DO UPDATE SET
        storage_mode = 'r2',
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        mime_type = excluded.mime_type,
        byte_size = excluded.byte_size,
        width = excluded.width,
        height = excluded.height,
        updated_at = excluded.updated_at`
    ).run(
      assetId,
      targetItemId,
      storageKey,
      publicUrl,
      mimeType,
      buffer.byteLength,
      width,
      height,
      now,
      now
    );

    // 4. Record audit log
    db.prepare(
      `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
       VALUES (?, ?, 'upload_asset', 'gallery_item', ?, ?, ?)`
    ).run(
      `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
      actorEmail,
      targetItemId,
      JSON.stringify({
        assetId,
        storageKey,
        byteSize: buffer.byteLength
      }),
      now
    );

    return {
      id: assetId,
      itemId: targetItemId,
      storageMode: "r2",
      storageKey,
      publicUrl,
      mimeType,
      byteSize: buffer.byteLength,
      width,
      height,
      createdAt: existingAsset?.created_at ? String(existingAsset.created_at) : now,
      updatedAt: now
    };
  } catch (err) {
    if (fs.existsSync(r2FilePath)) {
      try {
        fs.unlinkSync(r2FilePath);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}


