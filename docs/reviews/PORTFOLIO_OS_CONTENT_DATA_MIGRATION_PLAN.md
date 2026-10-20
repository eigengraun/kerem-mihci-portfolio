# Portfolio OS: Content Data Migration & Schema Expansion Plan
## Non-Destructive Cloudflare D1 & R2 Architectural Roadmap

**Date:** October 20, 2026  
**Status:** Architecture Specification & Non-Destructive Migration Plan  
**Target Database:** Cloudflare D1 (`kerem-portfolio-db-staging` / production)  
**Target Storage:** Cloudflare R2 (`kerem-portfolio-media-staging` / production)  
**Safety Mandate:** Zero modification or loss of the 30 canonical projects; preserve all 21 production video assets; backward compatibility with existing static TypeScript data fallbacks.

---

## 1. Executive Summary & Safety Guarantees

The existing Cloudflare D1 staging database contains **30 canonical projects** (`advertising` and `directing`) and their corresponding media associations. This migration plan expands the database schema to encompass all creative content domains without disturbing, altering, or dropping existing tables.

### Non-Destructive Guarantees:
1. **Existing Tables Preserved**: `projects`, `project_translations`, `project_media`, and `featured_curation` remain intact. Only additive constraints or indexes are applied.
2. **Deterministic Foreign Keys**: All new entities use standard SQLite foreign key cascades (`ON DELETE CASCADE`) to prevent orphaned rows.
3. **Data Parity with TypeScript Sources**: Initial population scripts ingest verified records directly from `src/data/videos.ts` (21 videos) and `src/data/profile.ts` (profile sections).
4. **Offline Resilience**: The public Next.js frontend will continue to use static JSON / TypeScript files as fallback sources if Cloudflare Worker API connectivity is unavailable.

---

## 2. Expanded Cloudflare D1 SQL Schema

The new migration script (`cloudflare/portfolio-api/migrations/0002_expand_content_schema.sql`) introduces 7 normalized tables:

```sql
-- ============================================================================
-- MIGRATION: 0002_expand_content_schema.sql
-- NON-DESTRUCTIVE CONTENT EXTENSIONS FOR PORTFOLIO OS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VIDEOS & REELS REPOSITORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,                       -- e.g. 'reel_01', 'directing_sample_01'
  slug TEXT UNIQUE NOT NULL,                 -- url-friendly slug
  client TEXT NOT NULL DEFAULT '',          -- client / brand name
  year TEXT NOT NULL DEFAULT '',            -- release year
  aspect_ratio TEXT NOT NULL DEFAULT '9:16', -- '9:16' (reel) or '16:9' (landscape)
  category TEXT NOT NULL DEFAULT 'reel',    -- 'reel', 'commercial', 'music_video'
  video_url TEXT NOT NULL,                   -- R2 or public URL (e.g. /videos/reel_01.mp4)
  poster_url TEXT NOT NULL,                  -- R2 or public URL for preview poster
  duration_seconds REAL DEFAULT 0,          -- video length
  sort_order INTEGER NOT NULL DEFAULT 0,    -- manual display order
  is_published INTEGER NOT NULL DEFAULT 1,   -- 1 = public, 0 = hidden
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_videos_aspect_ratio ON videos(aspect_ratio);
CREATE INDEX IF NOT EXISTS idx_videos_sort_order ON videos(sort_order);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(is_published);

-- Bilingual Video Translations
CREATE TABLE IF NOT EXISTS video_translations (
  video_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('tr', 'en')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  credits TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (video_id, locale),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_trans_locale ON video_translations(locale);

-- ----------------------------------------------------------------------------
-- 2. PERSONAL GALLERY (SEQUENTIAL STREAM)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,                       -- e.g. 'gal_01', UUID
  aspect_ratio REAL NOT NULL DEFAULT 1.0,    -- float aspect ratio (e.g. 1.777, 0.8)
  image_url TEXT NOT NULL,                   -- high-res image R2 URL
  thumbnail_url TEXT NOT NULL,               -- optimized thumbnail URL
  sort_order INTEGER NOT NULL DEFAULT 0,    -- sequential stream position
  is_published INTEGER NOT NULL DEFAULT 1,
  captured_at TEXT DEFAULT '',               -- photo capture date / year
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gallery_sort_order ON gallery_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_published ON gallery_items(is_published);

-- Bilingual Gallery Captions
CREATE TABLE IF NOT EXISTS gallery_translations (
  gallery_item_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('tr', 'en')),
  title TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (gallery_item_id, locale),
  FOREIGN KEY (gallery_item_id) REFERENCES gallery_items(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 3. PROFILE & NOTES ENGINE (6 NOTES TABS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_sections (
  id TEXT PRIMARY KEY,                       -- 'about', 'experience', 'education', 'skills', 'notes'
  section_type TEXT NOT NULL,                -- 'narrative', 'timeline', 'skills_matrix'
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_translations (
  section_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('tr', 'en')),
  headline TEXT NOT NULL DEFAULT '',
  content_markdown TEXT NOT NULL DEFAULT '', -- Rich biography or notes essay
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (section_id, locale),
  FOREIGN KEY (section_id) REFERENCES profile_sections(id) ON DELETE CASCADE
);

-- Timeline Items for Experience and Education
CREATE TABLE IF NOT EXISTS profile_timeline_items (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,                  -- 'experience' or 'education'
  period TEXT NOT NULL,                      -- e.g. '2021 — PRESENT'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (section_id) REFERENCES profile_sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_timeline_translations (
  timeline_item_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('tr', 'en')),
  title TEXT NOT NULL,                       -- e.g. 'Creative Director'
  organization TEXT NOT NULL,                -- e.g. 'VML / Y&R'
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (timeline_item_id, locale),
  FOREIGN KEY (timeline_item_id) REFERENCES profile_timeline_items(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 4. CV DOCUMENTS MANAGEMENT
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cv_documents (
  id TEXT PRIMARY KEY,                       -- e.g. 'cv_tr_v1', UUID
  locale TEXT NOT NULL CHECK(locale IN ('tr', 'en')),
  file_key TEXT NOT NULL,                    -- R2 storage key (cv/tr/kerem-mihci-cv.pdf)
  filename TEXT NOT NULL,                    -- 'kerem-mihci-cv-tr.pdf'
  file_size INTEGER NOT NULL,               -- file size in bytes
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  is_active INTEGER NOT NULL DEFAULT 1,      -- 1 = currently served on public site
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(locale, is_active)                  -- Only one active CV per locale
);

CREATE INDEX IF NOT EXISTS idx_cv_active ON cv_documents(locale, is_active);
```

---

## 3. Cloudflare R2 Storage Prefix Topology

To prevent collisions and ensure high cache performance, the R2 bucket (`kerem-portfolio-media-staging` / production) is organized into distinct namespaces:

```
kerem-portfolio-media/
├── projects/
│   └── <project-slug>/
│       ├── banner.webp
│       ├── still_01.webp
│       └── video_clip.mp4
├── videos/
│   ├── reels/
│   │   ├── reel_01.mp4
│   │   └── reel_02.mp4
│   ├── landscape/
│   │   └── directing_sample_01.mp4
│   └── posters/
│       ├── reel_01.webp
│       └── directing_sample_01.webp
├── gallery/
│   └── <item-id>/
│       ├── original.webp
│       └── thumb.webp
└── cv/
    ├── tr/
    │   └── kerem-mihci-cv-tr.pdf
    └── en/
        └── kerem-mihci-cv-en.pdf
```

### R2 Cache-Control Header Strategy:
- **Immutable Media (`/videos/*`, `/projects/*`)**: `Cache-Control: public, max-age=31536000, immutable`
- **Dynamic Documents (`/cv/*`)**: `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`

---

## 4. Initial Ingestion & Data Seeding Strategy

### 4.1 Ingestion of 21 Verified Video Assets
An automated, non-destructive migration script will parse `src/data/videos.ts` and generate D1 SQL statements:

```typescript
// Sample ingestion mapping logic
for (let i = 0; i < INITIAL_VIDEOS.length; i++) {
  const v = INITIAL_VIDEOS[i];
  // 1. Insert parent video record with explicit sort_order: i
  // 2. Insert Turkish translation (locale = 'tr', title = v.title)
  // 3. Insert English translation (locale = 'en', title = v.title)
}
```
*Deterministic Ordering Guarantee*: The current order in `src/data/videos.ts` will be assigned to `sort_order` (`0` to `20`). This establishes the canonical curator sequence before the CMS UI takes over.

### 4.2 Ingestion of Profile & Notes Content
Data from `src/data/profile.ts` will populate `profile_sections` and `profile_translations`:
- **`about`**: Bilingual biography, core competencies, and artistic philosophy.
- **`experience`**: 6 career milestones (Agencies, Commercial Directing, Independent Productions).
- **`education`**: Film & Television academic credentials.
- **`skills`**: Directing, Screenwriting, Cinematography, Color Grading, Creative Strategy.
- **`notes`**: Personal essays and director's notebooks.

---

## 5. Non-Destructive Deployment & Verification Protocol

### Step 1: Pre-Migration Health & Integrity Check
Before executing schema changes:
1. Query staging Worker `/api/v1/admin/health` to confirm D1 connectivity.
2. Confirm exactly 30 canonical projects exist via `SELECT count(*) FROM projects WHERE cms_status = 'published'`.

### Step 2: Safe Targeted Cleanup of Interrupted Test Artifact
1. Delete the specific leaked test draft:
   ```sql
   DELETE FROM projects WHERE slug = 'staging-e2e-29cbd44d';
   ```
2. Verify total project count resets to exactly 30 canonical records.

### Step 3: Schema Extension Execution
1. Apply `0002_expand_content_schema.sql` via Cloudflare Wrangler D1 execute.
2. Run automated validation query:
   ```sql
   SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
   ```
   Confirm all 7 new tables exist alongside the original 4 tables.

### Step 4: Asset Ingestion Execution
1. Run `scripts/seed-d1-videos-and-profile.mjs` against staging D1.
2. Confirm row counts:
   - `videos`: 21
   - `video_translations`: 42 (21 TR + 21 EN)
   - `profile_sections`: 5
   - `cv_documents`: 0 (ready for dashboard upload)

### Step 5: Rollback Safeguards
If any step fails:
- Original project tables are untouched.
- Rollback script `0002_rollback.sql` simply issues `DROP TABLE IF EXISTS` on the 7 new tables, leaving the core 30-project system completely unharmed.

---

## 6. Summary of Architectural Achievements

With this data migration plan:
1. **The 30 canonical projects remain 100% protected and operational.**
2. **All 21 production videos transition from static disk assets into editable database records.**
3. **The personal gallery gains a dedicated sequential storage schema.**
4. **All bio notes, resumes, and career timelines become dynamic and fully manageable from the dashboard.**
