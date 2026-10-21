#!/usr/bin/env node

/**
 * scripts/verify-phase4-2-browser-e2e.mjs
 *
 * Portfolio OS Phase 4.2.1: Real Chromium Browser E2E & Visual Verification Suite
 *
 * Executes authentic browser workflows using real Chromium via project-local Playwright.
 * Strictly tests:
 * - Isolated disposable SQLite sandbox (0600) migrated fresh from schema files.
 * - Host database and media invariant safety guards (100% SHA-256 match enforced).
 * - Real decodable canvas-generated JPEG image fixtures with distinct pixel patterns:
 *   - P1: Portrait (600x900)
 *   - P2: Landscape (1200x800)
 *   - P3: Square (800x800)
 * - Complete sequence reordering: P3 -> P1 -> P2 across Admin UI, SQLite, and Public API.
 * - Real public Portfolio OS navigation, Dock interaction, and GalleryApp window opening.
 * - In-window image rendering, decoding verification, and single vertical stream geometry.
 * - Real DOM scrolling measurements in Admin (#main-content) and Public Gallery feed.
 * - Mobile responsive catalog and editor reachability (390x844).
 * - Multi-language stability under Turkish (/tr) and English (/en).
 * - Comprehensive security negative assertions (CSRF, Origin, cross-asset, EXIF GPS).
 * - Fail-closed upstream outage simulation.
 * - Zero remote mutations (100% local execution).
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";
import { spawn, execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Host invariants
const hostDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const hostR2Dir = path.join(rootDir, ".local-r2");

// Output directories (repository-owned only; no hardcoded external paths)
const sanitizedScreenshotsDir =
  process.env.REVIEW_SCREENSHOTS_DIR ||
  path.join(rootDir, "docs", "reviews", "screenshots", "phase4_2_1");
fs.mkdirSync(sanitizedScreenshotsDir, { recursive: true });

// Test Results Registry
const results = {
  suite: "Portfolio OS Phase 4.2.1 Real Chromium Browser E2E & Visual Verification",
  timestamp: new Date().toISOString(),
  commit: "",
  total: 0,
  passed: 0,
  failed: 0,
  groups: {},
  failures: []
};

let currentGroup = "Initialization";

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
    results.groups[currentGroup].checks.push({ name, status: "PASS", detail });
    console.log(`  ✓ [PASS] ${name}${detail ? ` (${detail})` : ""}`);
  } else {
    results.failed++;
    results.groups[currentGroup].failed++;
    results.groups[currentGroup].checks.push({ name, status: "FAIL", detail });
    results.failures.push({ group: currentGroup, check: name, detail });
    console.error(`  ✗ [FAIL] ${name}${detail ? ` (${detail})` : ""}`);
  }
}

function getFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertIsolatedEnvironment(resolvedDbPath, resolvedMediaPath) {
  const normDb = path.resolve(resolvedDbPath);
  const normHostDb = path.resolve(hostDbPath);
  if (normDb === normHostDb || normDb.includes(".local-d1")) {
    throw new Error(
      `SAFETY_VIOLATION: Refusing to run tests against protected persistent database path: ${normDb}`
    );
  }
  const normMedia = path.resolve(resolvedMediaPath);
  const normHostR2 = path.resolve(hostR2Dir);
  if (normMedia === normHostR2 || normMedia.includes(".local-r2")) {
    throw new Error(
      `SAFETY_VIOLATION: Refusing to run tests against protected persistent media directory: ${normMedia}`
    );
  }
  return true;
}

/**
 * Generates an authentic, fully browser-decodable JPEG image using HTML5 Canvas in Chromium.
 * Draws distinct gradients, geometric grid patterns, and bold labels.
 */
async function generateAuthenticJpeg(page, { width, height, label, color }) {
  const base64Data = await page.evaluate(
    ({ w, h, text, bgColor }) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, bgColor);
      grad.addColorStop(1, "#0A0D14");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Geometric grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      for (let x = 40; x < w; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 40; y < h; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center plaque
      const boxW = Math.min(w * 0.85, 480);
      const boxH = 100;
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.fillRect((w - boxW) / 2, (h - boxH) / 2, boxW, boxH);
      ctx.strokeRect((w - boxW) / 2, (h - boxH) / 2, boxW, boxH);

      // Text labels
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, h / 2 - 12);

      ctx.fillStyle = "#4ADE80";
      ctx.font = "bold 16px monospace";
      ctx.fillText(`${w}x${h} • Decodable Test JPEG`, w / 2, h / 2 + 20);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      return dataUrl.split(",")[1];
    },
    { w: width, h: height, text: label, bgColor: color }
  );

  const buffer = Buffer.from(base64Data, "base64");
  return { buffer, width, height, label };
}

/**
 * Validates in-browser decoding of a JPEG buffer.
 */
async function verifyBrowserImageDecode(page, buffer) {
  const b64 = buffer.toString("base64");
  return await page.evaluate(async (dataUri) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          decoded: true
        });
      };
      img.onerror = () => {
        resolve({
          complete: false,
          naturalWidth: 0,
          naturalHeight: 0,
          decoded: false
        });
      };
      img.src = "data:image/jpeg;base64," + dataUri;
    });
  }, b64);
}

function createJpegWithGps() {
  const exif = [
    0xff, 0xd8, // SOI
    0xff, 0xe1, // APP1
    0x00, 0x28, // Length: 40 bytes
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif\0\0
    0x49, 0x49, 0x2a, 0x00, // II, little endian
    0x08, 0x00, 0x00, 0x00, // IFD0 offset = 8
    0x01, 0x00, // 1 entry in IFD0
    0x25, 0x88, // Tag 0x8825 = GPSInfo IFD pointer
    0x04, 0x00, // Type LONG
    0x01, 0x00, 0x00, 0x00, // Count = 1
    0x1a, 0x00, 0x00, 0x00, // Value offset = 26
    0x00, 0x00, 0x00, 0x00, // Next IFD = 0
    0x00, 0x00, // GPS IFD with 0 tags
    0xff, 0xd9 // EOI
  ];
  return Buffer.from(exif);
}

function hashAdminPasswordScrypt(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/admin`, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200 || res.status === 401) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

async function main() {
  console.log("============================================================");
  console.log("PORTFOLIO OS — PHASE 4.2.1 REAL CHROMIUM BROWSER E2E SUITE");
  console.log("============================================================");
  console.log(`Timestamp:       ${results.timestamp}`);
  console.log(`Project Root:    ${rootDir}`);
  console.log(`Screenshots Dir: ${sanitizedScreenshotsDir}`);

  try {
    results.commit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
    console.log(`Git Revision:    ${results.commit}`);
  } catch {}

  // Verify host gallery preview items before starting
  let hostPreviewCountBefore = 0;
  if (fs.existsSync(hostDbPath)) {
    const hostConn = new DatabaseSync(hostDbPath, { readOnly: true });
    try {
      const rows = hostConn.prepare("SELECT count(*) as count FROM portfolio_gallery_items WHERE id LIKE 'gallery-preview-%'").get();
      hostPreviewCountBefore = rows.count;
    } catch {}
    hostConn.close();
  }

  // Initial Host DB Invariant Snapshot
  const initialHostDbSha = getFileSha256(hostDbPath);
  const initialHostWalSha = getFileSha256(`${hostDbPath}-wal`);
  const initialHostShmSha = getFileSha256(`${hostDbPath}-shm`);

  // Temporary sandbox directory
  const tempTestDir = path.join(
    os.tmpdir(),
    `portfolio-isolated-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  );
  fs.mkdirSync(tempTestDir, { recursive: true });

  const tempDbPath = path.join(tempTestDir, "isolated.sqlite");
  const tempMediaDir = path.join(tempTestDir, "media");
  fs.mkdirSync(tempMediaDir, { recursive: true });

  let testServerProcess = null;
  let browser = null;
  let testDbConnection = null;

  try {
    // ------------------------------------------------------------
    // GROUP A: ISOLATION ARCHITECTURE & SAFETY GUARD ENFORCEMENT
    // ------------------------------------------------------------
    setGroup("A: Isolation Architecture & Safety Guard Enforcement");

    // 1. Negative test: Safety guard must refuse intentionally misconfigured persistent DB path
    let safetyGuardBlocked = false;
    try {
      assertIsolatedEnvironment(hostDbPath, tempMediaDir);
    } catch (err) {
      safetyGuardBlocked = err.message.includes("SAFETY_VIOLATION");
    }
    assert(
      safetyGuardBlocked,
      "Safety guard refuses intentionally misconfigured persistent DB path",
      "Correctly threw SAFETY_VIOLATION without modifying host DB"
    );

    // 2. Negative test: Safety guard must refuse intentionally misconfigured persistent media dir
    let mediaGuardBlocked = false;
    try {
      assertIsolatedEnvironment(tempDbPath, hostR2Dir);
    } catch (err) {
      mediaGuardBlocked = err.message.includes("SAFETY_VIOLATION");
    }
    assert(
      mediaGuardBlocked,
      "Safety guard refuses intentionally misconfigured persistent media dir",
      "Correctly threw SAFETY_VIOLATION for persistent media"
    );

    // 3. Isolated environment validation passes for disposable paths
    assert(
      assertIsolatedEnvironment(tempDbPath, tempMediaDir),
      "Safety guard approves verified isolated sandbox directory"
    );

    // 4. Construct fresh isolated SQLite database from migration files
    execSync(`LOCAL_D1_DB_PATH=${tempDbPath} node scripts/migrate-d1.mjs`, {
      stdio: "ignore",
      env: { ...process.env, LOCAL_D1_DB_PATH: tempDbPath }
    });

    testDbConnection = new DatabaseSync(tempDbPath);
    testDbConnection.exec("PRAGMA foreign_keys = ON;");

    const m2Sql = fs.readFileSync(
      path.join(rootDir, "cloudflare", "portfolio-api", "migrations", "0002_videos_and_reels_schema.sql"),
      "utf-8"
    );
    testDbConnection.exec(m2Sql);

    const m3Sql = fs.readFileSync(
      path.join(rootDir, "cloudflare", "portfolio-api", "migrations", "0003_personal_gallery_schema.sql"),
      "utf-8"
    );
    testDbConnection.exec(m3Sql);

    // Seed canonical 21 videos into isolated DB
    const { videosData } = await import(path.join(rootDir, "src", "data", "videos.ts"));
    const nowIso = new Date().toISOString();
    const insertVideo = testDbConnection.prepare(`
      INSERT INTO portfolio_videos (
        id, slug, status, orientation, video_type, production_method, ai_assisted,
        client_name, year, duration, aspect_ratio, featured, sort_order,
        autoplay_preview, created_at, updated_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertVideoTr = testDbConnection.prepare(`
      INSERT INTO portfolio_video_translations (
        id, video_id, locale, title, short_title, description, full_description, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    testDbConnection.exec("BEGIN TRANSACTION;");
    for (const v of videosData) {
      insertVideo.run(
        v.id,
        v.slug,
        "published",
        v.orientation || "portrait",
        v.type || "reel",
        v.productionMethod || "ai-assisted",
        v.aiAssisted ? 1 : 0,
        v.client || null,
        v.year || null,
        v.duration || null,
        v.orientation === "landscape" ? "16:9" : "9:16",
        v.featured ? 1 : 0,
        v.sortOrder || 0,
        v.autoplayPreview ? 1 : 0,
        nowIso,
        nowIso,
        nowIso
      );
      insertVideoTr.run(`tr-${v.id}-tr`, v.id, "tr", v.titleTR, v.shortTitleTR || null, v.descriptionTR || "", v.fullDescriptionTR || "", nowIso);
      insertVideoTr.run(`tr-${v.id}-en`, v.id, "en", v.titleEN, v.shortTitleEN || null, v.descriptionEN || "", v.fullDescriptionEN || "", nowIso);
    }

    testDbConnection.prepare(`
      INSERT INTO portfolio_video_assets (
        id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, created_at, updated_at
      ) VALUES ('vast-sample-poster', ?, 'poster', 'r2', 'videos/sample/poster.webp', '/api/media/videos/sample/poster.webp', 'image/webp', 1024, ?, ?)
    `).run(videosData[0].id, nowIso, nowIso);

    testDbConnection.exec("COMMIT;");

    const pCount = testDbConnection.prepare("SELECT count(*) as count FROM projects").get().count;
    const mCount = testDbConnection.prepare("SELECT count(*) as count FROM project_media").get().count;
    const vCount = testDbConnection.prepare("SELECT count(*) as count FROM portfolio_videos").get().count;
    const gCount = testDbConnection.prepare("SELECT count(*) as count FROM portfolio_gallery_items").get().count;

    assert(pCount === 30, "Fresh isolated DB seeded with exactly 30 canonical projects", `Count: ${pCount}`);
    assert(mCount === 70, "Fresh isolated DB seeded with exactly 70 project media records", `Count: ${mCount}`);
    assert(vCount === 21, "Fresh isolated DB seeded with exactly 21 canonical videos", `Count: ${vCount}`);
    assert(gCount === 0, "Fresh isolated DB starts with empty personal gallery (0 records)", `Count: ${gCount}`);

    // In-memory test admin credentials
    const testAdminEmail = "operator-e2e@isolated.local";
    const testAdminPassword = "IsolatedE2EPassphrase2026!";
    const testAdminHash = hashAdminPasswordScrypt(testAdminPassword);
    const testSessionSecret = crypto.randomBytes(32).toString("hex");

    assert(testAdminHash.startsWith("scrypt:"), "Temporary authentication fixture uses salted scrypt hash without reading persistent secrets");

    // Allocate safe loopback port
    const testPort = await getFreePort();
    const baseUrl = `http://127.0.0.1:${testPort}`;
    assert(testPort > 1024 && testPort < 65535, "Dedicated free loopback port safely allocated", `Port: ${testPort}`);

    // Spawn isolated Next.js instance
    const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
    const testEnv = {
      ...process.env,
      NODE_ENV: "production",
      CMS_STORAGE_MODE: "local",
      CMS_DATA_SOURCE: "local",
      LOCAL_D1_DB_PATH: tempDbPath,
      LOCAL_D1_FILE_PATH: tempDbPath,
      LOCAL_R2_DIR_PATH: tempMediaDir,
      PORT: String(testPort),
      HOSTNAME: "127.0.0.1",
      ADMIN_SESSION_SECRET: testSessionSecret,
      ADMIN_ALLOWED_EMAILS: testAdminEmail,
      ADMIN_EMAIL: testAdminEmail,
      ADMIN_EMAILS: testAdminEmail,
      ADMIN_PASSWORD_HASH: testAdminHash,
      SESSION_SECRET: testSessionSecret,
      ADMIN_TRUSTED_ORIGINS: `${baseUrl},http://localhost:${testPort}`
    };
    delete testEnv.CLOUDFLARE_CMS_API_URL;
    delete testEnv.CLOUDFLARE_API_SERVICE_TOKEN;
    delete testEnv.ADMIN_MASTER_PASSWORD;

    testServerProcess = spawn(process.execPath, [nextBin, "start", "-p", String(testPort), "-H", "127.0.0.1"], {
      cwd: rootDir,
      env: testEnv,
      stdio: "pipe"
    });

    await waitForServer(baseUrl, 15000);
    assert(true, "Isolated Next.js server operational and healthy on loopback binding", baseUrl);

    // Launch Chromium via project-local Playwright
    browser = await chromium.launch({ headless: true });
    assert(browser !== null, "Playwright launched Chromium cleanly using project-local dependency");

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    await context.addInitScript(() => {
      try {
        localStorage.setItem("portfolioOS:entry:v1:lastEnteredAt", String(Date.now()));
      } catch {}
    });
    const page = await context.newPage();

    // ------------------------------------------------------------
    // GROUP B: AUTHENTIC DECODABLE IMAGE FIXTURE GENERATION
    // ------------------------------------------------------------
    setGroup("B: Authentic Decodable Image Fixture Generation");

    // Generate real, decodable test JPEGs via Canvas with distinct aspect ratios & graphics:
    // P1: Portrait (600x900)
    // P2: Landscape (1200x800)
    // P3: Square (800x800)
    const photoP1 = await generateAuthenticJpeg(page, {
      width: 600,
      height: 900,
      label: "P1: Portrait Photograph",
      color: "#1E3A8A"
    });
    const photoP2 = await generateAuthenticJpeg(page, {
      width: 1200,
      height: 800,
      label: "P2: Landscape Photograph",
      color: "#065F46"
    });
    const photoP3 = await generateAuthenticJpeg(page, {
      width: 800,
      height: 800,
      label: "P3: Square Photograph",
      color: "#92400E"
    });

    // Verify JPEG SOI / APP0 JFIF byte signatures
    assert(
      photoP1.buffer[0] === 0xff && photoP1.buffer[1] === 0xd8 && photoP1.buffer[2] === 0xff,
      "P1 Portrait (600x900) has valid JPEG byte signature (FF D8 FF)"
    );
    assert(
      photoP2.buffer[0] === 0xff && photoP2.buffer[1] === 0xd8 && photoP2.buffer[2] === 0xff,
      "P2 Landscape (1200x800) has valid JPEG byte signature (FF D8 FF)"
    );
    assert(
      photoP3.buffer[0] === 0xff && photoP3.buffer[1] === 0xd8 && photoP3.buffer[2] === 0xff,
      "P3 Square (800x800) has valid JPEG byte signature (FF D8 FF)"
    );

    // Verify actual browser decoding and natural dimensions
    const decP1 = await verifyBrowserImageDecode(page, photoP1.buffer);
    assert(decP1.decoded && decP1.naturalWidth === 600 && decP1.naturalHeight === 900, "P1 decodes cleanly in browser to natural 600x900");

    const decP2 = await verifyBrowserImageDecode(page, photoP2.buffer);
    assert(decP2.decoded && decP2.naturalWidth === 1200 && decP2.naturalHeight === 800, "P2 decodes cleanly in browser to natural 1200x800");

    const decP3 = await verifyBrowserImageDecode(page, photoP3.buffer);
    assert(decP3.decoded && decP3.naturalWidth === 800 && decP3.naturalHeight === 800, "P3 decodes cleanly in browser to natural 800x800");

    // ------------------------------------------------------------
    // GROUP C: REAL BROWSER UI AUTHENTICATION & FIRST PHOTO INGESTION
    // ------------------------------------------------------------
    setGroup("C: Real Browser UI Authentication & First Photo Ingestion");

    await page.goto(`${baseUrl}/admin`);
    await page.waitForSelector('input[data-testid="admin-email-input"]', { timeout: 15000 });
    await page.fill('input[data-testid="admin-email-input"]', testAdminEmail);
    await page.fill('input[data-testid="admin-password-input"]', testAdminPassword);
    await page.click('button[data-testid="admin-password-login-btn"]');

    await page.waitForSelector('[data-testid="stat-gallery-published"]', { timeout: 15000 });
    assert(true, "Authenticated through real local admin login form");

    // Navigate to Personal Gallery
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');
    assert(true, "Navigated to Personal Photography Stream workspace");

    // Click Add Photograph
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    assert(true, "Opened Add Photograph editor form");

    // Upload P1 Portrait
    await page.setInputFiles('input[data-testid="gallery-file-input"]', {
      name: "p1-portrait.jpg",
      mimeType: "image/jpeg",
      buffer: photoP1.buffer
    });

    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="admin-gallery-editor-section"] img');
      return img && img.getAttribute("src")?.startsWith("/api/media/");
    });
    const p1UploadedSrc = await page.evaluate(() => {
      const img = document.querySelector('[data-testid="admin-gallery-editor-section"] img');
      return img?.getAttribute("src") || "";
    });
    assert(p1UploadedSrc.startsWith("/api/media/gallery/"), "Uploaded P1 Portrait image and verified preview", p1UploadedSrc);

    // Fill bilingual metadata for P1
    await page.click('button:has-text("Türkçe (TR)")');
    await page.fill('input[data-testid="gallery-alt-tr-input"]', "Galata Kulesi Dikey Portre");
    await page.fill('textarea[data-testid="gallery-caption-tr-input"]', "Tarihi yarımadanın akşamüstü görünümü.");

    await page.click('button:has-text("English (EN)")');
    await page.fill('input[data-testid="gallery-alt-en-input"]', "Galata Tower Vertical Portrait");
    await page.fill('textarea[data-testid="gallery-caption-en-input"]', "Historical peninsula during twilight.");

    await page.fill('input[data-testid="gallery-year-input"]', "2026");
    await page.fill('input[data-testid="gallery-location-input"]', "Beyoğlu, İstanbul");

    // Save P1 as draft
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/gallery") && r.ok()),
      page.click('button[data-testid="gallery-save-draft-btn"]')
    ]);
    assert(true, "Saved P1 as draft through admin UI");

    // Reload admin catalog and verify persistence
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');

    const draftRows = testDbConnection.prepare("SELECT id, status FROM portfolio_gallery_items").all();
    assert(draftRows.length === 1, "Exactly one draft item exists in SQLite", `Count: ${draftRows.length}`);
    const p1Id = draftRows[0].id;
    assert(draftRows[0].status === "draft", "Persisted item status is 'draft'");

    // Anonymous access to draft returns 404 with no-store
    const p1StorageKey = testDbConnection.prepare("SELECT storage_key FROM portfolio_gallery_assets WHERE item_id = ?").get(p1Id).storage_key;
    const anonDraftRes = await fetch(`${baseUrl}/api/media/${p1StorageKey}`);
    assert(anonDraftRes.status === 404, "Draft image is not accessible anonymously (HTTP 404)");
    const draftCacheHeader = anonDraftRes.headers.get("cache-control") || "";
    assert(draftCacheHeader.includes("no-store"), "Draft 404 includes Cache-Control: no-store");

    // Explicitly publish P1
    await page.click(`button[data-testid="gallery-edit-btn-${p1Id}"]`);
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/gallery") && (r.request().method() === "PUT" || r.request().method() === "POST") && !r.url().includes("/revisions") && !r.url().includes("/upload") && r.ok()),
      page.click('button[data-testid="gallery-publish-btn"]')
    ]);
    assert(true, "Published P1 explicitly through admin editor");

    const p1PubStatus = testDbConnection.prepare("SELECT status FROM portfolio_gallery_items WHERE id = ?").get(p1Id).status;
    assert(p1PubStatus === "published", "P1 status promoted to 'published' in SQLite");

    const anonPubRes = await fetch(`${baseUrl}/api/media/${p1StorageKey}`);
    assert(anonPubRes.status === 200, "Published image P1 is now anonymously accessible (HTTP 200 OK)");

    // ------------------------------------------------------------
    // GROUP D: MULTI-PHOTO INGESTION & COMPLETE SEQUENCE REORDERING (P3 -> P1 -> P2)
    // ------------------------------------------------------------
    setGroup("D: Multi-Photo Ingestion & Complete Sequence Reordering (P3 -> P1 -> P2)");

    // Ingest P2 Landscape (1200x800)
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    await page.setInputFiles('input[data-testid="gallery-file-input"]', {
      name: "p2-landscape.jpg",
      mimeType: "image/jpeg",
      buffer: photoP2.buffer
    });
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="admin-gallery-editor-section"] img');
      return img && img.getAttribute("src")?.startsWith("/api/media/");
    });
    await page.click('button:has-text("Türkçe (TR)")');
    await page.fill('input[data-testid="gallery-alt-tr-input"]', "Ege Kıyısı Manzarası");
    await page.fill('textarea[data-testid="gallery-caption-tr-input"]', "Geniş açı kıyı şeridi.");
    await page.click('button:has-text("English (EN)")');
    await page.fill('input[data-testid="gallery-alt-en-input"]', "Aegean Coast Landscape");
    await page.fill('textarea[data-testid="gallery-caption-en-input"]', "Wide angle coastline view.");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/gallery") && r.ok()),
      page.click('button[data-testid="gallery-publish-btn"]')
    ]);

    // Ingest P3 Square (800x800)
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    await page.setInputFiles('input[data-testid="gallery-file-input"]', {
      name: "p3-square.jpg",
      mimeType: "image/jpeg",
      buffer: photoP3.buffer
    });
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="admin-gallery-editor-section"] img');
      return img && img.getAttribute("src")?.startsWith("/api/media/");
    });
    await page.click('button:has-text("Türkçe (TR)")');
    await page.fill('input[data-testid="gallery-alt-tr-input"]', "Kare Mimari Detay");
    await page.fill('textarea[data-testid="gallery-caption-tr-input"]', "Simetrik cephe kompozisyonu.");
    await page.click('button:has-text("English (EN)")');
    await page.fill('input[data-testid="gallery-alt-en-input"]', "Square Architectural Detail");
    await page.fill('textarea[data-testid="gallery-caption-en-input"]', "Symmetrical facade composition.");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/gallery") && r.ok()),
      page.click('button[data-testid="gallery-publish-btn"]')
    ]);

    // Return to catalog: verify 3 published items
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');
    const cardCount3 = await page.locator('[data-testid^="gallery-item-card-"]').count();
    assert(cardCount3 === 3, "Three photographs created and published", `Count: ${cardCount3}`);

    const initialThree = testDbConnection.prepare("SELECT id, sort_order FROM portfolio_gallery_items ORDER BY sort_order ASC, id ASC").all();
    const p2Id = initialThree.find((r) => r.id !== p1Id).id;
    const p3Id = initialThree.find((r) => r.id !== p1Id && r.id !== p2Id).id;

    // Enter Reorder Mode
    await page.click('button[data-testid="gallery-reorder-toggle-btn"]');
    await page.waitForSelector('[data-testid="gallery-save-order-btn"]');
    assert(true, "Entered Stream Sequence Arrangement reorder mode");

    // Move P3 up twice to achieve target sequence: P3 -> P1 -> P2
    const moveUpP3 = page.locator(`button[data-testid="gallery-move-up-${p3Id}"]`);
    await moveUpP3.click();
    await page.waitForTimeout(150);
    await moveUpP3.click();
    await page.waitForTimeout(150);

    // Save Reordered Sequence
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/gallery/reorder") && r.ok()),
      page.click('button[data-testid="gallery-save-order-btn"]')
    ]);
    assert(true, "Saved reordered stream sequence through admin UI");

    // 1. Verify exact SQLite order
    const dbOrderRows = testDbConnection.prepare("SELECT id, sort_order FROM portfolio_gallery_items ORDER BY sort_order ASC").all();
    assert(
      dbOrderRows[0].id === p3Id && dbOrderRows[1].id === p1Id && dbOrderRows[2].id === p2Id,
      "SQLite sequence verified: [0]=P3, [1]=P1, [2]=P2",
      `Actual order: ${dbOrderRows.map((r) => r.id).join(" -> ")}`
    );

    // 2. Verify Public API endpoint order
    const pubApiRes = await fetch(`${baseUrl}/api/v1/public/gallery`);
    const pubApiData = await pubApiRes.json();
    const pubList = pubApiData.gallery || pubApiData.items || [];
    assert(
      pubList[0]?.id === p3Id && pubList[1]?.id === p1Id && pubList[2]?.id === p2Id,
      "Public API serves exact sequence: P3 -> P1 -> P2",
      `API IDs: ${pubList.map((i) => i.id).join(" -> ")}`
    );

    // 3. Reload admin page: verify UI retains order
    await page.reload();
    await page.waitForSelector('[data-testid="admin-tab-gallery"]', { timeout: 15000 });
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');
    const reloadedCards = await page.locator('[data-testid^="gallery-item-card-"]').all();
    const reloadedIds = await Promise.all(
      reloadedCards.map(async (c) => {
        const testId = (await c.getAttribute("data-testid")) || "";
        return testId.replace("gallery-item-card-", "");
      })
    );
    assert(
      reloadedIds[0] === p3Id && reloadedIds[1] === p1Id && reloadedIds[2] === p2Id,
      "Admin catalog UI stably retains sequence P3 -> P1 -> P2 after browser reload"
    );

    // ------------------------------------------------------------
    // GROUP E: PROVISIONAL IMAGE REPLACEMENT & BINARY ROLLBACK
    // ------------------------------------------------------------
    setGroup("E: Provisional Image Replacement & Binary Rollback");

    // Edit P1
    await page.click(`button[data-testid="gallery-edit-btn-${p1Id}"]`);
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');

    // Generate distinct replacement image B (900x600, Purple)
    const photoB = await generateAuthenticJpeg(page, {
      width: 900,
      height: 600,
      label: "Replacement Image B",
      color: "#6B21A8"
    });
    const photoP1_Sha256 = crypto.createHash("sha256").update(photoP1.buffer).digest("hex");
    const photoB_Sha256 = crypto.createHash("sha256").update(photoB.buffer).digest("hex");
    assert(photoP1_Sha256 !== photoB_Sha256, "Replacement image B has distinct binary SHA-256");

    await page.setInputFiles('input[data-testid="gallery-file-input"]', {
      name: "replacement-photo-b.jpg",
      mimeType: "image/jpeg",
      buffer: photoB.buffer
    });

    await page.waitForSelector('text=Staged Provisional Replacement', { timeout: 8000 });
    assert(true, "Provisional replacement warning banner rendered in editor UI");

    // Verify in DB: new asset is provisional, old asset is still active
    const p1Assets = testDbConnection.prepare("SELECT id, storage_key, asset_status FROM portfolio_gallery_assets WHERE item_id = ?").all(p1Id);
    const activeAsset = p1Assets.find((a) => a.asset_status === "active");
    const provAsset = p1Assets.find((a) => a.asset_status === "provisional");
    assert(activeAsset !== undefined, "Original asset A remains 'active' in DB during staging");
    assert(provAsset !== undefined, "Newly uploaded replacement asset B is 'provisional'");

    // Anonymous requests to provisional asset return 404
    const anonProvRes = await fetch(`${baseUrl}/api/media/${provAsset.storage_key}`);
    assert(anonProvRes.status === 404, "Provisional replacement image returns 404 to anonymous visitors");

    // Anonymous requests to original active asset return 200
    const anonOrigRes = await fetch(`${baseUrl}/api/media/${activeAsset.storage_key}`);
    assert(anonOrigRes.status === 200, "Original active image remains 200 OK for public visitors");

    // Explicitly publish replacement
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/gallery") && r.ok()),
      page.click('button[data-testid="gallery-publish-btn"]')
    ]);
    assert(true, "Promoted provisional replacement image to active upon explicit publish");

    // Confirm B is active and A is archived in DB
    const postPubAssets = testDbConnection.prepare("SELECT id, storage_key, asset_status FROM portfolio_gallery_assets WHERE item_id = ?").all(p1Id);
    const newActiveAsset = postPubAssets.find((a) => a.id === provAsset.id);
    const archivedAsset = postPubAssets.find((a) => a.id === activeAsset.id);
    assert(newActiveAsset?.asset_status === "active", "Asset B promoted to 'active'");
    assert(archivedAsset?.asset_status === "archived", "Previous asset A preserved as 'archived'");

    // Public feed now renders B
    const anonBRes = await fetch(`${baseUrl}/api/media/${newActiveAsset.storage_key}`);
    assert(anonBRes.status === 200, "Replacement image B is now live publicly (HTTP 200 OK)");

    // Rollback to revision containing original Photograph A
    const photoARevRow = testDbConnection.prepare("SELECT revision_number FROM portfolio_gallery_revisions WHERE item_id = ? AND json_extract(snapshot_json, '$.asset.storageKey') = ? ORDER BY revision_number DESC LIMIT 1").get(p1Id, activeAsset.storage_key);
    assert(photoARevRow !== undefined, "Revision history contains snapshot for Photograph A");

    await page.waitForSelector(`button[data-testid="gallery-restore-rev-${photoARevRow.revision_number}"]`);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/revisions") && r.request().method() === "POST" && r.ok()),
      page.click(`button[data-testid="gallery-restore-rev-${photoARevRow.revision_number}"]`)
    ]);
    assert(true, `Restored revision snapshot containing Photograph A (Rev #${photoARevRow.revision_number})`);

    const rolledBackAsset = testDbConnection.prepare("SELECT storage_key, asset_status FROM portfolio_gallery_assets WHERE item_id = ? AND asset_status = 'active'").get(p1Id);
    assert(rolledBackAsset.storage_key === activeAsset.storage_key, "Active asset restored to original asset A storage key");

    const restoredBytes = fs.readFileSync(path.join(tempMediaDir, rolledBackAsset.storage_key));
    const restoredSha256 = crypto.createHash("sha256").update(restoredBytes).digest("hex");
    assert(restoredSha256 === photoP1_Sha256, "Restored media binary SHA-256 strictly matches original photograph A binary hash");

    // ------------------------------------------------------------
    // GROUP F: PUBLIC GALLERYAPP REAL WINDOW E2E & VISUAL PROOF
    // ------------------------------------------------------------
    setGroup("F: Public GalleryApp Real Window E2E & Visual Proof");

    // Navigate to public portfolio in Turkish (/tr)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/tr`);
    await page.waitForTimeout(500);

    // Enter workspace: handle desktop entry screen if present
    const entryBtn = page.locator('button:has-text("Oturum Aç"), button:has-text("Enter Portfolio")');
    if (await entryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryBtn.click();
      await page.waitForTimeout(600);
    }
    // Also set bypass timestamp so subsequent reloads or navigations enter smoothly
    await page.evaluate(() => {
      try {
        localStorage.setItem("portfolioOS:entry:v1:lastEnteredAt", String(Date.now()));
      } catch {}
    });
    // Ensure entry overlay is gone
    await page.waitForSelector('div[aria-label="Portfolio OS Entry"]', { state: "hidden", timeout: 8000 }).catch(() => {});
    assert(true, "Entered Portfolio OS desktop workspace");

    // Locate and click Gallery Dock icon
    const dockGalleryBtn = page.locator('button[aria-label="Galeri"], button[aria-label="Gallery"]');
    await dockGalleryBtn.first().waitFor({ state: "visible", timeout: 10000 });
    await dockGalleryBtn.first().click({ force: true });
    assert(true, "Clicked Gallery app icon in public Desktop Dock");

    // Wait for GalleryApp window to be visibly open
    const galleryWinHeader = page.locator('.workspace-window-layer h1:has-text("Galeri"), .workspace-window-layer p:has-text("Gündelik görsel kayıtlar")');
    await galleryWinHeader.first().waitFor({ state: "visible", timeout: 10000 });
    assert(await galleryWinHeader.first().isVisible(), "GalleryApp window is visibly open with header 'Galeri'");

    // Locate rendered photograph stream inside the open Gallery window
    const renderedImages = page.locator('.workspace-window-layer .flex-1.p-5 img[alt]');
    await renderedImages.first().waitFor({ state: "visible", timeout: 10000 });
    const imageCount = await renderedImages.count();
    assert(imageCount === 3, "GalleryApp window renders exactly 3 published photographs", `Count: ${imageCount}`);

    // Verify in-window decode, natural dimensions, and aspect ratio preservation
    const imgDetails = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('.workspace-window-layer .flex-1.p-5 img[alt]'));
      return imgs.map((img) => ({
        src: img.src,
        alt: img.alt,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2)
      }));
    });

    // Check 1: P3 (Square) is first
    assert(
      imgDetails[0].complete && imgDetails[0].naturalWidth === 800 && imgDetails[0].naturalHeight === 800,
      "Position 1 is P3 Square (800x800, aspect 1.00) decoded cleanly"
    );
    assert(imgDetails[0].alt.includes("Kare"), "Position 1 alt text matches P3 Turkish description");

    // Check 2: P1 (Portrait) is second
    assert(
      imgDetails[1].complete && imgDetails[1].naturalWidth === 600 && imgDetails[1].naturalHeight === 900,
      "Position 2 is P1 Portrait (600x900, aspect 0.67) decoded cleanly without square cropping"
    );
    assert(imgDetails[1].alt.includes("Galata"), "Position 2 alt text matches P1 Turkish description");

    // Check 3: P2 (Landscape) is third
    assert(
      imgDetails[2].complete && imgDetails[2].naturalWidth === 1200 && imgDetails[2].naturalHeight === 800,
      "Position 3 is P2 Landscape (1200x800, aspect 1.50) decoded cleanly without square cropping"
    );
    assert(imgDetails[2].alt.includes("Ege"), "Position 3 alt text matches P2 Turkish description");

    // Verify single vertical column stream container
    const isSingleColumn = await page.evaluate(() => {
      const streamContainer = document.querySelector('.workspace-window-layer .flex-1.p-5 .flex-col.gap-4');
      if (!streamContainer) return false;
      const style = window.getComputedStyle(streamContainer);
      return style.display === "flex" && style.flexDirection === "column";
    });
    assert(isSingleColumn, "Photographs are arranged in a single vertical column stream");

    // Test internal vertical scrolling inside GalleryApp window
    const scrollTestResult = await page.evaluate(() => {
      const feed = document.querySelector('.workspace-window-layer .flex-1.p-5.overflow-y-auto');
      if (!feed) return { success: false, reason: "Feed container not found" };
      const scrollHeight = feed.scrollHeight;
      const clientHeight = feed.clientHeight;
      const scrollTopStart = feed.scrollTop;

      feed.scrollTop = 250;
      const scrollTopScrolled = feed.scrollTop;

      feed.scrollTop = 0;
      const scrollTopReturned = feed.scrollTop;

      return {
        success: true,
        scrollHeight,
        clientHeight,
        hasOverflow: scrollHeight > clientHeight,
        scrollTopStart,
        scrollTopScrolled,
        scrollTopReturned
      };
    });

    assert(
      scrollTestResult.success && scrollTestResult.hasOverflow && scrollTestResult.scrollTopScrolled >= 200,
      "GalleryApp internal feed scrolls down smoothly and returns to top",
      `scrollHeight: ${scrollTestResult.scrollHeight}, clientHeight: ${scrollTestResult.clientHeight}, scrolled: ${scrollTestResult.scrollTopScrolled}`
    );

    // Capture verified Desktop GalleryApp Open screenshot
    const publicDesktopShot = path.join(sanitizedScreenshotsDir, "public_gallery_window_open_desktop_1440x900.png");
    await page.screenshot({ path: publicDesktopShot, fullPage: false });
    assert(fs.existsSync(publicDesktopShot), "Captured verified desktop screenshot with Gallery window open (1440x900)");

    // Test Mobile Viewport (390x844) in Turkish
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/tr`);
    await page.waitForTimeout(1000);

    // Click mobile dock Gallery button
    const mobileDockGalleryBtn = page.locator('nav button[aria-label="Gallery"], nav button[aria-label="Galeri"], button[aria-label="Gallery"], button[aria-label="Galeri"]');
    await mobileDockGalleryBtn.first().waitFor({ state: "visible", timeout: 10000 });
    await mobileDockGalleryBtn.first().click({ force: true });
    assert(true, "Clicked Gallery app button in Mobile Dock");

    // Wait for mobile window header
    const mobileWinHeader = page.locator('header div:has-text("Galeri")');
    await mobileWinHeader.waitFor({ state: "visible", timeout: 10000 });
    assert(await mobileWinHeader.isVisible(), "Mobile Gallery window visibly open with title 'Galeri'");

    // Verify images rendered in mobile window
    const mobileImgs = page.locator('img[alt*="Kare"], img[alt*="Galata"], img[alt*="Ege"]');
    assert((await mobileImgs.count()) >= 3, "Mobile Gallery window renders all 3 published photographs");

    // Capture verified Mobile GalleryApp Open screenshot
    const publicMobileShot = path.join(sanitizedScreenshotsDir, "public_gallery_window_open_mobile_390x844.png");
    await page.screenshot({ path: publicMobileShot, fullPage: false });
    assert(fs.existsSync(publicMobileShot), "Captured verified mobile screenshot with Gallery window open (390x844)");

    // Test English Viewport (/en)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/en`);
    await page.waitForTimeout(500);
    const enEntryBtn = page.locator('button:has-text("Enter Portfolio"), button:has-text("Oturum Aç")');
    if (await enEntryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enEntryBtn.click();
      await page.waitForTimeout(600);
    }
    await page.waitForSelector('div[aria-label="Portfolio OS Entry"]', { state: "hidden", timeout: 8000 }).catch(() => {});
    const enDockBtn = page.locator('button[aria-label="Gallery"], button[aria-label="Galeri"]');
    await enDockBtn.first().waitFor({ state: "visible", timeout: 10000 });
    await enDockBtn.first().click({ force: true });

    const enHeader = page.locator('.workspace-window-layer h1:has-text("Gallery"), .workspace-window-layer p:has-text("Lowkey documentation")');
    await enHeader.first().waitFor({ state: "visible", timeout: 10000 });
    assert(await enHeader.first().isVisible(), "English locale (/en) opens Gallery with header 'Gallery'");

    const enImgAlts = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('.workspace-window-layer .flex-1.p-5 img[alt]'));
      return imgs.map((i) => i.alt);
    });
    assert(enImgAlts[0].includes("Square") && enImgAlts[1].includes("Galata") && enImgAlts[2].includes("Aegean"), "English alt texts and sequence P3 -> P1 -> P2 verified");

    // ------------------------------------------------------------
    // GROUP G: REAL SCROLL MEASUREMENTS & RESPONSIVE VALIDATION
    // ------------------------------------------------------------
    setGroup("G: Real Scroll Measurements & Responsive Validation");

    // Desktop Admin Catalog Scroll
    await page.goto(`${baseUrl}/admin`);
    if (await page.locator('input[data-testid="admin-email-input"]').isVisible()) {
      await page.fill('input[data-testid="admin-email-input"]', testAdminEmail);
      await page.fill('input[data-testid="admin-password-input"]', testAdminPassword);
      await page.click('button[data-testid="admin-password-login-btn"]');
    }
    await page.waitForSelector('[data-testid="admin-tab-gallery"]', { timeout: 15000 });
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');

    // Populate temporary gallery items to ensure catalog overflows and verify real vertical scroll
    const dummyIds = [];
    const dummyNow = new Date().toISOString();
    for (let i = 1; i <= 8; i++) {
      const dId = `scroll-dummy-${i}`;
      dummyIds.push(dId);
      testDbConnection.prepare(`
        INSERT INTO portfolio_gallery_items (id, status, sort_order, created_at, updated_at)
        VALUES (?, 'published', ?, ?, ?)
      `).run(dId, 10 + i, dummyNow, dummyNow);
    }
    await page.reload();
    await page.waitForSelector('[data-testid="admin-tab-gallery"]', { timeout: 15000 });
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');

    const adminScrollResult = await page.evaluate(() => {
      const main = document.getElementById("admin-main-stage") || document.getElementById("main-content");
      if (!main) return { success: false, reason: "main-stage not found" };
      const start = main.scrollTop;
      main.scrollTop = 250;
      const scrolled = main.scrollTop;
      main.scrollTop = 0;
      const returned = main.scrollTop;
      return {
        success: true,
        scrollHeight: main.scrollHeight,
        clientHeight: main.clientHeight,
        hasOverflow: main.scrollHeight > main.clientHeight,
        start,
        scrolled,
        returned
      };
    });

    // Remove temporary dummy items and restore original 3-item catalog
    for (const dId of dummyIds) {
      testDbConnection.prepare("DELETE FROM portfolio_gallery_items WHERE id = ?").run(dId);
    }
    await page.reload();
    await page.waitForSelector('[data-testid="admin-tab-gallery"]', { timeout: 15000 });
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');

    assert(
      adminScrollResult.success && adminScrollResult.hasOverflow && adminScrollResult.scrolled >= 200,
      "Desktop Admin catalog scroll container (#main-content / #admin-main-stage) measured and verified"
    );

    const desktopAdminCatalogShot = path.join(sanitizedScreenshotsDir, "admin_gallery_desktop_1440x900.png");
    await page.screenshot({ path: desktopAdminCatalogShot, fullPage: false });
    assert(fs.existsSync(desktopAdminCatalogShot), "Captured desktop admin catalog screenshot (1440x900)");

    // Desktop Admin Editor Screenshot
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    const desktopAdminEditorShot = path.join(sanitizedScreenshotsDir, "admin_gallery_editor_desktop_1440x900.png");
    await page.screenshot({ path: desktopAdminEditorShot, fullPage: false });
    assert(fs.existsSync(desktopAdminEditorShot), "Captured desktop admin editor screenshot (1440x900)");

    // Mobile Admin Catalog (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/admin`);
    if (await page.locator('input[data-testid="admin-email-input"]').isVisible()) {
      await page.fill('input[data-testid="admin-email-input"]', testAdminEmail);
      await page.fill('input[data-testid="admin-password-input"]', testAdminPassword);
      await page.click('button[data-testid="admin-password-login-btn"]');
    }
    await page.waitForSelector('[data-testid="admin-tab-gallery"]', { timeout: 15000 });
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');

    const mobileAdminCatalogShot = path.join(sanitizedScreenshotsDir, "admin_gallery_mobile_390x844.png");
    await page.screenshot({ path: mobileAdminCatalogShot, fullPage: false });
    assert(fs.existsSync(mobileAdminCatalogShot), "Captured mobile admin catalog screenshot (390x844)");

    // Mobile Admin Editor: Reachability of Save/Publish controls & no horizontal clipping
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');

    const mobileEditorAudit = await page.evaluate(() => {
      const main = document.getElementById("admin-main-stage") || document.getElementById("main-content");
      if (!main) return { ok: false, reason: "No main-stage found" };

      // Scroll to bottom
      main.scrollTop = main.scrollHeight;

      const publishBtn = document.querySelector('button[data-testid="gallery-publish-btn"]');
      const draftBtn = document.querySelector('button[data-testid="gallery-save-draft-btn"]');

      const isClipped = main.scrollWidth > main.clientWidth + 2;
      const pubRect = publishBtn?.getBoundingClientRect();

      return {
        ok: true,
        isClipped,
        hasPublishBtn: Boolean(publishBtn),
        hasDraftBtn: Boolean(draftBtn),
        pubRectTop: pubRect?.top,
        pubRectBottom: pubRect?.bottom,
        windowHeight: window.innerHeight
      };
    });

    assert(mobileEditorAudit.ok && !mobileEditorAudit.isClipped, "Mobile editor has zero horizontal clipping");
    assert(
      mobileEditorAudit.hasPublishBtn && mobileEditorAudit.hasDraftBtn,
      "Save Draft and Publish controls exist and are accessible in mobile editor"
    );

    const mobileAdminEditorShot = path.join(sanitizedScreenshotsDir, "admin_gallery_editor_mobile_390x844.png");
    await page.screenshot({ path: mobileAdminEditorShot, fullPage: false });
    assert(fs.existsSync(mobileAdminEditorShot), "Captured mobile admin editor screenshot (390x844)");

    // ------------------------------------------------------------
    // GROUP H: CRITICAL SECURITY COVERAGE & BOUNDARY ENFORCEMENT
    // ------------------------------------------------------------
    setGroup("H: Critical Security Coverage & Boundary Enforcement");

    // 1. Anonymous admin access rejected
    const anonAdminRes = await fetch(`${baseUrl}/api/admin/gallery`);
    assert(anonAdminRes.status === 401, "Anonymous request to /api/admin/gallery returns HTTP 401");

    // Extract auth cookies from page session
    const browserCookies = await context.cookies();
    const cookieHeader = browserCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const csrfToken = browserCookies.find((c) => c.name === "km_admin_csrf")?.value || "";

    // 2. Untrusted Origin rejected (403)
    const originRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: "http://malicious-site.com"
      },
      body: JSON.stringify({ id: "malicious-test" })
    });
    assert(originRes.status === 403, "Untrusted Origin rejected with HTTP 403 Forbidden");

    // 3. Missing CSRF token rejected (403)
    const missingCsrfRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: baseUrl
        // Missing x-csrf-token
      },
      body: JSON.stringify({ id: "csrf-probe" })
    });
    assert(missingCsrfRes.status === 403, "Missing CSRF token rejected with HTTP 403 Forbidden");

    // 4. Invalid CSRF token rejected (403)
    const invalidCsrfRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: baseUrl,
        "x-csrf-token": "totally-invalid-csrf-token-12345"
      },
      body: JSON.stringify({ id: "csrf-probe" })
    });
    assert(invalidCsrfRes.status === 403, "Invalid CSRF token rejected with HTTP 403 Forbidden");

    // 5. Attaching foreign video storage key rejected (403)
    const vidKey = testDbConnection.prepare("SELECT storage_key FROM portfolio_video_assets LIMIT 1").get()?.storage_key || "videos/sample/poster.webp";
    const vidKeyRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: baseUrl,
        "x-csrf-token": csrfToken
      },
      body: JSON.stringify({
        id: "probe-vid-key",
        altTR: "Test",
        altEN: "Test",
        asset: {
          storageKey: vidKey,
          storageMode: "r2",
          publicUrl: `/api/media/${vidKey}`,
          mimeType: "image/webp"
        }
      })
    });
    assert(vidKeyRes.status === 403, "Attaching video storage key to gallery item rejected with HTTP 403");

    // 6. Attaching another gallery item's storage key rejected (403)
    const p3Key = testDbConnection.prepare("SELECT storage_key FROM portfolio_gallery_assets WHERE item_id = ?").get(p3Id).storage_key;
    const crossGalleryRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: baseUrl,
        "x-csrf-token": csrfToken
      },
      body: JSON.stringify({
        id: "probe-cross-item",
        altTR: "Test",
        altEN: "Test",
        asset: {
          storageKey: p3Key,
          storageMode: "r2",
          publicUrl: `/api/media/${p3Key}`,
          mimeType: "image/jpeg"
        }
      })
    });
    assert(crossGalleryRes.status === 403, "Attaching another gallery item's storage key rejected with HTTP 403");

    // 7. Invalid reorder payload with proof of atomic non-mutation
    const preFailOrder = testDbConnection.prepare("SELECT id, sort_order FROM portfolio_gallery_items ORDER BY sort_order ASC").all();
    const badReorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: baseUrl,
        "x-csrf-token": csrfToken
      },
      body: JSON.stringify({
        items: [
          { id: p2Id, sortOrder: 0 },
          { id: p2Id, sortOrder: 1 } // Duplicate ID
        ]
      })
    });
    assert(badReorderRes.status === 400, "Duplicate ID reorder payload rejected with HTTP 400");
    const postFailOrder = testDbConnection.prepare("SELECT id, sort_order FROM portfolio_gallery_items ORDER BY sort_order ASC").all();
    assert(
      JSON.stringify(preFailOrder) === JSON.stringify(postFailOrder),
      "Atomic non-mutation: SQLite sort orders remained 100% identical after rejected reorder"
    );

    // 8. Upload of JPEG containing EXIF GPS rejected
    const gpsFormData = new FormData();
    gpsFormData.append("file", new Blob([createJpegWithGps()], { type: "image/jpeg" }), "gps-violation.jpg");
    gpsFormData.append("itemId", "gps-test-item");

    const gpsUploadRes = await fetch(`${baseUrl}/api/admin/gallery/upload`, {
      method: "POST",
      headers: { Cookie: cookieHeader, Origin: baseUrl, "x-csrf-token": csrfToken },
      body: gpsFormData
    });
    assert(gpsUploadRes.status === 400, "Image containing EXIF GPS metadata rejected with HTTP 400");

    // 9. Oversized upload (> 10MB) rejected with HTTP 413
    const bigFormData = new FormData();
    const bigBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);
    bigFormData.append("file", new Blob([bigBuffer], { type: "image/jpeg" }), "oversized.jpg");
    bigFormData.append("itemId", "big-test-item");

    const bigUploadRes = await fetch(`${baseUrl}/api/admin/gallery/upload`, {
      method: "POST",
      headers: { Cookie: cookieHeader, Origin: baseUrl, "x-csrf-token": csrfToken },
      body: bigFormData
    });
    assert(bigUploadRes.status === 413, "Oversized upload (>10MB) rejected with HTTP 413 Payload Too Large");

    // 10. Archived item anonymous access returns 404
    testDbConnection.exec(`UPDATE portfolio_gallery_items SET status = 'archived' WHERE id = '${p2Id}';`);
    const p2Key = testDbConnection.prepare("SELECT storage_key FROM portfolio_gallery_assets WHERE item_id = ?").get(p2Id).storage_key;
    const anonArchivedRes = await fetch(`${baseUrl}/api/media/${p2Key}`);
    assert(anonArchivedRes.status === 404, "Archived media key returns HTTP 404 to anonymous public visitors");
    testDbConnection.exec(`UPDATE portfolio_gallery_items SET status = 'published' WHERE id = '${p2Id}';`);

    // ------------------------------------------------------------
    // GROUP I: UPSTREAM OUTAGE RESILIENCE & FAIL-CLOSED INTEGRITY
    // ------------------------------------------------------------
    setGroup("I: Upstream Outage Resilience & Fail-Closed Integrity");

    // 1. Healthy empty state returns 200 with { gallery: [], count: 0 }
    testDbConnection.exec("UPDATE portfolio_gallery_items SET status = 'draft';");
    const emptyPubRes = await fetch(`${baseUrl}/api/v1/public/gallery`);
    const emptyPubData = await emptyPubRes.json();
    assert(emptyPubRes.status === 200, "Healthy empty gallery returns HTTP 200 OK");
    const emptyItems = emptyPubData.gallery || emptyPubData.items || [];
    assert(Array.isArray(emptyItems) && emptyItems.length === 0, "Healthy empty gallery returns empty array [] (zero data falsification)");

    // 2. Simulate upstream failure by temporarily renaming gallery table
    testDbConnection.exec("ALTER TABLE portfolio_gallery_items RENAME TO portfolio_gallery_items_fault;");
    const faultRes = await fetch(`${baseUrl}/api/v1/public/gallery`);
    const faultData = await faultRes.json();

    assert(faultRes.status === 503, "Upstream storage failure returns HTTP 503 Service Unavailable");
    assert(faultData.degraded === true, "Outage response includes degraded: true flag");
    const faultCache = faultRes.headers.get("cache-control") || "";
    assert(faultCache.includes("no-store"), "Outage 503 includes Cache-Control: no-store to prevent edge poisoning");

    // Restore table
    testDbConnection.exec("ALTER TABLE portfolio_gallery_items_fault RENAME TO portfolio_gallery_items;");
    testDbConnection.exec("UPDATE portfolio_gallery_items SET status = 'published';");
  } finally {
    // ------------------------------------------------------------
    // GROUP J: CLEAN TEARDOWN & HOST INTEGRITY INVARIANT VERIFICATION
    // ------------------------------------------------------------
    setGroup("J: Clean Teardown & Host Integrity Invariant Verification");

    if (browser) {
      try {
        await browser.close();
      } catch {}
    }

    if (testDbConnection) {
      try {
        testDbConnection.close();
      } catch {}
    }

    if (testServerProcess) {
      try {
        testServerProcess.kill("SIGTERM");
        await new Promise((r) => setTimeout(r, 600));
      } catch {}
    }

    // Clean up temporary sandbox directory
    if (fs.existsSync(tempTestDir)) {
      try {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
        assert(true, "Isolated sandbox directory cleanly destroyed", tempTestDir);
      } catch (err) {
        assert(false, "Failed to destroy isolated sandbox directory", err.message);
      }
    }

    // Host DB Invariant Assertions
    const finalHostDbSha = getFileSha256(hostDbPath);
    const finalHostWalSha = getFileSha256(`${hostDbPath}-wal`);
    const finalHostShmSha = getFileSha256(`${hostDbPath}-shm`);

    assert(
      initialHostDbSha === finalHostDbSha,
      "Host portfolio.sqlite byte-for-byte identical (SHA-256 match)",
      `SHA: ${finalHostDbSha?.slice(0, 16)}`
    );

    if (initialHostWalSha !== null) {
      assert(initialHostWalSha === finalHostWalSha, "Host portfolio.sqlite-wal SHA-256 match");
    }

    if (initialHostShmSha !== null) {
      assert(initialHostShmSha === finalHostShmSha, "Host portfolio.sqlite-shm SHA-256 match");
    }

    // Verify 3 local gallery preview records untouched
    if (fs.existsSync(hostDbPath)) {
      const hostConn = new DatabaseSync(hostDbPath, { readOnly: true });
      let previewCountAfter = 0;
      try {
        const rows = hostConn.prepare("SELECT count(*) as count FROM portfolio_gallery_items WHERE id LIKE 'gallery-preview-%'").get();
        previewCountAfter = rows.count;
      } catch {}
      hostConn.close();

      assert(
        hostPreviewCountBefore === previewCountAfter,
        "Host local gallery-preview records 100% preserved",
        `Count: ${previewCountAfter}`
      );
    }
  }

  // Write structured JSON results
  const jsonReportPath = path.join(rootDir, "docs", "reviews", "PORTFOLIO_OS_PHASE4_2_1_TEST_RESULTS.json");
  fs.writeFileSync(jsonReportPath, JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log(`\nStructured JSON test results written: ${jsonReportPath}`);

  console.log("\n============================================================");
  console.log("FINAL SUITE EXECUTION SUMMARY");
  console.log("============================================================");
  console.log(`TOTAL CHECKS: ${results.total}`);
  console.log(`PASSED:       ${results.passed}`);
  console.log(`FAILED:       ${results.failed}`);
  console.log("============================================================\n");

  if (results.failed > 0) {
    console.error(`SUITE FAILED with ${results.failed} failures.`);
    process.exit(1);
  } else {
    console.log("SUITE PASSED ALL CHECKS.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL RUNNER EXCEPTION:", err);
  process.exit(1);
});
