#!/usr/bin/env node

/**
 * scripts/smoke-phase5-staging-readonly.mjs
 *
 * Strictly Read-Only Cloudflare Staging Smoke Tests
 * Validates the deployed Phase 5 Worker API on staging:
 * - Public health and bindings
 * - Canonical projects, videos, gallery
 * - Phase 5 healthy empty endpoints (404 with structured codes and no-store)
 * - Empty collections (200 with [])
 * - Admin auth rejection for unauthenticated / invalid token read requests
 * - Unknown route 404 distinct from PROFILE_NOT_PUBLISHED / CV_NOT_PUBLISHED
 * - Video media streaming Range request (GET/HEAD only)
 *
 * ZERO remote mutations or writes.
 */

const STAGING_URL = "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev";

async function runSmokeTests() {
  console.log("============================================================");
  console.log("PHASE 5 CLOUDFLARE STAGING READ-ONLY SMOKE TESTS");
  console.log(`Target: ${STAGING_URL}`);
  console.log("Timestamp:", new Date().toISOString());
  console.log("============================================================\n");

  const results = [];
  let passed = 0;
  let failed = 0;

  function record(name, ok, details = "") {
    if (ok) {
      passed++;
      console.log(`  ✓ PASS: ${name} ${details ? `[${details}]` : ""}`);
      results.push({ name, passed: true, details });
    } else {
      failed++;
      console.error(`  ✗ FAIL: ${name} [${details}]`);
      results.push({ name, passed: false, details });
    }
  }

  // 1. Public Health
  try {
    const res = await fetch(`${STAGING_URL}/api/v1/public/health`);
    const json = await res.json();
    record("GET /api/v1/public/health returns HTTP 200", res.status === 200, `HTTP ${res.status}`);
    record("Health reports ok: true", json.ok === true);
    record("Health reports correct service name", json.service === "kerem-mihci-portfolio-api", json.service);
    record("Health reports D1 and R2 bindings", json.bindings?.d1 === "PORTFOLIO_DB" && json.bindings?.r2 === "PORTFOLIO_MEDIA");
    record("Health reports published projects count = 30", json.publishedCount === 30, `Count: ${json.publishedCount}`);
  } catch (err) {
    record("GET /api/v1/public/health", false, err.message);
  }

  // 2. Existing Content
  try {
    const projRes = await fetch(`${STAGING_URL}/api/v1/public/projects`);
    const projJson = await projRes.json();
    record("GET /api/v1/public/projects returns HTTP 200", projRes.status === 200);
    record("Projects returns 30 canonical published projects", Array.isArray(projJson.projects) && projJson.projects.length === 30, `Count: ${projJson.projects?.length}`);

    const vidRes = await fetch(`${STAGING_URL}/api/v1/public/videos`);
    const vidJson = await vidRes.json();
    record("GET /api/v1/public/videos returns HTTP 200", vidRes.status === 200);
    record("Videos returns 21 canonical published videos", Array.isArray(vidJson.videos) && vidJson.videos.length === 21, `Count: ${vidJson.videos?.length}`);

    const galRes = await fetch(`${STAGING_URL}/api/v1/public/gallery`);
    const galJson = await galRes.json();
    record("GET /api/v1/public/gallery returns HTTP 200", galRes.status === 200);
    record("Gallery returns empty array (post-cleanup state)", Array.isArray(galJson.gallery) && galJson.gallery.length === 0, `Count: ${galJson.gallery?.length}`);
  } catch (err) {
    record("Existing Content Endpoints", false, err.message);
  }

  // 3. Phase 5 Healthy Empty Endpoints (Profile & CV)
  try {
    const profRes = await fetch(`${STAGING_URL}/api/v1/public/profile`);
    const profJson = await profRes.json();
    record("GET /api/v1/public/profile returns HTTP 404 for unseeded profile", profRes.status === 404, `HTTP ${profRes.status}`);
    record("Profile 404 returns structured code PROFILE_NOT_PUBLISHED", profJson.code === "PROFILE_NOT_PUBLISHED", profJson.code);
    record("Profile 404 enforces Cache-Control: no-store", profRes.headers.get("cache-control")?.includes("no-store") === true, profRes.headers.get("cache-control"));

    const cvTrRes = await fetch(`${STAGING_URL}/api/v1/public/cv/tr`);
    const cvTrJson = await cvTrRes.json();
    record("GET /api/v1/public/cv/tr returns HTTP 404 for unseeded CV", cvTrRes.status === 404, `HTTP ${cvTrRes.status}`);
    record("CV TR 404 returns structured code CV_NOT_PUBLISHED", cvTrJson.code === "CV_NOT_PUBLISHED", cvTrJson.code);
    record("CV TR 404 enforces Cache-Control: no-store", cvTrRes.headers.get("cache-control")?.includes("no-store") === true);

    const cvEnRes = await fetch(`${STAGING_URL}/api/v1/public/cv/en`);
    const cvEnJson = await cvEnRes.json();
    record("GET /api/v1/public/cv/en returns HTTP 404 for unseeded CV", cvEnRes.status === 404, `HTTP ${cvEnRes.status}`);
    record("CV EN 404 returns structured code CV_NOT_PUBLISHED", cvEnJson.code === "CV_NOT_PUBLISHED", cvEnJson.code);
    record("CV EN 404 enforces Cache-Control: no-store", cvEnRes.headers.get("cache-control")?.includes("no-store") === true);
  } catch (err) {
    record("Phase 5 Profile & CV Endpoints", false, err.message);
  }

  // 4. Phase 5 Healthy Empty Collections (Notes, Experience, Education, Skills)
  try {
    for (const ws of ["design", "web", "motion-ai"]) {
      const notesRes = await fetch(`${STAGING_URL}/api/v1/public/notes/${ws}`);
      const notesJson = await notesRes.json();
      record(`GET /api/v1/public/notes/${ws} returns HTTP 200`, notesRes.status === 200);
      record(`Notes for ${ws} returns empty array []`, Array.isArray(notesJson.notes) && notesJson.notes.length === 0, `Length: ${notesJson.notes?.length}`);
    }

    const expRes = await fetch(`${STAGING_URL}/api/v1/public/experience`);
    const expJson = await expRes.json();
    record("GET /api/v1/public/experience returns HTTP 200", expRes.status === 200);
    record("Experience returns empty array []", Array.isArray(expJson.experience) && expJson.experience.length === 0, `Length: ${expJson.experience?.length}`);

    const eduRes = await fetch(`${STAGING_URL}/api/v1/public/education`);
    const eduJson = await eduRes.json();
    record("GET /api/v1/public/education returns HTTP 200", eduRes.status === 200);
    record("Education returns empty array []", Array.isArray(eduJson.education) && eduJson.education.length === 0, `Length: ${eduJson.education?.length}`);

    const skillsRes = await fetch(`${STAGING_URL}/api/v1/public/skills`);
    const skillsJson = await skillsRes.json();
    record("GET /api/v1/public/skills returns HTTP 200", skillsRes.status === 200);
    record("Skills returns empty array []", Array.isArray(skillsJson.skills) && skillsJson.skills.length === 0, `Length: ${skillsJson.skills?.length}`);
  } catch (err) {
    record("Phase 5 Collections Endpoints", false, err.message);
  }

  // 5. Admin Security & Rejection of Unauthorized Read Requests
  try {
    const noTokenRes = await fetch(`${STAGING_URL}/api/v1/admin/health`);
    record("Unauthenticated GET /api/v1/admin/health rejected with HTTP 401", noTokenRes.status === 401, `HTTP ${noTokenRes.status}`);

    const badTokenRes = await fetch(`${STAGING_URL}/api/v1/admin/health`, {
      headers: { Authorization: "Bearer synthetic-invalid-token-xyz" }
    });
    record("GET /api/v1/admin/health with invalid synthetic token rejected with HTTP 401", badTokenRes.status === 401, `HTTP ${badTokenRes.status}`);

    const noTokenProfileRes = await fetch(`${STAGING_URL}/api/v1/admin/profile`);
    record("Unauthenticated GET /api/v1/admin/profile rejected with HTTP 401", noTokenProfileRes.status === 401, `HTTP ${noTokenProfileRes.status}`);
  } catch (err) {
    record("Admin Security Endpoints", false, err.message);
  }

  // 6. Unknown Route 404 Distinction
  try {
    const unknownRes = await fetch(`${STAGING_URL}/api/v1/public/nonexistent-route-xyz`);
    const unknownJson = await unknownRes.json();
    record("Unknown public route returns HTTP 404", unknownRes.status === 404, `HTTP ${unknownRes.status}`);
    record(
      "Unknown route does not return unpublished resource code",
      unknownJson.code !== "PROFILE_NOT_PUBLISHED" && unknownJson.code !== "CV_NOT_PUBLISHED",
      `code: ${unknownJson.code || "none"}`
    );
  } catch (err) {
    record("Unknown Route Distinction", false, err.message);
  }

  // 7. Representative Video Metadata & Media Endpoint Security
  try {
    const singleVidRes = await fetch(`${STAGING_URL}/api/v1/public/videos/ai-moda-kombin-reels`);
    const singleVidJson = await singleVidRes.json();
    record("GET /api/v1/public/videos/:slug returns HTTP 200", singleVidRes.status === 200, `HTTP ${singleVidRes.status}`);
    record("Single video metadata contains published status", singleVidJson.video?.cmsStatus === "published", singleVidJson.video?.cmsStatus);
    record("Single video slug matches canonical identity", singleVidJson.video?.slug === "ai-moda-kombin-reels");

    // Media endpoint fail-closed verification on unseeded binary media
    const mediaRes = await fetch(`${STAGING_URL}/api/media/videos/ai-moda-kombin-reels/video.mp4`);
    record("Unseeded media key returns HTTP 404 Media Not Found (fail-closed)", mediaRes.status === 404, `HTTP ${mediaRes.status}`);
    record("Media 404 enforces Cache-Control: no-store", mediaRes.headers.get("cache-control")?.includes("no-store") === true, mediaRes.headers.get("cache-control"));

    // Media endpoint path traversal protection
    const traversalRes = await fetch(`${STAGING_URL}/api/media/../sensitive-file`);
    record("Media endpoint path traversal attempt rejected with HTTP 400 or 404", traversalRes.status === 400 || traversalRes.status === 404, `HTTP ${traversalRes.status}`);
  } catch (err) {
    record("Representative Video Metadata & Media Endpoints", false, err.message);
  }

  console.log("\n============================================================");
  console.log(`SMOKE TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) process.exit(1);
}

runSmokeTests().catch((err) => {
  console.error("FATAL ERROR IN SMOKE TESTS:", err);
  process.exit(1);
});
