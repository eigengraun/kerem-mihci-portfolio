#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Phase 4.1 Personal Gallery CMS Verification Suite
 *
 * Runs comprehensive, evidence-driven behavioral verification across all Phase 4.1 criteria:
 * - Group A: D1 Personal Gallery Schema & Relational Integrity (Migration 0003, 4 tables, 5 indexes, non-breaking check)
 * - Group B: Real Admin Gallery CRUD via HTTP Endpoints (Auth, CSRF, Create, Read, Update, Revisions, Rollback, Delete)
 * - Group C: Single-Record Identity Lifecycle & Zero Duplicate/Orphan Prevention
 * - Group D: Safe Provisional Asset Isolation & Premature Publication Prevention
 * - Group E: Partial Update Preservation & Strict Validation
 * - Group F: Strict Cross-Entity Media Ownership Verification
 * - Group G: Atomic Reorder Validation & Stream Sequence Persistence
 * - Group H: Image Media Upload, MIME & EXIF GPS Privacy Enforcement
 * - Group I: Upstream Outage Reporting (Degraded State HTTP 503)
 * - Group J: Public Frontend Hydration, Natural Aspect Ratio & Non-Regression
 * - Group K: Test Fixture Isolation & Zero Host Database Mutation Verification
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execSync, spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const rootDir = process.cwd();
const hostDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const testPort = 3198;
const baseUrl = `http://127.0.0.1:${testPort}`;

const results = {
  suite: "Portfolio OS Phase 4.1 Personal Gallery CMS Hardening Verification",
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

function getFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function createMinimalJpeg() {
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
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x0e, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d,
    0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x34, 0x25, 0xa4, 0x00,
    0x03, 0x70, 0x00, 0xfe, 0xfb, 0xfd, 0x50, 0x00
  ]);
}

function createJpegWithGps() {
  const exif = [
    0xff, 0xd8, // SOI
    0xff, 0xe1, // APP1
    0x00, 0x28, // Length: 40 bytes
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif\0\0
    0x49, 0x49, 0x2a, 0x00, // II, little endian
    0x08, 0x00, 0x00, 0x00, // IFD0 offset = 8
    0x01, 0x00, // 1 entry
    0x25, 0x88, // Tag 0x8825 (GPSInfo)
    0x04, 0x00, // Type LONG
    0x01, 0x00, 0x00, 0x00, // Count 1
    0x1a, 0x00, 0x00, 0x00, // Offset
    0x00, 0x00, 0x00, 0x00, // Next IFD = 0
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // SOF0 (1x1)
    0xff, 0xd9 // EOI
  ];
  return Buffer.from(exif);
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/v1/public/health`, { method: "HEAD" });
      if (res.status < 500) return true;
    } catch {
      // Retry after delay
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server failed to start on ${url} within ${timeoutMs}ms.`);
}

async function runSuite() {
  console.log("============================================================");
  console.log("PORTFOLIO OS PHASE 4.1: PERSONAL GALLERY CMS VERIFICATION");
  console.log(`Commit:    ${results.commit}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log("============================================================");

  // Record initial state of host database for non-pollution guarantee
  const hostInitialSha256 = getFileSha256(hostDbPath);

  // Setup isolated temporary SQLite test database and media dir
  const tempDbPath = path.join(os.tmpdir(), `portfolio-test-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.sqlite`);
  const tempR2Dir = path.join(os.tmpdir(), `r2-test-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`);
  fs.mkdirSync(tempR2Dir, { recursive: true });

  if (fs.existsSync(hostDbPath)) {
    fs.copyFileSync(hostDbPath, tempDbPath);
  }

  let testServerProcess = null;
  let testDbConnection = null;

  try {
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
    assert(migrationSql.includes("asset_status"), "Migration contains asset_status column");
    assert(migrationSql.includes("idx_portfolio_gallery_assets_lookup"), "Migration contains (item_id, asset_status) index");
    assert(!migrationSql.includes("UNIQUE(item_id)"), "Migration allows multiple historical/provisional assets per item (no UNIQUE item_id constraint)");

    // Open isolated test SQLite database
    testDbConnection = new DatabaseSync(tempDbPath);
    testDbConnection.exec(migrationSql);

    const assetCols = testDbConnection.prepare("PRAGMA table_info(portfolio_gallery_assets)").all().map((c) => c.name);
    if (!assetCols.includes("asset_status")) {
      testDbConnection.exec("ALTER TABLE portfolio_gallery_assets ADD COLUMN asset_status TEXT NOT NULL DEFAULT 'active';");
      testDbConnection.exec("CREATE INDEX IF NOT EXISTS idx_portfolio_gallery_assets_lookup ON portfolio_gallery_assets(item_id, asset_status);");
    }

    const localTables = testDbConnection
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);

    assert(localTables.includes("portfolio_gallery_items"), "portfolio_gallery_items table exists in test D1");
    assert(localTables.includes("portfolio_gallery_translations"), "portfolio_gallery_translations table exists in test D1");
    assert(localTables.includes("portfolio_gallery_assets"), "portfolio_gallery_assets table exists in test D1");
    assert(localTables.includes("portfolio_gallery_revisions"), "portfolio_gallery_revisions table exists in test D1");

    // Foreign key cascade check
    testDbConnection.exec("PRAGMA foreign_keys = ON;");
    const testFkId = `fk-test-${Date.now()}`;
    testDbConnection.prepare("INSERT INTO portfolio_gallery_items (id, status, sort_order, created_at, updated_at) VALUES (?, 'draft', 999, datetime('now'), datetime('now'))").run(testFkId);
    testDbConnection.prepare("INSERT INTO portfolio_gallery_translations (id, item_id, locale, alt_text, caption, updated_at) VALUES (?, ?, 'tr', 'Test Alt', '', datetime('now'))").run(`tr-${testFkId}`, testFkId);
    testDbConnection.prepare("INSERT INTO portfolio_gallery_assets (id, item_id, storage_mode, storage_key, public_url, mime_type, byte_size, asset_status, created_at, updated_at) VALUES (?, ?, 'r2', 'key/test', '/api/media/test', 'image/jpeg', 100, 'active', datetime('now'), datetime('now'))").run(`ast-${testFkId}`, testFkId);
    testDbConnection.prepare("INSERT INTO portfolio_gallery_revisions (id, item_id, revision_number, action, snapshot_json, actor_email, created_at) VALUES (?, ?, 1, 'test', '{}', 'test@example.com', datetime('now'))").run(`rev-${testFkId}`, testFkId);

    testDbConnection.prepare("DELETE FROM portfolio_gallery_items WHERE id = ?").run(testFkId);
    const orphanTranslations = testDbConnection.prepare("SELECT COUNT(*) as count FROM portfolio_gallery_translations WHERE item_id = ?").get(testFkId);
    const orphanAssets = testDbConnection.prepare("SELECT COUNT(*) as count FROM portfolio_gallery_assets WHERE item_id = ?").get(testFkId);
    const orphanRevisions = testDbConnection.prepare("SELECT COUNT(*) as count FROM portfolio_gallery_revisions WHERE item_id = ?").get(testFkId);

    assert(Number(orphanTranslations.count) === 0, "Foreign key cascade on delete removes translations");
    assert(Number(orphanAssets.count) === 0, "Foreign key cascade on delete removes assets");
    assert(Number(orphanRevisions.count) === 0, "Foreign key cascade on delete removes revisions");

    // Close SQLite handle so Next.js server can open it safely
    testDbConnection.close();
    testDbConnection = null;

    // Spawn isolated Next.js staging server pointing strictly to isolated temp DB and temp R2 dir
    console.log(`\nSpawning isolated test server on port ${testPort}...`);
    const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

    const envStagingPath = path.join(rootDir, ".env.staging.local");
    const stagingEnv = {};
    if (fs.existsSync(envStagingPath)) {
      const content = fs.readFileSync(envStagingPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          stagingEnv[key] = val;
        }
      }
    }

    const testEnv = {
      ...process.env,
      ...stagingEnv,
      NODE_ENV: "production",
      CMS_STORAGE_MODE: "local",
      CMS_DATA_SOURCE: "local",
      LOCAL_D1_DB_PATH: tempDbPath,
      LOCAL_R2_DIR_PATH: tempR2Dir,
      PORT: String(testPort),
      HOSTNAME: "127.0.0.1",
      ADMIN_TRUSTED_ORIGINS: `http://127.0.0.1:${testPort},http://localhost:${testPort}`
    };

    delete testEnv.CLOUDFLARE_CMS_API_URL;
    delete testEnv.CLOUDFLARE_API_SERVICE_TOKEN;

    testServerProcess = spawn(process.execPath, [nextBin, "start", "-p", String(testPort), "-H", "127.0.0.1"], {
      cwd: rootDir,
      env: testEnv,
      stdio: "pipe"
    });

    await waitForServer(baseUrl, 15000);
    console.log(`Isolated test server ready on ${baseUrl}`);

    // Re-open SQLite connection for direct inspection
    testDbConnection = new DatabaseSync(tempDbPath);

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

    // ------------------------------------------------------------
    // GROUP B: REAL ADMIN GALLERY CRUD VIA HTTP ENDPOINTS
    // ------------------------------------------------------------
    setGroup("B: Real Admin Gallery CRUD via HTTP Endpoints");

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

    const listAdminRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      headers: { Cookie: cookieHeader, Origin: baseUrl }
    });
    assert(listAdminRes.ok, "GET /api/admin/gallery succeeds", `HTTP ${listAdminRes.status}`);
    const listAdminData = await listAdminRes.json();
    const foundInAdmin = listAdminData.gallery?.find((g) => g.id === testPhotoId);
    assert(Boolean(foundInAdmin), "Created photograph appears in admin gallery list");

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

    // ------------------------------------------------------------
    // GROUP C: SINGLE-RECORD IDENTITY LIFECYCLE & ZERO DUPLICATE PREVENTION
    // ------------------------------------------------------------
    setGroup("C: Single-Record Identity Lifecycle & Zero Duplicate Prevention");

    // Test the create lifecycle: Stable ID upfront -> upload image -> save draft
    const stableFlowId = `photo-flow-${Date.now()}`;
    const initialItemCount = Number(testDbConnection.prepare("SELECT COUNT(*) as count FROM portfolio_gallery_items").get().count);

    // 1. Upload image passing the stable ID
    const flowJpeg = createMinimalJpeg();
    const flowUploadRes = await uploadPhoto(flowJpeg, "flow-test.jpg", "image/jpeg", stableFlowId);
    assert(flowUploadRes.status === 201, "Upload with stable ID creates initial draft asset", `HTTP ${flowUploadRes.status}`);
    const flowUploadData = await flowUploadRes.json();
    assert(flowUploadData.asset?.itemId === stableFlowId, "Uploaded asset binds strictly to the stable item ID");

    // 2. Save draft metadata for that exact same item ID
    const flowSaveRes = await fetch(`${baseUrl}/api/admin/gallery/${encodeURIComponent(stableFlowId)}`, {
      method: "PUT",
      headers: commonHeaders,
      body: JSON.stringify({
        id: stableFlowId,
        cmsStatus: "draft",
        src: flowUploadData.publicUrl,
        altTR: "Akış testi görseli",
        altEN: "Flow test image",
        asset: flowUploadData.asset
      })
    });
    if (!flowSaveRes.ok) {
      console.log("flowSaveRes failed:", await flowSaveRes.clone().text());
    }
    assert(flowSaveRes.ok, "Saving draft for existing item ID succeeds with 200", `HTTP ${flowSaveRes.status}`);

    const postItemCount = Number(testDbConnection.prepare("SELECT COUNT(*) as count FROM portfolio_gallery_items").get().count);
    assert(postItemCount === initialItemCount + 1, "Exactly ONE gallery record created during Add -> Upload -> Save flow (zero orphan duplicates)", `Expected: ${initialItemCount + 1}, Actual: ${postItemCount}`);

    // ------------------------------------------------------------
    // GROUP D: SAFE PROVISIONAL ASSET ISOLATION & PREMATURE PUBLICATION PREVENTION
    // ------------------------------------------------------------
    setGroup("D: Safe Provisional Asset Isolation & Premature Publication Prevention");

    const pubPhotoId = `photo-pub-${Date.now()}`;
    const initialJpeg = createMinimalJpeg();
    const up1Res = await uploadPhoto(initialJpeg, "active-v1.jpg", "image/jpeg", pubPhotoId);
    if (!up1Res.ok) console.log("up1Res failed:", await up1Res.clone().text());
    const up1Data = await up1Res.json();
    const activeStorageKey = up1Data.asset?.storageKey;
    const activePublicUrl = up1Data.publicUrl;

    // Publish the photo
    const publishRes = await fetch(`${baseUrl}/api/admin/gallery/${encodeURIComponent(pubPhotoId)}`, {
      method: "PUT",
      headers: commonHeaders,
      body: JSON.stringify({
        id: pubPhotoId,
        cmsStatus: "published",
        src: activePublicUrl,
        altTR: "Yayınlanmış fotoğraf",
        altEN: "Published photograph",
        asset: up1Data.asset
      })
    });
    if (!publishRes.ok) {
      console.log("publishRes failed:", await publishRes.clone().text());
    }
    assert(publishRes.ok, "Item published successfully");

    // Verify public anonymous GET to active media returns 200
    const publicActiveRes = await fetch(`${baseUrl}${activePublicUrl}`);
    assert(publicActiveRes.status === 200, "Public anonymous visitor can access active published image (HTTP 200)");

    // Upload a replacement image for the already-published photograph
    const replacementPng = createMinimalPng();
    const up2Res = await uploadPhoto(replacementPng, "provisional-v2.png", "image/png", pubPhotoId);
    assert(up2Res.status === 201, "Replacement image upload accepted (HTTP 201)");
    const up2Data = await up2Res.json();
    const provStorageKey = up2Data.asset.storageKey;
    const provPublicUrl = up2Data.publicUrl;

    assert(up2Data.asset.assetStatus === "provisional", "Replacement asset assigned asset_status: provisional");

    // Anonymous public visitor requesting the provisional replacement key MUST get 404 with no-store
    const anonProvRes = await fetch(`${baseUrl}${provPublicUrl}`);
    assert(anonProvRes.status === 404, "Public anonymous request for provisional image returns HTTP 404 (premature publication prevented)", `HTTP ${anonProvRes.status}`);
    const cacheControlHeader = anonProvRes.headers.get("cache-control") || "";
    assert(cacheControlHeader.includes("no-store"), "Public 404 on provisional image includes Cache-Control: no-store");

    // Admin authenticated request for the provisional image MUST succeed with 200
    const adminProvRes = await fetch(`${baseUrl}${provPublicUrl}`, {
      headers: { Cookie: cookieHeader, Origin: baseUrl }
    });
    assert(adminProvRes.status === 200, "Admin authenticated preview of provisional image returns HTTP 200");

    // Active image remains accessible to public visitors
    const publicActiveRes2 = await fetch(`${baseUrl}${activePublicUrl}`);
    assert(publicActiveRes2.status === 200, "Public anonymous visitor still receives active image while replacement is provisional");

    // Explicitly publish photograph -> provisional promoted to active
    const publishPromoRes = await fetch(`${baseUrl}/api/admin/gallery/${encodeURIComponent(pubPhotoId)}`, {
      method: "PUT",
      headers: commonHeaders,
      body: JSON.stringify({
        id: pubPhotoId,
        cmsStatus: "published",
        src: provPublicUrl,
        altTR: "Güncellenmiş yayın fotoğrafı",
        altEN: "Updated published photograph",
        promoteProvisionalAsset: true
      })
    });
    assert(publishPromoRes.ok, "Explicit publish promotes provisional asset");

    // Now public anonymous visitor can access newly promoted image
    const publicNewActiveRes = await fetch(`${baseUrl}${provPublicUrl}`);
    assert(publicNewActiveRes.status === 200, "Public anonymous visitor can now access promoted image after explicit publication (HTTP 200)");

    // Rollback to previous revision restores former active image
    const rollbackRes = await fetch(`${baseUrl}/api/admin/gallery/${encodeURIComponent(pubPhotoId)}/revisions`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({ revisionNumber: 1 })
    });
    assert(rollbackRes.ok, "Rollback to revision 1 succeeds");

    // Verify historical assets retained in database
    const allAssetsForPub = testDbConnection.prepare("SELECT id, storage_key, asset_status FROM portfolio_gallery_assets WHERE item_id = ?").all(pubPhotoId);
    assert(allAssetsForPub.length >= 2, "Asset Retention Policy: Historical asset records retained across revisions", `Count: ${allAssetsForPub.length}`);

    // ------------------------------------------------------------
    // GROUP E: PARTIAL UPDATE PRESERVATION & STRICT VALIDATION
    // ------------------------------------------------------------
    setGroup("E: Partial Update Preservation & Strict Validation");

    const partialTestId = `photo-partial-${Date.now()}`;
    await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        id: partialTestId,
        cmsStatus: "draft",
        src: "/assets/gallery/demo.webp",
        altTR: "Korumalı Türkçe Açıklama",
        altEN: "Protected English Description",
        captionTR: "Özel Altyazı",
        captionEN: "Custom Caption",
        year: "2024",
        location: "Moda, İstanbul",
        sortOrder: 50
      })
    });

    // Execute partial PATCH changing only cmsStatus
    const patchRes = await fetch(`${baseUrl}/api/admin/gallery/${encodeURIComponent(partialTestId)}`, {
      method: "PATCH",
      headers: commonHeaders,
      body: JSON.stringify({
        cmsStatus: "archived"
      })
    });
    assert(patchRes.ok, "Partial PATCH returns 200 OK");
    const patchedItem = (await patchRes.json()).item;
    assert(patchedItem.alt?.tr === "Korumalı Türkçe Açıklama", "Partial PATCH preserves existing Turkish alt text");
    assert(patchedItem.alt?.en === "Protected English Description", "Partial PATCH preserves existing English alt text");
    assert(patchedItem.caption?.tr === "Özel Altyazı", "Partial PATCH preserves existing Turkish caption");
    assert(patchedItem.caption?.en === "Custom Caption", "Partial PATCH preserves existing English caption");
    assert(patchedItem.year === "2024", "Partial PATCH preserves existing year");
    assert(patchedItem.location === "Moda, İstanbul", "Partial PATCH preserves existing location");

    // Publishing without Turkish alt text -> 400
    const invalidAltRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        id: `bad-alt-${Date.now()}`,
        cmsStatus: "published",
        src: "/assets/gallery/demo.webp",
        altTR: "",
        altEN: "English alt only"
      })
    });
    assert(invalidAltRes.status === 400, "Publishing without Turkish alt text rejected with HTTP 400");

    // Publishing without image -> 400
    const invalidImgRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        id: `bad-img-${Date.now()}`,
        cmsStatus: "published",
        altTR: "Fotoğraf",
        altEN: "Photo",
        src: ""
      })
    });
    assert(invalidImgRes.status === 400, "Publishing without image rejected with HTTP 400");

    // ------------------------------------------------------------
    // GROUP F: STRICT CROSS-ENTITY MEDIA OWNERSHIP VERIFICATION
    // ------------------------------------------------------------
    setGroup("F: Strict Cross-Entity Media Ownership Verification");

    // Fetch an existing project media key
    const projMediaRow = testDbConnection.prepare("SELECT storage_key FROM project_media LIMIT 1").get();
    if (projMediaRow) {
      const hijackRes = await fetch(`${baseUrl}/api/admin/gallery`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify({
          id: `hijack-proj-${Date.now()}`,
          cmsStatus: "draft",
          altTR: "Kaçak Proje Medyası",
          altEN: "Hijacked Project Media",
          asset: {
            storageKey: projMediaRow.storage_key,
            publicUrl: `/api/media/${projMediaRow.storage_key}`
          }
        })
      });
      assert(hijackRes.status === 403, "Associating project media storage key with gallery item rejected with HTTP 403");
    }

    // Attempting to attach another gallery item's storage key
    const hijackGalRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        id: `hijack-gal-${Date.now()}`,
        cmsStatus: "draft",
        altTR: "Kaçak Galeri Medyası",
        altEN: "Hijacked Gallery Media",
        asset: {
          storageKey: activeStorageKey,
          publicUrl: `/api/media/${activeStorageKey}`
        }
      })
    });
    assert(hijackGalRes.status === 403, "Associating another gallery item's storage key rejected with HTTP 403");

    // ------------------------------------------------------------
    // GROUP G: ATOMIC REORDER VALIDATION & STREAM PERSISTENCE
    // ------------------------------------------------------------
    setGroup("G: Atomic Reorder Validation & Stream Persistence");

    // 1. Reorder with non-array or empty array -> 400
    const emptyReorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({ items: [] })
    });
    assert(emptyReorderRes.status === 400, "Empty items array rejected with HTTP 400");

    // 2. Reorder with duplicate IDs -> 400
    const dupReorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        items: [
          { id: testPhotoId, sortOrder: 0 },
          { id: testPhotoId, sortOrder: 1 }
        ]
      })
    });
    assert(dupReorderRes.status === 400, "Duplicate IDs rejected with HTTP 400");

    // 3. Reorder with negative sortOrder -> 400
    const negReorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        items: [{ id: testPhotoId, sortOrder: -5 }]
      })
    });
    assert(negReorderRes.status === 400, "Negative sortOrder rejected with HTTP 400");

    // 4. Reorder with unknown ID -> 400 and atomic zero mutation
    const beforeOrder = Number(testDbConnection.prepare("SELECT sort_order FROM portfolio_gallery_items WHERE id = ?").get(testPhotoId)?.sort_order ?? 0);
    const unknownReorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        items: [
          { id: testPhotoId, sortOrder: 777 },
          { id: "non-existent-id-9999", sortOrder: 778 }
        ]
      })
    });
    assert(unknownReorderRes.status === 400, "Reorder containing unknown item ID rejected with HTTP 400");
    const afterOrder = Number(testDbConnection.prepare("SELECT sort_order FROM portfolio_gallery_items WHERE id = ?").get(testPhotoId)?.sort_order ?? 0);
    assert(afterOrder === beforeOrder, "Atomic rollback: Zero sort order mutations executed after failed reorder request");

    // 5. Valid reorder
    const validReorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        items: [{ id: testPhotoId, sortOrder: 42 }]
      })
    });
    assert(validReorderRes.ok, "Valid reorder returns HTTP 200");
    const persistedOrder = Number(testDbConnection.prepare("SELECT sort_order FROM portfolio_gallery_items WHERE id = ?").get(testPhotoId)?.sort_order ?? 0);
    assert(persistedOrder === 42, "Valid sort order persisted to database (sortOrder: 42)");

    // ------------------------------------------------------------
    // GROUP H: IMAGE MEDIA UPLOAD, MIME & EXIF GPS PRIVACY ENFORCEMENT
    // ------------------------------------------------------------
    setGroup("H: Image Media Upload, MIME & EXIF GPS Privacy Enforcement");

    // 1. Valid uploads (JPEG, PNG, WebP)
    const vJpeg = createMinimalJpeg();
    const upJpegRes = await uploadPhoto(vJpeg, "test.jpg", "image/jpeg", testPhotoId);
    assert(upJpegRes.status === 201, "Valid JPEG upload accepted (201)");
    const upJpegData = await upJpegRes.json();
    assert(upJpegData.asset?.mimeType === "image/jpeg", "JPEG asset record has image/jpeg MIME type");

    const vPng = createMinimalPng();
    const upPngRes = await uploadPhoto(vPng, "test.png", "image/png", testPhotoId);
    assert(upPngRes.status === 201, "Valid PNG upload accepted (201)");

    const vWebp = createMinimalWebP();
    const upWebpRes = await uploadPhoto(vWebp, "test.webp", "image/webp", testPhotoId);
    assert(upWebpRes.status === 201, "Valid WebP upload accepted (201)");

    // 2. Disallowed MIME type
    const pdfBuf = Buffer.from("%PDF-1.4 test document");
    const upPdfRes = await uploadPhoto(pdfBuf, "document.pdf", "application/pdf", testPhotoId);
    assert(upPdfRes.status === 400, "Disallowed MIME type rejected with HTTP 400");

    // 3. Fake PNG signature
    const fakePng = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    const upFakePngRes = await uploadPhoto(fakePng, "fake.png", "image/png", testPhotoId);
    assert(upFakePngRes.status === 400, "Corrupted PNG magic signature rejected with HTTP 400");

    // 4. File exceeding 10 MB
    const hugeBuf = Buffer.alloc(11 * 1024 * 1024);
    hugeBuf[0] = 0xff; hugeBuf[1] = 0xd8; hugeBuf[2] = 0xff;
    const upHugeRes = await uploadPhoto(hugeBuf, "huge.jpg", "image/jpeg", testPhotoId);
    if (upHugeRes.status !== 413) {
      console.log("upHugeRes unexpected status:", upHugeRes.status, await upHugeRes.clone().text());
    }
    assert(upHugeRes.status === 413, "Image exceeding 10 MB limit rejected with HTTP 413");

    // 5. EXIF GPS Geolocation Privacy Rejection
    const gpsJpeg = createJpegWithGps();
    const upGpsRes = await uploadPhoto(gpsJpeg, "camera-photo-gps.jpg", "image/jpeg", testPhotoId);
    assert(upGpsRes.status === 400, "JPEG containing EXIF GPS metadata rejected with HTTP 400 for personal privacy");
    const gpsJson = await upGpsRes.json();
    assert(gpsJson.error?.includes("GPS"), "Error message explicitly cites GPS metadata rejection");

    // ------------------------------------------------------------
    // GROUP I: UPSTREAM OUTAGE REPORTING (DEGRADED STATE)
    // ------------------------------------------------------------
    setGroup("I: Upstream Outage Reporting (Degraded State)");

    // Both public gallery routes exist and return valid responses
    const pubGalRes = await fetch(`${baseUrl}/api/v1/public/gallery`);
    assert(pubGalRes.status === 200, "GET /api/v1/public/gallery returns 200 OK when upstream healthy");
    const pubGalJson = await pubGalRes.json();
    assert(pubGalJson.ok === true && Array.isArray(pubGalJson.gallery), "Public gallery returns array of published items");

    const appGalRes = await fetch(`${baseUrl}/api/gallery`);
    assert(appGalRes.status === 200, "GET /api/gallery returns 200 OK when upstream healthy");

    // Verify route code structure for degraded 503 response
    const pubRouteCode = fs.readFileSync(path.join(rootDir, "src", "app", "api", "v1", "public", "gallery", "route.ts"), "utf-8");
    assert(pubRouteCode.includes("status: 503"), "Public gallery route defines HTTP 503 on degraded upstream");
    assert(pubRouteCode.includes("degraded: true"), "Public gallery route defines degraded: true in body");
    assert(pubRouteCode.includes("no-store"), "Public gallery route enforces Cache-Control: no-store on error");

    const appRouteCode = fs.readFileSync(path.join(rootDir, "src", "app", "api", "gallery", "route.ts"), "utf-8");
    assert(appRouteCode.includes("status: 503"), "Internal gallery route defines HTTP 503 on degraded upstream");

    // ------------------------------------------------------------
    // GROUP J: PUBLIC FRONTEND HYDRATION, NATURAL ASPECT RATIO & NON-REGRESSION
    // ------------------------------------------------------------
    setGroup("J: Public Frontend Hydration, Natural Aspect Ratio & Non-Regression");

    const pageTrRes = await fetch(`${baseUrl}/tr`);
    assert(pageTrRes.status === 200, "Public Turkish desktop /tr renders with 200 OK");

    const pageEnRes = await fetch(`${baseUrl}/en`);
    assert(pageEnRes.status === 200, "Public English desktop /en renders with 200 OK");

    const galleryAppCode = fs.readFileSync(path.join(rootDir, "src", "components", "applications", "GalleryApp.tsx"), "utf-8");
    assert(galleryAppCode.includes("flex flex-col gap-4"), "GalleryApp renders single vertical stream (flex-col gap-4)");
    assert(galleryAppCode.includes("object-contain"), "GalleryApp preserves natural aspect ratio (object-contain)");
    assert(!galleryAppCode.includes("aspect-square"), "GalleryApp contains zero forced square cropping");

    const sessionStoreCode = fs.readFileSync(path.join(rootDir, "src", "store", "sessionStore.ts"), "utf-8");
    assert(sessionStoreCode.includes("hydrateGallery"), "sessionStore exposes hydrateGallery");

    const adminCode = fs.readFileSync(path.join(rootDir, "src", "app", "admin", "AdminDashboardClient.tsx"), "utf-8");
    assert(adminCode.includes("admin-gallery-section"), "AdminDashboardClient contains admin-gallery-section");
    assert(adminCode.includes("admin-gallery-editor-section"), "AdminDashboardClient contains admin-gallery-editor-section");
    assert(adminCode.includes("gallery-reorder-toggle-btn"), "AdminDashboardClient contains gallery-reorder-toggle-btn");

    const finalProjectCount = Number(testDbConnection.prepare("SELECT COUNT(*) as count FROM projects").get().count);
    const finalVideoCount = Number(testDbConnection.prepare("SELECT COUNT(*) as count FROM portfolio_videos").get().count);
    assert(finalProjectCount >= 30, "Non-regression: 30 canonical projects preserved", `Count: ${finalProjectCount}`);
    assert(finalVideoCount >= 21, "Non-regression: 21 canonical videos preserved", `Count: ${finalVideoCount}`);

    // ------------------------------------------------------------
    // GROUP K: TEST FIXTURE ISOLATION & ZERO HOST DATABASE MUTATION
    // ------------------------------------------------------------
    setGroup("K: Test Fixture Isolation & Zero Host Database Mutation");

    const hostFinalSha256 = getFileSha256(hostDbPath);
    assert(
      hostInitialSha256 === hostFinalSha256,
      "Zero host mutations: .local-d1/portfolio.sqlite SHA256 is 100% identical before and after suite",
      `SHA256: ${hostFinalSha256?.slice(0, 16)}...`
    );
  } finally {
    // Teardown isolated test resources
    if (testDbConnection) {
      try { testDbConnection.close(); } catch {}
    }
    if (testServerProcess) {
      try {
        testServerProcess.kill("SIGTERM");
      } catch {}
    }
    if (fs.existsSync(tempDbPath)) {
      try { fs.unlinkSync(tempDbPath); } catch {}
    }
    if (fs.existsSync(tempR2Dir)) {
      try { fs.rmSync(tempR2Dir, { recursive: true, force: true }); } catch {}
    }
  }

  // ------------------------------------------------------------
  // SUITE SUMMARY & REPORT PERSISTENCE
  // ------------------------------------------------------------
  console.log("\n============================================================");
  console.log("PHASE 4.1 VERIFICATION SUITE RESULTS SUMMARY");
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

  const reportsDir = path.join(rootDir, "docs", "reviews");
  fs.mkdirSync(reportsDir, { recursive: true });
  const resultsJsonPath = path.join(reportsDir, "PORTFOLIO_OS_PHASE4_1_TEST_RESULTS.json");
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
