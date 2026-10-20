-- ============================================================
-- Kerem Mıhçı Portfolio OS — Cloudflare D1 Additive Schema
-- Migration: 0002_videos_and_reels_schema.sql
-- Description: Independent Normalized Schema for Videos & Reels CMS
-- Non-Breaking: Preserves all existing tables and data (projects, media, sessions)
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. Portfolio Videos Core Table
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

-- 2. Localized Video Content (TR / EN)
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

-- 3. Video Assets (Source Media, Posters, Thumbnails)
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

-- 4. Video Revisions (Audit & Snapshot History)
CREATE TABLE IF NOT EXISTS portfolio_video_revisions (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES portfolio_videos(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ============================================================
-- Indexes for Video Discovery, Ordering, and Asset Resolution
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_slug ON portfolio_videos(slug);
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_status_sort ON portfolio_videos(status, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_featured ON portfolio_videos(status, featured, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_orientation ON portfolio_videos(status, orientation);
CREATE INDEX IF NOT EXISTS idx_portfolio_video_translations_lookup ON portfolio_video_translations(video_id, locale);
CREATE INDEX IF NOT EXISTS idx_portfolio_video_assets_lookup ON portfolio_video_assets(video_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_portfolio_video_assets_storage_key ON portfolio_video_assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_portfolio_video_revisions_lookup ON portfolio_video_revisions(video_id, revision_number DESC);
