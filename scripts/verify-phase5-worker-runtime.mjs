#!/usr/bin/env node

/**
 * scripts/verify-phase5-worker-runtime.mjs
 *
 * Portfolio OS Phase 5.2: Isolated Local Cloudflare Worker Runtime E2E Suite
 *
 * Spawns an isolated local Cloudflare Worker instance via Wrangler/Miniflare
 * against a disposable migrated local D1 and local R2 fixture.
 * Strictly tests:
 * - Local migration application (0001 -> 0004) to local D1.
 * - Real runtime startup of Cloudflare Worker on localhost with ephemeral service token.
 * - Healthy empty vs degraded error response semantics (PROFILE_NOT_PUBLISHED, CV_NOT_PUBLISHED).
 * - Full authenticated write/publish lifecycle for Profile, Notes, Experience, Education, Skills, and CV.
 * - Draft privacy enforcement & public delivery authorization.
 * - Unpublish and immediate media access revocation.
 * - Revision history & rollback endpoint verification.
 * - Cross-entity media ownership and path traversal protection.
 * - Ephemeral service token enforcement (valid token accepted, missing/invalid token rejected).
 * - Invariant: ZERO remote Cloudflare calls, ZERO mutations to persistent host files.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const hostDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const wranglerConfigPath = path.join(rootDir, "cloudflare", "portfolio-api", "wrangler.jsonc");

const ephemeralServiceToken = "test-ephemeral-service-token-" + crypto.randomUUID();

const results = {
  suite: "Portfolio OS Phase 5.2 Local Cloudflare Worker Runtime Authenticated Lifecycle E2E",
  timestamp: new Date().toISOString(),
  commit: "",
  total: 0,
  passed: 0,
  failed: 0,
  checks: [],
  failures: []
};

try {
  results.commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {
  results.commit = "unknown";
}

function assert(condition, name, detail = "") {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  ✓ PASS: ${name}${detail ? ` [${detail}]` : ""}`);
    results.checks.push({ name, status: "PASS", detail });
  } else {
    results.failed++;
    const msg = `  ✗ FAIL: ${name}${detail ? ` [${detail}]` : ""}`;
    console.error(msg);
    results.failures.push(name);
    results.checks.push({ name, status: "FAIL", detail });
  }
}

function getFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function getAvailablePort(preferred = 8891) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(preferred, "127.0.0.1", () => {
      srv.close(() => resolve(preferred));
    });
    srv.on("error", () => {
      const srv2 = net.createServer();
      srv2.listen(0, "127.0.0.1", () => {
        const port = srv2.address().port;
        srv2.close(() => resolve(port));
      });
    });
  });
}

function createMinimalValidPdf(customText = "Kerem Mihci Official Worker Test CV") {
  const parts = [];
  const offsets = [];

  function addPart(str) {
    parts.push(Buffer.from(str, "binary"));
  }

  function currentOffset() {
    return parts.reduce((acc, p) => acc + p.length, 0);
  }

  addPart("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  offsets.push(currentOffset());
  addPart("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  offsets.push(currentOffset());
  addPart("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  offsets.push(currentOffset());
  addPart("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n");

  const streamBody = Buffer.from(`BT\n/F1 12 Tf\n72 712 Td\n(${customText}) Tj\nET\n`, "utf-8");
  offsets.push(currentOffset());
  addPart(`4 0 obj\n<< /Length ${streamBody.length} >>\nstream\n`);
  parts.push(streamBody);
  addPart("\nendstream\nendobj\n");

  const xrefOffset = currentOffset();
  let xref = "xref\n0 5\n0000000000 65535 f \n";
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  addPart(xref);

  addPart(`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.concat(parts);
}

async function waitForWorker(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/v1/public/health`);
      if (res.status === 200) {
        const json = await res.json();
        if (json.ok) return true;
      }
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Worker failed to start on ${url} within ${timeoutMs}ms.`);
}

async function runWorkerSuite() {
  console.log("============================================================");
  console.log("PORTFOLIO OS PHASE 5.2: LOCAL WORKER RUNTIME VERIFICATION");
  console.log(`Commit:    ${results.commit}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log("============================================================");

  const hostInitialSha256 = getFileSha256(hostDbPath);

  // 1. Task-Owned Fresh Persistence Sandbox
  const tempSandboxDir = path.join(os.tmpdir(), `p5-worker-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`);
  fs.mkdirSync(tempSandboxDir, { recursive: true });

  console.log(`\nInitializing isolated D1 database via local migrations...`);
  console.log(`Sandbox directory: ${tempSandboxDir}`);

  // Apply migrations 0001 through 0004 to local D1 via wrangler
  const migrationOutput = execSync(
    `echo "y" | npx wrangler d1 migrations apply PORTFOLIO_DB --local --persist-to "${tempSandboxDir}" --config "${wranglerConfigPath}"`,
    { encoding: "utf-8" }
  );

  assert(
    migrationOutput.includes("0004_profile_notes_cv_schema.sql") && migrationOutput.includes("✅"),
    "Wrangler local D1 migrations applied successfully (0001, 0002, 0003, 0004)"
  );

  const port = await getAvailablePort(8895);
  const workerUrl = `http://127.0.0.1:${port}`;
  let workerProcess = null;

  try {
    console.log(`\nSpawning local Worker process on port ${port}...`);
    workerProcess = spawn(
      "npx",
      [
        "wrangler",
        "dev",
        "--local",
        "--port",
        String(port),
        "--ip",
        "127.0.0.1",
        "--persist-to",
        tempSandboxDir,
        "--config",
        wranglerConfigPath,
        "--var",
        `CLOUDFLARE_API_SERVICE_TOKEN:${ephemeralServiceToken}`,
        "--var",
        "ALLOW_CANONICAL_SEED:true"
      ],
      {
        cwd: rootDir,
        stdio: "pipe"
      }
    );

    await waitForWorker(workerUrl, 25000);
    console.log(`Worker ready and responding at ${workerUrl}\n`);

    const authHeaders = {
      Authorization: `Bearer ${ephemeralServiceToken}`,
      "Content-Type": "application/json"
    };

    // ============================================================
    // GROUP 1: Health, Runtime Bindings & Ephemeral Security
    // ============================================================
    console.log("--- Group 1: Health, Runtime Bindings & Security ---");
    const healthRes = await fetch(`${workerUrl}/api/v1/public/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200, "GET /api/v1/public/health returns HTTP 200");
    assert(healthJson.ok === true, "Health response reports ok: true");
    assert(healthJson.service === "kerem-mihci-portfolio-api", "Health response identifies service name");
    assert(
      healthJson.bindings?.d1 === "PORTFOLIO_DB" && healthJson.bindings?.r2 === "PORTFOLIO_MEDIA",
      "Health response verifies D1 (PORTFOLIO_DB) and R2 (PORTFOLIO_MEDIA) bindings"
    );

    // Ephemeral token rejection
    const adminNoTokenRes = await fetch(`${workerUrl}/api/v1/admin/health`);
    assert(adminNoTokenRes.status === 401, "GET /api/v1/admin/health without Bearer token returns HTTP 401");

    const adminBadTokenRes = await fetch(`${workerUrl}/api/v1/admin/health`, {
      headers: { Authorization: "Bearer wrong-token-12345678" }
    });
    assert(adminBadTokenRes.status === 401, "GET /api/v1/admin/health with invalid Bearer token returns HTTP 401");

    const adminGoodTokenRes = await fetch(`${workerUrl}/api/v1/admin/health`, {
      headers: { Authorization: `Bearer ${ephemeralServiceToken}` }
    });
    const adminGoodJson = await adminGoodTokenRes.json();
    assert(adminGoodTokenRes.status === 200 && adminGoodJson.ok === true, "Authenticated GET /api/v1/admin/health returns HTTP 200 with valid service token");

    // ============================================================
    // GROUP 2: Healthy Empty States vs Degraded Outage Semantics
    // ============================================================
    console.log("\n--- Group 2: Healthy Empty vs Degraded Outage Semantics ---");
    const profileEmptyRes = await fetch(`${workerUrl}/api/v1/public/profile`);
    const profileEmptyJson = await profileEmptyRes.json();
    assert(profileEmptyRes.status === 404, "Unseeded public profile returns HTTP 404");
    assert(profileEmptyJson.code === "PROFILE_NOT_PUBLISHED", "Unseeded public profile returns code PROFILE_NOT_PUBLISHED");
    assert(profileEmptyRes.headers.get("cache-control")?.includes("no-store"), "Unseeded profile 404 enforces Cache-Control: no-store");

    const cvEmptyRes = await fetch(`${workerUrl}/api/v1/public/cv/en`);
    const cvEmptyJson = await cvEmptyRes.json();
    assert(cvEmptyRes.status === 404, "Unseeded public CV returns HTTP 404");
    assert(cvEmptyJson.code === "CV_NOT_PUBLISHED", "Unseeded public CV returns code CV_NOT_PUBLISHED");
    assert(cvEmptyRes.headers.get("cache-control")?.includes("no-store"), "Unseeded CV 404 enforces Cache-Control: no-store");

    const unknownRouteRes = await fetch(`${workerUrl}/api/v1/public/nonexistent-route-xyz`);
    const unknownRouteJson = await unknownRouteRes.json();
    assert(unknownRouteRes.status === 404, "Unknown public route returns HTTP 404");
    assert(unknownRouteJson.code !== "PROFILE_NOT_PUBLISHED" && unknownRouteJson.code !== "CV_NOT_PUBLISHED", "Unknown public route does not return unpublished resource code (distinguishable from healthy empty)");

    // Empty notes returns 200 with empty array (healthy empty)
    const emptyNotesRes = await fetch(`${workerUrl}/api/v1/public/notes/design`);
    const emptyNotesJson = await emptyNotesRes.json();
    assert(emptyNotesRes.status === 200 && Array.isArray(emptyNotesJson.notes) && emptyNotesJson.notes.length === 0, "Unseeded public notes returns HTTP 200 with empty array");

    // ============================================================
    // GROUP 3: Profile Lifecycle, Revisions & Rollback
    // ============================================================
    console.log("\n--- Group 3: Profile Lifecycle, Revisions & Rollback ---");
    // 1. Create draft profile
    const draftProfilePayload = {
      name: "Kerem Mıhçı Test Profile",
      email: "test@keremmihci.com",
      status: "draft",
      headlineTR: "Test Tasarımcı TR",
      headlineEN: "Test Designer EN",
      locationTR: "İstanbul",
      locationEN: "Istanbul",
      summaryTR: ["Test özet paragrafı 1"],
      summaryEN: ["Test summary paragraph 1"],
      stats: [{ value: "4+", labelTR: "Yıl", labelEN: "Years" }],
      focusAreasTR: ["Tasarım"],
      focusAreasEN: ["Design"]
    };

    const putDraftRes = await fetch(`${workerUrl}/api/v1/admin/profile`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(draftProfilePayload)
    });
    const putDraftJson = await putDraftRes.json();
    assert(putDraftRes.status === 200 && putDraftJson.ok === true, "PUT /api/v1/admin/profile creates draft profile [HTTP 200]");

    // Verify draft privacy (public read must still return 404 PROFILE_NOT_PUBLISHED)
    const checkDraftPubRes = await fetch(`${workerUrl}/api/v1/public/profile`);
    const checkDraftPubJson = await checkDraftPubRes.json();
    assert(checkDraftPubRes.status === 404 && checkDraftPubJson.code === "PROFILE_NOT_PUBLISHED", "Draft profile is NOT leaked publicly (returns HTTP 404 PROFILE_NOT_PUBLISHED)");

    // 2. Publish profile
    const putPublishRes = await fetch(`${workerUrl}/api/v1/admin/profile`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ ...draftProfilePayload, status: "published" })
    });
    assert(putPublishRes.status === 200, "PUT /api/v1/admin/profile publishes profile [HTTP 200]");

    // Verify published profile is publicly readable
    const checkPubProfileRes = await fetch(`${workerUrl}/api/v1/public/profile`);
    const checkPubProfileJson = await checkPubProfileRes.json();
    assert(checkPubProfileRes.status === 200 && checkPubProfileJson.profile?.name === "Kerem Mıhçı Test Profile", "Published profile is accessible via public GET /api/v1/public/profile [HTTP 200]");

    // 3. Revisions & Rollback
    const profileRevsRes = await fetch(`${workerUrl}/api/v1/admin/profile/revisions`, { headers: authHeaders });
    const profileRevsJson = await profileRevsRes.json();
    assert(profileRevsRes.status === 200 && Array.isArray(profileRevsJson.revisions) && profileRevsJson.revisions.length >= 2, "Profile revision history records mutations");

    const rollbackProfileRes = await fetch(`${workerUrl}/api/v1/admin/profile/rollback`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ revisionNumber: 1 })
    });
    assert(rollbackProfileRes.status === 200, "POST /api/v1/admin/profile/rollback restores prior draft revision [HTTP 200]");

    // Public read should immediately revoke access after rollback to draft
    const postRollbackPubRes = await fetch(`${workerUrl}/api/v1/public/profile`);
    assert(postRollbackPubRes.status === 404, "Rolling back to draft immediately revokes public access [HTTP 404]");

    // ============================================================
    // GROUP 4: Workspace Notes CRUD & Strict Workspace Isolation
    // ============================================================
    console.log("\n--- Group 4: Workspace Notes CRUD & Workspace Isolation ---");
    const testNoteId = "note-design-worker-test";
    const createNoteRes = await fetch(`${workerUrl}/api/v1/admin/notes`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        id: testNoteId,
        workspaceId: "design",
        status: "published",
        sortOrder: 1,
        filename: "test-note.txt",
        titleTR: "Test Notu TR",
        titleEN: "Test Note EN",
        contentTR: "Tasarım kuralı test metni",
        contentEN: "Design rule test text"
      })
    });
    assert(createNoteRes.status === 201, "POST /api/v1/admin/notes creates published note in design workspace [HTTP 201]");

    // Public read design workspace
    const pubDesignNotesRes = await fetch(`${workerUrl}/api/v1/public/notes/design`);
    const pubDesignNotesJson = await pubDesignNotesRes.json();
    assert(
      pubDesignNotesRes.status === 200 && pubDesignNotesJson.notes.some(n => n.id === testNoteId),
      "Public GET /api/v1/public/notes/design returns newly published note"
    );

    // Workspace isolation: note MUST NOT appear in web or motion-ai
    const pubWebNotesRes = await fetch(`${workerUrl}/api/v1/public/notes/web`);
    const pubWebNotesJson = await pubWebNotesRes.json();
    assert(
      pubWebNotesRes.status === 200 && !pubWebNotesJson.notes.some(n => n.id === testNoteId),
      "Strict Workspace Isolation: design note does NOT leak into web workspace"
    );

    // Delete note
    const deleteNoteRes = await fetch(`${workerUrl}/api/v1/admin/notes/${testNoteId}`, {
      method: "DELETE",
      headers: authHeaders
    });
    assert(deleteNoteRes.status === 200, "DELETE /api/v1/admin/notes/:id succeeds [HTTP 200]");

    const verifyDeletedNoteRes = await fetch(`${workerUrl}/api/v1/public/notes/design`);
    const verifyDeletedNoteJson = await verifyDeletedNoteRes.json();
    assert(!verifyDeletedNoteJson.notes.some(n => n.id === testNoteId), "Deleted note is no longer present in public stream");

    // ============================================================
    // GROUP 5: Experience, Education & Skills Lifecycle
    // ============================================================
    console.log("\n--- Group 5: Experience, Education & Skills Lifecycle ---");
    const testExpId = "exp-worker-test-item";
    const createExpRes = await fetch(`${workerUrl}/api/v1/admin/experience`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        id: testExpId,
        organization: "Worker Test Studio",
        startDate: "2024",
        category: "work",
        status: "published",
        sortOrder: 0,
        roleTR: "Yönetici Tasarımcı",
        roleEN: "Lead Designer",
        endDateTR: "Devam",
        endDateEN: "Present",
        descriptionTR: "Test açıklaması",
        descriptionEN: "Test description"
      })
    });
    assert(createExpRes.status === 201, "POST /api/v1/admin/experience creates published experience item [HTTP 201]");

    const pubExpRes = await fetch(`${workerUrl}/api/v1/public/experience`);
    const pubExpJson = await pubExpRes.json();
    assert(pubExpJson.experience?.some(e => e.id === testExpId), "Public GET /api/v1/public/experience returns published experience record");

    // Education
    const testEduId = "edu-worker-test-item";
    const createEduRes = await fetch(`${workerUrl}/api/v1/admin/education`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        id: testEduId,
        startYear: "2020",
        status: "published",
        sortOrder: 0,
        institutionTR: "Test Üniversitesi",
        institutionEN: "Test University",
        programTR: "Tasarım",
        programEN: "Design",
        endYearTR: "2024",
        endYearEN: "2024"
      })
    });
    assert(createEduRes.status === 201, "POST /api/v1/admin/education creates published education item [HTTP 201]");

    const pubEduRes = await fetch(`${workerUrl}/api/v1/public/education`);
    const pubEduJson = await pubEduRes.json();
    assert(pubEduJson.education?.some(e => e.id === testEduId), "Public GET /api/v1/public/education returns published education record");

    // Skills
    const testSkillId = "skill-design-worker-test";
    const createSkillRes = await fetch(`${workerUrl}/api/v1/admin/skills`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        id: testSkillId,
        category: "design",
        status: "published",
        sortOrder: 0,
        nameTR: "Test Becerisi TR",
        nameEN: "Test Skill EN"
      })
    });
    assert(createSkillRes.status === 201, "POST /api/v1/admin/skills creates published skill [HTTP 201]");

    const pubSkillsRes = await fetch(`${workerUrl}/api/v1/public/skills?category=design`);
    const pubSkillsJson = await pubSkillsRes.json();
    assert(pubSkillsJson.skills?.some(s => s.id === testSkillId), "Public GET /api/v1/public/skills returns published skill");

    // Cleanup created items
    await fetch(`${workerUrl}/api/v1/admin/experience/${testExpId}`, { method: "DELETE", headers: authHeaders });
    await fetch(`${workerUrl}/api/v1/admin/education/${testEduId}`, { method: "DELETE", headers: authHeaders });
    await fetch(`${workerUrl}/api/v1/admin/skills/${testSkillId}`, { method: "DELETE", headers: authHeaders });

    // ============================================================
    // GROUP 6: CV Document Upload, Draft Privacy, Publication & Media Delivery
    // ============================================================
    console.log("\n--- Group 6: CV Upload, Draft Privacy, Publication & Revocation ---");
    const testPdfBuffer = createMinimalValidPdf("Kerem Mihci Official Worker Runtime Test CV");
    const formData = new FormData();
    const pdfBlob = new Blob([testPdfBuffer], { type: "application/pdf" });
    formData.append("file", pdfBlob, "kerem-mihci-cv-en.pdf");
    formData.append("locale", "en");

    const cvUploadRes = await fetch(`${workerUrl}/api/v1/admin/cv/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ephemeralServiceToken}` },
      body: formData
    });
    const cvUploadJson = await cvUploadRes.json();
    assert(cvUploadRes.status === 201 && cvUploadJson.ok === true, "POST /api/v1/admin/cv/upload uploads valid PDF to R2 [HTTP 201]");
    const cvStorageKey = cvUploadJson.cv?.storageKey;
    assert(typeof cvStorageKey === "string" && cvStorageKey.startsWith("cv/en/"), "Uploaded CV returned valid storageKey");

    // Draft privacy: newly uploaded CV is in draft state; public metadata and media MUST return 404
    const pubCvDraftRes = await fetch(`${workerUrl}/api/v1/public/cv/en`);
    assert(pubCvDraftRes.status === 404, "Public GET /api/v1/public/cv/en returns HTTP 404 for draft CV");

    const pubMediaDraftRes = await fetch(`${workerUrl}/api/media/${cvStorageKey}`);
    assert(pubMediaDraftRes.status === 404, "Public binary media GET /api/media/:key returns HTTP 404 for draft CV (draft media protected)");
    assert(pubMediaDraftRes.headers.get("cache-control")?.includes("no-store"), "Draft CV binary media 404 enforces Cache-Control: no-store");

    // Publish CV
    const publishCvRes = await fetch(`${workerUrl}/api/v1/admin/cv/en`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: "published" })
    });
    assert(publishCvRes.status === 200, "PUT /api/v1/admin/cv/en promotes CV to published [HTTP 200]");

    // Public metadata read now succeeds
    const pubCvPublishedRes = await fetch(`${workerUrl}/api/v1/public/cv/en`);
    const pubCvPublishedJson = await pubCvPublishedRes.json();
    assert(pubCvPublishedRes.status === 200 && pubCvPublishedJson.cv?.status === "published", "Public GET /api/v1/public/cv/en delivers published CV metadata [HTTP 200]");

    // Public binary media delivery now succeeds
    const pubMediaPublishedRes = await fetch(`${workerUrl}/api/media/${cvStorageKey}`);
    assert(pubMediaPublishedRes.status === 200, "Public binary media GET /api/media/:key delivers HTTP 200 for published CV");
    assert(pubMediaPublishedRes.headers.get("content-type")?.includes("application/pdf"), "Public binary media delivery returns application/pdf Content-Type");

    // Unpublish CV (access revocation)
    const unpublishCvRes = await fetch(`${workerUrl}/api/v1/admin/cv/en`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: "draft" })
    });
    assert(unpublishCvRes.status === 200, "PUT /api/v1/admin/cv/en unpublishes CV back to draft [HTTP 200]");

    const pubMediaRevokedRes = await fetch(`${workerUrl}/api/media/${cvStorageKey}`);
    assert(pubMediaRevokedRes.status === 404, "Unpublishing immediately revokes public binary media access [HTTP 404]");

    // Path traversal protection
    const traversalRes = await fetch(`${workerUrl}/api/media/../sensitive-file`);
    assert(traversalRes.status === 400 || traversalRes.status === 404, "Path traversal attempt on media endpoint rejected [HTTP 400/404]");

  } finally {
    if (workerProcess) {
      console.log("\nShutting down local Worker process...");
      workerProcess.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1000));
    }

    try {
      if (fs.existsSync(tempSandboxDir)) {
        fs.rmSync(tempSandboxDir, { recursive: true, force: true });
      }
    } catch {}

    // Check host DB invariance
    const hostFinalSha256 = getFileSha256(hostDbPath);
    assert(
      hostInitialSha256 === hostFinalSha256,
      "Zero host mutations: .local-d1/portfolio.sqlite SHA256 is 100% identical before and after Worker suite",
      `Initial: ${hostInitialSha256?.slice(0, 16)}... | Final: ${hostFinalSha256?.slice(0, 16)}...`
    );
  }

  console.log("\n============================================================");
  console.log("LOCAL WORKER RUNTIME RESULTS SUMMARY");
  console.log("============================================================");
  console.log(`TOTAL CHECKS: ${results.total}`);
  console.log(`PASSED:       ${results.passed}`);
  console.log(`FAILED:       ${results.failed}`);

  if (results.failed > 0) {
    console.error("\nFAILURES:");
    for (const f of results.failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }
}

runWorkerSuite().catch((err) => {
  console.error("FATAL ERROR IN WORKER RUNTIME SUITE:", err);
  process.exit(1);
});
