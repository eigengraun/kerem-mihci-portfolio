-- ============================================================
-- Kerem Mıhçı Portfolio OS — Cloudflare D1 Initial Schema
-- Migration: 0001_initial_schema.sql
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. Core Projects Table
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

-- 2. Localized Project Content (TR / EN)
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

-- 3. Project Media & R2 Asset Metadata
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

-- 4. Categories
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

-- 5. Services / Capabilities
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

-- 6. Project Revisions (Snapshot History & Rollback)
CREATE TABLE IF NOT EXISTS project_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 7. Publishing Workflow Events
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

-- 8. Admin Audit Logs
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

-- 9. Site & CMS Settings
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status_workspace ON projects(status, workspace, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(status, workspace, featured, featured_order);
CREATE INDEX IF NOT EXISTS idx_project_translations_project_locale ON project_translations(project_id, locale);
CREATE INDEX IF NOT EXISTS idx_project_media_project_sort ON project_media(project_id, kind, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_revisions_project ON project_revisions(project_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_publishing_events_project ON publishing_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
