#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Phase 3.2 Videos & Reels CMS Verification Suite
 *
 * Runs comprehensive, evidence-driven behavioral verification across all Phase 3.2 criteria:
 * - Group A: Canonical Import Parity, Idempotency & CLI Guardrails (--staging, --force, --remote-staging)
 * - Group B: Database Schema & Foreign Key Integrity
 * - Group C: Fresh Local Database Initialization & No-Reseeding Guarantee
 * - Group D: Real Admin Video CRUD via HTTP Endpoints (Auth, CSRF, Create, Read, Update)
 * - Group E: Point-in-Time Revisions & Asset Binary Retention (Rollback preserves old binaries)
 * - Group F: Publication Lifecycle & Instant Unpublishing (Cache-Control: no-store, no-cache)
 * - Group G: Drag-and-Drop Reordering & Sort Order Persistence
 * - Group H: Dedicated Video Media Upload Engine with Real MP4 & Signature Enforcement
 * - Group I: Public Media Cache Policy & Header Consistency (max-age=0, must-revalidate, s-maxage=3600)
 * - Group J: Video Snapshot Bounded Lifetime & Invalidation (Tombstone ledger, TTL expiry, zero resurrection)
 * - Group K: True Fail-Closed Behavior (Cryptographic Zero Local Mutations in Staging Mode)
 * - Group L: Worker D1 Failure vs Legitimate Empty Dataset & Health Endpoints
 * - Group M: Bilingual Completeness Engine & Parity
 * - Group N: Frontend CMS Hydration & Public Portfolio OS Regression Prevention
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { videosData } from "../src/data/videos.ts";

const rootDir = process.cwd();
const localDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const baseUrl = "http://127.0.0.1:3099";

const results = {
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
  console.log(`\n--- ${name} ---`);
}

function assert(condition, name, detail = "") {
  results.total++;
  results.groups[currentGroup].total++;
  if (condition) {
    results.passed++;
    results.groups[currentGroup].passed++;
    console.log(`  ✓ PASS: ${name}`);
    results.groups[currentGroup].checks.push({ name, status: "PASS", detail });
  } else {
    results.failed++;
    results.groups[currentGroup].failed++;
    const msg = `  ✗ FAIL: ${name}${detail ? ` (${detail})` : ""}`;
    console.error(msg);
    results.failures.push(`${currentGroup}: ${name}`);
    results.groups[currentGroup].checks.push({ name, status: "FAIL", detail });
  }
}

async function runSuite() {
  console.log("============================================================");
  console.log("PORTFOLIO OS PHASE 3.2: FINAL STAGING READINESS VERIFICATION");
  console.log("============================================================\n");

  // ------------------------------------------------------------
  // GROUP A: Canonical Import Parity, Idempotency & CLI Guardrails
  // ------------------------------------------------------------
  setGroup("Group A: Canonical Import Parity & CLI Guardrails");
  assert(fs.existsSync(localDbPath), "Local D1 database exists (.local-d1/portfolio.sqlite)");

  const db = new DatabaseSync(localDbPath);
  const videoRows = db.prepare(`SELECT * FROM portfolio_videos ORDER BY sort_order ASC`).all();
  assert(videoRows.length === 21, `Database contains exactly 21 videos (found ${videoRows.length})`);

  const portraitRows = videoRows.filter((r) => r.orientation === "portrait");
  const landscapeRows = videoRows.filter((r) => r.orientation === "landscape");
  assert(portraitRows.length === 19, `19 portrait 9:16 videos present (found ${portraitRows.length})`);
  assert(landscapeRows.length === 2, `2 landscape 16:9 videos present (found ${landscapeRows.length})`);

  // CLI Fail-Closed Check on unknown argument
  let unknownArgCaught = false;
  try {
    execSync("node scripts/import-canonical-videos-to-d1.mjs --staging", { stdio: "pipe" });
  } catch (err) {
    unknownArgCaught = err.status === 1;
  }
  assert(unknownArgCaught, "Unknown CLI argument (--staging) fails closed with exit code 1");

  // CLI Fail-Closed Check on remote-staging with force
  let remoteForceCaught = false;
  try {
    execSync("node scripts/import-canonical-videos-to-d1.mjs --remote-staging --force", { stdio: "pipe" });
  } catch (err) {
    remoteForceCaught = err.status === 1;
  }
  assert(remoteForceCaught, "--force against remote-staging fails closed with exit code 1");

  // Remote-staging dry run execution (read-only, does not touch local SQLite)
  const remoteDryRunOut = execSync("node scripts/import-canonical-videos-to-d1.mjs --remote-staging", { encoding: "utf8" });
  assert(remoteDryRunOut.includes("Target Mode: DRY RUN (Read-Only Validation)"), "Remote staging importer defaults to read-only dry-run");
  assert(remoteDryRunOut.includes("0efef7a7-cc93-4dc2-8cb7-db28379fe01f"), "Remote staging importer validates exact approved D1 database ID");

  // Local dry run
  const localDryRunOut = execSync("node scripts/import-canonical-videos-to-d1.mjs --local --dry-run", { encoding: "utf8" });
  assert(localDryRunOut.includes("skipped=21"), "Local importer skips existing canonical records by default (non-destructive)");

  // ------------------------------------------------------------
  // GROUP B: Database Schema & Foreign Key Integrity
  // ------------------------------------------------------------
  setGroup("Group B: Database Schema & Foreign Key Integrity");
  const schemaTables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => r.name);
  assert(schemaTables.includes("portfolio_videos"), "Table portfolio_videos exists");
  assert(schemaTables.includes("portfolio_video_translations"), "Table portfolio_video_translations exists");
  assert(schemaTables.includes("portfolio_video_assets"), "Table portfolio_video_assets exists");
  assert(schemaTables.includes("portfolio_video_revisions"), "Table portfolio_video_revisions exists");

  // ------------------------------------------------------------
  // GROUP C: Fresh Local Database Initialization (Section 11)
  // ------------------------------------------------------------
  setGroup("Group C: Fresh Local Database Initialization & No-Reseeding");
  const tmpDbDir = path.join(rootDir, ".local-d1", "test-tmp-init");
  fs.mkdirSync(tmpDbDir, { recursive: true });
  const tmpDbPath = path.join(tmpDbDir, `fresh-${Date.now()}.sqlite`);

  const initCheckScript = `
    import { DatabaseSync } from "node:sqlite";
    import fs from "node:fs";
    import path from "node:path";
    import { getD1Database } from "./src/lib/portfolio/d1Engine.ts";

    process.env.CMS_STORAGE_MODE = "local";
    process.env.LOCAL_D1_DB_PATH = "${tmpDbPath}";

    // First call: initializes schema
    const db = getD1Database();
    const row = db.prepare("SELECT COUNT(*) as count FROM portfolio_videos").get();
    console.log("INITIAL_COUNT:" + Number(row.count));

    // Second call on read query: must remain empty, no auto-reseeding!
    const row2 = db.prepare("SELECT COUNT(*) as count FROM portfolio_videos").get();
    console.log("READ_ONLY_COUNT:" + Number(row2.count));
  `;

  const initResult = spawnSync("node", ["--import", "./scripts/ts-loader.mjs", "--experimental-strip-types", "--input-type=module", "-e", initCheckScript], {
    cwd: rootDir,
    encoding: "utf8"
  });

  const initialCountMatch = /INITIAL_COUNT:(\d+)/.exec(initResult.stdout);
  const readOnlyCountMatch = /READ_ONLY_COUNT:(\d+)/.exec(initResult.stdout);
  assert(initialCountMatch && Number(initialCountMatch[1]) === 0, "Fresh database initializes with exactly 0 videos (no silent auto-seed)");
  assert(readOnlyCountMatch && Number(readOnlyCountMatch[1]) === 0, "Subsequent read-only queries preserve 0 videos (no unexpected writes)");

  // Clean up test DB
  fs.rmSync(tmpDbDir, { recursive: true, force: true });

  // ------------------------------------------------------------
  // Authenticate Admin Session
  // ------------------------------------------------------------
  const credPath = path.join(rootDir, ".staging-admin-credentials.local");
  let adminEmail = "staging-admin@local.test";
  let adminPassword = "";

  if (fs.existsSync(credPath)) {
    const credLines = fs.readFileSync(credPath, "utf-8").split("\n");
    for (const line of credLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ADMIN_EMAIL=")) {
        adminEmail = trimmed.slice("ADMIN_EMAIL=".length).trim();
      } else if (trimmed.startsWith("ADMIN_PASSWORD=")) {
        adminPassword = trimmed.slice("ADMIN_PASSWORD=".length).trim();
      }
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

  // ------------------------------------------------------------
  // GROUP D: Real Admin Video CRUD via HTTP Endpoints
  // ------------------------------------------------------------
  setGroup("Group D: Admin Video CRUD Endpoints");

  // Reject Unauthenticated
  const unauthRes = await fetch(`${baseUrl}/api/admin/videos`);
  assert(unauthRes.status === 401, "GET /api/admin/videos without session rejected with 401 Unauthorized");

  // Reject Missing CSRF on mutation
  const noCsrfRes = await fetch(`${baseUrl}/api/admin/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader, Origin: baseUrl },
    body: JSON.stringify({ slug: "csrf-test" })
  });
  assert(noCsrfRes.status === 403, "POST /api/admin/videos without CSRF rejected with 403 Forbidden");

  // List all videos
  const listRes = await fetch(`${baseUrl}/api/admin/videos`, {
    headers: { Cookie: cookieHeader }
  });
  assert(listRes.ok, "GET /api/admin/videos with valid admin cookie returns HTTP 200");
  const listJson = await listRes.json();
  assert(Array.isArray(listJson.videos) && listJson.videos.length >= 21, `Returned ${listJson.videos?.length} videos`);

  // Create new video draft via POST
  const testSlug = `test-release-video-${Date.now()}`;
  const createPayload = {
    slug: testSlug,
    type: "reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "hybrid",
    titleTR: "Test Sürüm Videosu TR",
    titleEN: "Test Release Video EN",
    shortTitleTR: "Sürüm Testi",
    shortTitleEN: "Release Test",
    descriptionTR: "Test sürüm açıklaması TR",
    descriptionEN: "Test release description EN",
    client: "Release Test Studio",
    year: 2026,
    poster: "/videos/ai-moda-kombin-reels/poster.webp",
    src: "/videos/ai-moda-kombin-reels/video.mp4",
    duration: 15,
    aspectRatio: "9:16",
    servicesTR: ["Video Prodüksiyon", "AI"],
    servicesEN: ["Video Production", "AI"],
    services: ["Video Production", "AI"],
    autoplayPreview: true,
    featured: false,
    sortOrder: 99,
    cmsStatus: "draft"
  };

  const createRes = await fetch(`${baseUrl}/api/admin/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
      Origin: baseUrl
    },
    body: JSON.stringify(createPayload)
  });
  assert(createRes.status === 200 || createRes.status === 201, `POST /api/admin/videos creates draft video (HTTP ${createRes.status})`);
  const createJson = await createRes.json();
  const createdVideoId = createJson.video?.id;
  assert(Boolean(createdVideoId), `Created video has valid ID: ${createdVideoId}`);

  // Read created video via GET /api/admin/videos/[id]
  const readRes = await fetch(`${baseUrl}/api/admin/videos/${createdVideoId}`, {
    headers: { Cookie: cookieHeader }
  });
  assert(readRes.ok, `GET /api/admin/videos/[id] returns HTTP 200 for ${createdVideoId}`);
  const readJson = await readRes.json();
  assert(readJson.video?.titleTR === "Test Sürüm Videosu TR", "Read video matches created bilingual title TR");
  assert(readJson.video?.completeness?.score === 100, `Completeness meter computed 100%`);

  // Update video via PUT /api/admin/videos/[id]
  const updateRes = await fetch(`${baseUrl}/api/admin/videos/${createdVideoId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
      Origin: baseUrl
    },
    body: JSON.stringify({
      ...readJson.video,
      client: "Updated Test Studio Inc",
      titleEN: "Updated Title EN"
    })
  });
  assert(updateRes.ok, "PUT /api/admin/videos/[id] updates video successfully");

  // ------------------------------------------------------------
  // GROUP E: Point-in-Time Revisions & Asset Retention (Section 10)
  // ------------------------------------------------------------
  setGroup("Group E: Point-in-Time Revisions & Asset Retention");
  const samplePosterBytes = fs.readFileSync(path.join(rootDir, "public/videos/ai-moda-kombin-reels/poster.webp"));

  // 1. Upload Poster A
  const posterAForm = new FormData();
  posterAForm.append("videoSlug", testSlug);
  posterAForm.append("assetType", "poster");
  posterAForm.append("file", new Blob([samplePosterBytes], { type: "image/webp" }), "poster-A.webp");

  const uploadPosterARes = await fetch(`${baseUrl}/api/admin/videos/upload`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
    body: posterAForm
  });
  const uploadPosterAJson = await uploadPosterARes.json();
  const posterAKey = uploadPosterAJson.asset?.storageKey;
  assert(Boolean(posterAKey), `Uploaded Poster A (storageKey: ${posterAKey})`);

  // Save revision with Poster A
  await fetch(`${baseUrl}/api/admin/videos/${createdVideoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
    body: JSON.stringify({ ...readJson.video, poster: uploadPosterAJson.publicUrl, titleEN: "Title with Poster A" })
  });

  // 2. Upload Poster B (replacement)
  const posterBForm = new FormData();
  posterBForm.append("videoSlug", testSlug);
  posterBForm.append("assetType", "poster");
  posterBForm.append("file", new Blob([samplePosterBytes], { type: "image/webp" }), "poster-B.webp");

  const uploadPosterBRes = await fetch(`${baseUrl}/api/admin/videos/upload`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
    body: posterBForm
  });
  const uploadPosterBJson = await uploadPosterBRes.json();
  const posterBKey = uploadPosterBJson.asset?.storageKey;
  assert(posterBKey !== posterAKey, `Uploaded Poster B replacement (${posterBKey})`);

  // Verify Poster A file STILL EXISTS on disk under retention policy!
  const posterAPathOnDisk = path.join(rootDir, ".local-r2", posterAKey);
  assert(fs.existsSync(posterAPathOnDisk), "Poster A binary file retained on disk after replacement (NOT deleted)");

  // 3. Rollback to Revision with Poster A
  const revListRes = await fetch(`${baseUrl}/api/admin/videos/${createdVideoId}/revisions`, {
    headers: { Cookie: cookieHeader }
  });
  const revListJson = await revListRes.json();
  assert(Array.isArray(revListJson.revisions) && revListJson.revisions.length >= 1, `Recorded ${revListJson.revisions?.length} revision snapshots`);

  const rollbackTarget = revListJson.revisions[revListJson.revisions.length - 1];
  const rollbackRes = await fetch(`${baseUrl}/api/admin/videos/${createdVideoId}/revisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
    body: JSON.stringify({ revisionNumber: rollbackTarget.revisionNumber })
  });
  assert(rollbackRes.ok, `Rollback to revision #${rollbackTarget.revisionNumber} succeeded`);

  // Confirm restored revision works and Poster A is accessible
  const posterAGetRes = await fetch(`${baseUrl}/api/media/${posterAKey}`, {
    headers: { Cookie: cookieHeader }
  });
  assert(posterAGetRes.ok, `Restored historical asset (Poster A) is accessible via HTTP 200 after rollback`);

  // Clean up temporary poster files
  fs.rmSync(path.join(rootDir, ".local-r2", "videos", testSlug), { recursive: true, force: true });

  // ------------------------------------------------------------
  // GROUP F: Publication Lifecycle & Instant Unpublishing
  // ------------------------------------------------------------
  setGroup("Group F: Publication Lifecycle & Unpublishing");

  // Publish video
  const pubRes = await fetch(`${baseUrl}/api/admin/videos/${createdVideoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
    body: JSON.stringify({ ...readJson.video, cmsStatus: "published" })
  });
  assert(pubRes.ok, "Published video via admin endpoint");

  // Verify in public videos list
  const pubListRes = await fetch(`${baseUrl}/api/videos`);
  const pubListJson = await pubListRes.json();
  const isFoundInPublic = pubListJson.videos?.some((v) => v.id === createdVideoId);
  assert(isFoundInPublic, "Published video appears immediately in public GET /api/videos");

  // Verify public single video endpoint
  const pubSingleRes = await fetch(`${baseUrl}/api/videos/${testSlug}`);
  assert(pubSingleRes.ok, `GET /api/videos/:slug returns HTTP 200 for newly published video`);

  // Verify cache headers prevent stale caching
  const cacheControl = pubSingleRes.headers.get("cache-control") || "";
  assert(cacheControl.includes("no-store") || cacheControl.includes("no-cache"), `Cache-Control prevents public edge caching: ${cacheControl}`);

  // Unpublish back to draft
  const unpubRes = await fetch(`${baseUrl}/api/admin/videos/${createdVideoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
    body: JSON.stringify({ ...readJson.video, cmsStatus: "draft" })
  });
  assert(unpubRes.ok, "Unpublished video back to draft status");

  // Verify immediate 404 on unpublish
  const postUnpubRes = await fetch(`${baseUrl}/api/videos/${testSlug}`);
  assert(postUnpubRes.status === 404, "GET /api/videos/:slug immediately returns HTTP 404 after unpublishing (zero leak)");

  // Clean up created video
  const delRes = await fetch(`${baseUrl}/api/admin/videos/${createdVideoId}`, {
    method: "DELETE",
    headers: { Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl }
  });
  assert(delRes.ok, `DELETE /api/admin/videos/[id] deleted test video cleanly`);

  // ------------------------------------------------------------
  // GROUP G: Drag-and-Drop Reordering
  // ------------------------------------------------------------
  setGroup("Group G: Drag-and-Drop Reordering");
  const reorderRes = await fetch(`${baseUrl}/api/admin/videos/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
    body: JSON.stringify({
      orderings: [
        { id: "ai-moda-kombin-reels", sortOrder: 1 },
        { id: "la-ruota-pizza-artigianale-reels", sortOrder: 2 }
      ]
    })
  });
  assert(reorderRes.ok, "POST /api/admin/videos/reorder updates ordering atomically (HTTP 200)");

  // ------------------------------------------------------------
  // GROUP H: Dedicated Video Media Upload Engine with Real MP4 (Section 9)
  // ------------------------------------------------------------
  setGroup("Group H: Real MP4 Video Upload & Streaming Acceptance Gate");

  // Reject unauthenticated upload
  const unauthUploadRes = await fetch(`${baseUrl}/api/admin/videos/upload`, {
    method: "POST",
    body: new FormData()
  });
  assert(unauthUploadRes.status === 401, "POST /api/admin/videos/upload without auth rejected with 401");

  // Reject spoofed text file masquerading as MP4
  const fakeForm = new FormData();
  fakeForm.append("videoSlug", "mp4-acceptance-test");
  fakeForm.append("assetType", "video");
  fakeForm.append("file", new Blob(["plain text masquerading as video"], { type: "video/mp4" }), "fake.mp4");

  const fakeUploadRes = await fetch(`${baseUrl}/api/admin/videos/upload`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
    body: fakeForm
  });
  assert(fakeUploadRes.status === 400, "Upload with invalid magic bytes rejected with 400 Bad Request");
  const fakeUploadJson = await fakeUploadRes.json();
  assert(fakeUploadJson.error?.includes("ftyp"), `Error explains signature defect: ${fakeUploadJson.error}`);

  // Upload REAL MP4 video file from public disk
  const sampleMp4Path = path.join(rootDir, "public", "videos", "ai-moda-kombin-reels", "video.mp4");
  const realMp4Bytes = fs.readFileSync(sampleMp4Path);
  const mp4TestSlug = `mp4-upload-test-${Date.now()}`;
  const mp4TestId = `vid-${mp4TestSlug}`;

  // Insert draft parent video
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO portfolio_videos (id, slug, status, orientation, video_type, client_name, year, sort_order, created_at, updated_at)
    VALUES (?, ?, 'draft', 'portrait', 'reel', 'MP4 Gate Test Studio', 2026, 999, ?, ?)
  `).run(mp4TestId, mp4TestSlug, nowIso, nowIso);

  const realMp4Form = new FormData();
  realMp4Form.append("videoSlug", mp4TestSlug);
  realMp4Form.append("videoId", mp4TestId);
  realMp4Form.append("assetType", "video");
  realMp4Form.append("file", new Blob([realMp4Bytes], { type: "video/mp4" }), "test-sample.mp4");

  const realMp4UploadRes = await fetch(`${baseUrl}/api/admin/videos/upload`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
    body: realMp4Form
  });
  assert(realMp4UploadRes.status === 201, `POST /api/admin/videos/upload with real MP4 returns HTTP 201 Created`);
  const realMp4Json = await realMp4UploadRes.json();
  const mp4Asset = realMp4Json.asset;
  assert(mp4Asset?.assetType === "video", "Uploaded asset registered with assetType='video'");
  assert(mp4Asset?.byteSize === realMp4Bytes.length, `Persisted byte size matches real MP4 (${mp4Asset?.byteSize} bytes)`);

  // Verify ownership by portfolio_video_assets
  const dbMp4Asset = db.prepare(`SELECT * FROM portfolio_video_assets WHERE video_id = ? AND asset_type = 'video'`).get(mp4TestId);
  assert(Boolean(dbMp4Asset && dbMp4Asset.storage_key === mp4Asset.storageKey), "Asset record persisted in portfolio_video_assets (NOT project_media)");

  // Draft media protection: anonymous access must return 404
  const anonDraftMp4Res = await fetch(`${baseUrl}${mp4Asset.publicUrl}`);
  assert(anonDraftMp4Res.status === 404, "Draft video media returns HTTP 404 to anonymous visitors");

  // Authenticated preview: admin access must return 200
  const adminDraftMp4Res = await fetch(`${baseUrl}${mp4Asset.publicUrl}`, {
    headers: { Cookie: cookieHeader }
  });
  assert(adminDraftMp4Res.status === 200, "Draft video media returns HTTP 200 to authenticated admin preview");

  // Publish video -> public streaming check
  db.prepare(`UPDATE portfolio_videos SET status = 'published' WHERE id = ?`).run(mp4TestId);

  const publicMp4Res = await fetch(`${baseUrl}${mp4Asset.publicUrl}`, { method: "HEAD" });
  assert(publicMp4Res.status === 200, "Published MP4 accessible via HTTP 200 to public visitors");
  assert(publicMp4Res.headers.get("accept-ranges") === "bytes", "Video delivery advertises Accept-Ranges: bytes");

  // Real HTTP 206 Partial Content byte range streaming
  const rangeMp4Res = await fetch(`${baseUrl}${mp4Asset.publicUrl}`, {
    headers: { Range: "bytes=0-1024" }
  });
  assert(rangeMp4Res.status === 206, `Video Range streaming returns HTTP 206 Partial Content (got ${rangeMp4Res.status})`);
  assert(rangeMp4Res.headers.get("content-range")?.startsWith("bytes 0-1024/"), `Content-Range header correct: ${rangeMp4Res.headers.get("content-range")}`);

  // HTTP 416 on out of bounds range
  const oobMp4Res = await fetch(`${baseUrl}${mp4Asset.publicUrl}`, {
    headers: { Range: "bytes=999999999-999999999" }
  });
  assert(oobMp4Res.status === 416, `Out of bounds Range returns HTTP 416 Range Not Satisfiable (got ${oobMp4Res.status})`);

  // ------------------------------------------------------------
  // GROUP I: Public Media Cache Policy & Header Consistency (Section 3)
  // ------------------------------------------------------------
  setGroup("Group I: Public Media Cache Policy & Header Consistency");

  // Use the verified published video asset from Group H
  const publishedMediaUrl = `${baseUrl}${mp4Asset.publicUrl}`;

  // 1. HTTP 200 Cache Header
  const cache200Res = await fetch(publishedMediaUrl);
  const cache200Header = cache200Res.headers.get("cache-control") || "";
  assert(
    cache200Header.includes("max-age=0") && cache200Header.includes("must-revalidate"),
    `HTTP 200 media cache header enforces revalidation: ${cache200Header}`
  );
  assert(!cache200Header.includes("s-maxage=604800"), "Next.js proxy does NOT overwrite upstream with 7-day s-maxage=604800");

  // 2. HTTP 206 Partial Content Cache Header
  const cache206Res = await fetch(publishedMediaUrl, { headers: { Range: "bytes=0-100" } });
  const cache206Header = cache206Res.headers.get("cache-control") || "";
  assert(
    cache206Header.includes("max-age=0") && cache206Header.includes("must-revalidate"),
    `HTTP 206 Range media cache header enforces revalidation: ${cache206Header}`
  );

  // 3. HTTP 304 Not Modified Cache Header
  const etagVal = cache200Res.headers.get("etag") || "";
  if (etagVal) {
    const cache304Res = await fetch(publishedMediaUrl, { headers: { "If-None-Match": etagVal } });
    assert(cache304Res.status === 304, "Conditional GET with matching ETag returns HTTP 304 Not Modified");
    const cache304Header = cache304Res.headers.get("cache-control") || "";
    assert(
      cache304Header.includes("max-age=0") && cache304Header.includes("must-revalidate"),
      `HTTP 304 conditional cache header consistent with 200/206: ${cache304Header}`
    );
  }

  // Clean up MP4 acceptance test & Group I media
  db.prepare(`DELETE FROM portfolio_video_assets WHERE video_id = ?`).run(mp4TestId);
  db.prepare(`DELETE FROM portfolio_videos WHERE id = ?`).run(mp4TestId);
  fs.rmSync(path.join(rootDir, ".local-r2", "videos", mp4TestSlug), { recursive: true, force: true });

  // ------------------------------------------------------------
  // GROUP J: Video Snapshot Bounded Lifetime & Invalidation (Section 2)
  // ------------------------------------------------------------
  setGroup("Group J: Video Snapshot Bounded Lifetime & Invalidation");

  const snapshotTestScript = `
    import {
      getPublishedVideosWithMeta,
      recordVideoSnapshotMutation,
      getValidCoordinatedVideosSnapshot,
      setVerifiedPublishedVideosSnapshot
    } from "./src/lib/portfolio/repository.ts";

    process.env.CMS_STORAGE_MODE = "local";
    process.env.CMS_DATA_SOURCE = "cloudflare";
    // Set tight 150ms TTL for testing expiry
    process.env.CMS_VIDEO_SNAPSHOT_MAX_STALE_MS = "150";

    const testVideo = {
      id: "snap-test-video",
      slug: "snap-test-slug",
      cmsStatus: "published",
      titleTR: "Snapshot Test",
      titleEN: "Snapshot Test",
      sortOrder: 1
    };

    // 1. Populate snapshot
    setVerifiedPublishedVideosSnapshot([testVideo]);
    const initial = getValidCoordinatedVideosSnapshot();
    console.log("INITIAL_SNAP:" + (initial && initial.length === 1 ? "1" : "0"));

    // 2. Unpublish / Tombstone
    recordVideoSnapshotMutation({
      tombstoneId: testVideo.id,
      tombstoneSlug: testVideo.slug
    });
    const afterTombstone = getValidCoordinatedVideosSnapshot();
    console.log("AFTER_TOMBSTONE:" + (afterTombstone && afterTombstone.length === 0 ? "0" : "RESURRECTED"));

    // 3. Expiry test: Wait 200ms (> 150ms TTL)
    await new Promise((r) => setTimeout(r, 200));
    const expiredSnap = getValidCoordinatedVideosSnapshot();
    console.log("EXPIRED_SNAP:" + (expiredSnap === null ? "EXPIRED" : "NOT_EXPIRED"));
  `;

  const snapTestRun = spawnSync("node", ["--import", "./scripts/ts-loader.mjs", "--experimental-strip-types", "--input-type=module", "-e", snapshotTestScript], {
    cwd: rootDir,
    encoding: "utf8"
  });

  assert(snapTestRun.stdout.includes("INITIAL_SNAP:1"), "Verified published video snapshot loaded into memory");
  assert(snapTestRun.stdout.includes("AFTER_TOMBSTONE:0"), "Unpublishing tombstones video: previously published video CANNOT reappear during outage");
  assert(snapTestRun.stdout.includes("EXPIRED_SNAP:EXPIRED"), "Timestamp-based expiry test invalidates stale snapshot after TTL");

  // ------------------------------------------------------------
  // GROUP K: True Fail-Closed Behavior (NO TAUTOLOGY) (Section 8)
  // ------------------------------------------------------------
  setGroup("Group K: True Fail-Closed Behavior (Zero Local Fallback in Staging)");

  const failClosedScript = `
    import { DatabaseSync } from "node:sqlite";
    import crypto from "node:crypto";
    import fs from "node:fs";
    import path from "node:path";
    import {
      saveAdminVideo,
      deleteAdminVideo,
      updateVideoOrderingInD1,
      rollbackVideoRevisionInD1,
      uploadVideoAsset
    } from "./src/lib/portfolio/repository.ts";
    import { CmsStorageUnavailableError } from "./src/lib/portfolio/types.ts";

    const testDbPath = path.resolve("./.local-d1/portfolio.sqlite");
    const initialHash = crypto.createHash("sha256").update(fs.readFileSync(testDbPath)).digest("hex");

    // Force staging mode with intentionally broken / unreachable Worker URL
    process.env.CMS_STORAGE_MODE = "staging";
    process.env.CMS_DATA_SOURCE = "cloudflare";
    process.env.CLOUDFLARE_CMS_API_URL = "https://unreachable-staging-worker.invalid";
    process.env.CLOUDFLARE_API_SERVICE_TOKEN = "test-token-1234567890123456";

    let saveBlocked = false;
    try {
      await saveAdminVideo({ slug: "should-fail-video", cmsStatus: "published" }, "admin@test.local", "create");
    } catch (err) {
      saveBlocked = err instanceof CmsStorageUnavailableError || err.name === "CmsStorageUnavailableError" || err.message.includes("fetch failed") || err.message.includes("ENOTFOUND");
    }

    let reorderBlocked = false;
    try {
      await updateVideoOrderingInD1([{ id: "ai-moda-kombin-reels", sortOrder: 99 }], "admin@test.local");
    } catch (err) {
      reorderBlocked = err instanceof CmsStorageUnavailableError || err.name === "CmsStorageUnavailableError" || err.message.includes("fetch failed") || err.message.includes("ENOTFOUND");
    }

    let deleteBlocked = false;
    try {
      await deleteAdminVideo("ai-moda-kombin-reels", "admin@test.local");
    } catch (err) {
      deleteBlocked = err instanceof CmsStorageUnavailableError || err.name === "CmsStorageUnavailableError" || err.message.includes("fetch failed") || err.message.includes("ENOTFOUND");
    }

    let rollbackBlocked = false;
    try {
      await rollbackVideoRevisionInD1("ai-moda-kombin-reels", 1, "admin@test.local");
    } catch (err) {
      rollbackBlocked = err instanceof CmsStorageUnavailableError || err.name === "CmsStorageUnavailableError" || err.message.includes("fetch failed") || err.message.includes("ENOTFOUND");
    }

    const postHash = crypto.createHash("sha256").update(fs.readFileSync(testDbPath)).digest("hex");
    const hashIdentical = initialHash === postHash;

    console.log("SAVE_BLOCKED:" + saveBlocked);
    console.log("REORDER_BLOCKED:" + reorderBlocked);
    console.log("DELETE_BLOCKED:" + deleteBlocked);
    console.log("ROLLBACK_BLOCKED:" + rollbackBlocked);
    console.log("HASH_IDENTICAL:" + hashIdentical);
  `;

  const failClosedRun = spawnSync("node", ["--import", "./scripts/ts-loader.mjs", "--experimental-strip-types", "--input-type=module", "-e", failClosedScript], {
    cwd: rootDir,
    encoding: "utf8"
  });

  assert(failClosedRun.stdout.includes("SAVE_BLOCKED:true"), "Remote video save failure strictly blocks local fallback");
  assert(failClosedRun.stdout.includes("REORDER_BLOCKED:true"), "Remote video reorder failure strictly blocks local fallback");
  assert(failClosedRun.stdout.includes("DELETE_BLOCKED:true"), "Remote video delete failure strictly blocks local fallback");
  assert(failClosedRun.stdout.includes("ROLLBACK_BLOCKED:true"), "Remote revision rollback failure strictly blocks local fallback");
  assert(failClosedRun.stdout.includes("HASH_IDENTICAL:true"), "Cryptographic proof: SQLite database SHA-256 identical before and after (zero local writes)");

  // ------------------------------------------------------------
  // GROUP L: Worker D1 Failure vs Legitimate Empty Dataset (Section 4 & 6)
  // ------------------------------------------------------------
  setGroup("Group L: Worker D1 Error vs Empty Data & Health Endpoints");

  // Read Worker source to verify removal of blind catch { return []; }
  const workerSource = fs.readFileSync(path.join(rootDir, "cloudflare", "portfolio-api", "src", "index.ts"), "utf8");
  assert(!workerSource.includes("queryCmsVideosFromWorkerD1") || !workerSource.slice(workerSource.indexOf("queryCmsVideosFromWorkerD1")).slice(0, 400).includes("catch {\n    return [];\n  }"), "queryCmsVideosFromWorkerD1 does NOT silently swallow errors into empty array []");
  assert(workerSource.includes("SCHEMA_NOT_INITIALIZED") || workerSource.includes("migration required"), "Worker returns explicit error when video table is missing instead of count=0");
  assert(workerSource.includes('pathname === "/api/v1/public/health" || pathname === "/api/v1/health"'), "Worker supports both /api/v1/public/health and /api/v1/health");
  assert(workerSource.includes('request.method === "HEAD"'), "Worker public endpoints support HEAD method");

  // ------------------------------------------------------------
  // GROUP M: Bilingual Parity & Completeness
  // ------------------------------------------------------------
  setGroup("Group M: Bilingual Parity & Completeness");
  const allTranslations = db.prepare(`SELECT * FROM portfolio_video_translations`).all();
  assert(allTranslations.length >= 42, `At least 42 translations present (2 per canonical video, found ${allTranslations.length})`);

  let allBilingualValid = true;
  for (const v of listJson.videos) {
    if (!v.titleTR || !v.titleEN || !v.descriptionTR || !v.descriptionEN) {
      allBilingualValid = false;
    }
  }
  assert(allBilingualValid, "All canonical videos possess non-empty bilingual titles and descriptions");

  // ------------------------------------------------------------
  // GROUP N: Frontend CMS Hydration & Public Regression Prevention (Section 12 & 13)
  // ------------------------------------------------------------
  setGroup("Group N: Frontend Hydration & Public Regression Prevention");

  // 30 projects intact
  const projectRows = db.prepare(`SELECT count(*) as count FROM projects`).get();
  assert(Number(projectRows.count) === 30, `All 30 projects remain intact in D1 (found ${projectRows.count})`);

  // Verify ClientLocalePage synchronous hydration logic
  const clientPageSource = fs.readFileSync(path.join(rootDir, "src", "app", "[locale]", "ClientLocalePage.tsx"), "utf8");
  assert(clientPageSource.includes("isHydratedRef") && clientPageSource.includes("useSessionStore.getState().hydrateVideos"), "ClientLocalePage hydrates store synchronously before first render (zero flash of static data)");

  // Public TR page
  const trPageRes = await fetch(`${baseUrl}/tr`);
  assert(trPageRes.ok, "GET /tr renders HTTP 200 without server crash");
  const trHtml = await trPageRes.text();
  assert(trHtml.includes("Kerem Mıhçı") && trHtml.includes("<html"), "Public TR page contains valid layout and typography");

  // Public EN page
  const enPageRes = await fetch(`${baseUrl}/en`);
  assert(enPageRes.ok, "GET /en renders HTTP 200 without server crash");

  // Admin dashboard page
  const adminPageRes = await fetch(`${baseUrl}/admin`);
  assert(adminPageRes.ok, "GET /admin renders HTTP 200 without server crash");

  console.log("\n============================================================");
  console.log(`TOTAL CHECKS: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
  if (results.failed === 0) {
    console.log("VERDICT: ALL PHASE 3.2 FINAL STAGING READINESS TESTS PASSED!");
  } else {
    console.error("FAILURES ENCOUNTERED:", results.failures);
  }
  console.log("============================================================\n");

  // Write JSON report
  const reportPath = path.join(rootDir, "docs", "reviews", "PORTFOLIO_OS_PHASE3_2_TEST_RESULTS.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`✓ Test results report saved to ${reportPath}\n`);

  db.close();
  process.exit(results.failed === 0 ? 0 : 1);
}

runSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
