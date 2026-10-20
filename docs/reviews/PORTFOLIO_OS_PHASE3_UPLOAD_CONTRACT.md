# Portfolio OS Phase 3: Media Upload & Storage Contract

**Version:** 1.0.0  
**Status:** Approved & Verified (Local Simulation Mode)  
**System:** Kerem Mıhçı Portfolio OS — Videos & Reels Engine  
**Repository Branch:** `feature/cloudflare-cms-dashboard`  

---

## 1. Executive Summary

This document defines the strict binary and metadata contract for managing video and image assets within the Portfolio OS Videos & Reels CMS Engine. It enforces size limits, aspect ratios, allowed MIME types, key namespacing, and fail-closed validation across both local simulation and remote Cloudflare R2 object storage.

---

## 2. Asset Specification & Constraints

| Asset Category | Asset Type | Allowed MIME Types | Max File Size | Target Aspect Ratio | Recommended Resolution | Optimization Standard |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Video Asset** | `video` | `video/mp4`, `video/quicktime` | **100 MB** | 9:16 (Portrait) / 16:9 (Landscape) | 1080×1920 (9:16)<br>1920×1080 (16:9) | H.264 / AAC, faststart (`moov` at front), CRF 20–24 |
| **Poster Asset** | `poster` | `image/webp`, `image/jpeg`, `image/png` | **5 MB** | Matches video aspect ratio | 1080×1920 (9:16)<br>1920×1080 (16:9) | WebP (quality 85), lossless or near-lossless |
| **Thumbnail Asset** | `thumbnail` | `image/webp`, `image/jpeg`, `image/png` | **2 MB** | 1:1 or matches orientation | 400×711 (9:16)<br>640×360 (16:9) | WebP (quality 80) |

---

## 3. Storage Key Hierarchy & Namespacing

### 3.1 Cloudflare R2 Bucket Structure
All video assets uploaded through the CMS are persisted with deterministic, sanitized keys:

```
videos/
├── <video-slug>/
│   ├── video.mp4          # Canonical high-definition playback file
│   ├── poster.webp         # Video poster frame for pre-load and feed view
│   ├── thumbnail.webp      # Compact card thumbnail (optional)
│   └── uploads/
│       └── <timestamp>-<uuid>.<ext>  # Staged uploads before canonical commit
```

### 3.2 Storage Mode Classifications
Each row in `portfolio_video_assets` records its storage mode:
- `local_static`: Public assets bundled in Next.js `public/videos/<slug>/` for local development and offline preview.
- `r2`: Remote Cloudflare R2 object storage backed by custom domain or Worker proxy (`/api/media/videos/...`).
- `external`: External CDN or video hosting URL (e.g., Vimeo, YouTube, AWS S3).

---

## 4. API Upload Workflow & Validation

### 4.1 Admin Upload Endpoint
- **URL**: `POST /api/admin/media`
- **Authentication**: Strict server-side durable session cookie, valid `x-csrf-token`, and validated `Origin` header matching trusted admin origins.
- **Multipart Form Payload**:
  - `file`: Binary payload (Blob/File).
  - `category`: `"videos"`.
  - `slug`: Target video slug (e.g., `ai-moda-kombin-reels`).
  - `assetType`: `"video" | "poster" | "thumbnail"`.

### 4.2 Server-Side Validation Pipeline
1. **Magic Number & Header Inspection**: Verification that binary byte signature matches declared MIME type (`ftypisom`, `ftypmp42`, `RIFF....WEBP`).
2. **Size Enforcement**: Immediate fail-closed HTTP 413 if byte count exceeds defined limits (> 100 MB for video, > 5 MB for poster).
3. **Key Sanitization**: Slugs and filenames are strictly sanitized against path traversal (`..`, `/`, non-alphanumeric characters).
4. **Metadata Extraction**: Automatic calculation of `byte_size`, dimension (`width`, `height`), and duration (`duration_seconds`) where available.
5. **Database Transaction**: Atomic upsert into `portfolio_video_assets` coupled with revision snapshot in `portfolio_video_revisions`.

---

## 5. Streaming & Range Header Support

Public video delivery supports HTTP 206 Partial Content:
- `Range: bytes=0-` requests receive `HTTP 206 Partial Content` with `Content-Range: bytes 0-1048575/TotalBytes`.
- Browsers can seek seamlessly across both portrait 9:16 and landscape 16:9 videos without pre-buffering entire media files.
- Verified in test suite: `verify-phase3-video-cms.mjs` Group C assertions.
