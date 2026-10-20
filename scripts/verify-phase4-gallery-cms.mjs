#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Phase 4 Personal Gallery CMS Verification Suite
 *
 * Runs comprehensive, evidence-driven behavioral verification across all Phase 4 criteria:
 * - Group A: D1 Personal Gallery Schema & Relational Integrity (Migration 0003, 4 tables, 5 indexes, non-breaking check)
 * - Group B: Real Admin Gallery CRUD via HTTP Endpoints (Auth, Create, Read, Update, Revisions, Rollback, Delete)
 * - Group C: Image Media Upload, Signature & MIME Enforcement (JPEG, PNG, WebP up to 10 MB, reject disallowed/oversized)
 * - Group D: Safe Draft Isolation & Publishing Lifecycle (Draft returns 404 to public, 200 to admin, publish/unpublish/archive)
 * - Group E: Deterministic Ordering & Stream Sequence Persistence (Top-to-bottom sequence, reorder, append to bottom)
 * - Group F: Public Frontend Hydration, Aspect Ratio & Non-Regression (GalleryApp, sessionStore, no Dock/player regression)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const rootDir = process.cwd();
const localDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const baseUrl = "http://127.0.0.1:3099";

const results = {
  suite: "Portfolio OS Phase 4 Personal Gallery CMS Verification",
  timestamp: new Date().toISOString(),
  commit: "",
  total: 0,
  passed: 0,
  failed: 0,
  failures: [],
  groups: {}
};

try {
  results.commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {
  results.commit = "unknown";
}

let currentGroup = "General";

function setGroup(name) {
  currentGroup = name;
  if (!results.groups[name]) {
    results.groups[name] = { total: 0, passed: 0, failed: 0, checks: [] };
  }
  console.log(`\n============================================================`);
  console.log(`GROUP ${name}`);
  console.log(`============================================================`);
}

function assert(condition, name, detail = "") {
  results.total++;
  results.groups[currentGroup].total++;
  if (condition) {
    results.passed++;
    results.groups[currentGroup].passed++;
    console.log(`  ✓ PASS: ${name}${detail ? ` [${detail}]` : ""}`);
    results.groups[currentGroup].checks.push({ name, status: "PASS", detail });
  } else {
    results.failed++;
    results.groups[currentGroup].failed++;
    const msg = `  ✗ FAIL: ${name}${detail ? ` [${detail}]` : ""}`;
    console.error(msg);
    results.failures.push(`${currentGroup}: ${name}`);
    results.groups[currentGroup].checks.push({ name, status: "FAIL", detail });
  }
}

// Generate valid minimal binary files for test uploads
function createMinimalJpeg() {
  // Valid JPEG header: FF D8 FF E0 00 10 4A 46 49 46 00 01 ... FF D9
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);
}

function createMinimalPng() {
  // 1x1 transparent PNG: 89 50 4E 47 0D 0A 1A 0A ...
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
}

function createMinimalWebP() {
  // Valid 1x1 lossy WebP: RIFF ... WEBPVP8 ...
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x0e, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d,
    0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x34, 0x25, 0xa4, 0x00,
    0x03, 0x70, 0x00, 0xfe, 0xfb, 0xfd, 0x50, 0x00
  ]);
}

async function runSuite() {
  console.log("============================================================");
  console.log("PORTFOLIO OS PHASE 4: PERSONAL GALLERY CMS VERIFICATION");
  console.log(`Commit:    ${results.commit}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Target:    ${baseUrl}`);
  console.log("============================================================");

  // ------------------------------------------------------------
  // GROUP A: D1 PERSONAL GALLERY SCHEMA & RELATIONAL INTEGRITY
  // ------------------------------------------------------------
  setGroup("A: D1 Personal Gallery Schema & Relational Integrity");

  const migrationFile = path.join(
    rootDir,
    "cloudflare",
    "portfolio-api",
    "migrations",
    "0003_personal_gallery_schema.sql"
  );
  assert(fs.existsSync(migrationFile), "Migration file 0003_personal_gallery_schema.sql exists");

  const migrationSql = fs.readFileSync(migrationFile, "utf-8");
  assert(migrationSql.includes("portfolio_gallery_items"), "Migration contains portfolio_gallery_items");
  assert(migrationSql.includes("portfolio_gallery_translations"), "Migration contains portfolio_gallery_translations");
  assert(migrationSql.includes("portfolio_gallery_assets"), "Migration contains portfolio_gallery_assets");
  assert(migrationSql.includes("portfolio_gallery_revisions"), "Migration contains portfolio_gallery_revisions");
  assert(migrationSql.includes("idx_portfolio_gallery_status_sort"), "Migration contains status sort index");
  assert(migrationSql.includes("PRAGMA foreign_keys = ON;"), "Migration explicitly enforces foreign keys");

  // Open local SQLite database to inspect live schema
  const db = new DatabaseSync(localDbPath);

  // Bootstrap schema if needed
  db.exec(migrationSql);

  const localTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  assert(localTables.includes("portfolio_gallery_items"), "portfolio_gallery_items table exists in local D1");
  assert(localTables.includes("portfolio_gallery_translations"), "portfolio_gallery_translations table exists in local D1");
  assert(localTables.includes("portfolio_gallery_assets"), "portfolio_gallery_assets table exists in local D1");
  assert(localTables.includes("portfolio_gallery_revisions"), "portfolio_gallery_revisions table exists in local D1");

  // Check 5 indexes
  const localIndexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index'")
    .all()
    .map((r) => r.name);

  assert(localIndexes.includes("idx_portfolio_gallery_status_sort"), "idx_portfolio_gallery_status_sort exists");
  assert(localIndexes.includes("idx_portfolio_gallery_translations_lookup"), "idx_portfolio_gallery_translations_lookup exists");
  assert(localIndexes.includes("idx_portfolio_gallery_assets_lookup"), "idx_portfolio_gallery_assets_lookup exists");
  assert(localIndexes.includes("idx_portfolio_gallery_assets_storage_key"), "idx_portfolio_gallery_assets_storage_key exists");
  assert(localIndexes.includes("idx_portfolio_gallery_revisions_lookup"), "idx_portfolio_gallery_revisions_lookup exists");

  // Non-breaking check: Verify all 30 canonical projects, 1 staging draft, 70 media, 21 videos intact
  const projectCountRow = db.prepare("SELECT COUNT(*) as count FROM projects").get();
  assert(Number(projectCountRow.count) >= 30, "Existing projects preserved intact", `Count: ${projectCountRow.count}`);

  const mediaCountRow = db.prepare("SELECT COUNT(*) as count FROM project_media").get();
  assert(Number(mediaCountRow.count) >= 70, "Existing project media records preserved intact", `Count: ${mediaCountRow.count}`);

  const videoCountRow = db.prepare("SELECT COUNT(*) as count FROM portfolio_videos").get();
  assert(Number(videoCountRow.count) >= 21, "Existing canonical videos preserved intact", `Count: ${videoCountRow.count}`);

  // Foreign key cascade check
  db.exec("PRAGMA foreign_keys = ON;");
  const testId = `fk-test-${Date.now()}`;
  db.prepare("INSERT INTO portfolio_gallery_items (id, status, sort_order, created_at, updated_at) VALUES (?, 'draft', 999, datetime('now'), datetime('now'))").run(testId);
  db.prepare("INSERT INTO portfolio_gallery_translations (id, item_id, locale, alt_text, caption, updated_at) VALUES (?, ?, 'tr', 'Test Alt', '', datetime('now'))").run(`tr-${testId}`, testId);
  db.prepare("INSERT INTO portfolio_gallery_assets (id, item_id, storage_mode, storage_key, public_url, mime_type, byte_size, created_at, updated_at) VALUES (?, ?, 'r2', 'key/test', '/api/media/test', 'image/jpeg', 100, datetime('now'), datetime('now'))").run(`ast-${testId}`, testId);
  db.prepare("INSERT INTO portfolio_gallery_revisions (id, item_id, revision_number, action, snapshot_json, actor_email, created_at) VALUES (?, ?, 1, 'test', '{}', 'test@example.com', datetime('now'))").run(`rev-${testId}`, testId);

  db.prepare("DELETE FROM portfolio_gallery_items WHERE id = ?").run(testId);
  const orphanTranslations = db.prepare("SELECT COUNT(*) as count FROM portfolio_gallery_translations WHERE item_id = ?").get(testId);
  const orphanAssets = db.prepare("SELECT COUNT(*) as count FROM portfolio_gallery_assets WHERE item_id = ?").get(testId);
  const orphanRevisions = db.prepare("SELECT COUNT(*) as count FROM portfolio_gallery_revisions WHERE item_id = ?").get(testId);

  assert(Number(orphanTranslations.count) === 0, "Foreign key cascade on delete removes translations");
  assert(Number(orphanAssets.count) === 0, "Foreign key cascade on delete removes assets");
  assert(Number(orphanRevisions.count) === 0, "Foreign key cascade on delete removes revisions");

  // ------------------------------------------------------------
  // GROUP B: REAL ADMIN GALLERY CRUD VIA HTTP ENDPOINTS
  // ------------------------------------------------------------
  setGroup("B: Real Admin Gallery CRUD via HTTP Endpoints");

  // Read admin credentials from .staging-admin-credentials.local
  let adminEmail = "staging-admin@local.test";
  let adminPassword = "";
  const credFile = path.join(rootDir, ".staging-admin-credentials.local");
  if (fs.existsSync(credFile)) {
    const lines = fs.readFileSync(credFile, "utf-8").split("\n");
    for (const l of lines) {
      const t = l.trim();
      if (t.startsWith("ADMIN_EMAIL=")) adminEmail = t.slice("ADMIN_EMAIL=".length).trim();
      if (t.startsWith("ADMIN_PASSWORD=")) adminPassword = t.slice("ADMIN_PASSWORD=".length).trim();
    }
  }

  const authRes = await fetch(`${baseUrl}/api/admin/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  const authJson = await authRes.json();
  const setCookies = typeof authRes.headers.getSetCookie === "function"
    ? authRes.headers.getSetCookie()
    : [authRes.headers.get("set-cookie") || ""];
  const cookieHeader = setCookies.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
  const csrfToken = authJson.session?.csrfToken || authJson.csrfToken || "";

  assert(authRes.ok && Boolean(cookieHeader), `Admin authenticated successfully as ${adminEmail}`);
  assert(Boolean(csrfToken), "CSRF token returned by auth endpoint");

  const commonHeaders = {
    Cookie: cookieHeader,
    "x-csrf-token": csrfToken,
    "Content-Type": "application/json",
    Origin: baseUrl
  };

  // 1. Create Photograph
  const testPhotoId = `photo-${Date.now()}`;
  const createPayload = {
    id: testPhotoId,
    cmsStatus: "draft",
    src: "/assets/gallery/test-art.webp",
    altTR: "İstanbul Boğazı gün batımı",
    altEN: "Istanbul Bosphorus sunset",
    captionTR: "Marmara Denizi kıyısında çekilmiş fotoğraf",
    captionEN: "Photograph captured along the Marmara coast",
    year: "2026",
    location: "Istanbul, Turkey",
    sortOrder: 100
  };

  const createRes = await fetch(`${baseUrl}/api/admin/gallery`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify(createPayload)
  });
  assert(createRes.status === 201 || createRes.status === 200, "POST /api/admin/gallery creates photograph", `HTTP ${createRes.status}`);
  const createdJson = await createRes.json();
  assert(createdJson.ok === true, "Creation response reports ok: true");
  assert(createdJson.item?.id === testPhotoId, "Created photograph has matching ID");
  assert(createdJson.item?.alt?.tr === "İstanbul Boğazı gün batımı", "Created photograph stores Turkish alt");
  assert(createdJson.item?.alt?.en === "Istanbul Bosphorus sunset", "Created photograph stores English alt");

  // 2. Read Back via Admin Endpoints
  const listAdminRes = await fetch(`${baseUrl}/api/admin/gallery`, {
    headers: { Cookie: cookieHeader, Origin: baseUrl }
  });
  assert(listAdminRes.ok, "GET /api/admin/gallery succeeds", `HTTP ${listAdminRes.status}`);
  const listAdminData = await listAdminRes.json();
  const foundInAdmin = listAdminData.gallery?.find((g) => g.id === testPhotoId);
  assert(Boolean(foundInAdmin), "Created photograph appears in admin gallery list");

  const getByIdRes = await fetch(`${baseUrl}/api/admin/gallery/${testPhotoId}`, {
    headers: { Cookie: cookieHeader, Origin: baseUrl }
  });
  assert(getByIdRes.ok, "GET /api/admin/gallery/:id returns created photograph");
  const getByIdData = await getByIdRes.json();
  assert(getByIdData.item?.id === testPhotoId, "GET /api/admin/gallery/:id has matching ID");
  assert(Array.isArray(getByIdData.revisions) && getByIdData.revisions.length >= 1, "Initial creation records point-in-time revision");

  // 3. Update Photograph
  const updateRes = await fetch(`${baseUrl}/api/admin/gallery/${testPhotoId}`, {
    method: "PUT",
    headers: commonHeaders,
    body: JSON.stringify({
      ...createPayload,
      location: "Karaköy, Istanbul",
      captionEN: "Updated caption"
    })
  });
  assert(updateRes.ok, "PUT /api/admin/gallery/:id updates photograph");
  const updatedData = await updateRes.json();
  assert(updatedData.item?.location === "Karaköy, Istanbul", "Updated photograph persists updated location");
  assert(updatedData.revisions?.length >= 2, "Update records new revision (rev 2)");

  // 4. Rollback Revision
  const rollbackRes = await fetch(`${baseUrl}/api/admin/gallery/${testPhotoId}/revisions`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({ revisionNumber: 1 })
  });
  assert(rollbackRes.ok, "POST /api/admin/gallery/:id/revisions rolls back to revision 1");
  const rollbackData = await rollbackRes.json();
  assert(rollbackData.item?.location === "Istanbul, Turkey", "Rollback restored revision 1 location");

  // 5. Audit Logging Verification
  const auditRow = db.prepare("SELECT * FROM admin_audit_logs WHERE entity_type = 'gallery_item' AND entity_id = ? ORDER BY created_at DESC").get(testPhotoId);
  assert(Boolean(auditRow), "Audit log entry created for gallery item mutations");

  // ------------------------------------------------------------
  // GROUP C: IMAGE MEDIA UPLOAD, SIGNATURE & MIME ENFORCEMENT
  // ------------------------------------------------------------
  setGroup("C: Image Media Upload, Signature & MIME Enforcement");

  // Helper to upload multipart file to /api/admin/gallery/upload
  async function uploadPhoto(buffer, filename, mimeType, itemId = null) {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append("file", blob, filename);
    if (itemId) formData.append("itemId", itemId);

    return fetch(`${baseUrl}/api/admin/gallery/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "x-csrf-token": csrfToken,
        Origin: baseUrl
      },
      body: formData
    });
  }

  // 1. Valid JPEG
  const jpegBuf = createMinimalJpeg();
  const jpegRes = await uploadPhoto(jpegBuf, "sunset.jpg", "image/jpeg", testPhotoId);
  assert(jpegRes.status === 201, "Valid JPEG upload accepted with 201", `HTTP ${jpegRes.status}`);
  const jpegData = await jpegRes.json();
  assert(Boolean(jpegData.publicUrl), "JPEG upload returns publicUrl");
  assert(jpegData.asset?.mimeType === "image/jpeg", "JPEG asset record has image/jpeg MIME type");

  // 2. Valid PNG
  const pngBuf = createMinimalPng();
  const pngRes = await uploadPhoto(pngBuf, "art.png", "image/png", testPhotoId);
  assert(pngRes.status === 201, "Valid PNG upload accepted with 201", `HTTP ${pngRes.status}`);

  // 3. Valid WebP
  const webpBuf = createMinimalWebP();
  const webpRes = await uploadPhoto(webpBuf, "view.webp", "image/webp", testPhotoId);
  assert(webpRes.status === 201, "Valid WebP upload accepted with 201", `HTTP ${webpRes.status}`);

  // 4. Reject disallowed MIME type (e.g. video/mp4)
  const mp4Res = await uploadPhoto(Buffer.from("fake mp4 content"), "video.mp4", "video/mp4", testPhotoId);
  assert(mp4Res.status === 400, "Disallowed MIME type video/mp4 rejected with 400", `HTTP ${mp4Res.status}`);

  // 5. Reject fake signature (corrupted bytes with image/png MIME)
  const fakePngRes = await uploadPhoto(Buffer.from("NOT A REAL PNG SIGNATURE!"), "fake.png", "image/png", testPhotoId);
  assert(fakePngRes.status === 400, "Invalid magic byte signature rejected with 400", `HTTP ${fakePngRes.status}`);

  // 6. Reject oversized image (> 10 MB)
  const oversizedBuf = Buffer.alloc(11 * 1024 * 1024); // 11 MB
  const oversizeRes = await uploadPhoto(oversizedBuf, "huge.jpg", "image/jpeg", testPhotoId);
  assert(oversizeRes.status === 400 || oversizeRes.status === 413, "Oversized file > 10 MB rejected", `HTTP ${oversizeRes.status}`);

  // ------------------------------------------------------------
  // GROUP D: SAFE DRAFT ISOLATION & PUBLISHING LIFECYCLE
  // ------------------------------------------------------------
  setGroup("D: Safe Draft Isolation & Publishing Lifecycle");

  const draftPhotoId = `draft-photo-${Date.now()}`;
  // Upload a fresh WebP for the draft item
  const draftUploadRes = await uploadPhoto(createMinimalWebP(), "draft.webp", "image/webp", draftPhotoId);
  const draftUploadJson = await draftUploadRes.json();
  const draftMediaUrl = draftUploadJson.publicUrl;

  // Initialize draft photograph
  await fetch(`${baseUrl}/api/admin/gallery`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      id: draftPhotoId,
      cmsStatus: "draft",
      src: draftMediaUrl,
      altTR: "Taslak Fotoğraf",
      altEN: "Draft Photograph",
      sortOrder: 50
    })
  });

  // 1. Verify Draft is hidden from anonymous public gallery endpoint
  const publicGalleryRes1 = await fetch(`${baseUrl}/api/v1/public/gallery`);
  assert(publicGalleryRes1.ok, "GET /api/v1/public/gallery succeeds");
  const publicGalleryData1 = await publicGalleryRes1.json();
  const draftInPublic = publicGalleryData1.gallery?.find((g) => g.id === draftPhotoId);
  assert(!draftInPublic, "Draft photograph is completely absent from public gallery list (Safe Draft Isolation)");

  // 2. Verify Draft media asset returns 404 to anonymous visitors
  if (draftMediaUrl) {
    const publicMediaRes = await fetch(`${baseUrl}${draftMediaUrl}`);
    assert(publicMediaRes.status === 404, "Draft media asset returns 404 to unauthenticated public visitors", `HTTP ${publicMediaRes.status}`);
  }

  // 3. Publishing validation: Missing alt text must fail
  const invalidPublishRes = await fetch(`${baseUrl}/api/admin/gallery/${draftPhotoId}`, {
    method: "PUT",
    headers: commonHeaders,
    body: JSON.stringify({
      id: draftPhotoId,
      cmsStatus: "published",
      src: draftMediaUrl,
      altTR: "", // Missing Turkish alt
      altEN: "Only English"
    })
  });
  assert(invalidPublishRes.status === 400, "Publishing without bilingual alt text rejected with 400", `HTTP ${invalidPublishRes.status}`);

  // 4. Valid Publish
  const publishRes = await fetch(`${baseUrl}/api/admin/gallery/${draftPhotoId}`, {
    method: "PUT",
    headers: commonHeaders,
    body: JSON.stringify({
      id: draftPhotoId,
      cmsStatus: "published",
      src: draftMediaUrl,
      altTR: "Yayınlanan Fotoğraf",
      altEN: "Published Photograph",
      sortOrder: 50
    })
  });
  assert(publishRes.ok, "Valid publishing succeeds with 200", `HTTP ${publishRes.status}`);

  // 5. Verify published photograph appears on public gallery
  const publicGalleryRes2 = await fetch(`${baseUrl}/api/v1/public/gallery`);
  const publicGalleryData2 = await publicGalleryRes2.json();
  const publishedInPublic = publicGalleryData2.gallery?.find((g) => g.id === draftPhotoId);
  assert(Boolean(publishedInPublic), "Published photograph immediately visible on public gallery");

  // 6. Verify published media asset returns 200 to public
  if (draftMediaUrl) {
    const publicMediaRes2 = await fetch(`${baseUrl}${draftMediaUrl}`);
    assert(publicMediaRes2.status === 200, "Published media asset returns 200 OK to public visitors", `HTTP ${publicMediaRes2.status}`);
  }

  // 7. Instant Unpublish
  await fetch(`${baseUrl}/api/admin/gallery/${draftPhotoId}`, {
    method: "PUT",
    headers: commonHeaders,
    body: JSON.stringify({
      id: draftPhotoId,
      cmsStatus: "draft",
      src: draftMediaUrl,
      altTR: "Geri Çekilen Fotoğraf",
      altEN: "Unpublished Photograph"
    })
  });

  const publicGalleryRes3 = await fetch(`${baseUrl}/api/v1/public/gallery`);
  const publicGalleryData3 = await publicGalleryRes3.json();
  assert(!publicGalleryData3.gallery?.find((g) => g.id === draftPhotoId), "Unpublished photograph instantly disappears from public gallery");

  if (draftMediaUrl) {
    const unpubMediaRes = await fetch(`${baseUrl}${draftMediaUrl}`);
    assert(unpubMediaRes.status === 404, "Unpublished media asset immediately returns 404 to public visitors");
  }

  // ------------------------------------------------------------
  // GROUP E: DETERMINISTIC ORDERING & STREAM SEQUENCE PERSISTENCE
  // ------------------------------------------------------------
  setGroup("E: Deterministic Ordering & Stream Sequence Persistence");

  // Create 3 distinct test photos: P1, P2, P3
  const p1Id = `order-p1-${Date.now()}`;
  const p2Id = `order-p2-${Date.now()}`;
  const p3Id = `order-p3-${Date.now()}`;

  await fetch(`${baseUrl}/api/admin/gallery`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      id: p1Id,
      cmsStatus: "published",
      src: "/assets/gallery/p1.webp",
      altTR: "Birinci Fotoğraf",
      altEN: "First Photograph",
      sortOrder: 10
    })
  });

  await fetch(`${baseUrl}/api/admin/gallery`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      id: p2Id,
      cmsStatus: "published",
      src: "/assets/gallery/p2.webp",
      altTR: "İkinci Fotoğraf",
      altEN: "Second Photograph",
      sortOrder: 20
    })
  });

  await fetch(`${baseUrl}/api/admin/gallery`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      id: p3Id,
      cmsStatus: "published",
      src: "/assets/gallery/p3.webp",
      altTR: "Üçüncü Fotoğraf",
      altEN: "Third Photograph",
      sortOrder: 30
    })
  });

  // Query public gallery
  const orderRes1 = await fetch(`${baseUrl}/api/v1/public/gallery`);
  const orderData1 = await orderRes1.json();
  const testItems1 = (orderData1.gallery || []).filter((g) => [p1Id, p2Id, p3Id].includes(g.id));
  assert(testItems1.length === 3, "All 3 test photographs returned on public gallery");
  assert(
    testItems1.length === 3 &&
      testItems1[0]?.id === p1Id &&
      testItems1[1]?.id === p2Id &&
      testItems1[2]?.id === p3Id,
    "Initial order strictly reflects sortOrder ASC (P1 -> P2 -> P3)",
    `Actual: ${testItems1.map((x) => x.id).join(" -> ")}`
  );

  // Reorder: Move P3 to top, then P1, then P2
  const reorderPayload = [
    { id: p3Id, sortOrder: 0 },
    { id: p1Id, sortOrder: 1 },
    { id: p2Id, sortOrder: 2 }
  ];

  const reorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({ items: reorderPayload })
  });
  assert(reorderRes.ok, "POST /api/admin/gallery/reorder succeeds with 200");

  const orderRes2 = await fetch(`${baseUrl}/api/v1/public/gallery`);
  const orderData2 = await orderRes2.json();
  const testItems2 = (orderData2.gallery || []).filter((g) => [p1Id, p2Id, p3Id].includes(g.id));
  assert(
    testItems2.length === 3 &&
      testItems2[0]?.id === p3Id &&
      testItems2[1]?.id === p1Id &&
      testItems2[2]?.id === p2Id,
    "Updated stream order persisted and served deterministically (P3 -> P1 -> P2)",
    `Actual: ${testItems2.map((x) => x.id).join(" -> ")}`
  );

  // Append new photo without explicit sortOrder (must default to max + 1)
  const p4Id = `order-p4-${Date.now()}`;
  const p4Res = await fetch(`${baseUrl}/api/admin/gallery`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      id: p4Id,
      cmsStatus: "published",
      src: "/assets/gallery/p4.webp",
      altTR: "Dördüncü Fotoğraf",
      altEN: "Fourth Photograph"
    })
  });
  const p4Data = await p4Res.json();
  assert(p4Data.item?.sortOrder > 2, "New photograph defaults to appending at the bottom", `sortOrder: ${p4Data.item?.sortOrder}`);

  // Clean up test order items
  for (const id of [p1Id, p2Id, p3Id, p4Id, testPhotoId, draftPhotoId]) {
    await fetch(`${baseUrl}/api/admin/gallery/${id}`, {
      method: "DELETE",
      headers: commonHeaders
    }).catch(() => {});
  }

  // ------------------------------------------------------------
  // GROUP F: PUBLIC FRONTEND HYDRATION, ASPECT RATIO & NON-REGRESSION
  // ------------------------------------------------------------
  setGroup("F: Public Frontend Hydration, Aspect Ratio & Non-Regression");

  // 1. Verify Public Homepage (/tr and /en)
  const pageTrRes = await fetch(`${baseUrl}/tr`);
  assert(pageTrRes.status === 200, "Public Turkish desktop /tr renders with 200 OK");
  const htmlTr = await pageTrRes.text();
  assert(htmlTr.includes("<!DOCTYPE html>"), "Response is valid HTML document");

  const pageEnRes = await fetch(`${baseUrl}/en`);
  assert(pageEnRes.status === 200, "Public English desktop /en renders with 200 OK");

  // 2. Verify GalleryApp component code preserves natural aspect ratio
  const galleryAppCode = fs.readFileSync(
    path.join(rootDir, "src", "components", "applications", "GalleryApp.tsx"),
    "utf-8"
  );
  assert(galleryAppCode.includes("flex flex-col gap-4"), "GalleryApp renders single vertical stream (flex-col gap-4)");
  assert(galleryAppCode.includes("object-contain"), "GalleryApp preserves natural aspect ratio (object-contain)");
  assert(!galleryAppCode.includes("aspect-square"), "GalleryApp contains zero forced square cropping");

  // 3. Verify sessionStore hydration
  const sessionStoreCode = fs.readFileSync(
    path.join(rootDir, "src", "store", "sessionStore.ts"),
    "utf-8"
  );
  assert(sessionStoreCode.includes("hydrateGallery"), "sessionStore exposes hydrateGallery");
  assert(sessionStoreCode.includes("isCmsMode"), "hydrateGallery supports isCmsMode flag");

  // 4. Verify Admin Dashboard Client UI
  const adminCode = fs.readFileSync(
    path.join(rootDir, "src", "app", "admin", "AdminDashboardClient.tsx"),
    "utf-8"
  );
  assert(adminCode.includes("admin-gallery-section"), "AdminDashboardClient contains admin-gallery-section");
  assert(adminCode.includes("admin-gallery-editor-section"), "AdminDashboardClient contains admin-gallery-editor-section");
  assert(adminCode.includes("gallery-reorder-toggle-btn"), "AdminDashboardClient contains gallery-reorder-toggle-btn");

  // 5. Non-regression check: Canonical database content
  const finalProjectCount = db.prepare("SELECT COUNT(*) as count FROM projects").get();
  const finalVideoCount = db.prepare("SELECT COUNT(*) as count FROM portfolio_videos").get();
  assert(Number(finalProjectCount.count) >= 30, "Non-regression: 30 canonical projects preserved", `Count: ${finalProjectCount.count}`);
  assert(Number(finalVideoCount.count) >= 21, "Non-regression: 21 canonical videos preserved", `Count: ${finalVideoCount.count}`);

  db.close();

  // ------------------------------------------------------------
  // SUITE SUMMARY & REPORT PERSISTENCE
  // ------------------------------------------------------------
  console.log("\n============================================================");
  console.log("PHASE 4 VERIFICATION SUITE RESULTS SUMMARY");
  console.log("============================================================");
  console.log(`TOTAL CHECKS: ${results.total}`);
  console.log(`PASSED:       ${results.passed}`);
  console.log(`FAILED:       ${results.failed}`);

  if (results.failures.length > 0) {
    console.error("\nFAILURES:");
    for (const f of results.failures) {
      console.error(`  - ${f}`);
    }
  }

  // Write results JSON
  const reportsDir = path.join(rootDir, "docs", "reviews");
  fs.mkdirSync(reportsDir, { recursive: true });
  const resultsJsonPath = path.join(reportsDir, "PORTFOLIO_OS_PHASE4_GALLERY_TEST_RESULTS.json");
  fs.writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nResults written to: ${resultsJsonPath}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Verification suite failed with unhandled error:", err);
  process.exit(1);
});
