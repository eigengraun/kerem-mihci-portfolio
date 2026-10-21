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
  type CmsProfileRecord,
  type UpsertProfileInput,
  type CmsProfileRevisionRecord,
  type ProfileStat,
  type CmsWorkspaceNote,
  type UpsertWorkspaceNoteInput,
  type CmsWorkspaceNoteRevisionRecord,
  type CmsExperienceItem,
  type UpsertExperienceInput,
  type CmsExperienceRevisionRecord,
  type CmsEducationItem,
  type UpsertEducationInput,
  type CmsEducationRevisionRecord,
  type CmsSkillItem,
  type UpsertSkillInput,
  type CmsSkillCategory,
  type CmsCvDocument,
  type UpsertCvInput,
  type CmsCvRevisionRecord,
  type WorkspaceCategory,
  normalizeSlug,
  validateMediaFileSignature,
  validateVideoAssetSignature,
  validateGalleryImageSignature,
  validateCvPdfSignature
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
  asset_status TEXT NOT NULL DEFAULT 'active' CHECK (asset_status IN ('active', 'provisional', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_assets_lookup ON portfolio_gallery_assets(item_id, asset_status);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_assets_storage_key ON portfolio_gallery_assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_revisions_lookup ON portfolio_gallery_revisions(item_id, revision_number DESC);

-- Phase 5: Profile, Workspace Notes, Experience, Education, Skills & CV Schema (Additive)
CREATE TABLE IF NOT EXISTS portfolio_profile (
  id TEXT PRIMARY KEY DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  name TEXT NOT NULL DEFAULT 'Kerem Mıhçı',
  email TEXT NOT NULL DEFAULT 'info@keremmihci.com',
  image_url TEXT NOT NULL DEFAULT '/profile/kerem-mihci-profile.webp',
  avatar_url TEXT NOT NULL DEFAULT '/profile/kerem-mihci-avatar.webp',
  stats_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE TABLE IF NOT EXISTS portfolio_profile_translations (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES portfolio_profile(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('tr', 'en')),
  headline TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  summary_paragraphs_json TEXT NOT NULL DEFAULT '[]',
  focus_areas_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  UNIQUE(profile_id, locale)
);
CREATE TABLE IF NOT EXISTS portfolio_profile_revisions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES portfolio_profile(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_workspace_notes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL CHECK (workspace_id IN ('design', 'web', 'motion-ai')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  filename TEXT NOT NULL DEFAULT 'system.txt',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS portfolio_workspace_notes_translations (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES portfolio_workspace_notes(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('tr', 'en')),
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE(note_id, locale)
);
CREATE TABLE IF NOT EXISTS portfolio_workspace_notes_revisions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_experience (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  organization TEXT NOT NULL,
  start_date TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'work' CHECK (category IN ('work', 'freelance', 'ai', 'creative', 'volunteer')),
  skills_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS portfolio_experience_translations (
  id TEXT PRIMARY KEY,
  experience_id TEXT NOT NULL REFERENCES portfolio_experience(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('tr', 'en')),
  role TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  location TEXT,
  employment_type TEXT,
  description TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE(experience_id, locale)
);
CREATE TABLE IF NOT EXISTS portfolio_experience_revisions (
  id TEXT PRIMARY KEY,
  experience_id TEXT NOT NULL REFERENCES portfolio_experience(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_education (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  start_year TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS portfolio_education_translations (
  id TEXT PRIMARY KEY,
  education_id TEXT NOT NULL REFERENCES portfolio_education(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('tr', 'en')),
  institution TEXT NOT NULL DEFAULT '',
  program TEXT NOT NULL DEFAULT '',
  end_year TEXT NOT NULL DEFAULT '',
  status_label TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(education_id, locale)
);
CREATE TABLE IF NOT EXISTS portfolio_education_revisions (
  id TEXT PRIMARY KEY,
  education_id TEXT NOT NULL REFERENCES portfolio_education(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_skills (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('design', 'web', 'production', 'ai', 'strategy', 'tools')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS portfolio_skill_translations (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES portfolio_skills(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('tr', 'en')),
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(skill_id, locale)
);

CREATE TABLE IF NOT EXISTS portfolio_cv_documents (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL UNIQUE CHECK (locale IN ('tr', 'en')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  storage_mode TEXT NOT NULL DEFAULT 'local_static' CHECK (storage_mode IN ('local_static', 'r2', 'external')),
  storage_key TEXT NOT NULL DEFAULT '',
  public_url TEXT NOT NULL DEFAULT '',
  filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'application/pdf' CHECK (mime_type = 'application/pdf'),
  byte_size INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS portfolio_cv_revisions (
  id TEXT PRIMARY KEY,
  cv_id TEXT NOT NULL REFERENCES portfolio_cv_documents(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portfolio_workspace_notes_lookup ON portfolio_workspace_notes(workspace_id, status, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_workspace_notes_tr_lookup ON portfolio_workspace_notes_translations(note_id, locale);
CREATE INDEX IF NOT EXISTS idx_portfolio_workspace_notes_rev ON portfolio_workspace_notes_revisions(workspace_id, revision_number DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_experience_status_sort ON portfolio_experience(status, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_experience_tr_lookup ON portfolio_experience_translations(experience_id, locale);
CREATE INDEX IF NOT EXISTS idx_portfolio_experience_rev ON portfolio_experience_revisions(experience_id, revision_number DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_education_status_sort ON portfolio_education(status, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_education_tr_lookup ON portfolio_education_translations(education_id, locale);
CREATE INDEX IF NOT EXISTS idx_portfolio_education_rev ON portfolio_education_revisions(education_id, revision_number DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_skills_category_sort ON portfolio_skills(category, status, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_skill_tr_lookup ON portfolio_skill_translations(skill_id, locale);

CREATE INDEX IF NOT EXISTS idx_portfolio_cv_locale ON portfolio_cv_documents(locale, status);
CREATE INDEX IF NOT EXISTS idx_portfolio_cv_rev ON portfolio_cv_revisions(cv_id, revision_number DESC);
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

  // Non-destructive compatibility check for portfolio_gallery_assets (additive asset_status column and multi-asset per item support)
  try {
    const tableSqlRow = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='portfolio_gallery_assets'")
      .get() as { sql: string } | undefined;
    if (tableSqlRow?.sql && (tableSqlRow.sql.includes("UNIQUE(item_id)") || !tableSqlRow.sql.includes("asset_status"))) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS portfolio_gallery_assets_new (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL REFERENCES portfolio_gallery_items(id) ON DELETE CASCADE,
          storage_mode TEXT NOT NULL DEFAULT 'local_static' CHECK (storage_mode IN ('local_static', 'r2', 'external')),
          storage_key TEXT NOT NULL,
          public_url TEXT NOT NULL,
          mime_type TEXT NOT NULL DEFAULT 'image/webp' CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
          byte_size INTEGER NOT NULL DEFAULT 0,
          width INTEGER,
          height INTEGER,
          asset_status TEXT NOT NULL DEFAULT 'active' CHECK (asset_status IN ('active', 'provisional', 'archived')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO portfolio_gallery_assets_new (
          id, item_id, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, asset_status, created_at, updated_at
        )
        SELECT
          id, item_id, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, 'active', created_at, updated_at
        FROM portfolio_gallery_assets;
        DROP TABLE portfolio_gallery_assets;
        ALTER TABLE portfolio_gallery_assets_new RENAME TO portfolio_gallery_assets;
        CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_assets_lookup ON portfolio_gallery_assets(item_id, asset_status);
        CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_assets_storage_key ON portfolio_gallery_assets(storage_key);
        PRAGMA foreign_keys = ON;
      `);
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
         WHERE (pga.storage_key = ? OR pga.public_url = ?) AND (pga.asset_status = 'active' OR pga.asset_status IS NULL)
         LIMIT 1`
      )
      .get(storageKey, `/api/media/${storageKey}`) as { id: string; item_status: string } | undefined;

    if (galleryRow && galleryRow.item_status === "published") {
      return true;
    }
  } catch {
    // continue
  }

  // Check CV documents
  try {
    const cvRow = db
      .prepare(
        `SELECT id, status
         FROM portfolio_cv_documents
         WHERE (storage_key = ? OR public_url = ?)
         LIMIT 1`
      )
      .get(storageKey, `/api/media/${storageKey}`) as { id: string; status: string } | undefined;

    if (cvRow && cvRow.status === "published") {
      return true;
    }
  } catch {
    // continue
  }

  return false;
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

  const activeAssetsByItemId = new Map<string, CmsGalleryAssetRecord>();
  const provisionalAssetsByItemId = new Map<string, CmsGalleryAssetRecord>();

  for (const ar of assetRows) {
    const itemId = String(ar.item_id);
    const assetStatus = (ar.asset_status as "active" | "provisional" | "archived") || "active";
    const record: CmsGalleryAssetRecord = {
      id: String(ar.id),
      itemId,
      storageMode: (ar.storage_mode as "local_static" | "r2" | "external") || "local_static",
      storageKey: String(ar.storage_key || ""),
      publicUrl: String(ar.public_url || ""),
      mimeType: String(ar.mime_type || "image/webp"),
      byteSize: Number(ar.byte_size || 0),
      width: ar.width !== null && ar.width !== undefined ? Number(ar.width) : null,
      height: ar.height !== null && ar.height !== undefined ? Number(ar.height) : null,
      assetStatus,
      createdAt: String(ar.created_at || ""),
      updatedAt: String(ar.updated_at || "")
    };

    if (assetStatus === "active") {
      activeAssetsByItemId.set(itemId, record);
    } else if (assetStatus === "provisional") {
      provisionalAssetsByItemId.set(itemId, record);
    }
  }

  return itemRows.map((r) => {
    const itemId = String(r.id);
    const trs = translationsByItemId.get(itemId) || {};
    const activeAsset = activeAssetsByItemId.get(itemId) || null;
    const provisionalAsset = provisionalAssetsByItemId.get(itemId) || null;
    const effectiveAsset = activeAsset || provisionalAsset;

    const altTR = trs.tr ? String(trs.tr.alt_text || "") : "";
    const altEN = trs.en ? String(trs.en.alt_text || "") : "";
    const captionTR = trs.tr && trs.tr.caption ? String(trs.tr.caption) : undefined;
    const captionEN = trs.en && trs.en.caption ? String(trs.en.caption) : undefined;

    const hasCaption = Boolean(captionTR || captionEN);

    const item: CmsGalleryItem = {
      id: itemId,
      cmsStatus: (r.status as CmsPublishStatus) || "draft",
      sortOrder: Number(r.sort_order ?? 0),
      src: effectiveAsset?.publicUrl || "",
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
      asset: activeAsset,
      provisionalAsset
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
    .prepare(
      `SELECT * FROM portfolio_gallery_assets WHERE item_id IN (${placeholders}) AND (asset_status = 'active' OR asset_status IS NULL)`
    )
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
    ? (db.prepare(`SELECT * FROM portfolio_gallery_items WHERE id = ?`).get(input.id) as Record<string, unknown> | undefined)
    : undefined;

  if (actionLabel === "create") {
    if (existingById) {
      const err = new Error(`Gallery item with ID "${input.id}" already exists.`) as Error & { statusCode: number; code: string };
      err.statusCode = 409;
      err.code = "CONFLICT";
      throw err;
    }
  } else if (actionLabel !== "rollback") {
    if (!existingById) {
      const err = new Error("Gallery item not found.") as Error & { statusCode: number; code: string };
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
  }

  const itemId = existingById ? String(existingById.id) : (input.id || `gal-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`);
  const now = new Date().toISOString();

  // Strict Media Ownership Verification
  if (input.asset && input.asset.storageKey) {
    const sKey = input.asset.storageKey;
    // Reject if key is in project media
    const inProj = db.prepare("SELECT id FROM project_media WHERE storage_key = ? LIMIT 1").get(sKey);
    if (inProj) {
      const err = new Error("Unauthorized asset association: storage key belongs to project media.") as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }
    // Reject if key is in video assets
    const inVid = db.prepare("SELECT id FROM portfolio_video_assets WHERE storage_key = ? LIMIT 1").get(sKey);
    if (inVid) {
      const err = new Error("Unauthorized asset association: storage key belongs to video media.") as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }
    // Reject if owned by another gallery item
    const otherGal = db.prepare("SELECT id FROM portfolio_gallery_assets WHERE storage_key = ? AND item_id != ? LIMIT 1").get(sKey, itemId);
    if (otherGal) {
      const err = new Error("Unauthorized asset association: storage key is owned by another gallery item.") as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }
  }

  const prevStatus = existingById ? (String(existingById.status) as CmsPublishStatus) : null;
  const rawRequestedStatus = input.cmsStatus || (input.status as CmsPublishStatus | undefined);
  const nextStatus: CmsPublishStatus =
    rawRequestedStatus && ["draft", "published", "archived"].includes(rawRequestedStatus)
      ? rawRequestedStatus
      : prevStatus || "draft";

  // Preserve existing metadata on partial PATCH updates
  const existingTranslations = existingById
    ? (db.prepare(`SELECT locale, alt_text, caption FROM portfolio_gallery_translations WHERE item_id = ?`).all(itemId) as Array<{ locale: string; alt_text: string; caption: string }>)
    : [];
  const exTR = existingTranslations.find((t) => t.locale === "tr");
  const exEN = existingTranslations.find((t) => t.locale === "en");

  const finalAltTR = input.altTR !== undefined ? input.altTR : (exTR?.alt_text ?? "");
  const finalAltEN = input.altEN !== undefined ? input.altEN : (exEN?.alt_text ?? "");
  const finalCaptionTR = input.captionTR !== undefined ? input.captionTR : (exTR?.caption ?? "");
  const finalCaptionEN = input.captionEN !== undefined ? input.captionEN : (exEN?.caption ?? "");
  const finalYear = input.year !== undefined ? (input.year || null) : (existingById?.year ? String(existingById.year) : null);
  const finalLocation = input.location !== undefined ? (input.location || null) : (existingById?.location ? String(existingById.location) : null);

  // Validate MERGED state before publishing
  if (nextStatus === "published") {
    if (!finalAltTR.trim() || !finalAltEN.trim()) {
      const err = new Error("Both Turkish and English alt text are required before publishing.") as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    const activeAsset = db
      .prepare(`SELECT id, public_url FROM portfolio_gallery_assets WHERE item_id = ? AND (asset_status = 'active' OR asset_status IS NULL) LIMIT 1`)
      .get(itemId);
    const provAsset = db
      .prepare(`SELECT id, public_url FROM portfolio_gallery_assets WHERE item_id = ? AND asset_status = 'provisional' LIMIT 1`)
      .get(itemId);
    if (!input.src?.trim() && !activeAsset && !provAsset && !input.asset?.publicUrl) {
      const err = new Error("A valid image is required before publishing.") as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
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
    finalYear,
    finalLocation,
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
    finalAltTR,
    finalCaptionTR,
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
    finalAltEN,
    finalCaptionEN,
    now
  );

  // Promote provisional asset if publishing or explicitly requested
  if (nextStatus === "published" || input.promoteProvisionalAsset) {
    const provRow = db
      .prepare(`SELECT * FROM portfolio_gallery_assets WHERE item_id = ? AND asset_status = 'provisional' LIMIT 1`)
      .get(itemId) as { id: string } | undefined;
    if (provRow) {
      db.prepare(`UPDATE portfolio_gallery_assets SET asset_status = 'archived', updated_at = ? WHERE item_id = ? AND asset_status = 'active'`).run(now, itemId);
      db.prepare(`UPDATE portfolio_gallery_assets SET asset_status = 'active', updated_at = ? WHERE id = ?`).run(now, provRow.id);
    }
  }

  // If asset provided in input, persist it as active
  if (input.asset && input.asset.storageKey) {
    db.prepare(`UPDATE portfolio_gallery_assets SET asset_status = 'archived', updated_at = ? WHERE item_id = ? AND asset_status = 'active'`).run(now, itemId);

    const assetId = input.asset.id || `gast-${itemId}-${Date.now()}`;
    db.prepare(
      `INSERT INTO portfolio_gallery_assets (
        id, item_id, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, asset_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        storage_mode = excluded.storage_mode,
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        mime_type = excluded.mime_type,
        byte_size = excluded.byte_size,
        width = excluded.width,
        height = excluded.height,
        asset_status = 'active',
        updated_at = excluded.updated_at`
    ).run(
      assetId,
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
  } else if (input.src && !input.asset) {
    // Check if we have an active asset or external source
    const existingActive = db.prepare(`SELECT id FROM portfolio_gallery_assets WHERE item_id = ? AND asset_status = 'active' LIMIT 1`).get(itemId);
    if (!existingActive) {
      const assetId = `gast-${itemId}-${Date.now()}`;
      db.prepare(
        `INSERT INTO portfolio_gallery_assets (
          id, item_id, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, asset_status, created_at, updated_at
        ) VALUES (?, ?, 'external', ?, ?, 'image/webp', 0, null, null, 'active', ?, ?)`
      ).run(
        assetId,
        itemId,
        input.src,
        input.src,
        now,
        now
      );
    }
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

  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("Invalid reorder request: items array must be non-empty.") as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const seenIds = new Set<string>();
  for (const item of items) {
    if (!item.id || typeof item.id !== "string") {
      const err = new Error("Invalid reorder request: each item must have a valid string ID.") as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    if (typeof item.sortOrder !== "number" || !Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
      const err = new Error(`Invalid reorder request: sortOrder for item "${item.id}" must be a non-negative integer.`) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    if (seenIds.has(item.id)) {
      const err = new Error(`Invalid reorder request: duplicate item ID "${item.id}".`) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    seenIds.add(item.id);
  }

  const db = getD1Database();
  const placeholders = items.map(() => "?").join(",");
  const existingRows = db
    .prepare(`SELECT id FROM portfolio_gallery_items WHERE id IN (${placeholders})`)
    .all(...items.map((i) => i.id)) as Array<{ id: string }>;

  if (existingRows.length !== items.length) {
    const existingIdSet = new Set(existingRows.map((r) => r.id));
    const missing = items.filter((i) => !existingIdSet.has(i.id)).map((i) => i.id);
    const err = new Error(`Invalid reorder request: unknown item ID(s): ${missing.join(", ")}`) as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();

  // Atomically apply updates in an explicit SQLite transaction
  db.exec("BEGIN TRANSACTION;");
  try {
    for (const item of items) {
      db.prepare(`UPDATE portfolio_gallery_items SET sort_order = ?, updated_at = ? WHERE id = ?`).run(
        item.sortOrder,
        now,
        item.id
      );
    }

    db.prepare(
      `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
       VALUES (?, ?, 'reorder', 'gallery_item', null, ?, ?)`
    ).run(
      `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
      actorEmail,
      JSON.stringify({ count: items.length }),
      now
    );
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }

  return { updated: items.length };
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
  const now = new Date().toISOString();

  // Preserve the current item's sortOrder if it exists, so stream ordering is not clobbered by historical revision
  const currentRow = db
    .prepare(`SELECT sort_order FROM portfolio_gallery_items WHERE id = ? LIMIT 1`)
    .get(itemId) as { sort_order?: number } | undefined;
  const targetSortOrder = typeof currentRow?.sort_order === "number" ? currentRow.sort_order : snapshot.sortOrder;

  // If snapshot had an asset, re-promote that exact asset to active without deleting historical bytes
  if (snapshot.asset?.storageKey) {
    const matchRow = db
      .prepare(`SELECT id FROM portfolio_gallery_assets WHERE item_id = ? AND storage_key = ? LIMIT 1`)
      .get(itemId, snapshot.asset.storageKey) as { id: string } | undefined;

    if (matchRow) {
      db.prepare(`UPDATE portfolio_gallery_assets SET asset_status = 'archived', updated_at = ? WHERE item_id = ? AND asset_status = 'active'`).run(now, itemId);
      db.prepare(`UPDATE portfolio_gallery_assets SET asset_status = 'active', updated_at = ? WHERE id = ?`).run(now, matchRow.id);
    }
  }

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
      sortOrder: targetSortOrder,
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

  // Strict signature, format, EXIF GPS privacy, and size validation
  const sigCheck = validateGalleryImageSignature(buffer, mimeType, filename);
  if (!sigCheck.valid) {
    const isExceeds = sigCheck.error && sigCheck.error.includes("exceeds");
    const err = new Error(sigCheck.error || "Invalid gallery image asset.") as Error & { statusCode: number };
    err.statusCode = isExceeds ? 413 : 400;
    throw err;
  }

  const resolvedWidth = width ?? sigCheck.width ?? null;
  const resolvedHeight = height ?? sigCheck.height ?? null;

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
  let itemStatus = "draft";

  try {
    if (targetItemId) {
      const existing = db
        .prepare(`SELECT id, status FROM portfolio_gallery_items WHERE id = ?`)
        .get(targetItemId) as { id: string; status: string } | undefined;
      if (existing) {
        itemStatus = existing.status;
      } else {
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

    // Safe provisional vs active determination
    // If published: replacement is PROVISIONAL (pending explicit publish)
    // If draft: replacement is ACTIVE for the draft item
    const isPublished = itemStatus === "published";
    const assetStatus = isPublished ? "provisional" : "active";
    const assetId = `gast-${targetItemId}-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;

    if (!isPublished) {
      db.prepare(
        `UPDATE portfolio_gallery_assets SET asset_status = 'archived', updated_at = ? WHERE item_id = ? AND asset_status = 'active'`
      ).run(now, targetItemId);
    } else {
      db.prepare(
        `UPDATE portfolio_gallery_assets SET asset_status = 'archived', updated_at = ? WHERE item_id = ? AND asset_status = 'provisional'`
      ).run(now, targetItemId);
    }

    db.prepare(
      `INSERT INTO portfolio_gallery_assets (
        id, item_id, storage_mode, storage_key, public_url,
        mime_type, byte_size, width, height, asset_status, created_at, updated_at
      ) VALUES (?, ?, 'r2', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      assetId,
      targetItemId,
      storageKey,
      publicUrl,
      mimeType,
      buffer.byteLength,
      resolvedWidth,
      resolvedHeight,
      assetStatus,
      now,
      now
    );

    // Record audit log
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
        assetStatus,
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
      width: resolvedWidth,
      height: resolvedHeight,
      assetStatus,
      createdAt: now,
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
// PHASE 5: PROFILE, WORKSPACE NOTES, EXPERIENCE, EDUCATION, SKILLS & CV ENGINE
// ============================================================

// --- 1. PROFILE & ABOUT ---

export function getProfileFromD1(): CmsProfileRecord | null {
  assertLocalSimulationAllowed("getProfileFromD1");
  const db = getD1Database();
  const row = db.prepare("SELECT * FROM portfolio_profile WHERE id = 'main'").get() as Record<string, unknown> | undefined;
  if (!row) return null;

  const transRows = db.prepare("SELECT * FROM portfolio_profile_translations WHERE profile_id = 'main'").all() as Record<string, unknown>[];
  const trTrans = transRows.find((r) => r.locale === "tr");
  const enTrans = transRows.find((r) => r.locale === "en");

  let stats: ProfileStat[] = [];
  try {
    stats = JSON.parse(String(row.stats_json || "[]"));
  } catch {
    stats = [];
  }

  let trSummary: string[] = [];
  let enSummary: string[] = [];
  try {
    trSummary = JSON.parse(String(trTrans?.summary_paragraphs_json || "[]"));
  } catch {
    trSummary = [];
  }
  try {
    enSummary = JSON.parse(String(enTrans?.summary_paragraphs_json || "[]"));
  } catch {
    enSummary = [];
  }

  let trFocus: string[] = [];
  let enFocus: string[] = [];
  try {
    trFocus = JSON.parse(String(trTrans?.focus_areas_json || "[]"));
  } catch {
    trFocus = [];
  }
  try {
    enFocus = JSON.parse(String(enTrans?.focus_areas_json || "[]"));
  } catch {
    enFocus = [];
  }

  return {
    id: String(row.id),
    status: (row.status === "draft" ? "draft" : "published") as "draft" | "published",
    name: String(row.name || "Kerem Mıhçı"),
    email: String(row.email || "info@keremmihci.com"),
    image: String(row.image_url || "/profile/kerem-mihci-profile.webp"),
    avatar: String(row.avatar_url || "/profile/kerem-mihci-avatar.webp"),
    headline: {
      tr: String(trTrans?.headline || ""),
      en: String(enTrans?.headline || "")
    },
    location: {
      tr: String(trTrans?.location || ""),
      en: String(enTrans?.location || "")
    },
    alt: {
      tr: String(trTrans?.image_alt || ""),
      en: String(enTrans?.image_alt || "")
    },
    summary: {
      tr: trSummary,
      en: enSummary
    },
    stats,
    focusAreas: {
      tr: trFocus,
      en: enFocus
    },
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: row.published_at ? String(row.published_at) : null
  };
}

export function upsertProfileInD1(input: UpsertProfileInput, actorEmail: string): CmsProfileRecord {
  assertLocalSimulationAllowed("upsertProfileInD1");
  const db = getD1Database();
  const existing = getProfileFromD1();
  const now = new Date().toISOString();

  const name = input.name !== undefined ? input.name : (existing?.name || "Kerem Mıhçı");
  const email = input.email !== undefined ? input.email : (existing?.email || "info@keremmihci.com");
  const image = input.image !== undefined ? input.image : (existing?.image || "/profile/kerem-mihci-profile.webp");
  const avatar = input.avatar !== undefined ? input.avatar : (existing?.avatar || "/profile/kerem-mihci-avatar.webp");
  const status = input.status !== undefined ? input.status : (existing?.status || "published");
  const stats = input.stats !== undefined ? input.stats : (existing?.stats || []);

  const publishedAt = status === "published" ? (existing?.publishedAt || now) : null;

  db.prepare(`
    INSERT INTO portfolio_profile (id, status, name, email, image_url, avatar_url, stats_json, created_at, updated_at, published_at)
    VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      name = excluded.name,
      email = excluded.email,
      image_url = excluded.image_url,
      avatar_url = excluded.avatar_url,
      stats_json = excluded.stats_json,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at
  `).run(
    status,
    name,
    email,
    image,
    avatar,
    JSON.stringify(stats),
    existing ? existing.createdAt : now,
    now,
    publishedAt
  );

  // Translations
  const trHeadline = input.headlineTR !== undefined ? input.headlineTR : (existing?.headline.tr || "");
  const enHeadline = input.headlineEN !== undefined ? input.headlineEN : (existing?.headline.en || "");
  const trLocation = input.locationTR !== undefined ? input.locationTR : (existing?.location.tr || "");
  const enLocation = input.locationEN !== undefined ? input.locationEN : (existing?.location.en || "");
  const trAlt = input.altTR !== undefined ? input.altTR : (existing?.alt.tr || "");
  const enAlt = input.altEN !== undefined ? input.altEN : (existing?.alt.en || "");
  const trSummary = input.summaryTR !== undefined ? input.summaryTR : (existing?.summary.tr || []);
  const enSummary = input.summaryEN !== undefined ? input.summaryEN : (existing?.summary.en || []);
  const trFocus = input.focusAreasTR !== undefined ? input.focusAreasTR : (existing?.focusAreas.tr || []);
  const enFocus = input.focusAreasEN !== undefined ? input.focusAreasEN : (existing?.focusAreas.en || []);

  // TR translation
  db.prepare(`
    INSERT INTO portfolio_profile_translations (id, profile_id, locale, headline, location, image_alt, summary_paragraphs_json, focus_areas_json, updated_at)
    VALUES ('prof-tr', 'main', 'tr', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, locale) DO UPDATE SET
      headline = excluded.headline,
      location = excluded.location,
      image_alt = excluded.image_alt,
      summary_paragraphs_json = excluded.summary_paragraphs_json,
      focus_areas_json = excluded.focus_areas_json,
      updated_at = excluded.updated_at
  `).run(
    trHeadline,
    trLocation,
    trAlt,
    JSON.stringify(trSummary),
    JSON.stringify(trFocus),
    now
  );

  // EN translation
  db.prepare(`
    INSERT INTO portfolio_profile_translations (id, profile_id, locale, headline, location, image_alt, summary_paragraphs_json, focus_areas_json, updated_at)
    VALUES ('prof-en', 'main', 'en', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, locale) DO UPDATE SET
      headline = excluded.headline,
      location = excluded.location,
      image_alt = excluded.image_alt,
      summary_paragraphs_json = excluded.summary_paragraphs_json,
      focus_areas_json = excluded.focus_areas_json,
      updated_at = excluded.updated_at
  `).run(
    enHeadline,
    enLocation,
    enAlt,
    JSON.stringify(enSummary),
    JSON.stringify(enFocus),
    now
  );

  const updated = getProfileFromD1()!;

  // Revision tracking
  const revRow = db.prepare("SELECT MAX(revision_number) as max_rev FROM portfolio_profile_revisions WHERE profile_id = 'main'").get() as { max_rev: number | null } | undefined;
  const nextRev = (revRow?.max_rev ?? 0) + 1;
  db.prepare(`
    INSERT INTO portfolio_profile_revisions (id, profile_id, revision_number, action, snapshot_json, actor_email, created_at)
    VALUES (?, 'main', ?, 'update_profile', ?, ?, ?)
  `).run(
    `prev-main-${Date.now()}-${nextRev}`,
    nextRev,
    JSON.stringify(updated),
    actorEmail,
    now
  );

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'update_profile', 'profile', 'main', ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    JSON.stringify({ status, name }),
    now
  );

  return updated;
}

export function listProfileRevisionsFromD1(): CmsProfileRevisionRecord[] {
  assertLocalSimulationAllowed("listProfileRevisionsFromD1");
  const db = getD1Database();
  const rows = db.prepare("SELECT * FROM portfolio_profile_revisions WHERE profile_id = 'main' ORDER BY revision_number DESC").all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    profileId: String(r.profile_id),
    revisionNumber: Number(r.revision_number),
    action: String(r.action),
    snapshotJson: String(r.snapshot_json),
    actorEmail: String(r.actor_email),
    createdAt: String(r.created_at)
  }));
}

export function rollbackProfileRevisionInD1(revisionNumber: number, actorEmail: string): CmsProfileRecord {
  assertLocalSimulationAllowed("rollbackProfileRevisionInD1");
  const db = getD1Database();
  const rev = db.prepare("SELECT snapshot_json FROM portfolio_profile_revisions WHERE profile_id = 'main' AND revision_number = ? LIMIT 1").get(revisionNumber) as { snapshot_json: string } | undefined;
  if (!rev) {
    throw new Error(`Profile revision #${revisionNumber} not found.`);
  }

  const snapshot = JSON.parse(rev.snapshot_json) as CmsProfileRecord;
  return upsertProfileInD1({
    name: snapshot.name,
    email: snapshot.email,
    image: snapshot.image,
    avatar: snapshot.avatar,
    status: snapshot.status,
    stats: snapshot.stats,
    headlineTR: snapshot.headline.tr,
    headlineEN: snapshot.headline.en,
    locationTR: snapshot.location.tr,
    locationEN: snapshot.location.en,
    altTR: snapshot.alt.tr,
    altEN: snapshot.alt.en,
    summaryTR: snapshot.summary.tr,
    summaryEN: snapshot.summary.en,
    focusAreasTR: snapshot.focusAreas.tr,
    focusAreasEN: snapshot.focusAreas.en
  }, actorEmail);
}

// --- 2. WORKSPACE NOTES ---

function mapNoteRowsToCmsWorkspaceNotes(
  noteRows: Record<string, unknown>[],
  transRows: Record<string, unknown>[]
): CmsWorkspaceNote[] {
  const transByNoteId = new Map<string, { tr?: Record<string, unknown>; en?: Record<string, unknown> }>();
  for (const t of transRows) {
    const noteId = String(t.note_id);
    let entry = transByNoteId.get(noteId);
    if (!entry) {
      entry = {};
      transByNoteId.set(noteId, entry);
    }
    if (t.locale === "tr") entry.tr = t;
    if (t.locale === "en") entry.en = t;
  }

  return noteRows.map((r) => {
    const id = String(r.id);
    const trans = transByNoteId.get(id);
    return {
      id,
      workspaceId: String(r.workspace_id) as WorkspaceCategory,
      status: String(r.status) as CmsPublishStatus,
      sortOrder: Number(r.sort_order || 0),
      filename: String(r.filename || "system.txt"),
      title: {
        tr: String(trans?.tr?.title || ""),
        en: String(trans?.en?.title || "")
      },
      content: {
        tr: String(trans?.tr?.content || ""),
        en: String(trans?.en?.content || "")
      },
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      publishedAt: r.published_at ? String(r.published_at) : null,
      archivedAt: r.archived_at ? String(r.archived_at) : null
    };
  });
}

export function listWorkspaceNotesForAdminFromD1(workspaceId?: WorkspaceCategory): CmsWorkspaceNote[] {
  assertLocalSimulationAllowed("listWorkspaceNotesForAdminFromD1");
  const db = getD1Database();
  const notesQuery = workspaceId
    ? db.prepare("SELECT * FROM portfolio_workspace_notes WHERE workspace_id = ? ORDER BY sort_order ASC, id ASC").all(workspaceId)
    : db.prepare("SELECT * FROM portfolio_workspace_notes ORDER BY workspace_id ASC, sort_order ASC, id ASC").all();

  const transQuery = db.prepare("SELECT * FROM portfolio_workspace_notes_translations").all();
  return mapNoteRowsToCmsWorkspaceNotes(notesQuery, transQuery);
}

export function listPublishedWorkspaceNotesFromD1(workspaceId: WorkspaceCategory): CmsWorkspaceNote[] {
  assertLocalSimulationAllowed("listPublishedWorkspaceNotesFromD1");
  const db = getD1Database();
  const notesQuery = db.prepare(
    "SELECT * FROM portfolio_workspace_notes WHERE workspace_id = ? AND status = 'published' ORDER BY sort_order ASC, id ASC"
  ).all(workspaceId);

  const transQuery = db.prepare("SELECT * FROM portfolio_workspace_notes_translations").all();
  return mapNoteRowsToCmsWorkspaceNotes(notesQuery, transQuery);
}

export function getWorkspaceNoteByIdFromD1(id: string): CmsWorkspaceNote | null {
  assertLocalSimulationAllowed("getWorkspaceNoteByIdFromD1");
  const db = getD1Database();
  const noteRow = db.prepare("SELECT * FROM portfolio_workspace_notes WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!noteRow) return null;

  const transRows = db.prepare("SELECT * FROM portfolio_workspace_notes_translations WHERE note_id = ?").all(id) as Record<string, unknown>[];
  return mapNoteRowsToCmsWorkspaceNotes([noteRow], transRows)[0] || null;
}

export function upsertWorkspaceNoteInD1(
  input: UpsertWorkspaceNoteInput,
  actorEmail: string
): CmsWorkspaceNote {
  assertLocalSimulationAllowed("upsertWorkspaceNoteInD1");
  const db = getD1Database();
  const now = new Date().toISOString();
  const noteId = input.id || `note-${input.workspaceId}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const existing = getWorkspaceNoteByIdFromD1(noteId);

  const status = input.status || (existing?.status || "draft");
  const sortOrder = input.sortOrder !== undefined ? input.sortOrder : (existing?.sortOrder ?? 0);
  const filename = input.filename || (existing?.filename || "system.txt");

  const publishedAt = status === "published" ? (existing?.publishedAt || now) : null;
  const archivedAt = status === "archived" ? (existing?.archivedAt || now) : null;

  db.prepare(`
    INSERT INTO portfolio_workspace_notes (id, workspace_id, status, sort_order, filename, created_at, updated_at, published_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      workspace_id = excluded.workspace_id,
      status = excluded.status,
      sort_order = excluded.sort_order,
      filename = excluded.filename,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at,
      archived_at = excluded.archived_at
  `).run(
    noteId,
    input.workspaceId,
    status,
    sortOrder,
    filename,
    existing ? existing.createdAt : now,
    now,
    publishedAt,
    archivedAt
  );

  // Translations
  const trTitle = input.titleTR !== undefined ? input.titleTR : (existing?.title.tr || "");
  const enTitle = input.titleEN !== undefined ? input.titleEN : (existing?.title.en || "");
  const trContent = input.contentTR !== undefined ? input.contentTR : (existing?.content.tr || "");
  const enContent = input.contentEN !== undefined ? input.contentEN : (existing?.content.en || "");

  db.prepare(`
    INSERT INTO portfolio_workspace_notes_translations (id, note_id, locale, title, content, updated_at)
    VALUES (?, ?, 'tr', ?, ?, ?)
    ON CONFLICT(note_id, locale) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      updated_at = excluded.updated_at
  `).run(`wn-tr-${noteId}`, noteId, trTitle, trContent, now);

  db.prepare(`
    INSERT INTO portfolio_workspace_notes_translations (id, note_id, locale, title, content, updated_at)
    VALUES (?, ?, 'en', ?, ?, ?)
    ON CONFLICT(note_id, locale) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      updated_at = excluded.updated_at
  `).run(`wn-en-${noteId}`, noteId, enTitle, enContent, now);

  const updatedNote = getWorkspaceNoteByIdFromD1(noteId)!;

  // Workspace snapshot revision
  const allWorkspaceNotes = listWorkspaceNotesForAdminFromD1(input.workspaceId);
  const revRow = db.prepare("SELECT MAX(revision_number) as max_rev FROM portfolio_workspace_notes_revisions WHERE workspace_id = ?").get(input.workspaceId) as { max_rev: number | null } | undefined;
  const nextRev = (revRow?.max_rev ?? 0) + 1;

  db.prepare(`
    INSERT INTO portfolio_workspace_notes_revisions (id, workspace_id, revision_number, action, snapshot_json, actor_email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `wnrev-${input.workspaceId}-${Date.now()}-${nextRev}`,
    input.workspaceId,
    nextRev,
    existing ? "update_note" : "create_note",
    JSON.stringify(allWorkspaceNotes),
    actorEmail,
    now
  );

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, ?, 'workspace_note', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    existing ? "update_note" : "create_note",
    noteId,
    JSON.stringify({ workspaceId: input.workspaceId, status, filename }),
    now
  );

  return updatedNote;
}

export function deleteWorkspaceNoteInD1(id: string, actorEmail: string): { deletedId: string } {
  assertLocalSimulationAllowed("deleteWorkspaceNoteInD1");
  const db = getD1Database();
  const existing = getWorkspaceNoteByIdFromD1(id);
  if (!existing) {
    throw new Error(`Workspace note "${id}" not found.`);
  }

  const workspaceId = existing.workspaceId;
  const now = new Date().toISOString();

  db.prepare("DELETE FROM portfolio_workspace_notes WHERE id = ?").run(id);

  // Revision after deletion
  const remaining = listWorkspaceNotesForAdminFromD1(workspaceId);
  const revRow = db.prepare("SELECT MAX(revision_number) as max_rev FROM portfolio_workspace_notes_revisions WHERE workspace_id = ?").get(workspaceId) as { max_rev: number | null } | undefined;
  const nextRev = (revRow?.max_rev ?? 0) + 1;

  db.prepare(`
    INSERT INTO portfolio_workspace_notes_revisions (id, workspace_id, revision_number, action, snapshot_json, actor_email, created_at)
    VALUES (?, ?, ?, 'delete_note', ?, ?, ?)
  `).run(
    `wnrev-${workspaceId}-${Date.now()}-${nextRev}`,
    workspaceId,
    nextRev,
    JSON.stringify(remaining),
    actorEmail,
    now
  );

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'delete_note', 'workspace_note', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    id,
    JSON.stringify({ workspaceId }),
    now
  );

  return { deletedId: id };
}

export function updateWorkspaceNotesOrderingInD1(
  items: { id: string; sortOrder: number }[],
  actorEmail: string
): void {
  assertLocalSimulationAllowed("updateWorkspaceNotesOrderingInD1");
  const db = getD1Database();
  const now = new Date().toISOString();

  const updateStmt = db.prepare("UPDATE portfolio_workspace_notes SET sort_order = ?, updated_at = ? WHERE id = ?");
  for (const item of items) {
    updateStmt.run(item.sortOrder, now, item.id);
  }

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'reorder_notes', 'workspace_note', 'multiple', ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    JSON.stringify(items),
    now
  );
}

export function listWorkspaceNotesRevisionsFromD1(workspaceId: string): CmsWorkspaceNoteRevisionRecord[] {
  assertLocalSimulationAllowed("listWorkspaceNotesRevisionsFromD1");
  const db = getD1Database();
  const rows = db.prepare("SELECT * FROM portfolio_workspace_notes_revisions WHERE workspace_id = ? ORDER BY revision_number DESC").all(workspaceId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    revisionNumber: Number(r.revision_number),
    action: String(r.action),
    snapshotJson: String(r.snapshot_json),
    actorEmail: String(r.actor_email),
    createdAt: String(r.created_at)
  }));
}

export function rollbackWorkspaceNoteRevisionInD1(
  workspaceId: string,
  revisionNumber: number,
  actorEmail: string
): void {
  assertLocalSimulationAllowed("rollbackWorkspaceNoteRevisionInD1");
  const db = getD1Database();
  const rev = db.prepare("SELECT snapshot_json FROM portfolio_workspace_notes_revisions WHERE workspace_id = ? AND revision_number = ? LIMIT 1").get(workspaceId, revisionNumber) as { snapshot_json: string } | undefined;
  if (!rev) {
    throw new Error(`Workspace notes revision #${revisionNumber} not found for workspace "${workspaceId}".`);
  }

  const snapshotNotes = JSON.parse(rev.snapshot_json) as CmsWorkspaceNote[];
  const now = new Date().toISOString();

  // Delete current notes in workspace
  db.prepare("DELETE FROM portfolio_workspace_notes WHERE workspace_id = ?").run(workspaceId);

  // Re-insert snapshot notes
  for (const note of snapshotNotes) {
    upsertWorkspaceNoteInD1({
      id: note.id,
      workspaceId: note.workspaceId,
      status: note.status,
      sortOrder: note.sortOrder,
      filename: note.filename,
      titleTR: note.title.tr,
      titleEN: note.title.en,
      contentTR: note.content.tr,
      contentEN: note.content.en
    }, actorEmail);
  }

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'rollback_notes_revision', 'workspace_note', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    workspaceId,
    JSON.stringify({ revisionNumber }),
    now
  );
}

// --- 3. EXPERIENCE ---

function mapExperienceRowsToCms(
  rows: Record<string, unknown>[],
  transRows: Record<string, unknown>[]
): CmsExperienceItem[] {
  const transByExpId = new Map<string, { tr?: Record<string, unknown>; en?: Record<string, unknown> }>();
  for (const t of transRows) {
    const expId = String(t.experience_id);
    let entry = transByExpId.get(expId);
    if (!entry) {
      entry = {};
      transByExpId.set(expId, entry);
    }
    if (t.locale === "tr") entry.tr = t;
    if (t.locale === "en") entry.en = t;
  }

  return rows.map((r) => {
    const id = String(r.id);
    const trans = transByExpId.get(id);

    let skills: string[] = [];
    try {
      skills = JSON.parse(String(r.skills_json || "[]"));
    } catch {
      skills = [];
    }

    return {
      id,
      status: String(r.status) as CmsPublishStatus,
      organization: String(r.organization || ""),
      startDate: String(r.start_date || ""),
      category: (r.category || "work") as "work" | "freelance" | "ai" | "creative" | "volunteer",
      skills,
      sortOrder: Number(r.sort_order || 0),
      role: {
        tr: String(trans?.tr?.role || ""),
        en: String(trans?.en?.role || "")
      },
      endDate: {
        tr: String(trans?.tr?.end_date || ""),
        en: String(trans?.en?.end_date || "")
      },
      location: {
        tr: trans?.tr?.location ? String(trans.tr.location) : undefined,
        en: trans?.en?.location ? String(trans.en.location) : undefined
      },
      employmentType: {
        tr: trans?.tr?.employment_type ? String(trans.tr.employment_type) : undefined,
        en: trans?.en?.employment_type ? String(trans.en.employment_type) : undefined
      },
      description: {
        tr: String(trans?.tr?.description || ""),
        en: String(trans?.en?.description || "")
      },
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      publishedAt: r.published_at ? String(r.published_at) : null,
      archivedAt: r.archived_at ? String(r.archived_at) : null
    };
  });
}

export function listExperienceForAdminFromD1(category?: string): CmsExperienceItem[] {
  assertLocalSimulationAllowed("listExperienceForAdminFromD1");
  const db = getD1Database();
  const rows = category
    ? db.prepare("SELECT * FROM portfolio_experience WHERE category = ? ORDER BY sort_order ASC, start_date DESC, id ASC").all(category)
    : db.prepare("SELECT * FROM portfolio_experience ORDER BY sort_order ASC, start_date DESC, id ASC").all();

  const trans = db.prepare("SELECT * FROM portfolio_experience_translations").all();
  return mapExperienceRowsToCms(rows, trans);
}

export function listPublishedExperienceFromD1(category?: string): CmsExperienceItem[] {
  assertLocalSimulationAllowed("listPublishedExperienceFromD1");
  const db = getD1Database();
  const rows = category
    ? db.prepare("SELECT * FROM portfolio_experience WHERE category = ? AND status = 'published' ORDER BY sort_order ASC, start_date DESC, id ASC").all(category)
    : db.prepare("SELECT * FROM portfolio_experience WHERE status = 'published' ORDER BY sort_order ASC, start_date DESC, id ASC").all();

  const trans = db.prepare("SELECT * FROM portfolio_experience_translations").all();
  return mapExperienceRowsToCms(rows, trans);
}

export function getExperienceByIdFromD1(id: string): CmsExperienceItem | null {
  assertLocalSimulationAllowed("getExperienceByIdFromD1");
  const db = getD1Database();
  const row = db.prepare("SELECT * FROM portfolio_experience WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const trans = db.prepare("SELECT * FROM portfolio_experience_translations WHERE experience_id = ?").all(id);
  return mapExperienceRowsToCms([row], trans)[0] || null;
}

export function upsertExperienceInD1(
  input: UpsertExperienceInput,
  actorEmail: string
): CmsExperienceItem {
  assertLocalSimulationAllowed("upsertExperienceInD1");
  const db = getD1Database();
  const now = new Date().toISOString();
  const expId = input.id || `exp-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const existing = getExperienceByIdFromD1(expId);

  const status = input.status || (existing?.status || "draft");
  const sortOrder = input.sortOrder !== undefined ? input.sortOrder : (existing?.sortOrder ?? 0);
  const category = input.category || (existing?.category || "work");
  const skills = input.skills || (existing?.skills || []);

  const publishedAt = status === "published" ? (existing?.publishedAt || now) : null;
  const archivedAt = status === "archived" ? (existing?.archivedAt || now) : null;

  db.prepare(`
    INSERT INTO portfolio_experience (id, status, organization, start_date, category, skills_json, sort_order, created_at, updated_at, published_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      organization = excluded.organization,
      start_date = excluded.start_date,
      category = excluded.category,
      skills_json = excluded.skills_json,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at,
      archived_at = excluded.archived_at
  `).run(
    expId,
    status,
    input.organization,
    input.startDate,
    category,
    JSON.stringify(skills),
    sortOrder,
    existing ? existing.createdAt : now,
    now,
    publishedAt,
    archivedAt
  );

  // Translations
  db.prepare(`
    INSERT INTO portfolio_experience_translations (id, experience_id, locale, role, end_date, location, employment_type, description, updated_at)
    VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(experience_id, locale) DO UPDATE SET
      role = excluded.role,
      end_date = excluded.end_date,
      location = excluded.location,
      employment_type = excluded.employment_type,
      description = excluded.description,
      updated_at = excluded.updated_at
  `).run(
    `exp-tr-${expId}`,
    expId,
    input.roleTR,
    input.endDateTR,
    input.locationTR || null,
    input.employmentTypeTR || null,
    input.descriptionTR,
    now
  );

  db.prepare(`
    INSERT INTO portfolio_experience_translations (id, experience_id, locale, role, end_date, location, employment_type, description, updated_at)
    VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(experience_id, locale) DO UPDATE SET
      role = excluded.role,
      end_date = excluded.end_date,
      location = excluded.location,
      employment_type = excluded.employment_type,
      description = excluded.description,
      updated_at = excluded.updated_at
  `).run(
    `exp-en-${expId}`,
    expId,
    input.roleEN,
    input.endDateEN,
    input.locationEN || null,
    input.employmentTypeEN || null,
    input.descriptionEN,
    now
  );

  const updatedExp = getExperienceByIdFromD1(expId)!;

  // Revisions tracking
  const revRow = db.prepare("SELECT MAX(revision_number) as max_rev FROM portfolio_experience_revisions WHERE experience_id = ?").get(expId) as { max_rev: number | null } | undefined;
  const nextRev = (revRow?.max_rev ?? 0) + 1;
  db.prepare(`
    INSERT INTO portfolio_experience_revisions (id, experience_id, revision_number, action, snapshot_json, actor_email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `exprev-${expId}-${Date.now()}-${nextRev}`,
    expId,
    nextRev,
    existing ? "update_experience" : "create_experience",
    JSON.stringify(updatedExp),
    actorEmail,
    now
  );

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, ?, 'experience', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    existing ? "update_experience" : "create_experience",
    expId,
    JSON.stringify({ organization: input.organization, status }),
    now
  );

  return updatedExp;
}

export function deleteExperienceInD1(id: string, actorEmail: string): { deletedId: string } {
  assertLocalSimulationAllowed("deleteExperienceInD1");
  const db = getD1Database();
  const existing = getExperienceByIdFromD1(id);
  if (!existing) {
    throw new Error(`Experience item "${id}" not found.`);
  }

  const now = new Date().toISOString();
  db.prepare("DELETE FROM portfolio_experience WHERE id = ?").run(id);

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'delete_experience', 'experience', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    id,
    JSON.stringify({ organization: existing.organization }),
    now
  );

  return { deletedId: id };
}

export function updateExperienceOrderingInD1(
  items: { id: string; sortOrder: number }[],
  actorEmail: string
): void {
  assertLocalSimulationAllowed("updateExperienceOrderingInD1");
  const db = getD1Database();
  const now = new Date().toISOString();

  const updateStmt = db.prepare("UPDATE portfolio_experience SET sort_order = ?, updated_at = ? WHERE id = ?");
  for (const item of items) {
    updateStmt.run(item.sortOrder, now, item.id);
  }

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'reorder_experience', 'experience', 'multiple', ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    JSON.stringify(items),
    now
  );
}

export function listExperienceRevisionsFromD1(experienceId: string): CmsExperienceRevisionRecord[] {
  assertLocalSimulationAllowed("listExperienceRevisionsFromD1");
  const db = getD1Database();
  const rows = db.prepare("SELECT * FROM portfolio_experience_revisions WHERE experience_id = ? ORDER BY revision_number DESC").all(experienceId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    experienceId: String(r.experience_id),
    revisionNumber: Number(r.revision_number),
    action: String(r.action),
    snapshotJson: String(r.snapshot_json),
    actorEmail: String(r.actor_email),
    createdAt: String(r.created_at)
  }));
}

export function rollbackExperienceRevisionInD1(
  experienceId: string,
  revisionNumber: number,
  actorEmail: string
): CmsExperienceItem {
  assertLocalSimulationAllowed("rollbackExperienceRevisionInD1");
  const db = getD1Database();
  const rev = db.prepare("SELECT snapshot_json FROM portfolio_experience_revisions WHERE experience_id = ? AND revision_number = ? LIMIT 1").get(experienceId, revisionNumber) as { snapshot_json: string } | undefined;
  if (!rev) {
    throw new Error(`Experience revision #${revisionNumber} not found for id "${experienceId}".`);
  }

  const snapshot = JSON.parse(rev.snapshot_json) as CmsExperienceItem;
  return upsertExperienceInD1({
    id: snapshot.id,
    organization: snapshot.organization,
    startDate: snapshot.startDate,
    category: snapshot.category,
    skills: snapshot.skills,
    sortOrder: snapshot.sortOrder,
    status: snapshot.status,
    roleTR: snapshot.role.tr,
    roleEN: snapshot.role.en,
    endDateTR: snapshot.endDate.tr,
    endDateEN: snapshot.endDate.en,
    locationTR: snapshot.location?.tr,
    locationEN: snapshot.location?.en,
    employmentTypeTR: snapshot.employmentType?.tr,
    employmentTypeEN: snapshot.employmentType?.en,
    descriptionTR: snapshot.description.tr,
    descriptionEN: snapshot.description.en
  }, actorEmail);
}

// --- 4. EDUCATION ---

function mapEducationRowsToCms(
  rows: Record<string, unknown>[],
  transRows: Record<string, unknown>[]
): CmsEducationItem[] {
  const transByEduId = new Map<string, { tr?: Record<string, unknown>; en?: Record<string, unknown> }>();
  for (const t of transRows) {
    const eduId = String(t.education_id);
    let entry = transByEduId.get(eduId);
    if (!entry) {
      entry = {};
      transByEduId.set(eduId, entry);
    }
    if (t.locale === "tr") entry.tr = t;
    if (t.locale === "en") entry.en = t;
  }

  return rows.map((r) => {
    const id = String(r.id);
    const trans = transByEduId.get(id);

    return {
      id,
      status: String(r.status) as CmsPublishStatus,
      startYear: r.start_year ? String(r.start_year) : undefined,
      sortOrder: Number(r.sort_order || 0),
      institution: {
        tr: String(trans?.tr?.institution || ""),
        en: String(trans?.en?.institution || "")
      },
      program: {
        tr: String(trans?.tr?.program || ""),
        en: String(trans?.en?.program || "")
      },
      endYear: {
        tr: String(trans?.tr?.end_year || ""),
        en: String(trans?.en?.end_year || "")
      },
      statusLabel: {
        tr: String(trans?.tr?.status_label || ""),
        en: String(trans?.en?.status_label || "")
      },
      description: {
        tr: trans?.tr?.description ? String(trans.tr.description) : undefined,
        en: trans?.en?.description ? String(trans.en.description) : undefined
      },
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      publishedAt: r.published_at ? String(r.published_at) : null,
      archivedAt: r.archived_at ? String(r.archived_at) : null
    };
  });
}

export function listEducationForAdminFromD1(): CmsEducationItem[] {
  assertLocalSimulationAllowed("listEducationForAdminFromD1");
  const db = getD1Database();
  const rows = db.prepare("SELECT * FROM portfolio_education ORDER BY sort_order ASC, start_year DESC, id ASC").all();
  const trans = db.prepare("SELECT * FROM portfolio_education_translations").all();
  return mapEducationRowsToCms(rows, trans);
}

export function listPublishedEducationFromD1(): CmsEducationItem[] {
  assertLocalSimulationAllowed("listPublishedEducationFromD1");
  const db = getD1Database();
  const rows = db.prepare("SELECT * FROM portfolio_education WHERE status = 'published' ORDER BY sort_order ASC, start_year DESC, id ASC").all();
  const trans = db.prepare("SELECT * FROM portfolio_education_translations").all();
  return mapEducationRowsToCms(rows, trans);
}

export function getEducationByIdFromD1(id: string): CmsEducationItem | null {
  assertLocalSimulationAllowed("getEducationByIdFromD1");
  const db = getD1Database();
  const row = db.prepare("SELECT * FROM portfolio_education WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const trans = db.prepare("SELECT * FROM portfolio_education_translations WHERE education_id = ?").all(id);
  return mapEducationRowsToCms([row], trans)[0] || null;
}

export function upsertEducationInD1(
  input: UpsertEducationInput,
  actorEmail: string
): CmsEducationItem {
  assertLocalSimulationAllowed("upsertEducationInD1");
  const db = getD1Database();
  const now = new Date().toISOString();
  const eduId = input.id || `edu-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const existing = getEducationByIdFromD1(eduId);

  const status = input.status || (existing?.status || "draft");
  const sortOrder = input.sortOrder !== undefined ? input.sortOrder : (existing?.sortOrder ?? 0);
  const startYear = input.startYear !== undefined ? input.startYear : (existing?.startYear || null);

  const publishedAt = status === "published" ? (existing?.publishedAt || now) : null;
  const archivedAt = status === "archived" ? (existing?.archivedAt || now) : null;

  db.prepare(`
    INSERT INTO portfolio_education (id, status, start_year, sort_order, created_at, updated_at, published_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      start_year = excluded.start_year,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at,
      archived_at = excluded.archived_at
  `).run(
    eduId,
    status,
    startYear,
    sortOrder,
    existing ? existing.createdAt : now,
    now,
    publishedAt,
    archivedAt
  );

  // Translations
  db.prepare(`
    INSERT INTO portfolio_education_translations (id, education_id, locale, institution, program, end_year, status_label, description, updated_at)
    VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(education_id, locale) DO UPDATE SET
      institution = excluded.institution,
      program = excluded.program,
      end_year = excluded.end_year,
      status_label = excluded.status_label,
      description = excluded.description,
      updated_at = excluded.updated_at
  `).run(
    `edu-tr-${eduId}`,
    eduId,
    input.institutionTR,
    input.programTR,
    input.endYearTR,
    input.statusLabelTR,
    input.descriptionTR || null,
    now
  );

  db.prepare(`
    INSERT INTO portfolio_education_translations (id, education_id, locale, institution, program, end_year, status_label, description, updated_at)
    VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(education_id, locale) DO UPDATE SET
      institution = excluded.institution,
      program = excluded.program,
      end_year = excluded.end_year,
      status_label = excluded.status_label,
      description = excluded.description,
      updated_at = excluded.updated_at
  `).run(
    `edu-en-${eduId}`,
    eduId,
    input.institutionEN,
    input.programEN,
    input.endYearEN,
    input.statusLabelEN,
    input.descriptionEN || null,
    now
  );

  const updatedEdu = getEducationByIdFromD1(eduId)!;

  // Revisions tracking
  const revRow = db.prepare("SELECT MAX(revision_number) as max_rev FROM portfolio_education_revisions WHERE education_id = ?").get(eduId) as { max_rev: number | null } | undefined;
  const nextRev = (revRow?.max_rev ?? 0) + 1;
  db.prepare(`
    INSERT INTO portfolio_education_revisions (id, education_id, revision_number, action, snapshot_json, actor_email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `edurev-${eduId}-${Date.now()}-${nextRev}`,
    eduId,
    nextRev,
    existing ? "update_education" : "create_education",
    JSON.stringify(updatedEdu),
    actorEmail,
    now
  );

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, ?, 'education', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    existing ? "update_education" : "create_education",
    eduId,
    JSON.stringify({ institution: input.institutionTR, status }),
    now
  );

  return updatedEdu;
}

export function deleteEducationInD1(id: string, actorEmail: string): { deletedId: string } {
  assertLocalSimulationAllowed("deleteEducationInD1");
  const db = getD1Database();
  const existing = getEducationByIdFromD1(id);
  if (!existing) {
    throw new Error(`Education item "${id}" not found.`);
  }

  const now = new Date().toISOString();
  db.prepare("DELETE FROM portfolio_education WHERE id = ?").run(id);

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'delete_education', 'education', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    id,
    JSON.stringify({ institution: existing.institution.tr }),
    now
  );

  return { deletedId: id };
}

export function updateEducationOrderingInD1(
  items: { id: string; sortOrder: number }[],
  actorEmail: string
): void {
  assertLocalSimulationAllowed("updateEducationOrderingInD1");
  const db = getD1Database();
  const now = new Date().toISOString();

  const updateStmt = db.prepare("UPDATE portfolio_education SET sort_order = ?, updated_at = ? WHERE id = ?");
  for (const item of items) {
    updateStmt.run(item.sortOrder, now, item.id);
  }

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'reorder_education', 'education', 'multiple', ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    JSON.stringify(items),
    now
  );
}

export function listEducationRevisionsFromD1(educationId: string): CmsEducationRevisionRecord[] {
  assertLocalSimulationAllowed("listEducationRevisionsFromD1");
  const db = getD1Database();
  const rows = db.prepare("SELECT * FROM portfolio_education_revisions WHERE education_id = ? ORDER BY revision_number DESC").all(educationId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    educationId: String(r.education_id),
    revisionNumber: Number(r.revision_number),
    action: String(r.action),
    snapshotJson: String(r.snapshot_json),
    actorEmail: String(r.actor_email),
    createdAt: String(r.created_at)
  }));
}

export function rollbackEducationRevisionInD1(
  educationId: string,
  revisionNumber: number,
  actorEmail: string
): CmsEducationItem {
  assertLocalSimulationAllowed("rollbackEducationRevisionInD1");
  const db = getD1Database();
  const rev = db.prepare("SELECT snapshot_json FROM portfolio_education_revisions WHERE education_id = ? AND revision_number = ? LIMIT 1").get(educationId, revisionNumber) as { snapshot_json: string } | undefined;
  if (!rev) {
    throw new Error(`Education revision #${revisionNumber} not found for id "${educationId}".`);
  }

  const snapshot = JSON.parse(rev.snapshot_json) as CmsEducationItem;
  return upsertEducationInD1({
    id: snapshot.id,
    startYear: snapshot.startYear,
    sortOrder: snapshot.sortOrder,
    status: snapshot.status,
    institutionTR: snapshot.institution.tr,
    institutionEN: snapshot.institution.en,
    programTR: snapshot.program.tr,
    programEN: snapshot.program.en,
    endYearTR: snapshot.endYear.tr,
    endYearEN: snapshot.endYear.en,
    statusLabelTR: snapshot.statusLabel.tr,
    statusLabelEN: snapshot.statusLabel.en,
    descriptionTR: snapshot.description?.tr,
    descriptionEN: snapshot.description?.en
  }, actorEmail);
}

// --- 5. SKILLS ---

function mapSkillsRowsToCms(
  rows: Record<string, unknown>[],
  transRows: Record<string, unknown>[]
): CmsSkillItem[] {
  const transBySkillId = new Map<string, { tr?: Record<string, unknown>; en?: Record<string, unknown> }>();
  for (const t of transRows) {
    const skillId = String(t.skill_id);
    let entry = transBySkillId.get(skillId);
    if (!entry) {
      entry = {};
      transBySkillId.set(skillId, entry);
    }
    if (t.locale === "tr") entry.tr = t;
    if (t.locale === "en") entry.en = t;
  }

  return rows.map((r) => {
    const id = String(r.id);
    const trans = transBySkillId.get(id);

    return {
      id,
      category: String(r.category) as CmsSkillCategory,
      status: String(r.status) as CmsPublishStatus,
      sortOrder: Number(r.sort_order || 0),
      name: {
        tr: String(trans?.tr?.name || ""),
        en: String(trans?.en?.name || "")
      },
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at)
    };
  });
}

export function listSkillsForAdminFromD1(category?: CmsSkillCategory): CmsSkillItem[] {
  assertLocalSimulationAllowed("listSkillsForAdminFromD1");
  const db = getD1Database();
  const rows = category
    ? db.prepare("SELECT * FROM portfolio_skills WHERE category = ? ORDER BY sort_order ASC, id ASC").all(category)
    : db.prepare("SELECT * FROM portfolio_skills ORDER BY category ASC, sort_order ASC, id ASC").all();

  const trans = db.prepare("SELECT * FROM portfolio_skill_translations").all();
  return mapSkillsRowsToCms(rows, trans);
}

export function listPublishedSkillsFromD1(category?: CmsSkillCategory): CmsSkillItem[] {
  assertLocalSimulationAllowed("listPublishedSkillsFromD1");
  const db = getD1Database();
  const rows = category
    ? db.prepare("SELECT * FROM portfolio_skills WHERE category = ? AND status = 'published' ORDER BY sort_order ASC, id ASC").all(category)
    : db.prepare("SELECT * FROM portfolio_skills WHERE status = 'published' ORDER BY category ASC, sort_order ASC, id ASC").all();

  const trans = db.prepare("SELECT * FROM portfolio_skill_translations").all();
  return mapSkillsRowsToCms(rows, trans);
}

export function getSkillByIdFromD1(id: string): CmsSkillItem | null {
  assertLocalSimulationAllowed("getSkillByIdFromD1");
  const db = getD1Database();
  const row = db.prepare("SELECT * FROM portfolio_skills WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const trans = db.prepare("SELECT * FROM portfolio_skill_translations WHERE skill_id = ?").all(id);
  return mapSkillsRowsToCms([row], trans)[0] || null;
}

export function upsertSkillInD1(
  input: UpsertSkillInput,
  actorEmail: string
): CmsSkillItem {
  assertLocalSimulationAllowed("upsertSkillInD1");
  const db = getD1Database();
  const now = new Date().toISOString();
  const skillId = input.id || `skill-${input.category}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const existing = getSkillByIdFromD1(skillId);

  const status = input.status || (existing?.status || "published");
  const sortOrder = input.sortOrder !== undefined ? input.sortOrder : (existing?.sortOrder ?? 0);

  db.prepare(`
    INSERT INTO portfolio_skills (id, category, status, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      status = excluded.status,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `).run(
    skillId,
    input.category,
    status,
    sortOrder,
    existing ? existing.createdAt : now,
    now
  );

  // Translations
  db.prepare(`
    INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
    VALUES (?, ?, 'tr', ?, ?)
    ON CONFLICT(skill_id, locale) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at
  `).run(`sk-tr-${skillId}`, skillId, input.nameTR, now);

  db.prepare(`
    INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
    VALUES (?, ?, 'en', ?, ?)
    ON CONFLICT(skill_id, locale) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at
  `).run(`sk-en-${skillId}`, skillId, input.nameEN, now);

  const updatedSkill = getSkillByIdFromD1(skillId)!;

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, ?, 'skill', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    existing ? "update_skill" : "create_skill",
    skillId,
    JSON.stringify({ name: input.nameTR, category: input.category }),
    now
  );

  return updatedSkill;
}

export function deleteSkillInD1(id: string, actorEmail: string): { deletedId: string } {
  assertLocalSimulationAllowed("deleteSkillInD1");
  const db = getD1Database();
  const existing = getSkillByIdFromD1(id);
  if (!existing) {
    throw new Error(`Skill "${id}" not found.`);
  }

  const now = new Date().toISOString();
  db.prepare("DELETE FROM portfolio_skills WHERE id = ?").run(id);

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'delete_skill', 'skill', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    id,
    JSON.stringify({ category: existing.category, name: existing.name.tr }),
    now
  );

  return { deletedId: id };
}

export function updateSkillsOrderingInD1(
  items: { id: string; sortOrder: number }[],
  actorEmail: string
): void {
  assertLocalSimulationAllowed("updateSkillsOrderingInD1");
  const db = getD1Database();
  const now = new Date().toISOString();

  const updateStmt = db.prepare("UPDATE portfolio_skills SET sort_order = ?, updated_at = ? WHERE id = ?");
  for (const item of items) {
    updateStmt.run(item.sortOrder, now, item.id);
  }

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'reorder_skills', 'skill', 'multiple', ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    JSON.stringify(items),
    now
  );
}

// --- 6. CV DOCUMENTS ---

function mapCvRowToCms(row: Record<string, unknown>): CmsCvDocument {
  return {
    id: String(row.id),
    locale: (row.locale === "tr" ? "tr" : "en") as "tr" | "en",
    status: (row.status || "draft") as CmsPublishStatus,
    storageMode: (row.storage_mode || "local_static") as "local_static" | "r2" | "external",
    storageKey: String(row.storage_key || ""),
    publicUrl: String(row.public_url || ""),
    filename: String(row.filename || ""),
    mimeType: String(row.mime_type || "application/pdf"),
    byteSize: Number(row.byte_size || 0),
    sha256: String(row.sha256 || ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: row.published_at ? String(row.published_at) : null,
    archivedAt: row.archived_at ? String(row.archived_at) : null
  };
}

export function getCvDocumentFromD1(locale: "tr" | "en"): CmsCvDocument | null {
  assertLocalSimulationAllowed("getCvDocumentFromD1");
  const db = getD1Database();
  const row = db.prepare("SELECT * FROM portfolio_cv_documents WHERE locale = ?").get(locale) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapCvRowToCms(row);
}

export function listCvDocumentsFromD1(): CmsCvDocument[] {
  assertLocalSimulationAllowed("listCvDocumentsFromD1");
  const db = getD1Database();
  const rows = db.prepare("SELECT * FROM portfolio_cv_documents ORDER BY locale ASC").all() as Record<string, unknown>[];
  return rows.map(mapCvRowToCms);
}

export function upsertCvDocumentInD1(
  input: UpsertCvInput,
  actorEmail: string,
  actionLabel = "upsert_cv"
): CmsCvDocument {
  assertLocalSimulationAllowed("upsertCvDocumentInD1");
  const db = getD1Database();
  const now = new Date().toISOString();
  const locale = input.locale;
  const cvId = `cv-${locale}`;
  const existing = getCvDocumentFromD1(locale);

  const status = input.status !== undefined ? input.status : (existing?.status || "draft");
  const storageMode = input.storageMode !== undefined ? input.storageMode : (existing?.storageMode || "local_static");
  const storageKey = input.storageKey !== undefined ? input.storageKey : (existing?.storageKey || "");
  const publicUrl = input.publicUrl !== undefined ? input.publicUrl : (existing?.publicUrl || "");
  const filename = input.filename !== undefined ? input.filename : (existing?.filename || "");
  const mimeType = input.mimeType !== undefined ? input.mimeType : (existing?.mimeType || "application/pdf");
  const byteSize = input.byteSize !== undefined ? input.byteSize : (existing?.byteSize || 0);
  const sha256 = input.sha256 !== undefined ? input.sha256 : (existing?.sha256 || "");

  const publishedAt = status === "published" ? (existing?.publishedAt || now) : null;
  const archivedAt = status === "archived" ? (existing?.archivedAt || now) : null;

  db.prepare(`
    INSERT INTO portfolio_cv_documents (
      id, locale, status, storage_mode, storage_key, public_url, filename, mime_type, byte_size, sha256, created_at, updated_at, published_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(locale) DO UPDATE SET
      status = excluded.status,
      storage_mode = excluded.storage_mode,
      storage_key = excluded.storage_key,
      public_url = excluded.public_url,
      filename = excluded.filename,
      mime_type = excluded.mime_type,
      byte_size = excluded.byte_size,
      sha256 = excluded.sha256,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at,
      archived_at = excluded.archived_at
  `).run(
    cvId,
    locale,
    status,
    storageMode,
    storageKey,
    publicUrl,
    filename,
    mimeType,
    byteSize,
    sha256,
    existing ? existing.createdAt : now,
    now,
    publishedAt,
    archivedAt
  );

  const updated = getCvDocumentFromD1(locale)!;

  // Revision snapshot
  const revRow = db.prepare("SELECT MAX(revision_number) as max_rev FROM portfolio_cv_revisions WHERE cv_id = ?").get(cvId) as { max_rev: number | null } | undefined;
  const nextRev = (revRow?.max_rev ?? 0) + 1;
  db.prepare(`
    INSERT INTO portfolio_cv_revisions (id, cv_id, revision_number, action, snapshot_json, actor_email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `cvrev-${cvId}-${Date.now()}-${nextRev}`,
    cvId,
    nextRev,
    actionLabel,
    JSON.stringify(updated),
    actorEmail,
    now
  );

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, ?, 'cv_document', ?, ?, ?)
  `).run(
    `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    actorEmail,
    actionLabel,
    cvId,
    JSON.stringify({ locale, status, filename }),
    now
  );

  return updated;
}

export function uploadCvDocumentToStorageAndD1(params: {
  buffer: Buffer;
  filename: string;
  locale: "tr" | "en";
  actorEmail: string;
}): CmsCvDocument {
  assertLocalSimulationAllowed("uploadCvDocumentToStorageAndD1");
  const validation = validateCvPdfSignature(params.buffer, params.filename);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid CV PDF document.");
  }

  const sha256 = crypto.createHash("sha256").update(params.buffer).digest("hex");
  const safeFilename = path.basename(params.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `cv/${params.locale}/${Date.now()}-${safeFilename}`;
  const r2BaseDir = getLocalR2DirPath();
  const r2FilePath = path.join(r2BaseDir, storageKey);

  fs.mkdirSync(path.dirname(r2FilePath), { recursive: true });
  fs.writeFileSync(r2FilePath, params.buffer);

  const existing = getCvDocumentFromD1(params.locale);
  const nextStatus = existing?.status === "published" ? "published" : "draft";

  return upsertCvDocumentInD1({
    locale: params.locale,
    status: nextStatus,
    storageMode: "r2",
    storageKey,
    publicUrl: `/api/media/${storageKey}`,
    filename: safeFilename,
    mimeType: "application/pdf",
    byteSize: params.buffer.byteLength,
    sha256
  }, params.actorEmail, "upload_cv_pdf");
}

export function listCvRevisionsFromD1(locale: "tr" | "en"): CmsCvRevisionRecord[] {
  assertLocalSimulationAllowed("listCvRevisionsFromD1");
  const db = getD1Database();
  const cvId = `cv-${locale}`;
  const rows = db.prepare("SELECT * FROM portfolio_cv_revisions WHERE cv_id = ? ORDER BY revision_number DESC").all(cvId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    cvId: String(r.cv_id),
    revisionNumber: Number(r.revision_number),
    action: String(r.action),
    snapshotJson: String(r.snapshot_json),
    actorEmail: String(r.actor_email),
    createdAt: String(r.created_at)
  }));
}

export function rollbackCvRevisionInD1(
  locale: "tr" | "en",
  revisionNumber: number,
  actorEmail: string
): CmsCvDocument {
  assertLocalSimulationAllowed("rollbackCvRevisionInD1");
  const db = getD1Database();
  const cvId = `cv-${locale}`;
  const rev = db.prepare("SELECT snapshot_json FROM portfolio_cv_revisions WHERE cv_id = ? AND revision_number = ? LIMIT 1").get(cvId, revisionNumber) as { snapshot_json: string } | undefined;
  if (!rev) {
    throw new Error(`CV revision #${revisionNumber} not found for locale "${locale}".`);
  }

  const snapshot = JSON.parse(rev.snapshot_json) as CmsCvDocument;
  return upsertCvDocumentInD1({
    locale,
    status: snapshot.status,
    storageMode: snapshot.storageMode,
    storageKey: snapshot.storageKey,
    publicUrl: snapshot.publicUrl,
    filename: snapshot.filename,
    mimeType: snapshot.mimeType,
    byteSize: snapshot.byteSize,
    sha256: snapshot.sha256
  }, actorEmail, `rollback_rev_${revisionNumber}`);
}



