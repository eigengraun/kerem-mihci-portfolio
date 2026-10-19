import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const requireFromDisk = createRequire(import.meta.url);
const playwrightPath =
  "/Volumes/EMIX_WORK/02_DEV/GEMINI/MyPlace/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core";
const { chromium } = requireFromDisk(playwrightPath);

const executablePath =
  "/Users/keremmihci/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3099";
const WORKER_URL = process.env.CLOUDFLARE_CMS_API_URL || "http://127.0.0.1:8787";
const WORKER_TOKEN = process.env.CLOUDFLARE_API_SERVICE_TOKEN || "local-worker-service-secret-token-2026";

// Bounded HTTP: each request times out instead of hanging the suite.
const HTTP_TIMEOUT_MS = Number(process.env.HARNESS_HTTP_TIMEOUT_MS || 30000);
const rawFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) =>
  rawFetch(input, {
    ...init,
    signal: init.signal || AbortSignal.timeout(HTTP_TIMEOUT_MS)
  }).catch((err) => {
    const target = typeof input === "string" ? input : String(input?.url || input);
    err.message = `[e2e fetch ${init.method || "GET"} ${target}] ${err.message}`;
    throw err;
  });
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || "local-dev-ephemeral-hmac-secret-do-not-use-in-prod";

// Minimal valid 1x1 WebP image buffer for R2 upload testing
const TINY_WEBP_BASE64 =
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";
const TINY_WEBP_BUFFER = Buffer.from(TINY_WEBP_BASE64, "base64");

function forgeSignedSessionCookie(payload, secret = SESSION_SECRET) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `km_admin_session=${encodedPayload}.${signature}`;
}

async function runVerification() {
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    workerUrl: WORKER_URL,
    workerDirectChecks: {},
    authTestMatrix: [],
    securityAndSeoChecks: {},
    cmsPublishTestSteps: {},
    canonical30ProjectsCheck: {},
    publicResponsiveViewports: [],
    adminResponsiveViewports: [],
    allPassed: false
  };

  console.log("=== 1. Direct Cloudflare Worker Runtime & Binding Verification ===");
  const workerPubHealthRes = await fetch(`${WORKER_URL}/api/v1/public/health`);
  assert.equal(workerPubHealthRes.status, 200, "Worker public health must return 200");
  const workerPubHealth = await workerPubHealthRes.json();
  assert.equal(workerPubHealth.ok, true);
  assert.equal(workerPubHealth.publishedCount, 30, "Worker D1 must have 30 published projects");

  // Worker admin endpoint without service token -> 401
  const workerUnauthRes = await fetch(`${WORKER_URL}/api/v1/admin/projects`);
  assert.equal(workerUnauthRes.status, 401, "Worker admin endpoint without token must return 401");

  // Worker admin endpoint with invalid service token -> 401 (Test H)
  const workerBadTokenRes = await fetch(`${WORKER_URL}/api/v1/admin/projects`, {
    headers: { Authorization: "Bearer wrong-invalid-service-token" }
  });
  assert.equal(workerBadTokenRes.status, 401, "Worker admin endpoint with invalid token must return 401");

  // Worker admin system endpoint with valid token -> 200
  const workerSysRes = await fetch(`${WORKER_URL}/api/v1/admin/system`, {
    headers: { Authorization: `Bearer ${WORKER_TOKEN}` }
  });
  assert.equal(workerSysRes.status, 200, "Worker /api/v1/admin/system with valid token must return 200");
  const workerSysJson = await workerSysRes.json();
  assert.equal(workerSysJson.d1Health.counts.total, 30);
  assert.equal(workerSysJson.d1Health.counts.published, 30);
  assert.deepEqual(workerSysJson.d1Health.workspaceBreakdown, [
    { workspace: "design", status: "published", count: 18 },
    { workspace: "web", status: "published", count: 12 }
  ]);
  report.workerDirectChecks = {
    publicHealth: "PASSED (200)",
    unauthenticatedAdminBlocked: "PASSED (401)",
    invalidServiceTokenBlocked: "PASSED (401)",
    validServiceTokenSystemHealth: "PASSED (200)",
    workerWorkspaceBreakdown: workerSysJson.d1Health.workspaceBreakdown
  };

  console.log("=== 2. API Authorization Test Matrix (Tests A through H) ===");
  const adminEndpoints = [
    "/api/admin/projects",
    "/api/admin/projects/planfiq-website-web-uygulamasi",
    "/api/admin/media",
    "/api/admin/system",
    "/api/admin/analytics"
  ];

  // Test A — Unauthenticated request -> 401
  for (const endpoint of adminEndpoints) {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    assert.equal(res.status, 401, `Test A failed for ${endpoint}: got ${res.status}`);
  }
  report.authTestMatrix.push({
    test: "Test A — Unauthenticated request",
    endpoints: adminEndpoints,
    expected: 401,
    actual: 401,
    result: "PASS"
  });

  // Test B — Invalid session signature -> 401
  const badSigCookie = forgeSignedSessionCookie(
    {
      email: "kerem@keremmihci.com",
      mode: "master-password",
      iat: Date.now() - 1000,
      exp: Date.now() + 3600_000,
      csrfToken: "csrf-b",
      jti: "jti-b"
    },
    "wrong-signing-secret"
  );
  for (const endpoint of adminEndpoints) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { Cookie: badSigCookie }
    });
    assert.equal(res.status, 401, `Test B failed for ${endpoint}: got ${res.status}`);
  }
  report.authTestMatrix.push({
    test: "Test B — Invalid session signature",
    endpoints: adminEndpoints,
    expected: 401,
    actual: 401,
    result: "PASS"
  });

  // Test C — Expired session -> 401
  const expiredCookie = forgeSignedSessionCookie({
    email: "kerem@keremmihci.com",
    mode: "master-password",
    iat: Date.now() - 7200_000,
    exp: Date.now() - 10_000,
    csrfToken: "csrf-c",
    jti: "jti-c"
  });
  for (const endpoint of adminEndpoints) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { Cookie: expiredCookie }
    });
    assert.equal(res.status, 401, `Test C failed for ${endpoint}: got ${res.status}`);
  }
  report.authTestMatrix.push({
    test: "Test C — Expired session",
    endpoints: adminEndpoints,
    expected: 401,
    actual: 401,
    result: "PASS"
  });

  // Test D — Non-admin identity (validly signed token, unauthorized email) -> 403
  const nonAdminCookie = forgeSignedSessionCookie({
    email: "intruder@unauthorized-domain.com",
    mode: "google-oauth",
    iat: Date.now() - 1000,
    exp: Date.now() + 3600_000,
    csrfToken: "csrf-d",
    jti: "jti-d"
  });
  for (const endpoint of adminEndpoints) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { Cookie: nonAdminCookie }
    });
    assert.equal(res.status, 403, `Test D failed for ${endpoint}: got ${res.status}`);
  }
  report.authTestMatrix.push({
    test: "Test D — Non-admin identity",
    endpoints: adminEndpoints,
    expected: 403,
    actual: 403,
    result: "PASS"
  });

  // Test wrong master password -> 401
  const wrongPwRes = await fetch(`${BASE_URL}/api/admin/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "master-password",
      email: "kerem@keremmihci.com",
      password: "wrong-password-attempt"
    })
  });
  assert.equal(wrongPwRes.status, 401, "Wrong master password must return 401");

  // Authenticate a real admin session via POST /api/admin/auth (Test E)
  const masterPassword = process.env.ADMIN_MASTER_PASSWORD || "TestMasterPassword2026!";
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "master-password",
      email: "kerem@keremmihci.com",
      password: masterPassword
    })
  });
  assert.equal(loginRes.status, 200, "Admin master-password session login must return 200");
  const loginJson = await loginRes.json();
  const csrfToken = loginJson.session.csrfToken;
  const rawSetCookie = loginRes.headers.getSetCookie
    ? loginRes.headers.getSetCookie()
    : [loginRes.headers.get("set-cookie") || ""];
  const cookieHeader = rawSetCookie.map((c) => c.split(";")[0]).join("; ");

  // Test E — Valid admin identity -> 200 across all admin read endpoints
  for (const endpoint of adminEndpoints) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { Cookie: cookieHeader }
    });
    assert.equal(res.status, 200, `Test E failed for ${endpoint}: got ${res.status}`);
  }
  report.authTestMatrix.push({
    test: "Test E — Valid admin identity",
    endpoints: adminEndpoints,
    expected: 200,
    actual: 200,
    result: "PASS"
  });

  // Test F — Missing CSRF token on mutating request -> 403
  const missingCsrfRes = await fetch(`${BASE_URL}/api/admin/projects`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ slug: "csrf-test", titleTR: "Test", titleEN: "Test" })
  });
  assert.equal(missingCsrfRes.status, 403, `Test F (Missing CSRF) expected 403, got ${missingCsrfRes.status}`);
  report.authTestMatrix.push({
    test: "Test F — Missing CSRF token on mutating request",
    endpoints: ["POST /api/admin/projects"],
    expected: 403,
    actual: missingCsrfRes.status,
    result: "PASS"
  });

  // Test G — Invalid Origin header on mutating request -> 403
  const badOriginRes = await fetch(`${BASE_URL}/api/admin/projects`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
      Origin: "https://evil-attacker.example.com",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ slug: "origin-test", titleTR: "Test", titleEN: "Test" })
  });
  assert.equal(badOriginRes.status, 403, `Test G (Invalid Origin) expected 403, got ${badOriginRes.status}`);
  report.authTestMatrix.push({
    test: "Test G — Invalid Origin header",
    endpoints: ["POST /api/admin/projects"],
    expected: 403,
    actual: badOriginRes.status,
    result: "PASS"
  });

  // Test H — Invalid Worker service token -> 401
  report.authTestMatrix.push({
    test: "Test H — Invalid Worker service token",
    endpoints: ["GET /api/v1/admin/projects"],
    expected: 401,
    actual: workerBadTokenRes.status,
    result: "PASS"
  });

  // Additional Auth Hardening Check: Session Logout Revocation (jti)
  const tempLoginRes = await fetch(`${BASE_URL}/api/admin/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "master-password",
      email: "kerem@keremmihci.com",
      password: masterPassword
    })
  });
  const tempCookies = (
    tempLoginRes.headers.getSetCookie
      ? tempLoginRes.headers.getSetCookie()
      : [tempLoginRes.headers.get("set-cookie") || ""]
  )
    .map((c) => c.split(";")[0])
    .join("; ");
  const logoutRes = await fetch(`${BASE_URL}/api/admin/auth`, {
    method: "DELETE",
    headers: { Cookie: tempCookies }
  });
  assert.equal(logoutRes.status, 200, "Logout must return 200");
  const replayAfterLogoutRes = await fetch(`${BASE_URL}/api/admin/projects`, {
    headers: { Cookie: tempCookies }
  });
  assert.equal(
    replayAfterLogoutRes.status,
    401,
    "Replaying session cookie after DELETE /api/admin/auth must return 401 (jti revoked)"
  );
  report.securityAndSeoChecks.sessionLogoutRevocationVerified = true;

  // Additional R2 Hardening Check: Magic-byte file signature validation rejects fake image bytes
  const fakeFormData = new FormData();
  const fakeBlob = new Blob([Buffer.from("THIS_IS_NOT_A_VALID_WEBP_OR_PNG_FILE")], {
    type: "image/webp"
  });
  fakeFormData.append("file", fakeBlob, "spoofed.webp");
  fakeFormData.append("projectSlug", "cms-publish-test");
  fakeFormData.append("kind", "cover");

  const spoofUploadRes = await fetch(`${BASE_URL}/api/admin/media`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
      Origin: BASE_URL
    },
    body: fakeFormData
  });
  assert.equal(
    spoofUploadRes.status,
    400,
    `Expected 400 for spoofed image magic bytes, got ${spoofUploadRes.status}`
  );
  report.securityAndSeoChecks.magicByteSignatureEnforcementVerified = true;

  console.log("=== 3. SEO & Route Validation Checks ===");
  const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
  const robotsText = await robotsRes.text();
  assert.ok(robotsText.includes("Disallow: /admin"), "robots.txt must disallow /admin");
  report.securityAndSeoChecks.robotsDisallowsAdmin = true;

  const badLocaleRes = await fetch(`${BASE_URL}/unknown-invalid-route`);
  assert.equal(badLocaleRes.status, 404, "Unknown single-segment route must return 404");

  const badProjLocaleRes = await fetch(
    `${BASE_URL}/de/project/planfiq-website-web-uygulamasi`
  );
  assert.equal(badProjLocaleRes.status, 404, "Invalid locale on project route must return 404");

  const missingSlugRes = await fetch(`${BASE_URL}/tr/project/non-existent-slug-99999`);
  assert.equal(missingSlugRes.status, 404, "Non-existent project slug must return 404");
  report.securityAndSeoChecks.invalidRoutesReturn404 = true;

  const validProjRes = await fetch(`${BASE_URL}/tr/project/planfiq-website-web-uygulamasi`);
  assert.equal(validProjRes.status, 200);
  const validProjHtml = await validProjRes.text();
  assert.ok(
    validProjHtml.includes('"@type":"CreativeWork"'),
    "Project detail page must include CreativeWork JSON-LD"
  );
  report.securityAndSeoChecks.projectCreativeWorkJsonLd = true;

  console.log("=== 4. Canonical 30-Project Consistency & Video Library Separation Check ===");
  const initialPublicApi = await (await fetch(`${BASE_URL}/api/projects`)).json();
  assert.equal(initialPublicApi.count, 30, "Public /api/projects must return 30 canonical projects");

  const wsCounts = { design: 0, web: 0, "motion-ai": 0 };
  for (const p of initialPublicApi.projects) {
    wsCounts[p.workspace] = (wsCounts[p.workspace] || 0) + 1;
  }
  assert.deepEqual(wsCounts, { design: 18, web: 12, "motion-ai": 0 });
  assert.ok(
    !initialPublicApi.projects.some((p) => p.slug === "3d-product-family-render"),
    "Fabricated slug 3d-product-family-render must not exist in canonical projects"
  );

  const requiredNamedSlugs = [
    "yanarsan-yangin-website-tasarimi",
    "eigestore-website-tasarimi",
    "kagestudio-website-tasarimi",
    "deva-yangin-website-tasarimi",
    "emix-creative-website-tasarimi",
    "iuckmk-website-tasarimi",
    "engin-perde-website-optimizasyonu",
    "sanda-yachting-website-ceviri-calismasi",
    "ceylanlar-site-yonetimi-website-tasarimi",
    "alchemia-subat-2025-dergi-tasarimi",
    "kmz-2025",
    "fling-arena",
    "kagestudio-marka-kimligi",
    "eigestore-marka-kimligi",
    "hizir-yangin-marka-kimligi",
    "emix-qr-menu",
    "planfiq-logo-tasarimi",
    "ceylanlar-site-yonetimi-marka-kimligi",
    "deva-yangin-marka-kimligi",
    "goobzy-logo-tasarimi",
    "yanarsan-yangin-logo-tasarimi",
    "emix-creative-logo-tasarimi",
    "kixogames-logo-tasarimi",
    "kiyris-games-logo-tasarimi",
    "alchemia-ocak-2025-dergi-tasarimi",
    "alchemia-aralik-2024-dergi-tasarimi",
    "alchemia-kasim-2024-dergi-tasarimi",
    "alchemia-nisan-2025-dergi-tasarimi",
    "planfiq-website-web-uygulamasi",
    "solo-leveling-manga-website"
  ];
  for (const slug of requiredNamedSlugs) {
    const found = initialPublicApi.projects.find((p) => p.slug === slug);
    assert.ok(found, `Required canonical project ${slug} must exist in /api/projects`);
  }

  // Verify every single one of the 30 canonical projects returns HTTP 200 on both /tr/project/[slug] and /en/project/[slug]
  for (const proj of initialPublicApi.projects) {
    const [trR, enR] = await Promise.all([
      fetch(`${BASE_URL}/tr/project/${proj.slug}`),
      fetch(`${BASE_URL}/en/project/${proj.slug}`)
    ]);
    assert.equal(trR.status, 200, `/tr/project/${proj.slug} returned ${trR.status}`);
    assert.equal(enR.status, 200, `/en/project/${proj.slug} returned ${enR.status}`);
  }
  report.canonical30ProjectsCheck = {
    totalPublished: 30,
    workspaceDistribution: wsCounts,
    all30TrAndEnRoutesReturn200: true,
    namedProjectsVerified: requiredNamedSlugs.length
  };

  console.log("=== 5. No-Deploy Publishing Test Through Real Worker Route (cms-publish-test) ===");
  const adminHeaders = {
    Cookie: cookieHeader,
    "x-csrf-token": csrfToken,
    Origin: BASE_URL
  };
  report.cmsPublishTestSteps.step1_adminAuth = "PASSED";

  // Clean up any leftover cms-publish-test before starting
  await fetch(`${BASE_URL}/api/admin/projects/cms-publish-test`, {
    method: "DELETE",
    headers: adminHeaders
  });

  // Step 2: Upload R2 cover image for cms-publish-test (stored in Worker R2 PORTFOLIO_MEDIA)
  const formData = new FormData();
  const fileBlob = new Blob([TINY_WEBP_BUFFER], { type: "image/webp" });
  formData.append("file", fileBlob, "cms-test-cover.webp");
  formData.append("projectSlug", "cms-publish-test");
  formData.append("kind", "cover");
  formData.append("altTR", "CMS Test Kapak Görseli");
  formData.append("altEN", "CMS Test Cover Image");

  const uploadRes = await fetch(`${BASE_URL}/api/admin/media`, {
    method: "POST",
    headers: adminHeaders,
    body: formData
  });
  assert.equal(uploadRes.status, 201, "R2 media upload through Worker must return 201");
  const uploadJson = await uploadRes.json();
  const uploadedMediaUrl = uploadJson.media.publicUrl;
  const uploadedMediaId = uploadJson.media.id;
  assert.ok(uploadedMediaUrl.startsWith("/api/media/projects/cms-publish-test/cover/"));

  // Verify admin-authenticated R2 media endpoint proxies from Worker R2
  const mediaFetchRes = await fetch(`${BASE_URL}${uploadedMediaUrl}`, {
    headers: { Cookie: cookieHeader }
  });
  assert.equal(mediaFetchRes.status, 200, "Uploaded R2 media URL must return HTTP 200 for admin");
  assert.equal(mediaFetchRes.headers.get("content-type"), "image/webp");
  report.cmsPublishTestSteps.step2_r2MediaUploadViaWorker = {
    status: "PASSED",
    publicUrl: uploadedMediaUrl
  };

  // Step 3: Create cms-publish-test as DRAFT via Worker D1
  const createDraftRes = await fetch(`${BASE_URL}/api/admin/projects`, {
    method: "POST",
    headers: {
      ...adminHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: "cms-publish-test",
      slug: "cms-publish-test",
      cmsStatus: "draft",
      workspace: "web",
      featured: true,
      client: "Portfolio OS Verification",
      year: "2026",
      liveUrl: "https://keremmihci.com",
      cover: uploadedMediaUrl,
      thumbnail: uploadedMediaUrl,
      desktopIcon: uploadedMediaUrl,
      titleTR: "CMS Yayın Testi Projesi",
      titleEN: "CMS Publish Test Project",
      categoryTR: "Web Uygulaması & CMS",
      categoryEN: "Web Application & CMS",
      summaryTR: "Yeniden derleme gerektirmeden yayınlanan dinamik CMS test projesi.",
      summaryEN: "Dynamic CMS test project published without rebuild or redeploy.",
      descriptionTR: "Bu proje Cloudflare Worker D1 ve R2 altyapısını doğrulamak için oluşturulmuştur.",
      descriptionEN: "This project was created to verify the Cloudflare Worker D1 and R2 CMS pipeline.",
      media: [
        {
          type: "image",
          src: uploadedMediaUrl,
          altTR: "CMS Test Görseli",
          altEN: "CMS Test Image"
        }
      ]
    })
  });
  if (createDraftRes.status !== 201) {
    console.error("Draft creation response body:", await createDraftRes.clone().text());
  }
  assert.equal(createDraftRes.status, 201, "Draft creation must return 201");
  report.cmsPublishTestSteps.step3_createDraftInWorkerD1 = "PASSED";

  // Step 4: Verify DRAFT is NOT publicly visible on /tr/project/cms-publish-test, /en/project/cms-publish-test, /api/projects, /sitemap.xml, OR public /api/media/...
  const draftTrRes = await fetch(`${BASE_URL}/tr/project/cms-publish-test`);
  const draftEnRes = await fetch(`${BASE_URL}/en/project/cms-publish-test`);
  assert.equal(draftTrRes.status, 404, "Draft project must return 404 on public /tr route");
  assert.equal(draftEnRes.status, 404, "Draft project must return 404 on public /en route");

  const draftPublicMediaRes = await fetch(`${BASE_URL}${uploadedMediaUrl}`);
  assert.equal(
    draftPublicMediaRes.status,
    404,
    "Unpublished draft project media must NOT be publicly accessible before publish (expected 404)"
  );
  const draftAdminMediaRes = await fetch(`${BASE_URL}${uploadedMediaUrl}`, {
    headers: { Cookie: cookieHeader }
  });
  assert.equal(
    draftAdminMediaRes.status,
    200,
    "Admin-authenticated preview must be able to fetch draft project media (expected 200)"
  );

  const draftSitemapText = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
  assert.ok(
    !draftSitemapText.includes("cms-publish-test"),
    "Draft project must NOT appear in /sitemap.xml"
  );
  const draftPublicApi = await (await fetch(`${BASE_URL}/api/projects`)).json();
  assert.ok(
    !draftPublicApi.projects.some((p) => p.slug === "cms-publish-test"),
    "Draft project must NOT appear in public /api/projects"
  );
  report.cmsPublishTestSteps.step4_draftIsolationVerified = "PASSED";

  // Step 5: Verify Admin Preview route works while in DRAFT status
  const previewRes = await fetch(
    `${BASE_URL}/admin/preview/cms-publish-test?locale=tr`,
    { headers: { Cookie: cookieHeader } }
  );
  assert.equal(previewRes.status, 200, "Admin preview of draft must return 200");
  const previewHtml = await previewRes.text();
  assert.ok(
    previewHtml.includes("CMS Yayın Testi Projesi"),
    "Admin preview must render draft Turkish title"
  );
  report.cmsPublishTestSteps.step5_adminDraftPreview = "PASSED";

  // Step 6: Publish cms-publish-test WITHOUT rebuilding or restarting Next.js
  const publishRes = await fetch(`${BASE_URL}/api/admin/projects/cms-publish-test`, {
    method: "PATCH",
    headers: {
      ...adminHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ cmsStatus: "published", notes: "E2E no-deploy publish test" })
  });
  assert.equal(publishRes.status, 200, "Publishing project must return 200");
  report.cmsPublishTestSteps.step6_publishWithoutRebuild = "PASSED";

  // Step 7: Verify /tr/project/cms-publish-test, /en/project/cms-publish-test, and public /api/media/... immediately return 200
  const pubTrRes = await fetch(`${BASE_URL}/tr/project/cms-publish-test`);
  const pubEnRes = await fetch(`${BASE_URL}/en/project/cms-publish-test`);
  assert.equal(pubTrRes.status, 200, "Published project must return 200 on /tr/project/cms-publish-test");
  assert.equal(pubEnRes.status, 200, "Published project must return 200 on /en/project/cms-publish-test");

  const pubMediaRes = await fetch(`${BASE_URL}${uploadedMediaUrl}`);
  assert.equal(
    pubMediaRes.status,
    200,
    "Published project media must immediately return 200 on public /api/media/... route"
  );

  const pubTrHtml = await pubTrRes.text();
  const pubEnHtml = await pubEnRes.text();
  assert.ok(pubTrHtml.includes("CMS Yayın Testi Projesi"), "TR page must contain TR title");
  assert.ok(pubEnHtml.includes("CMS Publish Test Project"), "EN page must contain EN title");
  report.cmsPublishTestSteps.step7_publicRoutesLiveImmediately = "PASSED";

  // Step 8: Verify /sitemap.xml and /api/projects immediately include cms-publish-test
  const pubSitemapText = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
  assert.ok(
    pubSitemapText.includes("/tr/project/cms-publish-test") &&
      pubSitemapText.includes("/en/project/cms-publish-test"),
    "Published project must immediately appear in /sitemap.xml"
  );
  const pubApiJson = await (await fetch(`${BASE_URL}/api/projects`)).json();
  assert.ok(
    pubApiJson.projects.some((p) => p.slug === "cms-publish-test"),
    "Published project must immediately appear in /api/projects"
  );
  report.cmsPublishTestSteps.step8_sitemapAndPublicApiUpdated = "PASSED";

  // Step 9: Edit cms-publish-test and verify live update + revision history
  const editRes = await fetch(`${BASE_URL}/api/admin/projects/cms-publish-test`, {
    method: "PUT",
    headers: {
      ...adminHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: "cms-publish-test",
      slug: "cms-publish-test",
      cmsStatus: "published",
      workspace: "web",
      featured: true,
      client: "Portfolio OS Verification",
      year: "2026",
      cover: uploadedMediaUrl,
      thumbnail: uploadedMediaUrl,
      desktopIcon: uploadedMediaUrl,
      titleTR: "CMS Yayın Testi Projesi (Güncellendi)",
      titleEN: "CMS Publish Test Project (Updated)",
      categoryTR: "Web Uygulaması & CMS",
      categoryEN: "Web Application & CMS",
      descriptionTR: "Güncellenmiş açıklama metni.",
      descriptionEN: "Updated description text.",
      media: [
        {
          type: "image",
          src: uploadedMediaUrl,
          altTR: "CMS Test Görseli",
          altEN: "CMS Test Image"
        }
      ]
    })
  });
  assert.equal(editRes.status, 200);
  const editData = await editRes.json();
  assert.ok(editData.revisions.length >= 2, "Project must record revision snapshots");

  const updatedEnHtml = await (await fetch(`${BASE_URL}/en/project/cms-publish-test`)).text();
  assert.ok(
    updatedEnHtml.includes("CMS Publish Test Project (Updated)"),
    "Public EN page must immediately reflect updated title without rebuild"
  );
  report.cmsPublishTestSteps.step9_liveEditAndRevisionHistory = "PASSED";

  console.log("=== 6. Headless Browser E2E, Responsive Public & Responsive Admin QA ===");
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem(
          "km_intro_seen_at",
          JSON.stringify({ timestamp: Date.now() })
        );
      } catch {
        // ignore
      }
    });

    const page = await context.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    // Verify /en/project/cms-publish-test opens in browser
    await page.goto(`${BASE_URL}/en/project/cms-publish-test`, { waitUntil: "networkidle" });
    const bodyText = await page.locator("body").innerText();
    assert.ok(
      bodyText.includes("CMS Publish Test Project (Updated)"),
      "Browser must render newly published CMS project window on /en/project/cms-publish-test"
    );

    // Step 11: Unpublish cms-publish-test and verify immediate 404
    const unpubRes = await fetch(`${BASE_URL}/api/admin/projects/cms-publish-test`, {
      method: "PATCH",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cmsStatus: "draft" })
    });
    assert.equal(unpubRes.status, 200);
    const afterUnpubRes = await fetch(`${BASE_URL}/tr/project/cms-publish-test`);
    assert.equal(afterUnpubRes.status, 404, "Unpublished project must immediately return 404");
    const afterUnpubEnRes = await fetch(`${BASE_URL}/en/project/cms-publish-test`);
    assert.equal(afterUnpubEnRes.status, 404, "Unpublished project must return 404 on /en route");
    const unpubSitemapText = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
    assert.ok(
      !unpubSitemapText.includes("/tr/project/cms-publish-test") &&
        !unpubSitemapText.includes("/en/project/cms-publish-test") &&
        !unpubSitemapText.includes("cms-publish-test"),
      "Unpublished project must be completely removed from /sitemap.xml (both TR and EN URLs)"
    );
    const unpubApiJson = await (await fetch(`${BASE_URL}/api/projects`)).json();
    assert.ok(
      !unpubApiJson.projects.some((p) => p.slug === "cms-publish-test"),
      "Unpublished project must be removed from /api/projects"
    );
    report.cmsPublishTestSteps.step11_unpublishImmediate404 = "PASSED";
    report.cmsPublishTestSteps.step11b_unpublishSitemapAndApiRemoval = "PASSED";

    // Step 12: Archive cms-publish-test and verify 404
    const archiveRes = await fetch(`${BASE_URL}/api/admin/projects/cms-publish-test`, {
      method: "PATCH",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cmsStatus: "archived" })
    });
    assert.equal(archiveRes.status, 200);
    const afterArchiveRes = await fetch(`${BASE_URL}/en/project/cms-publish-test`);
    assert.equal(afterArchiveRes.status, 404, "Archived project must return 404");
    report.cmsPublishTestSteps.step12_archiveVerified = "PASSED";

    // Step 13: Clean up test project & test R2 asset so Worker D1 returns to 30 canonical projects
    const delProjRes = await fetch(`${BASE_URL}/api/admin/projects/cms-publish-test`, {
      method: "DELETE",
      headers: adminHeaders
    });
    assert.equal(delProjRes.status, 200);
    const delMediaRes = await fetch(
      `${BASE_URL}/api/admin/media?id=${encodeURIComponent(uploadedMediaId)}`,
      {
        method: "DELETE",
        headers: adminHeaders
      }
    );
    assert.equal(delMediaRes.status, 200);

    const finalProjectsJson = await (await fetch(`${BASE_URL}/api/projects`)).json();
    assert.equal(
      finalProjectsJson.count,
      30,
      `Expected 30 canonical published projects after cleanup, got ${finalProjectsJson.count}`
    );
    report.cmsPublishTestSteps.step13_cleanupAndCanonical30Restored = "PASSED";

    // Verify Responsive Admin Dashboard across all 6 required viewports:
    // 390x844, 430x932, 820x1180, 1024x768, 1440x900, 1920x1080
    // Testing login screen, overview, projects list, project editor, media library, GA4/GSC
    const adminViewports = [
      { width: 390, height: 844, label: "Mobile 390x844" },
      { width: 430, height: 932, label: "Mobile Large 430x932" },
      { width: 820, height: 1180, label: "Tablet Portrait 820x1180" },
      { width: 1024, height: 768, label: "Tablet Landscape 1024x768" },
      { width: 1440, height: 900, label: "Desktop 1440x900" },
      { width: 1920, height: 1080, label: "Large Desktop 1920x1080" }
    ];

    // First test Login Gate across all 6 viewports in a fresh unauthenticated context
    const unauthAdminCtx = await browser.newContext();
    const unauthAdminPage = await unauthAdminCtx.newPage();
    for (const vp of adminViewports) {
      await unauthAdminPage.setViewportSize({ width: vp.width, height: vp.height });
      await unauthAdminPage.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
      const loginMetrics = await unauthAdminPage.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth > window.innerWidth
      }));
      assert.equal(
        loginMetrics.overflowX,
        false,
        `Admin Login overflowX at ${vp.label}: scrollWidth=${loginMetrics.scrollWidth} > innerWidth=${loginMetrics.innerWidth}`
      );
    }
    // Sign in via admin-email-input + admin-password-login-btn
    await unauthAdminPage.setViewportSize({ width: 1440, height: 900 });
    await unauthAdminPage.getByTestId("admin-email-input").fill("kerem@keremmihci.com");
    await unauthAdminPage.getByTestId("admin-password-input").fill(masterPassword);
    await unauthAdminPage.getByTestId("admin-password-login-btn").click();
    await unauthAdminPage.waitForSelector('[data-testid="admin-overview-section"]', {
      timeout: 10000
    });

    // Verify Google Analytics, Search Console, and Traffic tabs are deferred / absent from navigation
    const ga4Tab = await unauthAdminPage.$('[data-testid="admin-tab-ga4"]');
    assert.equal(ga4Tab, null, "admin-tab-ga4 must not be rendered when Google UI is deferred");
    const gscTab = await unauthAdminPage.$('[data-testid="admin-tab-gsc"]');
    assert.equal(gscTab, null, "admin-tab-gsc must not be rendered when Google UI is deferred");
    const trafficTab = await unauthAdminPage.$('[data-testid="admin-tab-project-traffic"]');
    assert.equal(trafficTab, null, "admin-tab-project-traffic must not be rendered when Google UI is deferred");

    // Now test Overview, Projects Table, Project Editor, Media Library, Featured Manager, and System Status at each of the 6 viewports
    for (const vp of adminViewports) {
      await unauthAdminPage.setViewportSize({ width: vp.width, height: vp.height });
      const sectionResults = {};

      for (const tabId of ["overview", "projects", "editor", "media", "featured", "system"]) {
        await unauthAdminPage.getByTestId(`admin-tab-${tabId}`).click();
        await unauthAdminPage.waitForSelector(`[data-testid="admin-${tabId}-section"]`, {
          timeout: 5000
        });
        const m = await unauthAdminPage.evaluate(() => ({
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflowX: document.documentElement.scrollWidth > window.innerWidth
        }));
        assert.equal(
          m.overflowX,
          false,
          `Admin ${tabId} overflowX at ${vp.label}: scrollWidth=${m.scrollWidth} > innerWidth=${m.innerWidth}`
        );
        sectionResults[tabId] = "PASS (overflowX: false)";
      }

      report.adminResponsiveViewports.push({
        ...vp,
        loginScreen: "PASS (overflowX: false)",
        sections: sectionResults,
        passed: true
      });
    }
    await unauthAdminCtx.close();
    report.cmsPublishTestSteps.step10_browserDeepLinkAndAdminUiVerified = "PASSED";

    // Public Portfolio OS Responsive Viewport Matrix
    const publicViewports = [
      { width: 375, height: 812, label: "iPhone Mini (375x812)" },
      { width: 390, height: 844, label: "iPhone Standard (390x844)" },
      { width: 430, height: 932, label: "iPhone Pro Max (430x932)" },
      { width: 768, height: 1024, label: "Tablet Portrait (768x1024)" },
      { width: 820, height: 1180, label: "iPad Air (820x1180)" },
      { width: 1024, height: 768, label: "Tablet Landscape (1024x768)" },
      { width: 1280, height: 800, label: "Laptop (1280x800)" },
      { width: 1440, height: 900, label: "Desktop (1440x900)" },
      { width: 1920, height: 1080, label: "Large Desktop (1920x1080)" }
    ];

    const vpPage = await context.newPage();
    for (const vp of publicViewports) {
      await vpPage.setViewportSize({ width: vp.width, height: vp.height });
      await vpPage.goto(`${BASE_URL}/tr`, { waitUntil: "networkidle" });
      const metrics = await vpPage.evaluate(() => {
        return {
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflowX: document.documentElement.scrollWidth > window.innerWidth
        };
      });
      assert.equal(
        metrics.overflowX,
        false,
        `Public horizontal overflow at ${vp.label}: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`
      );
      report.publicResponsiveViewports.push({
        ...vp,
        overflowX: metrics.overflowX,
        passed: true
      });
    }

    assert.equal(consoleErrors.length, 0, `Unexpected page errors: ${consoleErrors.join(", ")}`);
    await context.close();
  } finally {
    await browser.close();
  }

  report.allPassed = true;
  report.completedAt = new Date().toISOString();
  fs.mkdirSync(path.join(process.cwd(), ".local-d1"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), ".local-d1", "verification-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  console.log(JSON.stringify(report, null, 2));
}

runVerification().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
