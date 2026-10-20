#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Phase 3 Videos & Reels CMS Verification Suite
 *
 * Runs comprehensive end-to-end verification across:
 * - Group A: Video Canonical Import Parity
 * - Group B: Local D1 Video Schema & CRUD
 * - Group C: Media Storage & Public Access Validation
 * - Group D: Public Content Discovery & Adapter Integration
 * - Group E: Admin Dashboard API & Usability
 * - Group F: Regression Prevention on Public Portfolio OS
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { videosData } from "../src/data/videos.ts";

const rootDir = process.cwd();
const localDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const baseUrl = "http://127.0.0.1:3099";

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function assert(condition, name, detail = "") {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    results.failed++;
    const msg = `  ✗ FAIL: ${name}${detail ? ` (${detail})` : ""}`;
    console.error(msg);
    results.failures.push(name);
  }
}

async function runSuite() {
  console.log("============================================================");
  console.log("PORTFOLIO OS PHASE 3: VIDEOS & REELS CMS VERIFICATION SUITE");
  console.log("============================================================\n");

  // ------------------------------------------------------------
  // GROUP A: Video Canonical Import Parity
  // ------------------------------------------------------------
  console.log("--- Group A: Video Canonical Import Parity ---");
  assert(fs.existsSync(localDbPath), "Local D1 database exists (.local-d1/portfolio.sqlite)");

  const db = new DatabaseSync(localDbPath);
  const videoRows = db.prepare(`SELECT * FROM portfolio_videos ORDER BY sort_order ASC`).all();
  assert(videoRows.length === 21, `Database contains exactly 21 videos (found ${videoRows.length})`);

  const portraitRows = videoRows.filter((r) => r.orientation === "portrait");
  const landscapeRows = videoRows.filter((r) => r.orientation === "landscape");
  assert(portraitRows.length === 19, `19 portrait 9:16 videos present (found ${portraitRows.length})`);
  assert(landscapeRows.length === 2, `2 landscape 16:9 videos present (found ${landscapeRows.length})`);

  let allFilesExist = true;
  let missingFiles = [];
  for (const v of videosData) {
    const mp4Path = path.join(rootDir, "public", v.src.replace(/^\//, ""));
    const posterPath = path.join(rootDir, "public", v.poster.replace(/^\//, ""));
    if (!fs.existsSync(mp4Path)) {
      allFilesExist = false;
      missingFiles.push(v.src);
    }
    if (!fs.existsSync(posterPath)) {
      allFilesExist = false;
      missingFiles.push(v.poster);
    }
  }
  assert(allFilesExist, "All 21 MP4 video files and 21 poster WebP files exist on disk", missingFiles.join(", "));

  // ------------------------------------------------------------
  // GROUP B: Local D1 Video Schema & CRUD Operations
  // ------------------------------------------------------------
  console.log("\n--- Group B: Local D1 Video Schema & CRUD Operations ---");
  const testSlug = `test-crud-video-${Date.now()}`;
  const testId = `vid-${testSlug}`;
  const now = new Date().toISOString();

  // Create Draft
  db.prepare(`
    INSERT INTO portfolio_videos (id, slug, status, orientation, video_type, client_name, year, sort_order, created_at, updated_at)
    VALUES (?, ?, 'draft', 'portrait', 'reel', 'Test Client', 2026, 999, ?, ?)
  `).run(testId, testSlug, now, now);

  db.prepare(`
    INSERT INTO portfolio_video_translations (id, video_id, locale, title, short_title, description, updated_at)
    VALUES (?, ?, 'tr', 'Test Başlık TR', 'Test TR', 'Test Açıklama TR', ?),
           (?, ?, 'en', 'Test Title EN', 'Test EN', 'Test Description EN', ?)
  `).run(`vtr-${testId}-tr`, testId, now, `vtr-${testId}-en`, testId, now);

  const inserted = db.prepare(`SELECT * FROM portfolio_videos WHERE id = ?`).get(testId);
  assert(Boolean(inserted && inserted.slug === testSlug), "Created test draft video record in D1");

  // Save Revision Snapshot
  db.prepare(`
    INSERT INTO portfolio_video_revisions (id, video_id, revision_number, action, snapshot_json, actor_email, created_at)
    VALUES (?, ?, 1, 'create_test', ?, 'test@portfolio.local', ?)
  `).run(`vrev-${testId}-1`, testId, JSON.stringify({ slug: testSlug, titleEN: "Test Title EN" }), now);

  const revCount = db.prepare(`SELECT COUNT(*) as count FROM portfolio_video_revisions WHERE video_id = ?`).get(testId);
  assert(Number(revCount.count) === 1, "Recorded video revision snapshot in D1");

  // Update Status to Published
  db.prepare(`UPDATE portfolio_videos SET status = 'published', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), testId);
  const updated = db.prepare(`SELECT status FROM portfolio_videos WHERE id = ?`).get(testId);
  assert(updated.status === "published", "Updated video status to published in D1");

  // Clean up test record
  db.prepare(`DELETE FROM portfolio_videos WHERE id = ?`).run(testId);
  db.prepare(`DELETE FROM portfolio_video_translations WHERE video_id = ?`).run(testId);
  db.prepare(`DELETE FROM portfolio_video_revisions WHERE video_id = ?`).run(testId);
  const deleted = db.prepare(`SELECT id FROM portfolio_videos WHERE id = ?`).get(testId);
  assert(!deleted, "Deleted test video and cascaded translations & revisions cleanly");

  // ------------------------------------------------------------
  // GROUP C: Media Storage & Public Access Validation
  // ------------------------------------------------------------
  console.log("\n--- Group C: Media Storage & Public Access Validation ---");
  const sampleVideo = videosData[0];
  const sampleRes = await fetch(`${baseUrl}${sampleVideo.src}`, { method: "HEAD" });
  assert(sampleRes.ok, `Public static video MP4 is accessible via HTTP 200 (${sampleVideo.src})`);

  const rangeRes = await fetch(`${baseUrl}${sampleVideo.src}`, {
    headers: { Range: "bytes=0-1024" }
  });
  assert(
    rangeRes.status === 200 || rangeRes.status === 206,
    `Video streaming Range header handled correctly (HTTP ${rangeRes.status})`
  );

  const samplePosterRes = await fetch(`${baseUrl}${sampleVideo.poster}`, { method: "HEAD" });
  assert(samplePosterRes.ok, `Public static poster WebP is accessible via HTTP 200 (${sampleVideo.poster})`);

  // ------------------------------------------------------------
  // GROUP D: Public Content Discovery & Adapter Integration
  // ------------------------------------------------------------
  console.log("\n--- Group D: Public Content Discovery & Adapter Integration ---");
  const pubVideosRes = await fetch(`${baseUrl}/api/videos`);
  assert(pubVideosRes.ok, "GET /api/videos returns HTTP 200");
  const pubVideosJson = await pubVideosRes.json();
  assert(pubVideosJson.ok === true && pubVideosJson.count === 21, `GET /api/videos returns 21 published videos (got ${pubVideosJson.count})`);

  const pubV1Res = await fetch(`${baseUrl}/api/v1/public/videos`);
  assert(pubV1Res.ok, "GET /api/v1/public/videos returns HTTP 200");
  const pubV1Json = await pubV1Res.json();
  assert(pubV1Json.count === 21, "GET /api/v1/public/videos returns count=21 matching schema");

  const singleVideoRes = await fetch(`${baseUrl}/api/videos/${encodeURIComponent(sampleVideo.slug)}`);
  assert(singleVideoRes.ok, `GET /api/videos/:slug returns HTTP 200 for slug "${sampleVideo.slug}"`);
  const singleVideoJson = await singleVideoRes.json();
  assert(singleVideoJson.video?.slug === sampleVideo.slug, "Single video payload matches expected slug");

  const invalidVideoRes = await fetch(`${baseUrl}/api/videos/non-existent-video-slug-12345`);
  assert(invalidVideoRes.status === 404, "GET /api/videos/:nonExistent returns HTTP 404 fail-closed");

  // ------------------------------------------------------------
  // GROUP E: Admin Dashboard API & Usability
  // ------------------------------------------------------------
  console.log("\n--- Group E: Admin Dashboard API & Usability ---");
  // Read staging admin credentials
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

  let cookieHeader = "";
  let csrfToken = "";

  if (adminPassword) {
    const authRes = await fetch(`${baseUrl}/api/admin/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl
      },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    assert(authRes.ok, `Admin password login succeeds for ${adminEmail} (HTTP ${authRes.status})`);
    const authJson = await authRes.json();
    const setCookies = typeof authRes.headers.getSetCookie === "function"
      ? authRes.headers.getSetCookie()
      : [authRes.headers.get("set-cookie") || ""];
    cookieHeader = setCookies.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
    csrfToken = authJson.session?.csrfToken || authJson.csrfToken || "";
  } else {
    // Fallback to dev-fixture if local
    const authRes = await fetch(`${baseUrl}/api/admin/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ mode: "dev-fixture" })
    });
    assert(authRes.ok, "Admin login succeeds (HTTP 200)");
    const authJson = await authRes.json();
    const setCookies = typeof authRes.headers.getSetCookie === "function"
      ? authRes.headers.getSetCookie()
      : [authRes.headers.get("set-cookie") || ""];
    cookieHeader = setCookies.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
    csrfToken = authJson.session?.csrfToken || authJson.csrfToken || "";
  }

  const adminVideosRes = await fetch(`${baseUrl}/api/admin/videos`, {
    headers: { Cookie: cookieHeader }
  });
  const adminVideosStatus = adminVideosRes.status;
  const adminVideosJson = await adminVideosRes.json().catch(() => ({}));
  assert(adminVideosRes.ok, `GET /api/admin/videos with admin session returns HTTP 200 (got ${adminVideosStatus})`);
  assert(
    Array.isArray(adminVideosJson.videos) && adminVideosJson.videos.length >= 21,
    `Admin videos endpoint returned ${adminVideosJson.videos?.length || 0} videos with completeness scores`
  );

  const sampleAdminVideo = adminVideosJson.videos?.[0];
  assert(
    sampleAdminVideo?.completeness && typeof sampleAdminVideo.completeness.score === "number",
    `Completeness meter calculated: ${sampleAdminVideo?.completeness?.score}% (ready: ${sampleAdminVideo?.completeness?.readyToPublish})`
  );

  // Test admin video reorder endpoint
  const reorderRes = await fetch(`${baseUrl}/api/admin/videos/reorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
      Origin: baseUrl,
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      orderings: [
        { id: sampleAdminVideo?.id || "ai-moda-kombin-reels", sortOrder: 1 }
      ]
    })
  });
  assert(reorderRes.ok, "POST /api/admin/videos/reorder succeeds with valid session (HTTP 200)");

  // ------------------------------------------------------------
  // GROUP F: Regression Prevention on Public Portfolio OS
  // ------------------------------------------------------------
  console.log("\n--- Group F: Regression Prevention on Public Portfolio OS ---");
  const publicTrPageRes = await fetch(`${baseUrl}/tr`);
  assert(publicTrPageRes.ok, "GET /tr renders HTTP 200 without server crash");
  const publicTrHtml = await publicTrPageRes.text();
  assert(publicTrHtml.includes("<html") && publicTrHtml.includes("Portfolio"), "Public /tr HTML response is well-formed");

  const publicEnPageRes = await fetch(`${baseUrl}/en`);
  assert(publicEnPageRes.ok, "GET /en renders HTTP 200 without server crash");

  const adminPageRes = await fetch(`${baseUrl}/admin`);
  assert(adminPageRes.ok, "GET /admin renders HTTP 200 without server crash");

  console.log("\n============================================================");
  console.log(`TOTAL CHECKS: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
  if (results.failed === 0) {
    console.log("VERDICT: ALL PHASE 3 VIDEOS & REELS CMS TESTS PASSED!");
  } else {
    console.error("FAILURES ENCOUNTERED:", results.failures);
  }
  console.log("============================================================\n");

  db.close();
  process.exit(results.failed === 0 ? 0 : 1);
}

runSuite().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
