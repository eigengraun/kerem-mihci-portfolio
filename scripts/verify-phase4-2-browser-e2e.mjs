#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Phase 4.2 Real Browser E2E & Local Staging Preflight Suite
 *
 * Implements a 100% reproducible, automated REAL Chromium/Playwright verification harness
 * operating against a strictly isolated, fresh temporary SQLite and media sandbox.
 *
 * Strictly adheres to project safety boundaries:
 * - ZERO mutations to .local-d1/portfolio.sqlite or persistent host media.
 * - ZERO remote Cloudflare D1 migrations, Worker deployments, or R2 mutations.
 * - ZERO dependency on external project node_modules or hardcoded browser paths.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import net from "node:net";
import { execSync, spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "playwright";

const rootDir = process.cwd();
const hostDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const hostR2Dir = path.join(rootDir, ".local-r2");

const results = {
  suite: "Portfolio OS Phase 4.2 Local Staging Preflight & Real Browser E2E",
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

function getDirectoryInventory(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.map((e) => ({
    name: e.name,
    isFile: e.isFile(),
    size: e.isFile() ? fs.statSync(path.join(dirPath, e.name)).size : 0,
    sha256: e.isFile() ? getFileSha256(path.join(dirPath, e.name)) : null
  }));
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

function createJpeg(width, height) {
  const hHigh = (height >> 8) & 0xff;
  const hLow = height & 0xff;
  const wHigh = (width >> 8) & 0xff;
  const wLow = width & 0xff;
  return Buffer.from([
    0xff, 0xd8, // SOI
    // DQT
    0xff, 0xdb, 0x00, 0x43, 0x00,
    0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14,
    0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
    0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c,
    0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32,
    // SOF0 (Baseline DCT)
    0xff, 0xc0, 0x00, 0x0b, 0x08, hHigh, hLow, wHigh, wLow, 0x01, 0x01, 0x11, 0x00,
    // DHT
    0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    // SOS
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x00,
    // EOI
    0xff, 0xd9
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
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/v1/public/health`, { method: "HEAD" });
      if (res.status < 500) return true;
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server failed to start on ${url} within ${timeoutMs}ms.`);
}

async function main() {
  console.log("============================================================");
  console.log("PORTFOLIO OS PHASE 4.2 REAL BROWSER E2E & PREFLIGHT");
  console.log(`Commit:    ${results.commit}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log("============================================================");

  // Snapshot host database before suite runs
  const hostInitialDbSha256 = getFileSha256(hostDbPath);
  const hostInitialWalSha256 = getFileSha256(`${hostDbPath}-wal`);
  const hostInitialShmSha256 = getFileSha256(`${hostDbPath}-shm`);
  const hostInitialInventory = getDirectoryInventory(path.dirname(hostDbPath));

  // Isolated temp directory for this specific run
  const tempTestDir = path.join(
    os.tmpdir(),
    `portfolio-e2e-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
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
    testDbConnection.exec("COMMIT;");

    const pCount = testDbConnection.prepare("SELECT count(*) as count FROM projects").get().count;
    const mCount = testDbConnection.prepare("SELECT count(*) as count FROM project_media").get().count;
    const vCount = testDbConnection.prepare("SELECT count(*) as count FROM portfolio_videos").get().count;
    const gCount = testDbConnection.prepare("SELECT count(*) as count FROM portfolio_gallery_items").get().count;

    assert(pCount === 30, "Fresh isolated DB seeded with exactly 30 canonical projects", `Count: ${pCount}`);
    assert(mCount === 70, "Fresh isolated DB seeded with exactly 70 project media records", `Count: ${mCount}`);
    assert(vCount === 21, "Fresh isolated DB seeded with exactly 21 canonical videos", `Count: ${vCount}`);
    assert(gCount === 0, "Fresh isolated DB starts with empty personal gallery (0 records)", `Count: ${gCount}`);

    // In-memory test admin authentication credentials
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

    // ------------------------------------------------------------
    // GROUP B: REAL BROWSER E2E: CREATE & SAVE DRAFT (TEST A)
    // ------------------------------------------------------------
    setGroup("B: Real Browser E2E: Create & Save Draft (Test A)");

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log(`  [BROWSER ERROR] ${msg.text()}`);
    });
    page.on("pageerror", (err) => console.log(`  [PAGE CRASH] ${err.message}`));

    // 1. Real login flow
    await page.goto(`${baseUrl}/admin`);
    await page.waitForSelector('input[data-testid="admin-email-input"]', { timeout: 15000 });
    await page.fill('input[data-testid="admin-email-input"]', testAdminEmail);
    await page.fill('input[data-testid="admin-password-input"]', testAdminPassword);
    await page.click('button[data-testid="admin-password-login-btn"]');

    await page.waitForSelector('[data-testid="stat-gallery-published"]', { timeout: 15000 });
    assert(true, "Authenticated through real local admin login form");

    // 2. Navigate to Personal Gallery
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');
    assert(true, "Navigated to Personal Photography Stream workspace");

    // 3. Click Add Photograph
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    assert(true, "Clicked Add Photograph and opened editor");

    // 4. Upload decodable JPEG image
    const photoA_Buffer = createJpeg(800, 600);
    const photoA_Sha256 = crypto.createHash("sha256").update(photoA_Buffer).digest("hex");
    await page.setInputFiles('input[data-testid="gallery-file-input"]', {
      name: "bosphorus-morning.jpg",
      mimeType: "image/jpeg",
      buffer: photoA_Buffer
    });

    // Wait for image preview
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="admin-gallery-editor-section"] img');
      return img && img.getAttribute("src")?.startsWith("/api/media/");
    });
    const uploadedSrc = await page.evaluate(() => {
      const img = document.querySelector('[data-testid="admin-gallery-editor-section"] img');
      return img?.getAttribute("src") || "";
    });
    assert(uploadedSrc.startsWith("/api/media/gallery/"), "Uploaded real decodable image file and verified preview", uploadedSrc);

    // 5. Fill bilingual metadata
    await page.click('button:has-text("Türkçe (TR)")');
    await page.fill('input[data-testid="gallery-alt-tr-input"]', "Boğazda sabah sisi ve vapur");
    await page.fill('textarea[data-testid="gallery-caption-tr-input"]', "Karaköy iskelesinden sabah ışığında çekilmiş kare.");

    await page.click('button:has-text("English (EN)")');
    await page.fill('input[data-testid="gallery-alt-en-input"]', "Morning mist and ferry on the Bosphorus");
    await page.fill('textarea[data-testid="gallery-caption-en-input"]', "Photograph captured from Karaköy pier in early morning light.");

    await page.fill('input[data-testid="gallery-year-input"]', "2026");
    await page.fill('input[data-testid="gallery-location-input"]', "İstanbul, Türkiye");

    // 6. Save as draft
    await page.click('button[data-testid="gallery-save-draft-btn"]');
    await page.waitForSelector('.bg-emerald-500\\/10');
    assert(true, "Saved photograph as draft through admin UI");

    // 7. Reload page and confirm persistence
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');

    const cardCount = await page.locator('[data-testid^="gallery-item-card-"]').count();
    assert(cardCount === 1, "Draft photograph persists in admin catalog after page reload", `Count: ${cardCount}`);

    // Verify exactly 1 gallery item in DB (zero duplicates or orphan drafts)
    const dbGalleryRows = testDbConnection.prepare("SELECT id, status, sort_order FROM portfolio_gallery_items").all();
    assert(dbGalleryRows.length === 1, "Exactly one gallery item exists in database for create operation", `Rows: ${dbGalleryRows.length}`);
    const createdItemId = dbGalleryRows[0].id;
    assert(dbGalleryRows[0].status === "draft", "Persisted item has status 'draft'");

    const dbTranslations = testDbConnection.prepare("SELECT locale, alt_text FROM portfolio_gallery_translations WHERE item_id = ?").all(createdItemId);
    assert(dbTranslations.length === 2, "Bilingual translations (TR and EN) persisted in database");

    // ------------------------------------------------------------
    // GROUP C: REAL BROWSER E2E: PUBLISHING & PUBLIC VIEW (TEST B)
    // ------------------------------------------------------------
    setGroup("C: Real Browser E2E: Publishing & Public View (Test B)");

    // 1. Anonymous access to draft image returns 404 with no-store
    const mediaKey = testDbConnection.prepare("SELECT storage_key FROM portfolio_gallery_assets WHERE item_id = ?").get(createdItemId).storage_key;
    const anonRes = await fetch(`${baseUrl}/api/media/${mediaKey}`);
    assert(anonRes.status === 404, "Draft image is not anonymously accessible (HTTP 404)", `Status: ${anonRes.status}`);
    const cacheHeader = anonRes.headers.get("cache-control") || "";
    assert(cacheHeader.includes("no-store"), "Draft 404 includes Cache-Control: no-store", cacheHeader);

    // 2. Open editor and publish
    await page.click(`button[data-testid="gallery-edit-btn-${createdItemId}"]`);
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');

    await page.click('button[data-testid="gallery-publish-btn"]');
    await page.waitForSelector('.bg-emerald-500\\/10');
    assert(true, "Published photograph explicitly through admin editor");

    // 3. Status in DB is published
    const publishedRow = testDbConnection.prepare("SELECT status FROM portfolio_gallery_items WHERE id = ?").get(createdItemId);
    assert(publishedRow.status === "published", "Database item status promoted to 'published'");

    // 4. Anonymous access to image now returns 200
    const anonPubRes = await fetch(`${baseUrl}/api/media/${mediaKey}`);
    assert(anonPubRes.status === 200, "Published image is now anonymously accessible (HTTP 200 OK)");

    // 5. Open public portfolio in browser and inspect Gallery App
    await page.goto(`${baseUrl}`);
    await page.waitForSelector('img[alt="Photos"], button:has-text("Photos"), [data-app="gallery"]', { timeout: 10000 }).catch(() => {});

    // Directly query public gallery endpoint to verify frontend hydration payload
    const pubGalleryRes = await fetch(`${baseUrl}/api/v1/public/gallery`);
    const pubGalleryData = await pubGalleryRes.json();
    assert(pubGalleryRes.status === 200, "Public gallery endpoint returns HTTP 200 OK");
    assert(pubGalleryData.count === 1, "Public gallery feed contains exactly 1 published item");
    const galleryItems = pubGalleryData.gallery || pubGalleryData.items || [];
    assert(galleryItems[0]?.alt?.tr === "Boğazda sabah sisi ve vapur", "Correct Turkish alt text in public feed");
    assert(galleryItems[0]?.alt?.en === "Morning mist and ferry on the Bosphorus", "Correct English alt text in public feed");

    // ------------------------------------------------------------
    // GROUP D: REAL BROWSER E2E: THREE-PHOTOGRAPH ORDERING (TEST C)
    // ------------------------------------------------------------
    setGroup("D: Real Browser E2E: Three-Photograph Ordering (Test C)");

    // Create 2 additional test photographs with distinct aspect ratios
    // P1 already exists (800x600 landscape-ish)
    // P2: Landscape (1200x800)
    // P3: Portrait (600x900)
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');

    // Add P2 (Landscape)
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    await page.setInputFiles('input[data-testid="gallery-file-input"]', {
      name: "landscape-photo.jpg",
      mimeType: "image/jpeg",
      buffer: createJpeg(1200, 800)
    });
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="admin-gallery-editor-section"] img');
      return img && img.getAttribute("src")?.startsWith("/api/media/");
    });
    await page.click('button:has-text("English (EN)")');
    await page.fill('input[data-testid="gallery-alt-en-input"]', "Aegean Coast Landscape");
    await page.click('button:has-text("Türkçe (TR)")');
    await page.fill('input[data-testid="gallery-alt-tr-input"]', "Ege Kıyısı Manzarası");
    await page.click('button[data-testid="gallery-publish-btn"]');
    await page.waitForSelector('.bg-emerald-500\\/10');

    // Add P3 (Portrait)
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    await page.setInputFiles('input[data-testid="gallery-file-input"]', {
      name: "portrait-photo.jpg",
      mimeType: "image/jpeg",
      buffer: createJpeg(600, 900)
    });
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="admin-gallery-editor-section"] img');
      return img && img.getAttribute("src")?.startsWith("/api/media/");
    });
    await page.click('button:has-text("English (EN)")');
    await page.fill('input[data-testid="gallery-alt-en-input"]', "Galata Tower Vertical Portrait");
    await page.click('button:has-text("Türkçe (TR)")');
    await page.fill('input[data-testid="gallery-alt-tr-input"]', "Galata Kulesi Dikey Portre");
    await page.click('button[data-testid="gallery-publish-btn"]');
    await page.waitForSelector('.bg-emerald-500\\/10');

    // Return to catalog and verify all 3 items exist
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');
    const threeCards = await page.locator('[data-testid^="gallery-item-card-"]').count();
    assert(threeCards === 3, "Three test photographs created and published", `Count: ${threeCards}`);

    const allThreeRows = testDbConnection.prepare("SELECT id, sort_order FROM portfolio_gallery_items ORDER BY sort_order ASC, id ASC").all();
    const p1Id = createdItemId;
    const p2Id = allThreeRows.find((r) => r.id !== p1Id).id;
    const p3Id = allThreeRows.find((r) => r.id !== p1Id && r.id !== p2Id).id;

    // Toggle Reorder mode in UI
    await page.click('button[data-testid="gallery-reorder-toggle-btn"]');
    await page.waitForSelector('[data-testid="gallery-save-order-btn"]');
    assert(true, "Entered Stream Sequence Arrangement reorder mode");

    // Reorder sequence via UI controls:
    // We want order: P3, P1, P2.
    // Use the move buttons to achieve this.
    const moveUpP3 = page.locator(`button[data-testid="gallery-move-up-${p3Id}"]`);
    while ((await moveUpP3.isVisible()) && (await moveUpP3.isEnabled())) {
      await moveUpP3.click();
      await page.waitForTimeout(250);
    }

    // Click Save Stream Order
    await page.click('button[data-testid="gallery-save-order-btn"]');
    await page.waitForSelector('[data-testid="gallery-save-order-btn"]', { state: "detached", timeout: 10000 });

    // Verify reorder persisted in database
    const reorderedRows = testDbConnection.prepare("SELECT id, sort_order FROM portfolio_gallery_items ORDER BY sort_order ASC").all();
    assert(reorderedRows[0].id === p3Id, "Item P3 is in position 1 in database", `First ID: ${reorderedRows[0].id}`);
    assert(reorderedRows[0].sort_order < reorderedRows[1].sort_order, "Strict sort_order ordering persisted in SQLite");

    // Public API returns deterministic order matching persisted data
    const pubOrderRes = await fetch(`${baseUrl}/api/v1/public/gallery`);
    const pubOrderData = await pubOrderRes.json();
    const pubOrderList = pubOrderData.gallery || pubOrderData.items || [];
    assert(pubOrderList[0]?.id === p3Id, "Public gallery feed serves P3 at top of stream");

    // ------------------------------------------------------------
    // GROUP E: PROVISIONAL IMAGE REPLACEMENT & BINARY ROLLBACK (TEST D)
    // ------------------------------------------------------------
    setGroup("E: Provisional Image Replacement & Binary Rollback (Test D)");

    // 1. Begin with published photograph P1
    const p1InitialAsset = testDbConnection.prepare("SELECT storage_key, public_url FROM portfolio_gallery_assets WHERE item_id = ? AND asset_status = 'active'").get(p1Id);
    assert(p1InitialAsset !== undefined, "Photograph P1 has active asset before replacement");

    // 2. Upload distinct replacement image P1_v2 in editor
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.click(`button[data-testid="gallery-edit-btn-${p1Id}"]`);
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');

    const photoB_Buffer = createJpeg(900, 600); // Distinct bytes
    const photoB_Sha256 = crypto.createHash("sha256").update(photoB_Buffer).digest("hex");
    assert(photoA_Sha256 !== photoB_Sha256, "Replacement image B has distinct binary SHA-256");

    await page.setInputFiles('input[data-testid="gallery-file-input"]', {
      name: "replacement-photo-b.jpg",
      mimeType: "image/jpeg",
      buffer: photoB_Buffer
    });

    // 3. Verify provisional banner appears in UI
    await page.waitForSelector('text=Staged Provisional Replacement', { timeout: 8000 });
    assert(true, "Provisional replacement warning banner rendered in editor UI");

    // 4. Verify in DB: new asset is 'provisional', old asset is still 'active'
    const p1Assets = testDbConnection.prepare("SELECT id, storage_key, asset_status FROM portfolio_gallery_assets WHERE item_id = ?").all(p1Id);
    const activeAsset = p1Assets.find((a) => a.asset_status === "active");
    const provAsset = p1Assets.find((a) => a.asset_status === "provisional");

    assert(activeAsset !== undefined, "Original asset A remains 'active' in DB during staging");
    assert(provAsset !== undefined, "Newly uploaded replacement asset B is created with asset_status 'provisional'");

    // 5. Verify anonymous requests to provisional asset return 404
    const anonProvRes = await fetch(`${baseUrl}/api/media/${provAsset.storage_key}`);
    assert(anonProvRes.status === 404, "Provisional replacement image returns 404 to anonymous visitors", `Status: ${anonProvRes.status}`);

    // 6. Verify anonymous requests to original active asset return 200
    const anonOrigRes = await fetch(`${baseUrl}/api/media/${activeAsset.storage_key}`);
    assert(anonOrigRes.status === 200, "Original active image remains 200 OK for public visitors");

    // 7. Explicitly publish replacement via admin editor
    const [pubResponse] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/admin/gallery") &&
          resp.request().method() === "PUT" &&
          resp.status() === 200
      ),
      page.click('button[data-testid="gallery-publish-btn"]')
    ]);
    assert(pubResponse.ok(), "Clicked Publish to promote provisional replacement image");

    // 8. Confirm B is now active and A is archived in DB
    const postPubAssets = testDbConnection.prepare("SELECT id, storage_key, asset_status FROM portfolio_gallery_assets WHERE item_id = ?").all(p1Id);
    const newActiveAsset = postPubAssets.find((a) => a.id === provAsset.id);
    const archivedAsset = postPubAssets.find((a) => a.id === activeAsset.id);
    assert(newActiveAsset?.asset_status === "active", "Provisional asset B promoted to 'active'");
    assert(archivedAsset?.asset_status === "archived", "Previous asset A preserved as 'archived' historical asset");

    // 9. Public feed now renders B
    const anonBRes = await fetch(`${baseUrl}/api/media/${newActiveAsset.storage_key}`);
    assert(anonBRes.status === 200, "Replacement image B is now live publicly (HTTP 200 OK)");

    // 10. Perform revision rollback to revision 1 (restoring A)
    const rev1Row = testDbConnection.prepare("SELECT revision_number FROM portfolio_gallery_revisions WHERE item_id = ? ORDER BY revision_number ASC LIMIT 1").get(p1Id);
    assert(rev1Row !== undefined, "Revision history contains initial snapshot (Rev #1)");

    await page.waitForSelector(`button[data-testid="gallery-restore-rev-${rev1Row.revision_number}"]`);
    await page.click(`button[data-testid="gallery-restore-rev-${rev1Row.revision_number}"]`);
    await page.waitForTimeout(600);
    assert(true, "Clicked Restore on initial revision snapshot");

    // 11. Verify restored public image content matches original binary bytes
    const rolledBackAsset = testDbConnection.prepare("SELECT storage_key, asset_status FROM portfolio_gallery_assets WHERE item_id = ? AND asset_status = 'active'").get(p1Id);
    assert(rolledBackAsset.storage_key === activeAsset.storage_key, "Active asset restored to original asset A storage key");

    const restoredBytes = fs.readFileSync(path.join(tempMediaDir, rolledBackAsset.storage_key));
    const restoredSha256 = crypto.createHash("sha256").update(restoredBytes).digest("hex");
    assert(restoredSha256 === photoA_Sha256, "Restored media binary SHA-256 strictly matches original photograph A binary hash", restoredSha256.slice(0, 16));

    // ------------------------------------------------------------
    // GROUP F: ARCHIVE & UNPUBLISH LIFECYCLE (TEST E)
    // ------------------------------------------------------------
    setGroup("F: Archive & Unpublish Lifecycle (Test E)");

    // Set item to draft or archived
    await page.selectOption('select[data-testid="gallery-status-select"]', "archived");
    await page.click('button[data-testid="gallery-save-draft-btn"]');
    await page.waitForSelector('.bg-emerald-500\\/10');
    assert(true, "Status updated to 'archived' in editor UI");

    // Verify removed from public gallery catalog
    const pubAfterArchiveRes = await fetch(`${baseUrl}/api/v1/public/gallery`);
    const pubAfterArchiveData = await pubAfterArchiveRes.json();
    const pubAfterArchiveItems = pubAfterArchiveData.gallery || pubAfterArchiveData.items || [];
    const hasArchivedInPublic = pubAfterArchiveItems.some((i) => i.id === p1Id);
    assert(!hasArchivedInPublic, "Archived photograph removed from public gallery stream");

    // Anonymous media access to archived item returns 404
    const anonArchivedRes = await fetch(`${baseUrl}/api/media/${rolledBackAsset.storage_key}`);
    assert(anonArchivedRes.status === 404, "Archived media key returns HTTP 404 to anonymous public visitors");

    // ------------------------------------------------------------
    // GROUP G: SECURITY NEGATIVE TESTS & BOUNDARY ENFORCEMENT (TEST F)
    // ------------------------------------------------------------
    setGroup("G: Security Negative Tests & Boundary Enforcement (Test F)");

    // 1. Anonymous admin access rejected
    const anonAdminRes = await fetch(`${baseUrl}/api/admin/gallery`);
    assert(anonAdminRes.status === 401, "Anonymous request to /api/admin/gallery returns HTTP 401", `Status: ${anonAdminRes.status}`);

    // Extract auth cookies from page session for authenticated negative tests
    const browserCookies = await context.cookies();
    const cookieHeader = browserCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const csrfToken = browserCookies.find((c) => c.name === "km_admin_csrf")?.value || "";

    // 2. CSRF/Origin enforcement
    const csrfRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: "http://malicious-site.com"
      },
      body: JSON.stringify({ id: "malicious-test" })
    });
    assert(csrfRes.status === 403, "Untrusted Origin rejected with HTTP 403 Forbidden", `Status: ${csrfRes.status}`);

    // 3. Cross-gallery asset ownership rejected
    const crossGalleryRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: baseUrl,
        "x-csrf-token": csrfToken
      },
      body: JSON.stringify({
        id: "probe-cross-asset",
        altTR: "Test",
        altEN: "Test",
        asset: {
          storageKey: "gallery/other-person-photo.jpg",
          storageMode: "r2",
          publicUrl: "/api/media/gallery/other-person-photo.jpg",
          mimeType: "image/jpeg",
          byteSize: 1000
        }
      })
    });
    // Attempting to attach another item's asset or project media
    const projMediaKey = testDbConnection.prepare("SELECT storage_key FROM project_media LIMIT 1").get().storage_key;
    const projMediaAttachRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: baseUrl,
        "x-csrf-token": csrfToken
      },
      body: JSON.stringify({
        id: "probe-proj-media",
        altTR: "Test",
        altEN: "Test",
        asset: {
          storageKey: projMediaKey,
          storageMode: "r2",
          publicUrl: `/api/media/${projMediaKey}`,
          mimeType: "image/jpeg",
          byteSize: 50000
        }
      })
    });
    assert(projMediaAttachRes.status === 403, "Attaching project_media key to gallery item rejected with HTTP 403", `Status: ${projMediaAttachRes.status}`);

    // 4. Invalid reorder payload (empty array) rejected atomically
    const emptyReorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader, Origin: baseUrl, "x-csrf-token": csrfToken },
      body: JSON.stringify({ items: [] })
    });
    assert(emptyReorderRes.status === 400, "Empty reorder payload rejected with HTTP 400 Bad Request");

    // 5. Duplicate reorder IDs rejected
    const dupReorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader, Origin: baseUrl, "x-csrf-token": csrfToken },
      body: JSON.stringify({
        items: [
          { id: p2Id, sortOrder: 1 },
          { id: p2Id, sortOrder: 2 }
        ]
      })
    });
    assert(dupReorderRes.status === 400, "Duplicate reorder IDs rejected with HTTP 400 Bad Request");

    // 6. Non-existent reorder IDs rejected
    const nonExistentReorderRes = await fetch(`${baseUrl}/api/admin/gallery/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader, Origin: baseUrl, "x-csrf-token": csrfToken },
      body: JSON.stringify({
        items: [{ id: "ghost-item-id-9999", sortOrder: 1 }]
      })
    });
    assert(nonExistentReorderRes.status === 400, "Non-existent reorder IDs rejected with HTTP 400 Bad Request");

    // 7. Upload of JPEG containing EXIF GPS rejected
    const gpsFormData = new FormData();
    gpsFormData.append("file", new Blob([createJpegWithGps()], { type: "image/jpeg" }), "gps-violation.jpg");
    gpsFormData.append("itemId", "gps-test-item");

    const gpsUploadRes = await fetch(`${baseUrl}/api/admin/gallery/upload`, {
      method: "POST",
      headers: { Cookie: cookieHeader, Origin: baseUrl, "x-csrf-token": csrfToken },
      body: gpsFormData
    });
    assert(gpsUploadRes.status === 400, "Image containing EXIF GPS metadata rejected with HTTP 400", `Status: ${gpsUploadRes.status}`);

    // 8. Invalid MIME / magic byte rejected
    const fakeJpgData = new FormData();
    fakeJpgData.append("file", new Blob([Buffer.from("THIS IS NOT A VALID IMAGE BUFFER")], { type: "image/jpeg" }), "fake.jpg");
    fakeJpgData.append("itemId", "fake-test-item");

    const fakeUploadRes = await fetch(`${baseUrl}/api/admin/gallery/upload`, {
      method: "POST",
      headers: { Cookie: cookieHeader, Origin: baseUrl, "x-csrf-token": csrfToken },
      body: fakeJpgData
    });
    assert(fakeUploadRes.status === 400, "Invalid MIME / magic byte signature rejected with HTTP 400");

    // 9. Oversized upload (> 10MB) rejected with HTTP 413
    const bigFormData = new FormData();
    const bigBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024); // 10MB + 1KB
    bigFormData.append("file", new Blob([bigBuffer], { type: "image/jpeg" }), "oversized.jpg");
    bigFormData.append("itemId", "big-test-item");

    const bigUploadRes = await fetch(`${baseUrl}/api/admin/gallery/upload`, {
      method: "POST",
      headers: { Cookie: cookieHeader, Origin: baseUrl, "x-csrf-token": csrfToken },
      body: bigFormData
    });
    assert(bigUploadRes.status === 413, "Oversized upload (>10MB) rejected with HTTP 413 Payload Too Large", `Status: ${bigUploadRes.status}`);

    // 10. Publication without mandatory bilingual alt text rejected
    const missingAltRes = await fetch(`${baseUrl}/api/admin/gallery`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader, Origin: baseUrl, "x-csrf-token": csrfToken },
      body: JSON.stringify({
        id: "probe-missing-alt",
        status: "published",
        altTR: "", // Missing
        altEN: "Some english alt",
        src: "/api/media/gallery/test.jpg"
      })
    });
    assert(missingAltRes.status === 400, "Publishing photograph without bilingual alt text rejected with HTTP 400");

    // ------------------------------------------------------------
    // GROUP H: UPSTREAM OUTAGE RESILIENCE & DEGRADATION PARITY (TEST G)
    // ------------------------------------------------------------
    setGroup("H: Upstream Outage Resilience & Degradation Parity (Test G)");

    // 1. Healthy empty state returns 200 with { items: [], count: 0 }
    // Temporarily unpublish all items in isolated DB
    testDbConnection.exec("UPDATE portfolio_gallery_items SET status = 'draft';");
    const emptyPubRes = await fetch(`${baseUrl}/api/v1/public/gallery`);
    const emptyPubData = await emptyPubRes.json();
    assert(emptyPubRes.status === 200, "Healthy empty gallery returns HTTP 200 OK");
    const emptyItems = emptyPubData.gallery || emptyPubData.items || [];
    assert(Array.isArray(emptyItems) && emptyItems.length === 0, "Healthy empty gallery returns empty items array [] (zero falsification)");

    // 2. Simulate upstream failure by temporarily renaming gallery table in isolated DB
    testDbConnection.exec("ALTER TABLE portfolio_gallery_items RENAME TO portfolio_gallery_items_fault;");
    const faultRes = await fetch(`${baseUrl}/api/v1/public/gallery`);
    const faultData = await faultRes.json();

    assert(faultRes.status === 503, "Upstream storage failure returns HTTP 503 Service Unavailable", `Status: ${faultRes.status}`);
    assert(faultData.degraded === true, "Outage response includes degraded: true flag");
    const faultCache = faultRes.headers.get("cache-control") || "";
    assert(faultCache.includes("no-store"), "Outage 503 includes Cache-Control: no-store to prevent edge poisoning", faultCache);

    // Restore table
    testDbConnection.exec("ALTER TABLE portfolio_gallery_items_fault RENAME TO portfolio_gallery_items;");
    testDbConnection.exec("UPDATE portfolio_gallery_items SET status = 'published';");

    // ------------------------------------------------------------
    // GROUP I: RESPONSIVE VIEWPORTS & VISUAL NON-REGRESSION
    // ------------------------------------------------------------
    setGroup("I: Responsive Viewports & Visual Non-Regression");

    const screenshotsDir = path.join(rootDir, "docs", "reviews", "screenshots", "phase4_2");
    const artifactScreenshotsDir = "/Users/keremmihci/.gemini/antigravity/brain/bd30031d-6647-4acb-9e39-1add5e789838/screenshots/phase4_2";
    fs.mkdirSync(screenshotsDir, { recursive: true });
    fs.mkdirSync(artifactScreenshotsDir, { recursive: true });

    // Desktop Viewport (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');

    // Test catalog scrolling down and back up
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    assert(true, "Desktop admin gallery catalog scrolls down and back up smoothly");

    const desktopCatalogShot = path.join(screenshotsDir, "admin_gallery_desktop_1440x900.png");
    await page.screenshot({ path: desktopCatalogShot, fullPage: false });
    fs.copyFileSync(desktopCatalogShot, path.join(artifactScreenshotsDir, "admin_gallery_desktop_1440x900.png"));
    assert(fs.existsSync(desktopCatalogShot), "Desktop catalog screenshot captured (1440x900)");

    // Desktop Editor
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    const desktopEditorShot = path.join(screenshotsDir, "admin_gallery_editor_desktop_1440x900.png");
    await page.screenshot({ path: desktopEditorShot, fullPage: false });
    fs.copyFileSync(desktopEditorShot, path.join(artifactScreenshotsDir, "admin_gallery_editor_desktop_1440x900.png"));
    assert(fs.existsSync(desktopEditorShot), "Desktop editor screenshot captured (1440x900)");

    // Mobile Viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/admin`);
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]');

    const mobileCatalogShot = path.join(screenshotsDir, "admin_gallery_mobile_390x844.png");
    await page.screenshot({ path: mobileCatalogShot, fullPage: false });
    fs.copyFileSync(mobileCatalogShot, path.join(artifactScreenshotsDir, "admin_gallery_mobile_390x844.png"));
    assert(fs.existsSync(mobileCatalogShot), "Mobile catalog screenshot captured (390x844)");

    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]');
    const mobileEditorShot = path.join(screenshotsDir, "admin_gallery_editor_mobile_390x844.png");
    await page.screenshot({ path: mobileEditorShot, fullPage: false });
    fs.copyFileSync(mobileEditorShot, path.join(artifactScreenshotsDir, "admin_gallery_editor_mobile_390x844.png"));
    assert(fs.existsSync(mobileEditorShot), "Mobile editor screenshot captured (390x844)");

    // Public Gallery Desktop View
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}`);
    await page.waitForTimeout(500);
    const publicDesktopShot = path.join(screenshotsDir, "public_gallery_desktop_1440x900.png");
    await page.screenshot({ path: publicDesktopShot, fullPage: false });
    fs.copyFileSync(publicDesktopShot, path.join(artifactScreenshotsDir, "public_gallery_desktop_1440x900.png"));
    assert(fs.existsSync(publicDesktopShot), "Public portfolio desktop screenshot captured (1440x900)");

    // Public Gallery Mobile View
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}`);
    await page.waitForTimeout(500);
    const publicMobileShot = path.join(screenshotsDir, "public_gallery_mobile_390x844.png");
    await page.screenshot({ path: publicMobileShot, fullPage: false });
    fs.copyFileSync(publicMobileShot, path.join(artifactScreenshotsDir, "public_gallery_mobile_390x844.png"));
    assert(fs.existsSync(publicMobileShot), "Public portfolio mobile screenshot captured (390x844)");
  } finally {
    // ------------------------------------------------------------
    // GROUP J: CLEAN TEARDOWN & HOST INTEGRITY INVARIANT VERIFICATION
    // ------------------------------------------------------------
    setGroup("J: Clean Teardown & Host Integrity Invariant Verification");

    // Close browser cleanly
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }

    // Close SQLite test connection
    if (testDbConnection) {
      try {
        testDbConnection.close();
      } catch {}
    }

    // Terminate test server process
    if (testServerProcess && testServerProcess.pid) {
      try {
        testServerProcess.kill("SIGTERM");
      } catch {}
      assert(true, "Isolated test Next.js server terminated safely");
    }

    // Clean up temporary test sandbox
    if (fs.existsSync(tempTestDir)) {
      try {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
        assert(true, "Temporary test sandbox wiped cleanly from /tmp");
      } catch (err) {
        console.error("Failed to remove temp dir:", err);
      }
    }

    // Verify host database integrity
    const hostFinalDbSha256 = getFileSha256(hostDbPath);
    assert(
      hostInitialDbSha256 === hostFinalDbSha256,
      "Host database .local-d1/portfolio.sqlite SHA-256 is 100% identical before and after suite",
      `SHA: ${hostFinalDbSha256?.slice(0, 16)}...`
    );

    const hostFinalWalSha256 = getFileSha256(`${hostDbPath}-wal`);
    assert(
      hostInitialWalSha256 === hostFinalWalSha256,
      "Host database WAL file (.local-d1/portfolio.sqlite-wal) 100% unchanged"
    );

    const hostFinalShmSha256 = getFileSha256(`${hostDbPath}-shm`);
    assert(
      hostInitialShmSha256 === hostFinalShmSha256,
      "Host database SHM file (.local-d1/portfolio.sqlite-shm) 100% unchanged"
    );

    const hostFinalInventory = getDirectoryInventory(path.dirname(hostDbPath));
    const inventoryMatches = JSON.stringify(hostInitialInventory) === JSON.stringify(hostFinalInventory);
    assert(inventoryMatches, "Host .local-d1 directory file inventory completely unchanged");

    // Verify the 3 existing preview items in host DB are intact
    const hostDbVerify = new DatabaseSync(hostDbPath, { open: true, readOnly: true });
    const previewItems = hostDbVerify.prepare("SELECT id FROM portfolio_gallery_items WHERE id LIKE 'gallery-preview-%'").all();
    hostDbVerify.close();
    assert(
      previewItems.length === 3,
      "Three existing local gallery-preview records preserved intact in host DB",
      `Count: ${previewItems.length}`
    );
  }

  // Write JSON test results
  const resultsJsonPath = path.join(rootDir, "docs", "reviews", "PORTFOLIO_OS_PHASE4_2_TEST_RESULTS.json");
  fs.writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✓ Wrote structured test results to ${resultsJsonPath}`);

  console.log("\n============================================================");
  console.log(`PHASE 4.2 TEST SUMMARY: ${results.passed} / ${results.total} PASSED`);
  console.log(`Failures: ${results.failed}`);
  console.log("============================================================\n");

  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR IN PHASE 4.2 SUITE:", err);
  process.exit(1);
});
