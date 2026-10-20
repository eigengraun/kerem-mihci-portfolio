# Portfolio OS Phase 3 & 3.2: Video Media Upload & Storage Contract

**Version:** 2.1.0 (Hardened Staging & Point-in-Time Retention Contract)<br>
**Status:** Approved & Verified (Local Simulation & Cloudflare Worker Aligned)  
**System:** Kerem Mıhçı Portfolio OS — Videos & Reels Engine  
**Repository Branch:** `feature/cloudflare-cms-dashboard`  

---

## 1. Executive Summary

This contract defines the strict binary, validation, security, memory handling, and metadata rules for managing video and poster assets in Portfolio OS. It enforces fail-closed magic byte signature inspection, deterministic R2 object keys, immutable asset retention for revision rollback, strict size limits, and full parity between local simulation and remote Cloudflare R2 object storage.

---

## 2. Asset Specification & Binary Constraints

| Asset Category | Asset Type Parameter | Allowed MIME Types | Binary Signatures (Magic Bytes) | Max File Size | Target Aspect Ratio | Recommended Resolution | Encoding Standard |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Video Asset** | `video` | `video/mp4`, `video/webm` | MP4: `ftyp` box at byte offset 4–11<br>WebM: `\x1A\x45\xDF\xA3` at byte offset 0–3 | **100 MB** | 9:16 (Portrait)<br>16:9 (Landscape) | 1080×1920 (9:16)<br>1920×1080 (16:9) | H.264 / AAC / VP9, faststart (`moov` atom at front), 30–60 FPS |
| **Poster Asset** | `poster` | `image/webp`, `image/jpeg`, `image/png` | WebP: `RIFF....WEBP`<br>JPEG: `\xFF\xD8\xFF`<br>PNG: `\x89PNG\r\n\x1A\n` | **5 MB** | Matches video aspect ratio | 1080×1920 (9:16)<br>1920×1080 (16:9) | WebP (quality 85–90), progressive JPEG, or optimized PNG |
| **Thumbnail Asset** | `thumbnail` | `image/webp`, `image/jpeg`, `image/png` | Same as poster signatures | **2 MB** | 9:16 / 16:9 or 1:1 | 400×711 (9:16)<br>640×360 (16:9) | WebP (quality 80) |

> [!IMPORTANT]
> Uncompressed QuickTime (`video/quicktime` / `.mov`) is intentionally excluded from direct web streaming ingestion to prevent browser playback incompatibility and storage waste. All ingested videos must be web-optimized MP4 or WebM containers.

---

## 3. Storage Hierarchy & Table Ownership

### 3.1 Dedicated Database Table
All video media assets are owned exclusively by the `portfolio_video_assets` table (NOT `project_media`). This completely prevents cross-domain ID conflicts with portfolio design projects.

```sql
CREATE TABLE portfolio_video_assets (
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
```

### 3.2 Cloudflare R2 Bucket Key Namespacing & Asset Binary Retention
Uploaded assets are assigned collision-resistant, sanitized storage keys within the video namespace:

```
videos/
└── <video-slug>/
    ├── poster-<timestamp>-<randomHex>.webp
    └── video-<timestamp>-<randomHex>.mp4
```

- **Historical Asset Retention for Point-in-Time Rollback**: When a user replaces an existing poster or video asset, previous binaries are **retained** under their immutable timestamped storage keys in R2 and local storage. This guarantees that point-in-time revision rollback (`portfolio_video_revisions`) never breaks media links or leads to missing assets.
- **Transactional Rollback on Failure**: If a database write fails during asset replacement, the newly uploaded object is rolled back immediately to maintain consistency.
- **Bucket Pruning**: Background pruning or R2 lifecycle rules may be scheduled separately without impacting active or historically referenced snapshots.

---

## 4. Endpoints & Authentication

### 4.1 Dedicated Next.js Route
- **URL**: `POST /api/admin/videos/upload`
- **Auth**: Server-side durable session cookie, valid `x-csrf-token`, and validated `Origin` header matching trusted admin origins.
- **Multipart Form Payload**:
  - `file`: Binary file.
  - `videoSlug`: Target video slug (e.g. `ai-moda-kombin-reels`).
  - `assetType`: `"video" | "poster" | "thumbnail"`.
  - `videoId` (optional): Video record ID.

### 4.2 Cloudflare Worker Dedicated Route
- **URL**: `POST /api/v1/admin/videos/upload`
- **Auth**: `Authorization: Bearer <CLOUDFLARE_API_SERVICE_TOKEN>` and `X-Actor-Email: <admin-email>`.
- **Payload**: Multipart form matching the Next.js boundary.

---

## 5. Streaming, Range & Cache Protocol

### 5.1 HTTP Range Support (RFC 7233)
- Media streaming routes (`/api/media/*` and public static paths) advertise `Accept-Ranges: bytes`.
- Byte-range requests (`Range: bytes=start-end`) return `HTTP 206 Partial Content` with valid `Content-Range: bytes start-end/total`.
- Out-of-bounds requests return `HTTP 416 Range Not Satisfiable` with `Content-Range: bytes */total`.

### 5.2 Cache Control & Private Media Protection
- Published media objects return `Cache-Control: public, max-age=0, must-revalidate, s-maxage=3600` with `ETag`.
- Next.js media proxy passes through upstream edge caching without overriding with legacy 7-day TTLs (`s-maxage=604800` is eliminated).
- Media belonging to draft or archived videos returns `HTTP 404` to unauthenticated public visitors, but returns `HTTP 200` to authenticated admins with `Cache-Control: private, no-store, no-cache, must-revalidate`.

---

## 6. Worker Memory Limits & Buffer Streaming Considerations

Cloudflare Worker execution environments have specific memory characteristics:
1. **Isolate Memory Ceiling**: Cloudflare Workers standard isolates enforce a 128 MB RAM ceiling (up to 512 MB on higher tiers).
2. **Buffer Allocation (`file.arrayBuffer()`)**: Ingesting large files via `file.arrayBuffer()` holds the entire payload in isolate memory simultaneously during signature validation and R2 `put()`.
3. **Recommended Upload Ceiling**:
   - Files $\le$ **50 MB**: Fully safe for standard Worker isolate ingestion.
   - Files **50 MB – 100 MB**: Permitted, but memory usage approaches isolate thresholds under high concurrency.
   - The Studio OS Admin UI displays a warning for files exceeding 50 MB, advising short/optimized clips.
