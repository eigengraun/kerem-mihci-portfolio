-- ============================================================
-- Kerem Mıhçı Portfolio OS — Cloudflare D1 Additive Schema
-- Migration: 0003_personal_gallery_schema.sql
-- Description: Independent Normalized Schema for Personal Gallery CMS
-- Non-Breaking: Preserves all existing tables and data (projects, media, videos, sessions, audit_logs)
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. Personal Gallery Items Core Table
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

-- 2. Localized Content (TR / EN)
CREATE TABLE IF NOT EXISTS portfolio_gallery_translations (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES portfolio_gallery_items(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('tr', 'en')),
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE(item_id, locale)
);

-- 3. Gallery Media Assets (Original / Processed Images)
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

-- 4. Gallery Revisions (Audit & Snapshot History)
CREATE TABLE IF NOT EXISTS portfolio_gallery_revisions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES portfolio_gallery_items(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ============================================================
-- Indexes for Deterministic Ordering, Discovery, and Media Lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_status_sort ON portfolio_gallery_items(status, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_translations_lookup ON portfolio_gallery_translations(item_id, locale);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_assets_lookup ON portfolio_gallery_assets(item_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_assets_storage_key ON portfolio_gallery_assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_revisions_lookup ON portfolio_gallery_revisions(item_id, revision_number DESC);
