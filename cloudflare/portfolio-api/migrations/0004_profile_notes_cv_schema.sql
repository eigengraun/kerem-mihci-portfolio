-- ============================================================
-- Kerem Mıhçı Portfolio OS — Cloudflare D1 Additive Schema
-- Migration: 0004_profile_notes_cv_schema.sql
-- Description: Independent Normalized Schema for Profile, Workspace Notes, Experience, Education, Skills and CV CMS
-- Non-Breaking: Preserves all existing tables and data (projects, media, videos, gallery, sessions, audit_logs)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. PROFILE & ABOUT TABLES
-- ============================================================

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

-- ============================================================
-- 2. WORKSPACE NOTES TABLES
-- ============================================================

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

-- ============================================================
-- 3. EXPERIENCE TABLES
-- ============================================================

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

-- ============================================================
-- 4. EDUCATION TABLES
-- ============================================================

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

-- ============================================================
-- 5. SKILLS TABLES
-- ============================================================

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

-- ============================================================
-- 6. CV DOCUMENT TABLES
-- ============================================================

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

-- ============================================================
-- INDEXES FOR DETERMINISTIC DISCOVERY AND PERFORMANCE
-- ============================================================

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
