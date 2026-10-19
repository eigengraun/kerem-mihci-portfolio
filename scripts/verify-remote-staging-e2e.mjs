#!/usr/bin/env node
/**
 * Automated Verification: Cloudflare Remote Staging E2E Publishing Flow
 *
 * Verifies against REAL Cloudflare staging infrastructure:
 *   - Worker: kerem-mihci-portfolio-api-staging
 *   - D1:     kerem-portfolio-db-staging
 *   - R2:     kerem-portfolio-media-staging
 *
 * Verifies:
 *   1. Direct Worker bindings & public health endpoint
 *   2. Next.js startup on isolated port (3099) in CMS_STORAGE_MODE=staging
 *   3. Admin authentication via scrypt password
 *   4. Durable session creation in remote staging D1 admin_sessions
 *   5. R2 media upload to remote staging R2 bucket & D1 project_media registration
 *   6. Draft project creation ('staging-e2e-test-project') & isolation from public routes
 *   7. Admin preview of draft project
 *   8. Instant publish without Next.js rebuild or restart
 *   9. Immediate HTTP 200 on dynamic TR & EN public routes
 *  10. Featured desktop icon participation
 *  11. Dynamic sitemap.xml update
 *  12. Immediate 404 and sitemap removal upon unpublish
 *  13. Clean removal of test records only; preserving all 30 canonical projects
 */

import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const TEST_PORT = 3099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const WORKER_URL =
  process.env.CLOUDFLARE_CMS_API_URL ||
  "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev";

const SECRET_PATH =
  process.env.STAGING_SERVICE_TOKEN_PATH ||
  "/Users/keremmihci/.gemini/antigravity/brain/bd30031d-6647-4acb-9e39-1add5e789838/scratch/.staging-service-token.tmp";

if (!fs.existsSync(SECRET_PATH)) {
  console.error(`ERROR: Service token file not found at ${SECRET_PATH}`);
  process.exit(1);
}
const WORKER_TOKEN = fs.readFileSync(SECRET_PATH, "utf8").trim();

const ADMIN_EMAIL = "kerem@keremmihci.com";
const MASTER_PASSWORD = "StagingTestMasterPassword2026!";
const SESSION_SECRET = "staging-ephemeral-hmac-secret-min16chars-2026!";

// 1x1 valid WebP image
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
  console.log("=== CLOUDFLARE REMOTE STAGING E2E PUBLISHING SUITE ===");
  console.log("Target Worker:", WORKER_URL);
  console.log("Next.js Port:", TEST_PORT);

  const testReport = {
    startedAt: new Date().toISOString(),
    workerUrl: WORKER_URL,
    steps: {},
    allPassed: false
  };

  try {
    // 1. Verify Remote Worker Public Health
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

    // 2. Start Next.js in production staging mode
    console.log("\n--- Step 2: Starting Next.js instance on port 3099 (CMS_STORAGE_MODE=staging) ---");
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

    await waitForHttp(`${BASE_URL}/api/projects`, async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      return data.count === 30;
    });
    console.log("✓ Next.js server online and serving 30 canonical projects from staging Worker.");

    // 3. Admin Authentication via scrypt
    console.log("\n--- Step 3: Admin Login with scrypt Password ---");
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

    // 4. Verify Durable Session in Remote Staging D1
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

    // Clean up any existing test project before starting
    await fetch(`${BASE_URL}/api/admin/projects/staging-e2e-test-project`, {
      method: "DELETE",
      headers: adminHeaders
    });

    // 5. Upload Test Media to Remote Staging R2 Bucket
    console.log("\n--- Step 5: Uploading Test Image to Remote Staging R2 Bucket ---");
    const formData = new FormData();
    const fileBlob = new Blob([TINY_WEBP_BUFFER], { type: "image/webp" });
    formData.append("file", fileBlob, "staging-test-cover.webp");
    formData.append("projectSlug", "staging-e2e-test-project");
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

    // 6. Create Test Project as DRAFT
    console.log("\n--- Step 6: Creating Test Project Draft ('staging-e2e-test-project') ---");
    const createDraftRes = await fetch(`${BASE_URL}/api/admin/projects`, {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: "staging-e2e-test-project",
        slug: "staging-e2e-test-project",
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

    // 7. Verify Draft Isolation
    console.log("\n--- Step 7: Verifying Draft Isolation from Public Endpoints ---");
    const draftTrRes = await fetch(`${BASE_URL}/tr/project/staging-e2e-test-project`);
    const draftEnRes = await fetch(`${BASE_URL}/en/project/staging-e2e-test-project`);
    assert.equal(draftTrRes.status, 404, "Draft must return 404 on /tr/project/... route");
    assert.equal(draftEnRes.status, 404, "Draft must return 404 on /en/project/... route");

    const draftSitemap = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
    assert.ok(!draftSitemap.includes("staging-e2e-test-project"), "Draft must NOT appear in sitemap.xml");

    const draftPublicApi = await (await fetch(`${BASE_URL}/api/projects`)).json();
    assert.ok(
      !draftPublicApi.projects.some((p) => p.slug === "staging-e2e-test-project"),
      "Draft must NOT appear in public /api/projects"
    );
    assert.equal(draftPublicApi.count, 30, "Public count must remain 30");

    const draftPublicMedia = await fetch(`${BASE_URL}${uploadedMediaUrl}`);
    assert.equal(draftPublicMedia.status, 404, "Draft media must NOT be publicly accessible (404)");

    const draftAdminMedia = await fetch(`${BASE_URL}${uploadedMediaUrl}`, {
      headers: { Cookie: cookieHeader }
    });
    assert.equal(draftAdminMedia.status, 200, "Draft media must be viewable by admin (200)");
    testReport.steps.step7_draftIsolation = "PASS";
    console.log("✓ Draft isolation verified: 404 on public routes, sitemap, api, and media.");

    // 8. Admin Preview
    console.log("\n--- Step 8: Verifying Admin Draft Preview ---");
    const previewRes = await fetch(
      `${BASE_URL}/admin/preview/staging-e2e-test-project?locale=tr`,
      { headers: { Cookie: cookieHeader } }
    );
    assert.equal(previewRes.status, 200, "Admin preview must return 200");
    const previewHtml = await previewRes.text();
    assert.ok(previewHtml.includes("Staging E2E Test Projesi"), "Admin preview renders draft content");
    testReport.steps.step8_adminPreview = "PASS";
    console.log("✓ Admin preview verified for draft project.");

    // 9. Publish Project Without Rebuild
    console.log("\n--- Step 9: Publishing Project Without Rebuild ---");
    const publishRes = await fetch(`${BASE_URL}/api/admin/projects/staging-e2e-test-project`, {
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

    // 10. Verify Immediate Public Dynamic Routes & Media
    console.log("\n--- Step 10: Verifying Public Dynamic Routes & Media Immediately Live ---");
    const pubTrRes = await fetch(`${BASE_URL}/tr/project/staging-e2e-test-project`);
    const pubEnRes = await fetch(`${BASE_URL}/en/project/staging-e2e-test-project`);
    assert.equal(pubTrRes.status, 200, "Published project must return 200 on TR route");
    assert.equal(pubEnRes.status, 200, "Published project must return 200 on EN route");
    const pubTrHtml = await pubTrRes.text();
    const pubEnHtml = await pubEnRes.text();
    assert.ok(pubTrHtml.includes("Staging E2E Test Projesi"), "TR route rendered TR title");
    assert.ok(pubEnHtml.includes("Staging E2E Test Project"), "EN route rendered EN title");

    const pubMediaRes = await fetch(`${BASE_URL}${uploadedMediaUrl}`);
    assert.equal(pubMediaRes.status, 200, "Published media must return 200 publicly");
    testReport.steps.step10_publicRoutesLive = "PASS";
    console.log("✓ TR and EN dynamic routes and media live immediately with HTTP 200.");

    // 11. Verify Desktop Icon Participation & Sitemap Update
    console.log("\n--- Step 11: Verifying Desktop Icon Grid & Dynamic Sitemap Update ---");
    const pubApi = await (await fetch(`${BASE_URL}/api/projects`)).json();
    assert.equal(pubApi.count, 31, "Published count must now be 31");
    const testProjectInApi = pubApi.projects.find((p) => p.slug === "staging-e2e-test-project");
    assert.ok(testProjectInApi, "Test project must be in public /api/projects");
    assert.equal(testProjectInApi.featured, true, "Featured flag must be true");
    assert.ok(testProjectInApi.desktopIcon, "Desktop icon must be defined");

    const pubSitemap = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
    assert.ok(
      pubSitemap.includes("/tr/project/staging-e2e-test-project") &&
        pubSitemap.includes("/en/project/staging-e2e-test-project"),
      "Sitemap must dynamically include both TR and EN URLs for published project"
    );
    testReport.steps.step11_featuredAndSitemap = "PASS";
    console.log("✓ Desktop icon participation and dynamic sitemap.xml verified.");

    // 12. Unpublish Project
    console.log("\n--- Step 12: Unpublishing Project -> Verifying Immediate 404 & Sitemap Removal ---");
    const unpubRes = await fetch(`${BASE_URL}/api/admin/projects/staging-e2e-test-project`, {
      method: "PATCH",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cmsStatus: "draft" })
    });
    assert.equal(unpubRes.status, 200, "Unpublishing project must return 200");

    const unpubTrRes = await fetch(`${BASE_URL}/tr/project/staging-e2e-test-project`);
    const unpubEnRes = await fetch(`${BASE_URL}/en/project/staging-e2e-test-project`);
    assert.equal(unpubTrRes.status, 404, "Unpublished project must return 404 on TR route");
    assert.equal(unpubEnRes.status, 404, "Unpublished project must return 404 on EN route");

    const unpubSitemap = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
    assert.ok(
      !unpubSitemap.includes("staging-e2e-test-project"),
      "Unpublished project must be completely removed from sitemap.xml"
    );

    const unpubApi = await (await fetch(`${BASE_URL}/api/projects`)).json();
    assert.equal(unpubApi.count, 30, "Public count must return to 30");
    testReport.steps.step12_unpublish = "PASS";
    console.log("✓ Unpublish verified: immediate 404 and removal from sitemap and public API.");

    // 13. Clean Up: Delete Only Test Records
    console.log("\n--- Step 13: Cleaning Up Test Records (Preserving 30 Canonical Projects) ---");
    const delProjRes = await fetch(`${BASE_URL}/api/admin/projects/staging-e2e-test-project`, {
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
    console.log("ALL 13 STAGING E2E PUBLISHING FLOW TESTS PASSED SUCCESSFULLY");
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
