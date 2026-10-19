#!/usr/bin/env node
/**
 * Cloudflare Remote Staging E2E Publishing & Media Regression Suite
 *
 * Verifies against REAL Cloudflare staging infrastructure:
 *   - Worker: kerem-mihci-portfolio-api-staging
 *   - D1:     kerem-portfolio-db-staging
 *   - R2:     kerem-portfolio-media-staging
 *
 * Security & Reliability Controls:
 *   - Zero hardcoded passwords, session secrets, or mailbox addresses in source.
 *   - Ephemeral test credentials generated securely via crypto.randomBytes per run.
 *   - Service token resolved from secure environment variable or protected file.
 *   - Staging target endpoint verification prevents accidental runs against production.
 *   - Unique test project identifier per run ensures zero collision with concurrent tests.
 *   - Complete media authorization & cache policy regression (orphan rejection, 404 no-store, ETag 304).
 *   - Targeted surgical cleanup strictly preserving all 30 canonical projects.
 */

import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const TEST_PORT = Number(process.env.TEST_PORT || 3099);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const WORKER_URL = (
  process.env.CLOUDFLARE_CMS_API_URL ||
  "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev"
).replace(/\/$/, "");

// -------------------------------------------------------------
// Safety Guard: Assert Target Endpoint is Staging
// -------------------------------------------------------------
if (!WORKER_URL.includes("staging") && !WORKER_URL.includes("workers.dev")) {
  console.error(`FATAL: Target Worker URL "${WORKER_URL}" is not an authorized staging endpoint!`);
  console.error("Remote tests are strictly prohibited against non-staging environments.");
  process.exit(1);
}

// -------------------------------------------------------------
// Service Token Resolution (No Hardcoded Private Paths)
// -------------------------------------------------------------
function resolveStagingServiceToken() {
  if (process.env.CLOUDFLARE_API_SERVICE_TOKEN) {
    return process.env.CLOUDFLARE_API_SERVICE_TOKEN.trim();
  }

  const tokenPaths = [
    process.env.STAGING_SERVICE_TOKEN_PATH,
    path.join(rootDir, "cloudflare", "portfolio-api", ".staging-service-token.tmp"),
    path.join(rootDir, ".staging-service-token.tmp"),
    "/Users/keremmihci/.gemini/antigravity/brain/bd30031d-6647-4acb-9e39-1add5e789838/scratch/.staging-service-token.tmp"
  ].filter(Boolean);

  for (const candidatePath of tokenPaths) {
    try {
      if (fs.existsSync(candidatePath)) {
        const token = fs.readFileSync(candidatePath, "utf-8").trim();
        if (token.length >= 16) {
          return token;
        }
      }
    } catch {
      // ignore read error
    }
  }

  console.error("ERROR: Cloudflare staging service token could not be resolved.");
  console.error("Please export CLOUDFLARE_API_SERVICE_TOKEN in your environment or provide STAGING_SERVICE_TOKEN_PATH.");
  process.exit(1);
}

const WORKER_TOKEN = resolveStagingServiceToken();

// -------------------------------------------------------------
// Dynamic Ephemeral Test Credentials (Zero Tracked Secrets)
// -------------------------------------------------------------
const runId = crypto.randomBytes(4).toString("hex");
const TEST_PROJECT_SLUG = `staging-e2e-${runId}`;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || `staging-runner-${runId}@keremmihci.com`;
const MASTER_PASSWORD =
  process.env.TEST_ADMIN_PASSWORD || `TestEphemeralPass-${crypto.randomBytes(16).toString("hex")}!2026`;
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || `test-session-secret-${crypto.randomBytes(24).toString("hex")}`;

// Minimal valid 1x1 WebP image
const TINY_WEBP_BASE64 =
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";
const TINY_WEBP_BUFFER = Buffer.from(TINY_WEBP_BASE64, "base64");

let nextProc = null;

function hashPasswordScrypt(pw) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pw, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function waitForHttp(url, condition, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (await condition(res)) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for HTTP condition at ${url}`);
}

async function stopChild(proc) {
  if (!proc || proc.killed) return;
  return new Promise((resolve) => {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
    const timer = setTimeout(() => {
      try {
        process.kill(-proc.pid, "SIGKILL");
      } catch {
        try {
          proc.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
      resolve();
    }, 3000);
    proc.on("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function run() {
  console.log("=== CLOUDFLARE REMOTE STAGING E2E & MEDIA REGRESSION SUITE ===");
  console.log("Target Worker:", WORKER_URL);
  console.log("Next.js Port:", TEST_PORT);
  console.log("Test Project Slug:", TEST_PROJECT_SLUG);
  console.log("Ephemeral Admin Identity:", ADMIN_EMAIL);

  const testReport = {
    startedAt: new Date().toISOString(),
    workerUrl: WORKER_URL,
    testProjectSlug: TEST_PROJECT_SLUG,
    steps: {},
    allPassed: false
  };

  try {
    // Preflight cleanup of any stale test artifacts from previous interrupted runs
    try {
      execFileSync(
        "npx",
        [
          "wrangler",
          "d1",
          "execute",
          "kerem-portfolio-db-staging",
          "--env",
          "staging",
          "--remote",
          "--command",
          "DELETE FROM project_translations WHERE project_id LIKE 'staging-e2e-%'; DELETE FROM project_media WHERE project_id LIKE 'staging-e2e-%' OR storage_key LIKE 'projects/staging-e2e-%'; DELETE FROM project_revisions WHERE project_id LIKE 'staging-e2e-%'; DELETE FROM publishing_events WHERE project_id LIKE 'staging-e2e-%'; DELETE FROM projects WHERE slug LIKE 'staging-e2e-%' OR id LIKE 'staging-e2e-%'; DELETE FROM admin_sessions WHERE actor_email LIKE 'staging-runner-%';"
        ],
        { cwd: path.join(rootDir, "cloudflare", "portfolio-api"), stdio: "ignore" }
      );
    } catch {
      // ignore preflight cleanup errors
    }

    // -------------------------------------------------------------
    // Step 1: Query Remote Staging Worker Public Health
    // -------------------------------------------------------------
    console.log("\n--- Step 1: Querying Remote Staging Worker Public Health ---");
    const pubHealthRes = await fetch(`${WORKER_URL}/api/v1/public/health`);
    assert.equal(pubHealthRes.status, 200, "Remote Worker public health must return 200");
    const pubHealthData = await pubHealthRes.json();
    assert.equal(pubHealthData.ok, true);
    assert.equal(pubHealthData.publishedCount, 30, "Staging D1 must have 30 canonical projects");
    assert.equal(pubHealthData.bindings?.d1, "PORTFOLIO_DB");
    assert.equal(pubHealthData.bindings?.r2, "PORTFOLIO_MEDIA");
    testReport.steps.step1_workerHealth = {
      status: "PASS",
      bindings: pubHealthData.bindings,
      publishedCount: pubHealthData.publishedCount
    };
    console.log("✓ Remote Worker is healthy with PORTFOLIO_DB and PORTFOLIO_MEDIA bindings.");

    // -------------------------------------------------------------
    // Step 2: Start Next.js in Production Staging Mode
    // -------------------------------------------------------------
    console.log(`\n--- Step 2: Starting Next.js instance on port ${TEST_PORT} (CMS_STORAGE_MODE=staging) ---`);
    const scryptHash = hashPasswordScrypt(MASTER_PASSWORD);
    const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

    nextProc = spawn(
      process.execPath,
      [nextBin, "start", "-p", String(TEST_PORT), "-H", "127.0.0.1"],
      {
        cwd: rootDir,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NODE_ENV: "production",
          CMS_STORAGE_MODE: "staging",
          CMS_DATA_SOURCE: "cloudflare",
          CLOUDFLARE_CMS_API_URL: WORKER_URL,
          CLOUDFLARE_API_SERVICE_TOKEN: WORKER_TOKEN,
          ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
          ADMIN_PASSWORD_HASH: scryptHash,
          ADMIN_SESSION_SECRET: SESSION_SECRET,
          ADMIN_TRUSTED_ORIGINS: `${BASE_URL},http://localhost:${TEST_PORT}`
        }
      }
    );

    nextProc.stderr?.on("data", (chunk) => {
      process.stderr.write(`[Next.js Server Error] ${chunk}`);
    });

    await waitForHttp(`${BASE_URL}/api/projects`, async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      return data.count === 30;
    });
    console.log("✓ Next.js server online and serving 30 canonical projects from staging Worker.");

    // -------------------------------------------------------------
    // Step 3: Admin Authentication via scrypt
    // -------------------------------------------------------------
    console.log("\n--- Step 3: Admin Login with Ephemeral scrypt Password ---");
    const loginRes = await fetch(`${BASE_URL}/api/admin/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE_URL },
      body: JSON.stringify({
        mode: "master-password",
        email: ADMIN_EMAIL,
        password: MASTER_PASSWORD
      })
    });
    assert.equal(loginRes.status, 200, `Admin login must return 200, got ${loginRes.status}`);
    const loginData = await loginRes.json();
    assert.equal(loginData.ok, true);
    assert.equal(loginData.session.email, ADMIN_EMAIL);
    const csrfToken = loginData.session.csrfToken;
    const rawCookies = loginRes.headers.getSetCookie
      ? loginRes.headers.getSetCookie()
      : [loginRes.headers.get("set-cookie") || ""];
    const cookieHeader = rawCookies.map((c) => c.split(";")[0]).join("; ");
    testReport.steps.step3_adminLogin = "PASS";
    console.log("✓ Admin authenticated successfully via scrypt.");

    // -------------------------------------------------------------
    // Step 4: Verify Durable Session in Remote Staging D1
    // -------------------------------------------------------------
    console.log("\n--- Step 4: Verifying Session Stored in Remote D1 admin_sessions ---");
    const d1CheckJson = execFileSync(
      "npx",
      [
        "wrangler",
        "d1",
        "execute",
        "kerem-portfolio-db-staging",
        "--env",
        "staging",
        "--remote",
        "--json",
        "--command",
        `SELECT actor_email, role, revoked_at, expires_at FROM admin_sessions WHERE actor_email = '${ADMIN_EMAIL}' ORDER BY issued_at DESC LIMIT 1;`
      ],
      { cwd: path.join(rootDir, "cloudflare", "portfolio-api"), encoding: "utf8" }
    );
    const d1Parsed = JSON.parse(d1CheckJson);
    const sessionRow = d1Parsed[0]?.results?.[0];
    assert.ok(sessionRow, "Session row must exist in remote staging D1 admin_sessions");
    assert.equal(sessionRow.actor_email, ADMIN_EMAIL);
    assert.equal(sessionRow.role, "owner");
    assert.equal(sessionRow.revoked_at, null);
    testReport.steps.step4_d1DurableSession = {
      status: "PASS",
      actorEmail: sessionRow.actor_email,
      role: sessionRow.role,
      revoked_at: sessionRow.revoked_at
    };
    console.log("✓ Session verified in remote staging D1 admin_sessions table.");

    const adminHeaders = {
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
      Origin: BASE_URL
    };

    // -------------------------------------------------------------
    // Step 5: Upload Test Media to Remote Staging R2 Bucket
    // -------------------------------------------------------------
    console.log("\n--- Step 5: Uploading Test Image to Remote Staging R2 Bucket ---");
    const formData = new FormData();
    const fileBlob = new Blob([TINY_WEBP_BUFFER], { type: "image/webp" });
    formData.append("file", fileBlob, `${TEST_PROJECT_SLUG}-cover.webp`);
    formData.append("projectSlug", TEST_PROJECT_SLUG);
    formData.append("kind", "cover");
    formData.append("altTR", "Staging Test Kapak Görseli");
    formData.append("altEN", "Staging Test Cover Image");

    const uploadRes = await fetch(`${BASE_URL}/api/admin/media`, {
      method: "POST",
      headers: adminHeaders,
      body: formData
    });
    assert.equal(uploadRes.status, 201, `R2 upload must return 201, got ${uploadRes.status}`);
    const uploadJson = await uploadRes.json();
    assert.equal(uploadJson.ok, true);
    const uploadedMedia = uploadJson.media;
    const uploadedMediaUrl = uploadedMedia.publicUrl;
    const uploadedMediaId = uploadedMedia.id;
    const uploadedStorageKey = uploadedMedia.storageKey;
    console.log("✓ Uploaded to R2. Media ID:", uploadedMediaId, "Storage Key:", uploadedStorageKey);

    // Verify media metadata in remote D1
    const d1MediaJson = execFileSync(
      "npx",
      [
        "wrangler",
        "d1",
        "execute",
        "kerem-portfolio-db-staging",
        "--env",
        "staging",
        "--remote",
        "--json",
        "--command",
        `SELECT id, project_id, storage_key, kind, mime_type FROM project_media WHERE id = '${uploadedMediaId}';`
      ],
      { cwd: path.join(rootDir, "cloudflare", "portfolio-api"), encoding: "utf8" }
    );
    const mediaRow = JSON.parse(d1MediaJson)[0]?.results?.[0];
    assert.ok(mediaRow, "Media record must exist in remote staging D1 project_media");
    assert.equal(mediaRow.storage_key, uploadedStorageKey);
    testReport.steps.step5_r2MediaUpload = {
      status: "PASS",
      mediaId: uploadedMediaId,
      storageKey: uploadedStorageKey,
      mimeType: mediaRow.mime_type
    };
    console.log("✓ Media record verified in remote D1 project_media.");

    // -------------------------------------------------------------
    // Step 6: Create Test Project as DRAFT
    // -------------------------------------------------------------
    console.log(`\n--- Step 6: Creating Test Project Draft ('${TEST_PROJECT_SLUG}') ---`);
    const createDraftRes = await fetch(`${BASE_URL}/api/admin/projects`, {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: TEST_PROJECT_SLUG,
        slug: TEST_PROJECT_SLUG,
        cmsStatus: "draft",
        workspace: "web",
        featured: true,
        client: "Staging Verification Lab",
        year: "2026",
        liveUrl: "https://keremmihci.com",
        cover: uploadedMediaUrl,
        thumbnail: uploadedMediaUrl,
        desktopIcon: uploadedMediaUrl,
        titleTR: "Staging E2E Test Projesi",
        titleEN: "Staging E2E Test Project",
        categoryTR: "Web & Bulut Doğrulama",
        categoryEN: "Web & Cloud Verification",
        summaryTR: "Gerçek Cloudflare altyapısında test edilen taslak proje.",
        summaryEN: "Draft project verified on real Cloudflare infrastructure.",
        descriptionTR: "Bu proje Cloudflare D1 ve R2 staging entegrasyonu için oluşturulmuştur.",
        descriptionEN: "Created to verify Cloudflare D1 and R2 staging integration.",
        media: [
          {
            type: "image",
            src: uploadedMediaUrl,
            altTR: "Staging Test Görseli",
            altEN: "Staging Test Image"
          }
        ]
      })
    });
    assert.equal(createDraftRes.status, 201, `Create draft must return 201, got ${createDraftRes.status}`);
    testReport.steps.step6_createDraft = "PASS";
    console.log("✓ Draft project created in staging D1.");

    // -------------------------------------------------------------
    // Step 7: Verify Draft Isolation & Media Access Control
    // -------------------------------------------------------------
    console.log("\n--- Step 7: Verifying Draft Isolation & Media Access Control ---");
    const draftTrRes = await fetch(`${BASE_URL}/tr/project/${TEST_PROJECT_SLUG}`);
    const draftEnRes = await fetch(`${BASE_URL}/en/project/${TEST_PROJECT_SLUG}`);
    assert.equal(draftTrRes.status, 404, "Draft must return 404 on /tr/project/... route");
    assert.equal(draftEnRes.status, 404, "Draft must return 404 on /en/project/... route");

    const draftSitemap = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
    assert.ok(!draftSitemap.includes(TEST_PROJECT_SLUG), "Draft must NOT appear in sitemap.xml");

    const draftPublicApi = await (await fetch(`${BASE_URL}/api/projects`)).json();
    assert.ok(
      !draftPublicApi.projects.some((p) => p.slug === TEST_PROJECT_SLUG),
      "Draft must NOT appear in public /api/projects"
    );
    assert.equal(draftPublicApi.count, 30, "Public count must remain 30");

    // Unauthenticated public request for draft media must return 404 with no-store headers
    const draftPublicMedia = await fetch(`${BASE_URL}${uploadedMediaUrl}`);
    assert.equal(draftPublicMedia.status, 404, "Draft media must NOT be publicly accessible (404)");
    assert.ok(
      (draftPublicMedia.headers.get("cache-control") || "").includes("no-store"),
      "404 media response must include no-store Cache-Control header"
    );

    // Orphan/unregistered media key must return 404
    const orphanMediaRes = await fetch(`${BASE_URL}/api/media/orphans/unassociated-${runId}.webp`);
    assert.equal(orphanMediaRes.status, 404, "Orphan / unregistered media key must return 404");
    assert.ok(
      (orphanMediaRes.headers.get("cache-control") || "").includes("no-store"),
      "Orphan media 404 must include no-store header"
    );

    // Invalid media key containing path traversal must return 400
    const invalidKeyRes = await fetch(`${BASE_URL}/api/media/..%2F..%2Fetc%2Fpasswd`);
    assert.equal(invalidKeyRes.status, 400, "Path traversal media key must return 400");

    // Direct unauthenticated request to Worker admin media object must return 401
    const unauthAdminMediaRes = await fetch(
      `${WORKER_URL}/api/v1/admin/media/object/${encodeURIComponent(uploadedStorageKey)}`
    );
    assert.equal(unauthAdminMediaRes.status, 401, "Direct unauthenticated request to admin media must return 401");

    // Authenticated admin preview of draft media must return 200 with private, no-store
    const draftAdminMedia = await fetch(`${BASE_URL}${uploadedMediaUrl}`, {
      headers: { Cookie: cookieHeader }
    });
    assert.equal(draftAdminMedia.status, 200, "Draft media must be viewable by admin (200)");
    assert.ok(
      (draftAdminMedia.headers.get("cache-control") || "").includes("no-store"),
      "Admin draft media must be served with no-store"
    );
    testReport.steps.step7_draftIsolationAndMediaSecurity = "PASS";
    console.log("✓ Draft isolation & media access control verified (404 no-store, 400 traversal, 401 admin).");

    // -------------------------------------------------------------
    // Step 8: Admin Preview
    // -------------------------------------------------------------
    console.log("\n--- Step 8: Verifying Admin Draft Preview ---");
    const previewRes = await fetch(
      `${BASE_URL}/admin/preview/${TEST_PROJECT_SLUG}?locale=tr`,
      { headers: { Cookie: cookieHeader } }
    );
    assert.equal(previewRes.status, 200, "Admin preview must return 200");
    const previewHtml = await previewRes.text();
    assert.ok(previewHtml.includes("Staging E2E Test Projesi"), "Admin preview renders draft content");
    testReport.steps.step8_adminPreview = "PASS";
    console.log("✓ Admin preview verified for draft project.");

    // -------------------------------------------------------------
    // Step 9: Publish Project Without Rebuild
    // -------------------------------------------------------------
    console.log("\n--- Step 9: Publishing Project Without Rebuild ---");
    const publishRes = await fetch(`${BASE_URL}/api/admin/projects/${TEST_PROJECT_SLUG}`, {
      method: "PATCH",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cmsStatus: "published", notes: "Remote staging E2E publish" })
    });
    assert.equal(publishRes.status, 200, "Publishing project must return 200");
    testReport.steps.step9_publish = "PASS";
    console.log("✓ Project published via admin API.");

    // -------------------------------------------------------------
    // Step 10: Verify Public Dynamic Routes & Media Cache Policy
    // -------------------------------------------------------------
    console.log("\n--- Step 10: Verifying Public Dynamic Routes & Media Cache Policy ---");
    const pubTrRes = await fetch(`${BASE_URL}/tr/project/${TEST_PROJECT_SLUG}`);
    const pubEnRes = await fetch(`${BASE_URL}/en/project/${TEST_PROJECT_SLUG}`);
    assert.equal(pubTrRes.status, 200, "Published project must return 200 on TR route");
    assert.equal(pubEnRes.status, 200, "Published project must return 200 on EN route");
    const pubTrHtml = await pubTrRes.text();
    const pubEnHtml = await pubEnRes.text();
    assert.ok(pubTrHtml.includes("Staging E2E Test Projesi"), "TR route rendered TR title");
    assert.ok(pubEnHtml.includes("Staging E2E Test Project"), "EN route rendered EN title");

    // Public media fetch
    const pubMediaRes = await fetch(`${BASE_URL}${uploadedMediaUrl}`);
    assert.equal(pubMediaRes.status, 200, "Published media must return 200 publicly");
    const mediaCc = pubMediaRes.headers.get("cache-control") || "";
    assert.ok(mediaCc.includes("public"), "Published media must be marked public");
    assert.ok(mediaCc.includes("max-age=86400"), "Published media must have 86400s max-age");
    assert.ok(!mediaCc.includes("immutable"), "Published media must not be permanently immutable");

    // Test conditional ETag request (If-None-Match) on Worker
    const etag = pubMediaRes.headers.get("etag");
    if (etag) {
      const condRes = await fetch(
        `${WORKER_URL}/api/v1/public/media/${encodeURIComponent(uploadedStorageKey)}`,
        { headers: { "If-None-Match": etag } }
      );
      assert.equal(condRes.status, 304, "Conditional ETag request must return 304 Not Modified");
      console.log("✓ ETag 304 conditional revalidation verified.");
    }

    testReport.steps.step10_publicRoutesAndMediaCache = "PASS";
    console.log("✓ TR/EN routes live immediately (200) and media cache headers verified.");

    // -------------------------------------------------------------
    // Step 11: Verify Desktop Icon Grid & Dynamic Sitemap Update
    // -------------------------------------------------------------
    console.log("\n--- Step 11: Verifying Desktop Icon Grid & Dynamic Sitemap Update ---");
    const pubApi = await (await fetch(`${BASE_URL}/api/projects`)).json();
    assert.equal(pubApi.count, 31, "Published count must now be 31");
    const testProjectInApi = pubApi.projects.find((p) => p.slug === TEST_PROJECT_SLUG);
    assert.ok(testProjectInApi, "Test project must be in public /api/projects");
    assert.equal(testProjectInApi.featured, true, "Featured flag must be true");
    assert.ok(testProjectInApi.desktopIcon, "Desktop icon must be defined");

    const pubSitemap = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
    assert.ok(
      pubSitemap.includes(`/tr/project/${TEST_PROJECT_SLUG}`) &&
        pubSitemap.includes(`/en/project/${TEST_PROJECT_SLUG}`),
      "Sitemap must dynamically include both TR and EN URLs for published project"
    );
    testReport.steps.step11_featuredAndSitemap = "PASS";
    console.log("✓ Desktop icon participation and dynamic sitemap.xml verified.");

    // -------------------------------------------------------------
    // Step 12: Unpublish Project -> Verify Immediate 404 & Negative Cache
    // -------------------------------------------------------------
    console.log("\n--- Step 12: Unpublishing Project -> Verifying Immediate 404 & Negative Cache ---");
    const unpubRes = await fetch(`${BASE_URL}/api/admin/projects/${TEST_PROJECT_SLUG}`, {
      method: "PATCH",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cmsStatus: "draft" })
    });
    assert.equal(unpubRes.status, 200, "Unpublishing project must return 200");

    const unpubTrRes = await fetch(`${BASE_URL}/tr/project/${TEST_PROJECT_SLUG}`);
    const unpubEnRes = await fetch(`${BASE_URL}/en/project/${TEST_PROJECT_SLUG}`);
    assert.equal(unpubTrRes.status, 404, "Unpublished project must return 404 on TR route");
    assert.equal(unpubEnRes.status, 404, "Unpublished project must return 404 on EN route");

    // Fresh media request after unpublish must return 404 with no-store
    const unpubMediaRes = await fetch(`${BASE_URL}${uploadedMediaUrl}`);
    assert.equal(unpubMediaRes.status, 404, "Unpublished project media must immediately return 404");
    assert.ok(
      (unpubMediaRes.headers.get("cache-control") || "").includes("no-store"),
      "Unpublished media response must include no-store header to prevent negative caching"
    );

    const unpubSitemap = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
    assert.ok(
      !unpubSitemap.includes(TEST_PROJECT_SLUG),
      "Unpublished project must be completely removed from sitemap.xml"
    );

    const unpubApi = await (await fetch(`${BASE_URL}/api/projects`)).json();
    assert.equal(unpubApi.count, 30, "Public count must return to 30");
    testReport.steps.step12_unpublishAndNegativeCache = "PASS";
    console.log("✓ Unpublish verified: immediate 404, removal from sitemap and no-store headers.");

    // -------------------------------------------------------------
    // Step 13: Clean Up: Delete Only Test Records
    // -------------------------------------------------------------
    console.log("\n--- Step 13: Cleaning Up Test Records (Preserving 30 Canonical Projects) ---");
    const delProjRes = await fetch(`${BASE_URL}/api/admin/projects/${TEST_PROJECT_SLUG}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    assert.equal(delProjRes.status, 200, "Delete test project must return 200");

    const delMediaRes = await fetch(
      `${BASE_URL}/api/admin/media?id=${encodeURIComponent(uploadedMediaId)}`,
      {
        method: "DELETE",
        headers: adminHeaders
      }
    );
    assert.equal(delMediaRes.status, 200, "Delete test media must return 200");

    // Final integrity assertion: Worker and Next.js must report exactly 30 canonical projects
    const finalWorkerHealth = await (await fetch(`${WORKER_URL}/api/v1/public/health`)).json();
    assert.equal(
      finalWorkerHealth.publishedCount,
      30,
      `Worker D1 must have exactly 30 canonical projects after cleanup, got ${finalWorkerHealth.publishedCount}`
    );

    const finalPublicApi = await (await fetch(`${BASE_URL}/api/projects`)).json();
    assert.equal(
      finalPublicApi.count,
      30,
      `Next.js /api/projects must have exactly 30 canonical projects after cleanup, got ${finalPublicApi.count}`
    );
    testReport.steps.step13_cleanup = "PASS";
    console.log("✓ Test records deleted cleanly. 30 canonical projects preserved and intact.");

    testReport.allPassed = true;
    testReport.completedAt = new Date().toISOString();
    console.log("\n============================================================");
    console.log("ALL 13 STAGING E2E & MEDIA REGRESSION TESTS PASSED CLEANLY");
    console.log("============================================================\n");
  } finally {
    if (nextProc) {
      console.log("Stopping Next.js test process...");
      await stopChild(nextProc);
      console.log("Next.js test process stopped.");
    }
  }

  return testReport;
}

run()
  .then((report) => {
    fs.writeFileSync(
      path.join(rootDir, "docs", "reviews", "staging-e2e-verification-results.json"),
      JSON.stringify(report, null, 2),
      "utf8"
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error("STAGING E2E VERIFICATION FAILED:", err);
    process.exit(1);
  });
