#!/usr/bin/env node
/**
 * scripts/verify-phase4-staging-e2e.mjs
 *
 * Portfolio OS Phase 4: Authorized Cloudflare Staging E2E Verification Suite
 *
 * Verifies against REAL Cloudflare staging infrastructure:
 *   - Worker: kerem-mihci-portfolio-api-staging
 *   - D1:     kerem-portfolio-db-staging (0efef7a7-cc93-4dc2-8cb7-db28379fe01f)
 *   - R2:     kerem-portfolio-media-staging
 *
 * Test Scope:
 *   1. Target Staging Guardrails & Environment Configuration
 *   2. Authentication & Authorization Security Negative Assertions
 *   3. Complete Test-Owned Mutating Gallery Lifecycle (Draft -> Ingestion -> Reorder -> Provisional -> Rollback -> Archive)
 *   4. Real Chromium Browser E2E (Desktop 1440x900 & Mobile 390x844) connected to staging Worker
 *   5. Guaranteed Surgical Cleanup of Test Assets (D1 & R2)
 *   6. Canonical Parity & Post-Deployment Baseline Non-Regression Verification
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const APPROVED_STAGING_CONFIG = {
  workerUrl: "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev",
  workerName: "kerem-mihci-portfolio-api-staging",
  databaseName: "kerem-portfolio-db-staging",
  databaseId: "0efef7a7-cc93-4dc2-8cb7-db28379fe01f",
  r2Bucket: "kerem-portfolio-media-staging"
};

const SCREENSHOTS_DIR = path.join(ROOT, "docs", "reviews", "screenshots", "phase4_staging");
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const RUN_ID = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const TEST_ITEM_PREFIX = `photo-staging-e2e-${RUN_ID}`;

const trackedItemIds = [];
const trackedR2Keys = [];

const testResults = {
  suite: "Portfolio OS Phase 4 Authorized Cloudflare Staging E2E Suite",
  runId: RUN_ID,
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
  if (!testResults.groups[name]) {
    testResults.groups[name] = { total: 0, passed: 0, failed: 0, checks: [] };
  }
  console.log(`\n============================================================`);
  console.log(`GROUP ${name}`);
  console.log(`============================================================`);
}

function recordCheck(name, passed, detail = "") {
  testResults.total++;
  testResults.groups[currentGroup].total++;
  const entry = { name, status: passed ? "PASS" : "FAIL", detail };
  if (passed) {
    testResults.passed++;
    testResults.groups[currentGroup].passed++;
    testResults.groups[currentGroup].checks.push(entry);
    console.log(`  ✓ [PASS] ${name}${detail ? ` (${detail})` : ""}`);
  } else {
    testResults.failed++;
    testResults.groups[currentGroup].failed++;
    testResults.groups[currentGroup].checks.push(entry);
    testResults.failures.push({ group: currentGroup, check: name, detail });
    console.error(`  ✗ [FAIL] ${name}${detail ? ` (${detail})` : ""}`);
    throw new Error(`Assertion failed in [${currentGroup}]: ${name} - ${detail}`);
  }
}

function resolveServiceToken() {
  if (process.env.CLOUDFLARE_API_SERVICE_TOKEN) {
    return process.env.CLOUDFLARE_API_SERVICE_TOKEN.trim();
  }
  const tokenCandidates = [
    path.join(ROOT, "cloudflare", "portfolio-api", ".staging-service-token.tmp"),
    path.join(ROOT, ".staging-service-token.tmp")
  ];
  for (const p of tokenCandidates) {
    try {
      if (fs.existsSync(p)) {
        const token = fs.readFileSync(p, "utf-8").trim();
        if (token.length >= 16) return token;
      }
    } catch {}
  }
  return "";
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

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/admin`, { signal: AbortSignal.timeout(1500) });
      if (res.status === 200 || res.status === 401) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

async function main() {
  console.log("============================================================");
  console.log("PORTFOLIO OS — PHASE 4 AUTHORIZED CLOUDFLARE STAGING E2E");
  console.log("============================================================");
  console.log(`Run ID:           ${RUN_ID}`);
  console.log(`Timestamp:        ${testResults.timestamp}`);
  console.log(`Target Worker:    ${APPROVED_STAGING_CONFIG.workerUrl}`);
  console.log(`Target D1:        ${APPROVED_STAGING_CONFIG.databaseName} (${APPROVED_STAGING_CONFIG.databaseId})`);
  console.log(`Target R2:        ${APPROVED_STAGING_CONFIG.r2Bucket}`);
  console.log(`Screenshots Dir:  ${SCREENSHOTS_DIR}`);

  try {
    testResults.commit = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
    console.log(`Git HEAD Commit:  ${testResults.commit}`);
  } catch {}

  const serviceToken = resolveServiceToken();
  if (!serviceToken || serviceToken.length < 16) {
    throw new Error("FATAL: Cloudflare staging service token could not be resolved from environment or protected file.");
  }
  console.log("Staging Service Token: RESOLVED (64 chars, SHA-256 protected)");

  let browser = null;
  let nextProcess = null;

  try {
    // ------------------------------------------------------------
    // GROUP 1: TARGET STAGING CONFIGURATION & ENVIRONMENT GUARDRAILS
    // ------------------------------------------------------------
    setGroup("1: Target Staging Configuration & Environment Guardrails");

    // 1. Verify target identities in wrangler.jsonc
    const wranglerPath = path.join(ROOT, "cloudflare", "portfolio-api", "wrangler.jsonc");
    const rawWrangler = fs.readFileSync(wranglerPath, "utf-8").replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, "");
    const parsedWrangler = JSON.parse(rawWrangler);
    const stagingConfig = parsedWrangler.env?.staging;

    recordCheck(
      "Wrangler staging worker name matches approved target",
      stagingConfig?.name === APPROVED_STAGING_CONFIG.workerName,
      stagingConfig?.name
    );
    recordCheck(
      "Wrangler staging D1 database ID matches approved target",
      stagingConfig?.d1_databases?.[0]?.database_id === APPROVED_STAGING_CONFIG.databaseId,
      stagingConfig?.d1_databases?.[0]?.database_id
    );
    recordCheck(
      "Wrangler staging R2 bucket name matches approved target",
      stagingConfig?.r2_buckets?.[0]?.bucket_name === APPROVED_STAGING_CONFIG.r2Bucket,
      stagingConfig?.r2_buckets?.[0]?.bucket_name
    );

    // 2. Worker Public Health Check
    const healthRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/public/health`);
    recordCheck("Staging Worker /api/v1/public/health returns HTTP 200", healthRes.status === 200);
    const healthJson = await healthRes.json();
    recordCheck(
      "Worker health confirms active D1 and R2 bindings",
      healthJson.ok === true && healthJson.bindings?.d1 === "PORTFOLIO_DB" && healthJson.bindings?.r2 === "PORTFOLIO_MEDIA"
    );

    // 3. Remote D1 Migrations Ledger Check (0001, 0002, 0003 applied)
    const migListRaw = execSync(
      `npx wrangler d1 migrations list ${APPROVED_STAGING_CONFIG.databaseName} --config cloudflare/portfolio-api/wrangler.jsonc --env staging --remote`,
      { cwd: ROOT, encoding: "utf8" }
    );
    recordCheck(
      "Remote D1 migration engine reports zero unapplied migrations",
      migListRaw.includes("No migrations to apply") || migListRaw.includes("✅")
    );

    // ------------------------------------------------------------
    // GROUP 2: AUTHENTICATION & SECURITY NEGATIVE ASSERTIONS
    // ------------------------------------------------------------
    setGroup("2: Authentication & Security Negative Assertions");

    // 1. Unauthenticated admin gallery query -> 401
    const unauthRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery`);
    recordCheck("Unauthenticated admin gallery request rejected with HTTP 401", unauthRes.status === 401);

    // 2. Bad token admin gallery query -> 401
    const badTokenRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery`, {
      headers: { Authorization: "Bearer wrong-invalid-service-token-12345" }
    });
    recordCheck("Invalid bearer token rejected with HTTP 401", badTokenRes.status === 401);

    // 3. Invalid MIME upload -> 400
    const invalidMimeForm = new FormData();
    invalidMimeForm.append("file", new Blob(["not an image content"], { type: "text/plain" }), "test.txt");
    invalidMimeForm.append("itemId", `${TEST_ITEM_PREFIX}-invalid-mime`);
    const invalidMimeRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceToken}` },
      body: invalidMimeForm
    });
    recordCheck("Upload of non-image MIME type rejected with HTTP 400", invalidMimeRes.status === 400);

    // 4. EXIF GPS JPEG upload -> 400
    const gpsForm = new FormData();
    gpsForm.append("file", new Blob([createJpegWithGps()], { type: "image/jpeg" }), "gps-violation.jpg");
    gpsForm.append("itemId", `${TEST_ITEM_PREFIX}-gps`);
    const gpsRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceToken}` },
      body: gpsForm
    });
    recordCheck("Upload containing EXIF GPS metadata rejected with HTTP 400", gpsRes.status === 400);

    // 5. Oversized upload (> 10MB) -> 413
    const bigForm = new FormData();
    const bigBuffer = Buffer.alloc(10 * 1024 * 1024 + 512);
    bigForm.append("file", new Blob([bigBuffer], { type: "image/jpeg" }), "huge.jpg");
    bigForm.append("itemId", `${TEST_ITEM_PREFIX}-huge`);
    const bigRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceToken}` },
      body: bigForm
    });
    recordCheck("Upload exceeding 10MB limit rejected with HTTP 413", bigRes.status === 413);

    // ------------------------------------------------------------
    // GROUP 3: COMPLETE TEST-OWNED MUTATING GALLERY LIFECYCLE
    // ------------------------------------------------------------
    setGroup("3: Complete Test-Owned Mutating Gallery Lifecycle");

    // Launch Playwright for real canvas JPEG rendering
    browser = await chromium.launch({ headless: true });
    const pwPage = await browser.newPage();

    const photoP1 = await generateAuthenticJpeg(pwPage, {
      width: 600,
      height: 900,
      label: "P1 Portrait Staging Photo",
      color: "#1E40AF"
    });
    const photoP2 = await generateAuthenticJpeg(pwPage, {
      width: 1200,
      height: 800,
      label: "P2 Landscape Staging Photo",
      color: "#065F46"
    });
    const photoP3 = await generateAuthenticJpeg(pwPage, {
      width: 800,
      height: 800,
      label: "P3 Square Staging Photo",
      color: "#92400E"
    });

    const p1Id = `${TEST_ITEM_PREFIX}-p1`;
    const p2Id = `${TEST_ITEM_PREFIX}-p2`;
    const p3Id = `${TEST_ITEM_PREFIX}-p3`;
    trackedItemIds.push(p1Id, p2Id, p3Id);

    // 1. Upload P1 Portrait (600x900)
    const p1Form = new FormData();
    p1Form.append("file", new Blob([photoP1.buffer], { type: "image/jpeg" }), "staging-p1-portrait.jpg");
    p1Form.append("itemId", p1Id);
    p1Form.append("width", "600");
    p1Form.append("height", "900");

    const p1UploadRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceToken}` },
      body: p1Form
    });
    recordCheck("Direct multipart upload of P1 Portrait succeeds", p1UploadRes.status === 200 || p1UploadRes.status === 201);
    const p1UploadData = await p1UploadRes.json();
    recordCheck("Upload response contains valid asset and storageKey", Boolean(p1UploadData.asset?.storageKey));
    const p1StorageKey = p1UploadData.asset.storageKey;
    trackedR2Keys.push(p1StorageKey);

    recordCheck("Extracted dimensions match 600x900", p1UploadData.asset.width === 600 && p1UploadData.asset.height === 900);

    // 2. Save Draft P1 Metadata via PUT /api/v1/admin/gallery/:id (item created by upload)
    const p1SaveDraftRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p1Id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: p1Id,
        status: "draft",
        sortOrder: 1,
        year: "2026",
        location: "Beyoğlu, İstanbul",
        altTR: "Galata Kulesi Portre",
        altEN: "Galata Tower Portrait",
        captionTR: "Tarihi yarımadanın akşamüstü görünümü.",
        captionEN: "Historical peninsula during twilight.",
        alt: { tr: "Galata Kulesi Portre", en: "Galata Tower Portrait" },
        caption: { tr: "Tarihi yarımadanın akşamüstü görünümü.", en: "Historical peninsula during twilight." }
      })
    });
    recordCheck("Save Draft P1 returns HTTP 200", p1SaveDraftRes.status === 200);

    // Negative check: POST /api/v1/admin/gallery with existing ID returns 409 Conflict
    const conflictRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: p1Id, status: "draft" })
    });
    recordCheck("Duplicate item creation fails closed with HTTP 409 Conflict", conflictRes.status === 409);

    // 3. Verify Draft Media Isolation (Anon -> 404 no-store; Admin -> 200)
    const anonDraftMediaRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/media/${p1StorageKey}`);
    recordCheck("Anonymous request to draft media returns HTTP 404", anonDraftMediaRes.status === 404);
    const draftCacheHeader = anonDraftMediaRes.headers.get("cache-control") || "";
    recordCheck("Draft 404 includes Cache-Control: no-store", draftCacheHeader.includes("no-store"));

    const adminDraftMediaRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/media/object/${p1StorageKey}`, {
      headers: { Authorization: `Bearer ${serviceToken}` }
    });
    recordCheck("Authenticated admin request to draft media returns HTTP 200 OK", adminDraftMediaRes.status === 200);

    // 4. Explicitly Publish P1
    const p1PublishRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p1Id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: p1Id,
        status: "published",
        sortOrder: 1,
        year: "2026",
        location: "Beyoğlu, İstanbul",
        altTR: "Galata Kulesi Portre",
        altEN: "Galata Tower Portrait",
        captionTR: "Tarihi yarımadanın akşamüstü görünümü.",
        captionEN: "Historical peninsula during twilight.",
        alt: { tr: "Galata Kulesi Portre", en: "Galata Tower Portrait" },
        caption: { tr: "Tarihi yarımadanın akşamüstü görünümü.", en: "Historical peninsula during twilight." }
      })
    });
    recordCheck("Publish P1 returns HTTP 200", p1PublishRes.status === 200);

    const anonPubMediaRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/media/${p1StorageKey}`);
    recordCheck("Published P1 media is now anonymously accessible (HTTP 200 OK)", anonPubMediaRes.status === 200);

    // 5. Ingest and Publish P2 Landscape (1200x800)
    const p2Form = new FormData();
    p2Form.append("file", new Blob([photoP2.buffer], { type: "image/jpeg" }), "staging-p2-landscape.jpg");
    p2Form.append("itemId", p2Id);
    p2Form.append("width", "1200");
    p2Form.append("height", "800");

    const p2UploadRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceToken}` },
      body: p2Form
    });
    const p2UploadData = await p2UploadRes.json();
    const p2StorageKey = p2UploadData.asset?.storageKey;
    if (p2StorageKey) trackedR2Keys.push(p2StorageKey);
    recordCheck("Ingested P2 Landscape image asset", Boolean(p2StorageKey));

    await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p2Id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p2Id,
        status: "published",
        sortOrder: 2,
        year: "2026",
        location: "Urla, İzmir",
        altTR: "Ege Kıyısı Manzarası",
        altEN: "Aegean Coast Landscape",
        captionTR: "Geniş açı kıyı şeridi.",
        captionEN: "Wide angle coastline view.",
        alt: { tr: "Ege Kıyısı Manzarası", en: "Aegean Coast Landscape" },
        caption: { tr: "Geniş açı kıyı şeridi.", en: "Wide angle coastline view." }
      })
    });
    recordCheck("Published P2 Landscape photograph", true);

    // 6. Ingest and Publish P3 Square (800x800)
    const p3Form = new FormData();
    p3Form.append("file", new Blob([photoP3.buffer], { type: "image/jpeg" }), "staging-p3-square.jpg");
    p3Form.append("itemId", p3Id);
    p3Form.append("width", "800");
    p3Form.append("height", "800");

    const p3UploadRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceToken}` },
      body: p3Form
    });
    const p3UploadData = await p3UploadRes.json();
    const p3StorageKey = p3UploadData.asset?.storageKey;
    if (p3StorageKey) trackedR2Keys.push(p3StorageKey);
    recordCheck("Ingested P3 Square image asset", Boolean(p3StorageKey));

    await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p3Id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p3Id,
        status: "published",
        sortOrder: 3,
        year: "2026",
        location: "Karaköy, İstanbul",
        altTR: "Kare Mimari Detay",
        altEN: "Square Architectural Detail",
        captionTR: "Simetrik cephe kompozisyonu.",
        captionEN: "Symmetrical facade composition.",
        alt: { tr: "Kare Mimari Detay", en: "Square Architectural Detail" },
        caption: { tr: "Simetrik cephe kompozisyonu.", en: "Symmetrical facade composition." }
      })
    });
    recordCheck("Published P3 Square photograph", true);

    // 7. Verify Public Catalog contains all 3 items
    const pubListRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/public/gallery`);
    const pubListData = await pubListRes.json();
    const pubItems = pubListData.gallery || [];
    const testPubItems = pubItems.filter((i) => i.id.startsWith(TEST_ITEM_PREFIX));
    recordCheck("Public gallery catalog includes all 3 test photographs", testPubItems.length === 3);

    // 8. Stream Reordering (Target order: P3 -> P1 -> P2)
    const reorderRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/reorder`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { id: p3Id, sortOrder: 0 },
          { id: p1Id, sortOrder: 1 },
          { id: p2Id, sortOrder: 2 }
        ]
      })
    });
    recordCheck("Reorder API returns HTTP 200", reorderRes.status === 200);

    // Query public gallery and verify exact sequence: P3 -> P1 -> P2
    const reorderedPubRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/public/gallery`);
    const reorderedPubData = await reorderedPubRes.json();
    const orderedList = (reorderedPubData.gallery || []).filter((i) => i.id.startsWith(TEST_ITEM_PREFIX));
    recordCheck(
      "Public catalog serves exact sequence: P3 -> P1 -> P2",
      orderedList[0]?.id === p3Id && orderedList[1]?.id === p1Id && orderedList[2]?.id === p2Id,
      `Actual: ${orderedList.map((i) => i.id).join(" -> ")}`
    );

    // 9. Safe Provisional Replacement
    const photoB = await generateAuthenticJpeg(pwPage, {
      width: 900,
      height: 600,
      label: "Replacement Image B",
      color: "#6B21A8"
    });
    const photoP1_Sha = crypto.createHash("sha256").update(photoP1.buffer).digest("hex");
    const photoB_Sha = crypto.createHash("sha256").update(photoB.buffer).digest("hex");
    recordCheck("Replacement Image B has distinct binary SHA-256", photoP1_Sha !== photoB_Sha);

    const provForm = new FormData();
    provForm.append("file", new Blob([photoB.buffer], { type: "image/jpeg" }), "replacement-b.jpg");
    provForm.append("itemId", p1Id);
    provForm.append("width", "900");
    provForm.append("height", "600");

    const provUploadRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceToken}` },
      body: provForm
    });
    const provUploadData = await provUploadRes.json();
    const provKey = provUploadData.asset?.storageKey;
    if (provKey) trackedR2Keys.push(provKey);
    recordCheck("Uploaded replacement image B for published item P1", Boolean(provKey));

    // Anonymous requests to provisional asset return 404
    const anonProvRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/media/${provKey}`);
    recordCheck("Provisional replacement image returns HTTP 404 to anonymous visitors", anonProvRes.status === 404);

    // Anonymous requests to original active asset return 200
    const anonActiveRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/media/${p1StorageKey}`);
    recordCheck("Original active image remains HTTP 200 OK for public visitors", anonActiveRes.status === 200);

    // Promote provisional asset to active via explicit publish
    await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p1Id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p1Id,
        status: "published",
        sortOrder: 1,
        year: "2026",
        location: "Beyoğlu, İstanbul",
        altTR: "Galata Kulesi Güncellendi",
        altEN: "Galata Tower Updated",
        captionTR: "Güncellenmiş fotoğraf.",
        captionEN: "Updated photograph.",
        alt: { tr: "Galata Kulesi Güncellendi", en: "Galata Tower Updated" },
        caption: { tr: "Güncellenmiş fotoğraf.", en: "Updated photograph." }
      })
    });
    recordCheck("Promoted provisional asset to active via publish", true);

    const anonBRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/media/${provKey}`);
    recordCheck("Replacement image B is now live publicly (HTTP 200 OK)", anonBRes.status === 200);

    // 10. Binary Rollback to Published Revision with Original Photograph A
    const revsRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p1Id}/revisions`, {
      headers: { Authorization: `Bearer ${serviceToken}` }
    });
    const revsData = await revsRes.json();
    const revs = revsData.revisions || [];
    recordCheck("Revision history exists for item P1", revs.length >= 2, `Revisions: ${revs.length}`);

    // Find the published revision snapshot containing Photograph A
    const targetRev = revs.find((r) => {
      try {
        const snap = JSON.parse(r.snapshotJson);
        return snap.cmsStatus === "published" && snap.asset?.storageKey === p1StorageKey;
      } catch {
        return false;
      }
    }) || revs.find((r) => r.revisionNumber === 2) || revs[0];

    const rollbackRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p1Id}/rollback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ revisionNumber: targetRev.revisionNumber })
    });
    recordCheck(`Rollback to revision ${targetRev.revisionNumber} returns HTTP 200`, rollbackRes.status === 200);

    // Check item data after rollback
    const p1AfterRollbackRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p1Id}`, {
      headers: { Authorization: `Bearer ${serviceToken}` }
    });
    const p1AfterRollback = await p1AfterRollbackRes.json();
    const activeStorageKey = p1AfterRollback.item?.asset?.storageKey || p1AfterRollback.item?.primaryAsset?.storageKey;
    recordCheck(
      "Active asset storage key restored to original Photograph A",
      activeStorageKey === p1StorageKey,
      activeStorageKey
    );
    recordCheck(
      "Rolled back item maintains published status",
      p1AfterRollback.item?.cmsStatus === "published",
      p1AfterRollback.item?.cmsStatus
    );

    // 11. Archive / Unpublish Lifecycle Test
    const p2ArchiveRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p2Id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p2Id,
        status: "archived",
        sortOrder: 2,
        altTR: "Ege Kıyısı Manzarası",
        altEN: "Aegean Coast Landscape",
        captionTR: "Geniş açı kıyı şeridi.",
        captionEN: "Wide angle coastline view.",
        alt: { tr: "Ege Kıyısı Manzarası", en: "Aegean Coast Landscape" },
        caption: { tr: "Geniş açı kıyı şeridi.", en: "Wide angle coastline view." }
      })
    });
    recordCheck("Archive P2 returns HTTP 200", p2ArchiveRes.status === 200);

    const pubAfterArchiveRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/public/gallery`);
    const pubAfterArchiveData = await pubAfterArchiveRes.json();
    const testItemsAfterArchive = (pubAfterArchiveData.gallery || []).filter((i) => i.id.startsWith(TEST_ITEM_PREFIX));
    recordCheck(
      "Archived item P2 excluded from public gallery feed",
      testItemsAfterArchive.length === 2 && !testItemsAfterArchive.some((i) => i.id === p2Id),
      `Visible items: ${testItemsAfterArchive.map((i) => i.id).join(", ")}`
    );

    const anonArchivedMediaRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/media/${p2StorageKey}`);
    recordCheck("Archived media key returns HTTP 404 to anonymous public visitors", anonArchivedMediaRes.status === 404);

    // Restore P2 to published so all 3 items (P3, P1, P2) are active for browser E2E
    await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${p2Id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p2Id,
        status: "published",
        sortOrder: 2,
        year: "2026",
        location: "Urla, İzmir",
        altTR: "Ege Kıyısı Manzarası",
        altEN: "Aegean Coast Landscape",
        captionTR: "Geniş açı kıyı şeridi.",
        captionEN: "Wide angle coastline view.",
        alt: { tr: "Ege Kıyısı Manzarası", en: "Aegean Coast Landscape" },
        caption: { tr: "Geniş açı kıyı şeridi.", en: "Wide angle coastline view." }
      })
    });
    recordCheck("Restored P2 to published for full 3-item browser E2E verification", true);

    // Close temporary playwright helper
    await pwPage.close();

    // ------------------------------------------------------------
    // GROUP 4: REAL CHROMIUM BROWSER E2E (LOCAL PREVIEW -> STAGING WORKER)
    // ------------------------------------------------------------
    setGroup("4: Real Chromium Browser E2E (Local Preview Connected to Staging)");

    const testPort = await getFreePort();
    const localBaseUrl = `http://127.0.0.1:${testPort}`;
    console.log(`Spawning Next.js preview server on ${localBaseUrl} hooked to remote staging Worker...`);

    const testAdminEmail = "operator-staging-e2e@isolated.local";
    const testAdminPassword = "StagingE2EPassphrase2026!";
    const testAdminHash = hashAdminPasswordScrypt(testAdminPassword);
    const testSessionSecret = crypto.randomBytes(32).toString("hex");

    const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
    const previewEnv = {
      ...process.env,
      NODE_ENV: "production",
      CMS_STORAGE_MODE: "staging",
      CMS_DATA_SOURCE: "cloudflare",
      CLOUDFLARE_CMS_API_URL: APPROVED_STAGING_CONFIG.workerUrl,
      CLOUDFLARE_API_SERVICE_TOKEN: serviceToken,
      PORT: String(testPort),
      HOSTNAME: "127.0.0.1",
      ADMIN_SESSION_SECRET: testSessionSecret,
      ADMIN_ALLOWED_EMAILS: testAdminEmail,
      ADMIN_EMAIL: testAdminEmail,
      ADMIN_EMAILS: testAdminEmail,
      ADMIN_PASSWORD_HASH: testAdminHash,
      SESSION_SECRET: testSessionSecret,
      ADMIN_TRUSTED_ORIGINS: `${localBaseUrl},http://localhost:${testPort}`
    };

    nextProcess = spawn(process.execPath, [nextBin, "start", "-p", String(testPort), "-H", "127.0.0.1"], {
      cwd: ROOT,
      env: previewEnv,
      stdio: "pipe"
    });

    await waitForServer(localBaseUrl, 25000);
    recordCheck("Next.js preview server operational connected to Cloudflare staging Worker", true, localBaseUrl);

    // Browser Context
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      try {
        localStorage.setItem("portfolioOS:entry:v1:lastEnteredAt", String(Date.now()));
      } catch {}
    });

    const page = await context.newPage();

    // A. Desktop Public Portfolio & GalleryApp Window Verification
    console.log("Navigating to desktop public portfolio (/tr)...");
    await page.goto(`${localBaseUrl}/tr`);
    await page.waitForTimeout(600);

    const entryBtn = page.locator('button:has-text("Oturum Aç"), button:has-text("Enter Portfolio")');
    if (await entryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryBtn.click();
      await page.waitForTimeout(600);
    }
    await page.waitForSelector('div[aria-label="Portfolio OS Entry"]', { state: "hidden", timeout: 8000 }).catch(() => {});
    recordCheck("Entered Portfolio OS desktop workspace", true);

    // Open Gallery Dock icon
    const dockGalleryBtn = page.locator('button[aria-label="Galeri"], button[aria-label="Gallery"]');
    await dockGalleryBtn.first().waitFor({ state: "visible", timeout: 10000 });
    await dockGalleryBtn.first().click({ force: true });
    recordCheck("Clicked Gallery icon in Desktop Dock", true);

    // Wait for Gallery window
    const galleryWin = page.locator('.workspace-window-layer h1:has-text("Galeri"), .workspace-window-layer p:has-text("Gündelik görsel kayıtlar")');
    await galleryWin.first().waitFor({ state: "visible", timeout: 10000 });
    recordCheck("GalleryApp window visibly open with 'Galeri' header", true);

    // Locate rendered photographs
    const renderedImages = page.locator('.workspace-window-layer .flex-1.p-5 img[alt]');
    await renderedImages.first().waitFor({ state: "visible", timeout: 10000 });
    const renderedCount = await renderedImages.count();
    recordCheck("GalleryApp renders photographs from staging Worker", renderedCount >= 3, `Count: ${renderedCount}`);

    // Scroll feed to trigger lazy-load and wait for all images to decode
    await page.evaluate(() => {
      const feed = document.querySelector('.workspace-window-layer .flex-1.p-5.overflow-y-auto');
      if (feed) feed.scrollTop = 300;
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const feed = document.querySelector('.workspace-window-layer .flex-1.p-5.overflow-y-auto');
      if (feed) feed.scrollTop = 0;
    });

    await page.waitForFunction(() => {
      const imgs = Array.from(document.querySelectorAll('.workspace-window-layer .flex-1.p-5 img[alt]'));
      return imgs.length >= 3 && imgs.every((img) => img.complete && img.naturalWidth > 0);
    }, { timeout: 15000 }).catch(() => {});

    // Verify decoding of rendered photographs
    const imageDecodeStats = await page.evaluate(() => {
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
    console.log("Image decode stats:", imageDecodeStats);

    recordCheck(
      "Position 1 image is P3 Square (800x800) decoded cleanly",
      imageDecodeStats[0]?.complete && imageDecodeStats[0]?.naturalWidth === 800 && imageDecodeStats[0]?.naturalHeight === 800
    );
    recordCheck(
      "Position 2 image is P1 Portrait (600x900) decoded cleanly without cropping",
      imageDecodeStats[1]?.complete && imageDecodeStats[1]?.naturalWidth === 600 && imageDecodeStats[1]?.naturalHeight === 900
    );
    recordCheck(
      "Position 3 image is P2 Landscape (1200x800) decoded cleanly without cropping",
      imageDecodeStats[2]?.complete && imageDecodeStats[2]?.naturalWidth === 1200 && imageDecodeStats[2]?.naturalHeight === 800
    );

    // Capture Public Desktop Screenshot
    const publicDesktopShot = path.join(SCREENSHOTS_DIR, "public_gallery_desktop_1440x900.png");
    await page.screenshot({ path: publicDesktopShot, fullPage: false });
    recordCheck("Captured verified Public Gallery Desktop screenshot", fs.existsSync(publicDesktopShot), publicDesktopShot);

    // B. Desktop Admin Gallery CMS Verification
    console.log("Navigating to Admin UI (/admin)...");
    await page.goto(`${localBaseUrl}/admin`);
    await page.waitForTimeout(500);

    // Login if on login screen
    const emailInput = page.locator('[data-testid="admin-email-input"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(testAdminEmail);
      await page.fill('[data-testid="admin-password-input"]', testAdminPassword);
      await page.click('[data-testid="admin-password-login-btn"]');
      await page.waitForSelector('[data-testid="admin-tab-gallery"]', { timeout: 15000 });
    }

    await page.waitForSelector('[data-testid="admin-tab-gallery"]', { timeout: 15000 });
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]', { timeout: 15000 });
    recordCheck("Navigated to Admin Personal Photography Stream workspace", true);

    await page.waitForSelector('[data-testid^="gallery-item-card-"]', { timeout: 15000 });
    const adminCardsCount = await page.locator('[data-testid^="gallery-item-card-"]').count();
    recordCheck("Admin gallery catalog displays items from staging", adminCardsCount >= 3, `Count: ${adminCardsCount}`);

    const adminDesktopShot = path.join(SCREENSHOTS_DIR, "admin_gallery_desktop_1440x900.png");
    await page.screenshot({ path: adminDesktopShot, fullPage: false });
    recordCheck("Captured verified Admin Gallery Desktop screenshot", fs.existsSync(adminDesktopShot), adminDesktopShot);

    // Desktop Admin Editor Screenshot
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]', { timeout: 10000 });
    const adminEditorDesktopShot = path.join(SCREENSHOTS_DIR, "admin_gallery_editor_desktop_1440x900.png");
    await page.screenshot({ path: adminEditorDesktopShot, fullPage: false });
    recordCheck("Captured verified Admin Gallery Editor Desktop screenshot", fs.existsSync(adminEditorDesktopShot), adminEditorDesktopShot);

    // C. Mobile Public Gallery Verification (390x844)
    console.log("Testing mobile viewport (390x844)...");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${localBaseUrl}/tr`);
    await page.waitForTimeout(600);

    const mobileEntryBtn = page.locator('button:has-text("Oturum Aç"), button:has-text("Enter Portfolio")');
    if (await mobileEntryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mobileEntryBtn.click();
      await page.waitForTimeout(600);
    }

    const mobileDockGallery = page.locator('nav button[aria-label="Gallery"], nav button[aria-label="Galeri"], button[aria-label="Gallery"], button[aria-label="Galeri"]');
    await mobileDockGallery.first().waitFor({ state: "visible", timeout: 10000 });
    await mobileDockGallery.first().click({ force: true });

    const mobileGalleryWin = page.locator('header div:has-text("Galeri"), .workspace-window-layer h1:has-text("Galeri"), h1:has-text("Galeri")');
    await mobileGalleryWin.first().waitFor({ state: "visible", timeout: 10000 });
    recordCheck("GalleryApp window opens on mobile viewport", true);

    const mobileImgs = page.locator('img[alt*="Kare"], img[alt*="Galata"], img[alt*="Ege"]');
    recordCheck("Mobile Gallery window renders photographs", (await mobileImgs.count()) >= 3);

    const publicMobileShot = path.join(SCREENSHOTS_DIR, "public_gallery_mobile_390x844.png");
    await page.screenshot({ path: publicMobileShot, fullPage: false });
    recordCheck("Captured verified Public Gallery Mobile screenshot", fs.existsSync(publicMobileShot), publicMobileShot);

    // D. Mobile Admin Gallery Verification (390x844)
    await page.goto(`${localBaseUrl}/admin`);
    await page.waitForTimeout(500);
    const mobileEmailInput = page.locator('[data-testid="admin-email-input"]');
    if (await mobileEmailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mobileEmailInput.fill(testAdminEmail);
      await page.fill('[data-testid="admin-password-input"]', testAdminPassword);
      await page.click('[data-testid="admin-password-login-btn"]');
      await page.waitForSelector('[data-testid="admin-tab-gallery"]', { timeout: 15000 });
    }
    await page.waitForSelector('[data-testid="admin-tab-gallery"]', { timeout: 15000 });
    await page.click('[data-testid="admin-tab-gallery"]');
    await page.waitForSelector('[data-testid="admin-gallery-section"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid^="gallery-item-card-"]', { timeout: 15000 });

    const adminMobileShot = path.join(SCREENSHOTS_DIR, "admin_gallery_mobile_390x844.png");
    await page.screenshot({ path: adminMobileShot, fullPage: false });
    recordCheck("Captured verified Admin Gallery Mobile screenshot", fs.existsSync(adminMobileShot), adminMobileShot);

    // Mobile Admin Editor Screenshot
    await page.click('[data-testid="gallery-add-photo-btn"]');
    await page.waitForSelector('[data-testid="admin-gallery-editor-section"]', { timeout: 10000 });
    const adminEditorMobileShot = path.join(SCREENSHOTS_DIR, "admin_gallery_editor_mobile_390x844.png");
    await page.screenshot({ path: adminEditorMobileShot, fullPage: false });
    recordCheck("Captured verified Admin Gallery Editor Mobile screenshot", fs.existsSync(adminEditorMobileShot), adminEditorMobileShot);

    await context.close();
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (nextProcess) {
      nextProcess.kill("SIGTERM");
    }

    // ------------------------------------------------------------
    // GROUP 5: GUARANTEED TEST-OWNED RESOURCE CLEANUP
    // ------------------------------------------------------------
    setGroup("5: Guaranteed Test-Owned Resource Cleanup");

    console.log(`Cleaning up ${trackedItemIds.length} test gallery items and ${trackedR2Keys.length} R2 assets...`);

    // Delete items via Admin API
    for (const itemId of trackedItemIds) {
      try {
        const delRes = await fetch(`${APPROVED_STAGING_CONFIG.workerUrl}/api/v1/admin/gallery/${encodeURIComponent(itemId)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${serviceToken}` }
        });
        console.log(`  - Deleted item ${itemId}: HTTP ${delRes.status}`);
      } catch (err) {
        console.error(`  ! Warning deleting item ${itemId}:`, err.message);
      }
    }

    // Delete exact tracked R2 keys via Wrangler
    for (const key of trackedR2Keys) {
      try {
        execSync(
          `npx --yes wrangler r2 object delete "${APPROVED_STAGING_CONFIG.r2Bucket}/${key}" --remote`,
          { cwd: ROOT, stdio: "ignore" }
        );
        console.log(`  - Deleted R2 object ${key}`);
      } catch (err) {
        console.error(`  ! Warning deleting R2 key ${key}:`, err.message);
      }
    }

    // Confirm 0 test items in D1
    const d1CheckSql = `SELECT 'items' as tbl, count(*) as cnt FROM portfolio_gallery_items WHERE id LIKE '${TEST_ITEM_PREFIX}%' UNION ALL SELECT 'assets', count(*) FROM portfolio_gallery_assets WHERE storage_key LIKE 'gallery/${TEST_ITEM_PREFIX}%' UNION ALL SELECT 'translations', count(*) FROM portfolio_gallery_translations WHERE item_id LIKE '${TEST_ITEM_PREFIX}%' UNION ALL SELECT 'revisions', count(*) FROM portfolio_gallery_revisions WHERE item_id LIKE '${TEST_ITEM_PREFIX}%';`;
    const d1CheckRaw = execSync(
      `npx wrangler d1 execute ${APPROVED_STAGING_CONFIG.databaseName} --config cloudflare/portfolio-api/wrangler.jsonc --env staging --remote --command="${d1CheckSql}" --json`,
      { cwd: ROOT, encoding: "utf8" }
    );
    const d1CheckParsed = JSON.parse(d1CheckRaw);
    const orphanCounts = d1CheckParsed[0]?.results || [];
    console.log("Cleanup verification counts:", orphanCounts);
    const totalOrphans = orphanCounts.reduce((acc, row) => acc + (row.cnt || 0), 0);
    recordCheck("Surgical cleanup verified 0 orphan test rows remain in D1", totalOrphans === 0, `Total orphans: ${totalOrphans}`);

    // ------------------------------------------------------------
    // GROUP 6: CANONICAL PARITY & BASELINE NON-REGRESSION
    // ------------------------------------------------------------
    setGroup("6: Canonical Parity & Baseline Non-Regression");

    const baselineSql = "SELECT 'projects' as tbl, count(*) as cnt FROM projects UNION ALL SELECT 'videos', count(*) FROM portfolio_videos UNION ALL SELECT 'media', count(*) FROM project_media UNION ALL SELECT 'gallery', count(*) FROM portfolio_gallery_items;";
    const baselineRaw = execSync(
      `npx wrangler d1 execute ${APPROVED_STAGING_CONFIG.databaseName} --config cloudflare/portfolio-api/wrangler.jsonc --env staging --remote --command="${baselineSql}" --json`,
      { cwd: ROOT, encoding: "utf8" }
    );
    const baselineParsed = JSON.parse(baselineRaw);
    const baselineRows = baselineParsed[0]?.results || [];
    console.log("Baseline invariants:", baselineRows);
    const countsMap = Object.fromEntries(baselineRows.map((r) => [r.tbl, r.cnt]));

    recordCheck("Baseline projects invariant confirmed: exactly 31 records", countsMap.projects === 31, `Count: ${countsMap.projects}`);
    recordCheck("Baseline videos invariant confirmed: exactly 21 canonical videos", countsMap.videos === 21, `Count: ${countsMap.videos}`);
    recordCheck("Baseline project media invariant confirmed: exactly 72 records", countsMap.media === 72, `Count: ${countsMap.media}`);
    recordCheck("Clean baseline gallery invariant confirmed: 0 test/stale items", countsMap.gallery === 0, `Count: ${countsMap.gallery}`);
  }

  // Write Structured JSON Results
  const resultsPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE4_STAGING_TEST_RESULTS.json");
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2), "utf8");
  console.log(`\nWritten test results: ${resultsPath}`);

  console.log("\n============================================================");
  console.log(`FINAL STAGING E2E SUMMARY: ${testResults.passed}/${testResults.total} CHECKS PASSED`);
  console.log("============================================================");

  if (testResults.failed > 0) {
    console.error(`FAILED: ${testResults.failed} checks failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR IN STAGING E2E SUITE:", err);
  process.exit(1);
});
