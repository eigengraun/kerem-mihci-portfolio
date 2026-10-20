# Portfolio OS: Staging Cleanup Candidates & Read-Only Data Investigation

**Date:** October 20, 2026  
**Auditor:** Antigravity Agentic Engineer  
**Database:** Cloudflare D1 Staging (`kerem-portfolio-db-staging`)  
**Worker API:** `https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev`  
**Mandate:** Read-Only Investigation Only — ZERO MUTATION OR DELETION EXECUTED.

---

## 1. Executive Summary

A comprehensive, read-only inspection of the remote Cloudflare D1 staging database was conducted via the staging Worker API (`GET /api/v1/admin/projects` and `GET /api/v1/admin/system`). 

### Key Findings:
1. **Total Records in Staging D1**: **31 projects**
   - **30 Canonical Projects**: 100% matched with canonical source code (`src/data/projects.ts`):
     - `workspace: "design"`: 18 projects (all `status: "published"`)
     - `workspace: "web"`: 12 projects (all `status: "published"`)
     - Total published: **30 projects**
   - **1 Non-Canonical Record**: Exactly one extra record exists (`slug: "staging-e2e-29cbd44d"`).
2. **Public Data Exposure Verification**:
   - The public Worker endpoint `GET /api/v1/public/projects` was queried directly.
   - Result: Exactly 30 published projects returned (`Is draft exposed publicly?: false`).
   - **Conclusion**: The extra record has never leaked to the public website or visitors. It exists purely as an administrative draft within D1.
3. **Artifact Provenance**:
   - The record was created at `2026-10-19T22:32:28.259Z` during an automated staging E2E test suite run (`verify-remote-staging-e2e.mjs`).
   - Audit logs show subsequent test runs (`staging-runner-271ab35d`, `staging-runner-e64cc606`) successfully cleaned up their own test projects (`project_delete`, `media_delete`).
   - The `staging-e2e-29cbd44d` record remained because its specific test runner process was interrupted before its teardown step could execute.
   - **Zero user-created or manual portfolio data is involved.**

---

## 2. Exact Technical Profile of the Candidate Record

```json
{
  "id": "staging-e2e-29cbd44d",
  "slug": "staging-e2e-29cbd44d",
  "cmsStatus": "draft",
  "status": "completed",
  "workspace": "web",
  "categoryIds": ["website"],
  "featured": true,
  "sortOrder": 31,
  "titleTR": "Staging E2E Test Projesi",
  "titleEN": "Staging E2E Test Project",
  "categoryTR": "Web & Bulut Doğrulama",
  "categoryEN": "Web & Cloud Verification",
  "client": "Staging Verification Lab",
  "year": "2026",
  "summaryTR": "Gerçek Cloudflare altyapısında test edilen taslak proje.",
  "summaryEN": "Draft project verified on real Cloudflare infrastructure.",
  "descriptionTR": "Bu proje Cloudflare D1 ve R2 staging entegrasyonu için oluşturulmuştur.",
  "descriptionEN": "Created to verify Cloudflare D1 and R2 staging integration.",
  "servicesTR": [],
  "servicesEN": [],
  "tools": [],
  "deliverablesTR": [],
  "deliverablesEN": [],
  "highlightsTR": [],
  "highlightsEN": [],
  "tags": [],
  "liveUrl": "https://keremmihci.com",
  "initials": "ST",
  "cover": "/api/media/projects/staging-e2e-29cbd44d/cover/2026/10/d10a27f6-staging-e2e-29cbd44d-cover.webp",
  "thumbnail": "/api/media/projects/staging-e2e-29cbd44d/cover/2026/10/d10a27f6-staging-e2e-29cbd44d-cover.webp",
  "desktopIcon": "/api/media/projects/staging-e2e-29cbd44d/cover/2026/10/d10a27f6-staging-e2e-29cbd44d-cover.webp",
  "desktopThumbnail": {
    "src": "/api/media/projects/staging-e2e-29cbd44d/cover/2026/10/d10a27f6-staging-e2e-29cbd44d-cover.webp",
    "width": 120,
    "height": 90,
    "scale": 1
  },
  "media": [
    {
      "id": "staging-e2e-29cbd44d-media-1",
      "type": "image",
      "src": "/api/media/projects/staging-e2e-29cbd44d/cover/2026/10/d10a27f6-staging-e2e-29cbd44d-cover.webp",
      "altTR": "Staging Test Görseli",
      "altEN": "Staging Test Image"
    }
  ],
  "desktop": { "x": 28, "y": 28 },
  "initialWindow": { "width": 820, "height": 600 },
  "createdAt": "2026-10-19T22:32:28.259Z",
  "updatedAt": "2026-10-19T22:32:28.259Z",
  "publishedAt": null,
  "archivedAt": null
}
```

---

## 3. Associated R2 Stored Media
- Storage Key: `projects/staging-e2e-29cbd44d/cover/2026/10/d10a27f6-staging-e2e-29cbd44d-cover.webp`
- Size: 44 bytes (synthetic test WebP header)
- Public URL: `/api/media/projects/staging-e2e-29cbd44d/cover/2026/10/d10a27f6-staging-e2e-29cbd44d-cover.webp`

---

## 4. Operational Assessment & Recommended Procedure

### Operational Assessment:
- The presence of this draft does not corrupt canonical data.
- The 30 canonical projects have `status = 'published'` and match source files with 0 missing slugs and 0 field mismatches.
- However, because `staging-e2e-29cbd44d` has `featured = 1`, the admin dashboard Featured Manager previously displayed it without differentiating its draft status.
- In Phase 1, we implemented client-side isolation: drafts are now clearly badged as `DRAFT / NOT PUBLIC`, and only published featured projects are counted as live desktop items.

### Recommended Future Surgical Cleanup (Awaiting Explicit User Authorization):
When the user explicitly authorizes staging cleanup in a future session, the following non-destructive, surgical procedure should be executed:

```sql
-- Step 1: Remove associated media record from project_media
DELETE FROM project_media WHERE project_id = 'staging-e2e-29cbd44d';

-- Step 2: Remove translations (handled by CASCADE if FK active, or explicit delete)
DELETE FROM project_translations WHERE project_id = 'staging-e2e-29cbd44d';

-- Step 3: Remove project record
DELETE FROM projects WHERE id = 'staging-e2e-29cbd44d';

-- Step 4: Verification query
SELECT count(*) as total, sum(case when status='published' then 1 else 0 end) as published FROM projects;
-- Expected result: total = 30, published = 30
```

> [!IMPORTANT]
> **Safety Guarantee**: In accordance with instructions, **NO DELETE queries have been executed during this audit and Phase 1**. Staging D1 remains completely untouched.
