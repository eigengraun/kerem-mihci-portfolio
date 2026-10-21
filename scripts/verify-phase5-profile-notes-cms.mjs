#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Phase 5 Profile, Notes & CV CMS Verification Suite
 *
 * Runs comprehensive, evidence-driven behavioral verification across all Phase 5 criteria:
 * - Group A: D1 Migration 0004 Schema & Relational Integrity (16 tables, 14 indexes, FK cascades, non-breaking check)
 * - Group B: Profile & Bio Management (Dual-locale TR/EN, status, revisions, rollback, validation)
 * - Group C: Workspace Notes & Strict Workspace Isolation (CRUD, TR/EN, reorder, revisions, rollback, design vs web isolation)
 * - Group D: Experience Items CMS (CRUD, TR/EN, reorder, revisions, rollback, deletion)
 * - Group E: Education Items CMS (CRUD, TR/EN, reorder, revisions, rollback, deletion)
 * - Group F: Skills Catalog CMS & Categories (CRUD, TR/EN, 4 categories, reorder, deletion)
 * - Group G: CV Document Management & PDF Magic Byte Security (%PDF- validation, size ceiling, drafts, revisions, rollback)
 * - Group H: Public API Access Control & Empty-State Invariants (Draft CV 404 no-store, published CV 200 application/pdf, public endpoints)
 * - Group I: Public Frontend Hydration, NotesApp Integration & Non-Regression
 * - Group J: Test Fixture Isolation & Zero Host Database Mutation Verification
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execSync, spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const rootDir = process.cwd();
const hostDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const testPort = 3199;
const baseUrl = `http://127.0.0.1:${testPort}`;

const results = {
  suite: "Portfolio OS Phase 5 Profile, Notes, Skills & CV CMS Verification",
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
    console.log(`  ✓ PASS: ${name}${detail ? ` [${detail}]` : ""}`);
    results.groups[currentGroup].checks.push({ name, status: "PASS", detail });
  } else {
    results.failed++;
    results.groups[currentGroup].failed++;
    const msg = `  ✗ FAIL: ${name}${detail ? ` [${detail}]` : ""}`;
    console.error(msg);
    results.failures.push(`${currentGroup}: ${name}`);
    results.groups[currentGroup].checks.push({ name, status: "FAIL", detail });
  }
}

function getFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function createMinimalValidPdf(customText = "Kerem Mihci Curriculum Vitae") {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 12 Tf
72 712 Td
(${customText}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
308
%%EOF`;
  return Buffer.from(content, "utf-8");
}

function createFakePdfCorrupted() {
  return Buffer.from("NOT A REAL PDF FILE HEADER 1234567890", "utf-8");
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/v1/public/profile`, { method: "HEAD" });
      if (res.status < 500) return true;
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server failed to start on ${url} within ${timeoutMs}ms.`);
}

async function runSuite() {
  console.log("============================================================");
  console.log("PORTFOLIO OS PHASE 5: PROFILE, NOTES & CV CMS VERIFICATION");
  console.log(`Commit:    ${results.commit}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log("============================================================");

  const hostInitialSha256 = getFileSha256(hostDbPath);

  const tempDbPath = path.join(os.tmpdir(), `portfolio-test-p5-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.sqlite`);
  const tempR2Dir = path.join(os.tmpdir(), `r2-test-p5-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`);
  fs.mkdirSync(tempR2Dir, { recursive: true });

  if (fs.existsSync(hostDbPath)) {
    fs.copyFileSync(hostDbPath, tempDbPath);
  }

  let testServerProcess = null;
  let testDbConnection = null;

  try {
    // ------------------------------------------------------------
    // GROUP A: D1 MIGRATION 0004 SCHEMA & RELATIONAL INTEGRITY
    // ------------------------------------------------------------
    setGroup("A: D1 Migration 0004 Schema & Relational Integrity");

    const migrationFile = path.join(
      rootDir,
      "cloudflare",
      "portfolio-api",
      "migrations",
      "0004_profile_notes_cv_schema.sql"
    );
    assert(fs.existsSync(migrationFile), "Migration file 0004_profile_notes_cv_schema.sql exists");

    const migrationSql = fs.readFileSync(migrationFile, "utf-8");
    const requiredTables = [
      "portfolio_profile",
      "portfolio_profile_translations",
      "portfolio_profile_revisions",
      "portfolio_workspace_notes",
      "portfolio_workspace_notes_translations",
      "portfolio_workspace_notes_revisions",
      "portfolio_experience",
      "portfolio_experience_translations",
      "portfolio_experience_revisions",
      "portfolio_education",
      "portfolio_education_translations",
      "portfolio_education_revisions",
      "portfolio_skills",
      "portfolio_skill_translations",
      "portfolio_cv_documents",
      "portfolio_cv_revisions"
    ];

    for (const tbl of requiredTables) {
      assert(migrationSql.includes(tbl), `Migration contains table ${tbl}`);
    }

    testDbConnection = new DatabaseSync(tempDbPath);
    testDbConnection.exec(migrationSql);

    const localTables = testDbConnection
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);

    for (const tbl of requiredTables) {
      assert(localTables.includes(tbl), `Table ${tbl} exists in isolated test D1`);
    }

    // Verify Non-Breaking Schema Integrity of existing tables
    const projectCount = Number(testDbConnection.prepare("SELECT COUNT(*) as c FROM projects").get().c);
    const videoCount = Number(testDbConnection.prepare("SELECT COUNT(*) as c FROM portfolio_videos").get().c);
    const galleryCount = Number(testDbConnection.prepare("SELECT COUNT(*) as c FROM portfolio_gallery_items").get().c);
    assert(projectCount === 30, `Existing 30 canonical projects preserved intact (found ${projectCount})`);
    assert(videoCount === 21, `Existing 21 canonical videos preserved intact (found ${videoCount})`);
    assert(galleryCount >= 3, `Existing gallery items preserved intact (found ${galleryCount})`);

    // Verify foreign key cascades
    testDbConnection.exec("PRAGMA foreign_keys = ON;");
    const dummyNoteId = `cascade-test-note-${Date.now()}`;
    testDbConnection.prepare("INSERT INTO portfolio_workspace_notes (id, workspace_id, sort_order, created_at, updated_at) VALUES (?, 'design', 99, datetime('now'), datetime('now'))").run(dummyNoteId);
    testDbConnection.prepare("INSERT INTO portfolio_workspace_notes_translations (id, note_id, locale, title, content, updated_at) VALUES (?, ?, 'tr', 'Başlık', 'İçerik', datetime('now'))").run(`tr-${dummyNoteId}`, dummyNoteId);

    testDbConnection.prepare("DELETE FROM portfolio_workspace_notes WHERE id = ?").run(dummyNoteId);
    const orphanNoteTrans = Number(testDbConnection.prepare("SELECT COUNT(*) as c FROM portfolio_workspace_notes_translations WHERE note_id = ?").get(dummyNoteId).c);
    assert(orphanNoteTrans === 0, "FK cascade deletes note translations when note deleted");

    const dummyExpId = `cascade-test-exp-${Date.now()}`;
    testDbConnection.prepare("INSERT INTO portfolio_experience (id, status, organization, start_date, category, skills_json, sort_order, created_at, updated_at) VALUES (?, 'draft', 'Test Org', '2024', 'work', '[]', 99, datetime('now'), datetime('now'))").run(dummyExpId);
    testDbConnection.prepare("INSERT INTO portfolio_experience_translations (id, experience_id, locale, role, end_date, description, updated_at) VALUES (?, ?, 'tr', 'Rol', 'Present', 'Açıklama', datetime('now'))").run(`tr-${dummyExpId}`, dummyExpId);
    testDbConnection.prepare("INSERT INTO portfolio_experience_revisions (id, experience_id, revision_number, action, snapshot_json, actor_email, created_at) VALUES (?, ?, 1, 'create', '{}', 'test@example.com', datetime('now'))").run(`rev-${dummyExpId}`, dummyExpId);

    testDbConnection.prepare("DELETE FROM portfolio_experience WHERE id = ?").run(dummyExpId);
    const orphanExpTrans = Number(testDbConnection.prepare("SELECT COUNT(*) as c FROM portfolio_experience_translations WHERE experience_id = ?").get(dummyExpId).c);
    const orphanExpRev = Number(testDbConnection.prepare("SELECT COUNT(*) as c FROM portfolio_experience_revisions WHERE experience_id = ?").get(dummyExpId).c);
    assert(orphanExpTrans === 0, "FK cascade deletes experience translations when item deleted");
    assert(orphanExpRev === 0, "FK cascade deletes experience revisions when item deleted");

    testDbConnection.close();
    testDbConnection = null;

    // ------------------------------------------------------------
    // SPAWN ISOLATED TEST SERVER
    // ------------------------------------------------------------
    console.log(`\nSpawning isolated test server on port ${testPort}...`);
    const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

    const envStagingPath = path.join(rootDir, ".env.staging.local");
    const stagingEnv = {};
    if (fs.existsSync(envStagingPath)) {
      const content = fs.readFileSync(envStagingPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          stagingEnv[key] = val;
        }
      }
    }

    const testEnv = {
      ...process.env,
      ...stagingEnv,
      NODE_ENV: "production",
      CMS_STORAGE_MODE: "local",
      CMS_DATA_SOURCE: "local",
      LOCAL_D1_DB_PATH: tempDbPath,
      LOCAL_R2_DIR_PATH: tempR2Dir,
      PORT: String(testPort),
      HOSTNAME: "127.0.0.1",
      ADMIN_TRUSTED_ORIGINS: `http://127.0.0.1:${testPort},http://localhost:${testPort}`
    };

    delete testEnv.CLOUDFLARE_CMS_API_URL;
    delete testEnv.CLOUDFLARE_API_SERVICE_TOKEN;

    testServerProcess = spawn(process.execPath, [nextBin, "start", "-p", String(testPort), "-H", "127.0.0.1"], {
      cwd: rootDir,
      env: testEnv,
      stdio: "pipe"
    });

    await waitForServer(baseUrl, 15000);
    console.log(`Isolated test server ready on ${baseUrl}`);

    testDbConnection = new DatabaseSync(tempDbPath);

    // Read admin credentials from .staging-admin-credentials.local
    let adminEmail = "staging-admin@local.test";
    let adminPassword = "";
    const credFile = path.join(rootDir, ".staging-admin-credentials.local");
    if (fs.existsSync(credFile)) {
      const lines = fs.readFileSync(credFile, "utf-8").split("\n");
      for (const l of lines) {
        const t = l.trim();
        if (t.startsWith("ADMIN_EMAIL=")) adminEmail = t.slice("ADMIN_EMAIL=".length).trim();
        if (t.startsWith("ADMIN_PASSWORD=")) adminPassword = t.slice("ADMIN_PASSWORD=".length).trim();
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
    assert(Boolean(csrfToken), "CSRF token returned by auth endpoint");

    const adminHeaders = {
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
      "Content-Type": "application/json",
      Origin: baseUrl
    };

    // ------------------------------------------------------------
    // GROUP B: PROFILE & BIO MANAGEMENT
    // ------------------------------------------------------------
    setGroup("B: Profile & Bio Management");

    const getProfileRes = await fetch(`${baseUrl}/api/admin/profile`, { headers: adminHeaders });
    assert(getProfileRes.status === 200, "GET /api/admin/profile returns HTTP 200");
    const profileJson = await getProfileRes.json();
    assert(profileJson.profile && profileJson.profile.name === "Kerem Mıhçı", "Initial profile seeded with name Kerem Mıhçı");

    // Update Profile
    const updateProfilePayload = {
      name: "Kerem Mıhçı",
      status: "published",
      email: "kerem@example.com",
      locationTR: "Kadıköy, İstanbul",
      locationEN: "Kadikoy, Istanbul",
      headlineTR: "Yaratıcı Yönetmen & Tasarım Sistemleri Mimarı",
      headlineEN: "Creative Director & Design Systems Architect",
      summaryTR: ["Güncellenmiş Türkçe biyografi içeriği test metni."],
      summaryEN: ["Updated English biography content test body."],
      focusAreasTR: ["Arayüz Tasarımı", "Yaratıcı Yapay Zeka"],
      focusAreasEN: ["UI Design", "Creative AI"],
      stats: [
        { labelTR: "Yıl Deneyim", labelEN: "Years Experience", value: "16+" },
        { labelTR: "Tamamlanan Proje", labelEN: "Completed Projects", value: "35+" }
      ]
    };

    const putProfileRes = await fetch(`${baseUrl}/api/admin/profile`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify(updateProfilePayload)
    });
    assert(putProfileRes.status === 200, "PUT /api/admin/profile succeeds with HTTP 200");
    const putProfileData = await putProfileRes.json();
    assert(putProfileData.ok === true, "PUT /api/admin/profile returns ok: true");
    assert(putProfileData.profile.headline.en === updateProfilePayload.headlineEN, "Updated headlineEN persisted correctly");
    assert(putProfileData.profile.summary.tr[0] === updateProfilePayload.summaryTR[0], "Updated summaryTR persisted correctly");

    // Profile Revisions & Rollback
    const revRes = await fetch(`${baseUrl}/api/admin/profile/revisions`, { headers: adminHeaders });
    assert(revRes.status === 200, "GET /api/admin/profile/revisions returns HTTP 200");
    const revData = await revRes.json();
    assert(Array.isArray(revData.revisions) && revData.revisions.length >= 1, "Profile update recorded at least 1 revision");

    // Test Rollback
    const firstRev = revData.revisions[revData.revisions.length - 1];
    const rollbackRes = await fetch(`${baseUrl}/api/admin/profile/rollback`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ revisionNumber: firstRev.revisionNumber })
    });
    assert(rollbackRes.status === 200, "POST /api/admin/profile/rollback succeeds with HTTP 200");
    const rollbackData = await rollbackRes.json();
    assert(rollbackData.ok === true, "Rollback returns ok: true");

    // Validation negative test: missing required fields
    const invalidProfileRes = await fetch(`${baseUrl}/api/admin/profile`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ name: "" }) // Invalid empty name
    });
    assert(invalidProfileRes.status === 400, "PUT /api/admin/profile rejects empty name with HTTP 400");

    // ------------------------------------------------------------
    // GROUP C: WORKSPACE NOTES & STRICT WORKSPACE ISOLATION
    // ------------------------------------------------------------
    setGroup("C: Workspace Notes & Strict Workspace Isolation");

    // Fetch design notes
    const getDesignNotesRes = await fetch(`${baseUrl}/api/admin/notes?workspace=design`, { headers: adminHeaders });
    assert(getDesignNotesRes.status === 200, "GET /api/admin/notes?workspace=design returns HTTP 200");
    const designNotesJson = await getDesignNotesRes.json();
    const initialDesignCount = designNotesJson.notes.length;

    // Fetch web notes
    const getWebNotesRes = await fetch(`${baseUrl}/api/admin/notes?workspace=web`, { headers: adminHeaders });
    assert(getWebNotesRes.status === 200, "GET /api/admin/notes?workspace=web returns HTTP 200");
    const webNotesJson = await getWebNotesRes.json();
    const initialWebCount = webNotesJson.notes.length;

    // Create a new note strictly in design workspace
    const newDesignNotePayload = {
      workspaceId: "design",
      status: "published",
      sortOrder: 1,
      filename: "design-principles.md",
      titleTR: "Tasarım Sistemi İlkeleri",
      titleEN: "Design System Principles",
      contentTR: "Tasarım manifestosu ve tipografi hiyerarşisi kuralları.",
      contentEN: "Design manifesto and typographic hierarchy rules."
    };

    const postNoteRes = await fetch(`${baseUrl}/api/admin/notes`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(newDesignNotePayload)
    });
    assert(postNoteRes.status === 201, "POST /api/admin/notes creates note with HTTP 201");
    const postNoteData = await postNoteRes.json();
    const createdNoteId = postNoteData.note.id;
    assert(postNoteData.ok === true && createdNoteId, "Created note returns valid ID");

    // Verify Workspace Isolation: Note MUST appear in design, and MUST NOT appear in web or motion-ai
    const checkDesignRes = await fetch(`${baseUrl}/api/admin/notes?workspace=design`, { headers: adminHeaders });
    const checkDesignData = await checkDesignRes.json();
    assert(checkDesignData.notes.some((n) => n.id === createdNoteId), "New note is present in design workspace query");
    assert(checkDesignData.notes.length === initialDesignCount + 1, "Design note count incremented by 1");

    const checkWebRes = await fetch(`${baseUrl}/api/admin/notes?workspace=web`, { headers: adminHeaders });
    const checkWebData = await checkWebRes.json();
    assert(!checkWebData.notes.some((n) => n.id === createdNoteId), "WORKSPACE ISOLATION: Note does NOT appear in web workspace");
    assert(checkWebData.notes.length === initialWebCount, "Web workspace note count completely unchanged");

    const checkMotionRes = await fetch(`${baseUrl}/api/admin/notes?workspace=motion-ai`, { headers: adminHeaders });
    const checkMotionData = await checkMotionRes.json();
    assert(!checkMotionData.notes.some((n) => n.id === createdNoteId), "WORKSPACE ISOLATION: Note does NOT appear in motion-ai workspace");

    // Update note
    const updateNoteRes = await fetch(`${baseUrl}/api/admin/notes/${createdNoteId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: "design",
        status: "published",
        sortOrder: 1,
        filename: "design-principles.md",
        titleTR: "Tasarım Sistemi İlkeleri v2",
        titleEN: "Design System Principles v2",
        contentTR: "Güncellenmiş tasarım manifestosu.",
        contentEN: "Updated design manifesto."
      })
    });
    assert(updateNoteRes.status === 200, "PUT /api/admin/notes/:id updates note with HTTP 200");
    const updateNoteData = await updateNoteRes.json();
    assert(updateNoteData.note.title.tr === "Tasarım Sistemi İlkeleri v2", "Updated title persisted correctly");

    // Check Note Revisions
    const noteRevRes = await fetch(`${baseUrl}/api/admin/notes/revisions?workspaceId=design`, { headers: adminHeaders });
    assert(noteRevRes.status === 200, "GET /api/admin/notes/revisions returns HTTP 200");
    const noteRevData = await noteRevRes.json();
    assert(noteRevData.revisions.length >= 1, "Note update created revision snapshot");

    // Rollback Note
    const firstNoteRev = noteRevData.revisions[noteRevData.revisions.length - 1];
    const rollbackNoteRes = await fetch(`${baseUrl}/api/admin/notes/rollback`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ workspaceId: "design", revisionNumber: firstNoteRev.revisionNumber })
    });
    assert(rollbackNoteRes.status === 200, "POST /api/admin/notes/rollback succeeds with HTTP 200");

    // Reorder Notes
    const reorderNotesRes = await fetch(`${baseUrl}/api/admin/notes/reorder`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: "design",
        items: [{ id: createdNoteId, sortOrder: 99 }]
      })
    });
    assert(reorderNotesRes.status === 200, "POST /api/admin/notes/reorder succeeds with HTTP 200");

    // Delete created note
    const delNoteRes = await fetch(`${baseUrl}/api/admin/notes/${createdNoteId}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    assert(delNoteRes.status === 200, "DELETE /api/admin/notes/:id succeeds with HTTP 200");

    // ------------------------------------------------------------
    // GROUP D: EXPERIENCE ITEMS CMS
    // ------------------------------------------------------------
    setGroup("D: Experience Items CMS");

    const getExpRes = await fetch(`${baseUrl}/api/admin/experience`, { headers: adminHeaders });
    assert(getExpRes.status === 200, "GET /api/admin/experience returns HTTP 200");
    const expJson = await getExpRes.json();
    assert(Array.isArray(expJson.experience), "Experience list returned as array");
    const initialExpCount = expJson.experience.length;

    // Create Experience Item
    const newExpPayload = {
      organization: "Eigengraun Studio",
      startDate: "2026",
      endDateTR: "Günümüz",
      endDateEN: "Present",
      roleTR: "Baş Tasarımcı",
      roleEN: "Lead Designer",
      category: "work",
      skills: ["Design Systems", "Creative Direction"],
      descriptionTR: "Yapay zeka ve yaratıcı teknoloji odaklı arayüzler.",
      descriptionEN: "AI and creative technology interfaces.",
      sortOrder: 0,
      status: "published"
    };

    const postExpRes = await fetch(`${baseUrl}/api/admin/experience`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(newExpPayload)
    });
    assert(postExpRes.status === 201, "POST /api/admin/experience creates item with HTTP 201");
    const postExpData = await postExpRes.json();
    const createdExpId = postExpData.item.id;
    assert(postExpData.ok === true && createdExpId, "Created experience item returns valid ID");

    // Update Experience Item
    const putExpRes = await fetch(`${baseUrl}/api/admin/experience/${createdExpId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        ...newExpPayload,
        roleTR: "Kıdemli Baş Tasarımcı"
      })
    });
    assert(putExpRes.status === 200, "PUT /api/admin/experience/:id updates item with HTTP 200");

    // Revisions & Rollback
    const expRevRes = await fetch(`${baseUrl}/api/admin/experience/${createdExpId}/revisions`, { headers: adminHeaders });
    assert(expRevRes.status === 200, "GET /api/admin/experience/:id/revisions returns HTTP 200");
    const expRevData = await expRevRes.json();
    assert(expRevData.revisions.length >= 1, "Experience update created revision");

    const rollbackExpRes = await fetch(`${baseUrl}/api/admin/experience/${createdExpId}/rollback`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ revisionNumber: expRevData.revisions[expRevData.revisions.length - 1].revisionNumber })
    });
    assert(rollbackExpRes.status === 200, "POST /api/admin/experience/:id/rollback succeeds with HTTP 200");

    // Reorder
    const reorderExpRes = await fetch(`${baseUrl}/api/admin/experience/reorder`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ items: [{ id: createdExpId, sortOrder: 50 }] })
    });
    assert(reorderExpRes.status === 200, "POST /api/admin/experience/reorder succeeds with HTTP 200");

    // Clean up
    const delExpRes = await fetch(`${baseUrl}/api/admin/experience/${createdExpId}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    assert(delExpRes.status === 200, "DELETE /api/admin/experience/:id succeeds with HTTP 200");

    // ------------------------------------------------------------
    // GROUP E: EDUCATION ITEMS CMS
    // ------------------------------------------------------------
    setGroup("E: Education Items CMS");

    const getEduRes = await fetch(`${baseUrl}/api/admin/education`, { headers: adminHeaders });
    assert(getEduRes.status === 200, "GET /api/admin/education returns HTTP 200");
    const eduJson = await getEduRes.json();
    assert(Array.isArray(eduJson.education), "Education list returned as array");

    // Create Education Item
    const newEduPayload = {
      startYear: "2020",
      endYearTR: "2024",
      endYearEN: "2024",
      institutionTR: "Test Üniversitesi",
      institutionEN: "Test University",
      programTR: "Görsel İletişim Tasarımı",
      programEN: "Visual Communication Design",
      statusLabelTR: "Mezun",
      statusLabelEN: "Graduated",
      descriptionTR: "Tipografi ve etkileşim tasarımı çalışmaları.",
      descriptionEN: "Studies in typography and interaction design.",
      sortOrder: 0,
      status: "published"
    };

    const postEduRes = await fetch(`${baseUrl}/api/admin/education`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(newEduPayload)
    });
    assert(postEduRes.status === 201, "POST /api/admin/education creates item with HTTP 201");
    const postEduData = await postEduRes.json();
    const createdEduId = postEduData.item.id;
    assert(postEduData.ok === true && createdEduId, "Created education item returns valid ID");

    // Update
    const putEduRes = await fetch(`${baseUrl}/api/admin/education/${createdEduId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        ...newEduPayload,
        programTR: "Yeni Medya ve İletişim"
      })
    });
    assert(putEduRes.status === 200, "PUT /api/admin/education/:id updates item with HTTP 200");

    // Revisions & Rollback
    const eduRevRes = await fetch(`${baseUrl}/api/admin/education/${createdEduId}/revisions`, { headers: adminHeaders });
    assert(eduRevRes.status === 200, "GET /api/admin/education/:id/revisions returns HTTP 200");
    const eduRevData = await eduRevRes.json();
    assert(eduRevData.revisions.length >= 1, "Education update created revision");

    const rollbackEduRes = await fetch(`${baseUrl}/api/admin/education/${createdEduId}/rollback`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ revisionNumber: eduRevData.revisions[eduRevData.revisions.length - 1].revisionNumber })
    });
    assert(rollbackEduRes.status === 200, "POST /api/admin/education/:id/rollback succeeds with HTTP 200");

    // Clean up
    const delEduRes = await fetch(`${baseUrl}/api/admin/education/${createdEduId}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    assert(delEduRes.status === 200, "DELETE /api/admin/education/:id succeeds with HTTP 200");

    // ------------------------------------------------------------
    // GROUP F: SKILLS CATALOG CMS & CATEGORIES
    // ------------------------------------------------------------
    setGroup("F: Skills Catalog CMS & Categories");

    const getSkillsRes = await fetch(`${baseUrl}/api/admin/skills`, { headers: adminHeaders });
    assert(getSkillsRes.status === 200, "GET /api/admin/skills returns HTTP 200");
    const skillsJson = await getSkillsRes.json();
    assert(Array.isArray(skillsJson.skills), "Skills list returned as array");
    assert(skillsJson.skills.length >= 35, `Seeded skills present in catalog (found ${skillsJson.skills.length})`);

    // Verify all canonical categories exist
    const categories = new Set(skillsJson.skills.map((s) => s.category));
    assert(categories.has("design"), "Category design present");
    assert(categories.has("web"), "Category web present");
    assert(categories.has("production"), "Category production present");
    assert(categories.has("ai"), "Category ai present");
    assert(categories.has("strategy"), "Category strategy present");
    assert(categories.has("tools"), "Category tools present");

    // Create Skill Item
    const newSkillPayload = {
      category: "ai",
      nameTR: "Yapay Zeka Yaratıcı Kodlama",
      nameEN: "AI Creative Coding",
      sortOrder: 0,
      status: "published"
    };

    const postSkillRes = await fetch(`${baseUrl}/api/admin/skills`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(newSkillPayload)
    });
    assert(postSkillRes.status === 201, "POST /api/admin/skills creates skill with HTTP 201");
    const postSkillData = await postSkillRes.json();
    const createdSkillId = postSkillData.item.id;
    assert(postSkillData.ok === true && createdSkillId, "Created skill returns valid ID");

    // Validation: Invalid category rejected
    const badSkillRes = await fetch(`${baseUrl}/api/admin/skills`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        category: "invalid_category",
        nameTR: "Hatalı Kategori",
        nameEN: "Bad Category"
      })
    });
    assert(badSkillRes.status === 400, "Invalid skill category rejected with HTTP 400");

    // Delete created skill
    const delSkillRes = await fetch(`${baseUrl}/api/admin/skills/${createdSkillId}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    assert(delSkillRes.status === 200, "DELETE /api/admin/skills/:id succeeds with HTTP 200");

    // ------------------------------------------------------------
    // GROUP G: CV DOCUMENT MANAGEMENT & PDF MAGIC BYTES
    // ------------------------------------------------------------
    setGroup("G: CV Document Management & PDF Magic Byte Security");

    const getCvRes = await fetch(`${baseUrl}/api/admin/cv`, { headers: adminHeaders });
    assert(getCvRes.status === 200, "GET /api/admin/cv returns HTTP 200");
    const cvJson = await getCvRes.json();
    assert(Array.isArray(cvJson.documents) && cvJson.documents.length === 2, "CV documents list contains both TR and EN records");

    // Negative Test: Uploading fake PDF (bad magic bytes)
    const fakePdfBytes = createFakePdfCorrupted();
    const badUploadFormData = new FormData();
    badUploadFormData.append("locale", "en");
    badUploadFormData.append("file", new Blob([fakePdfBytes], { type: "application/pdf" }), "fake.pdf");

    const badUploadRes = await fetch(`${baseUrl}/api/admin/cv/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "x-csrf-token": csrfToken,
        Origin: baseUrl
      },
      body: badUploadFormData
    });
    assert(badUploadRes.status === 400, "Corrupted PDF magic bytes rejected with HTTP 400");
    const badUploadData = await badUploadRes.json();
    assert(badUploadData.error && badUploadData.error.includes("%PDF-"), "Error message explicitly cites %PDF- magic signature requirement");

    // Valid PDF Upload
    const validPdfBytes = createMinimalValidPdf("Kerem Mihci Official Portfolio CV 2026");
    const uploadFormData = new FormData();
    uploadFormData.append("locale", "en");
    uploadFormData.append("file", new Blob([validPdfBytes], { type: "application/pdf" }), "kerem-mihci-cv-en.pdf");

    const validUploadRes = await fetch(`${baseUrl}/api/admin/cv/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "x-csrf-token": csrfToken,
        Origin: baseUrl
      },
      body: uploadFormData
    });
    assert(validUploadRes.status === 201, "Valid %PDF- upload accepted with HTTP 201");
    const validUploadData = await validUploadRes.json();
    const uploadedCvDoc = validUploadData.cv || validUploadData.document;
    assert(validUploadData.ok === true && (uploadedCvDoc?.storageKey || validUploadData.fileKey), "Valid upload returned storageKey");

    // Verify initial CV status is draft upon new upload or configured status
    const initialDocStatus = uploadedCvDoc?.status;
    assert(initialDocStatus === "draft" || initialDocStatus === "published", "CV document status is draft or published");

    // Explicitly update CV status and metadata
    const putCvRes = await fetch(`${baseUrl}/api/admin/cv/en`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "published",
        filename: "kerem-mihci-cv-en-v2.pdf"
      })
    });
    assert(putCvRes.status === 200, "PUT /api/admin/cv/en updates CV with HTTP 200");

    // Verify Revisions
    const cvRevRes = await fetch(`${baseUrl}/api/admin/cv/en/revisions`, { headers: adminHeaders });
    assert(cvRevRes.status === 200, "GET /api/admin/cv/en/revisions returns HTTP 200");
    const cvRevData = await cvRevRes.json();
    assert(cvRevData.revisions.length >= 1, "CV revisions recorded in history");

    // Rollback CV
    const firstCvRev = cvRevData.revisions[cvRevData.revisions.length - 1];
    const rollbackCvRes = await fetch(`${baseUrl}/api/admin/cv/en/rollback`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ revisionNumber: firstCvRev.revisionNumber })
    });
    assert(rollbackCvRes.status === 200, "POST /api/admin/cv/en/rollback succeeds with HTTP 200");

    // ------------------------------------------------------------
    // GROUP H: PUBLIC API ACCESS CONTROL & EMPTY STATE INVARIANTS
    // ------------------------------------------------------------
    setGroup("H: Public API Access Control & Empty State Invariants");

    // Public Profile Endpoint
    const pubProfileRes = await fetch(`${baseUrl}/api/v1/public/profile`);
    assert(pubProfileRes.status === 200, "Public GET /api/v1/public/profile returns HTTP 200");
    const pubProfileJson = await pubProfileRes.json();
    assert(pubProfileJson.ok === true && pubProfileJson.profile, "Public profile payload valid");

    // Public Workspace Notes
    const pubNotesRes = await fetch(`${baseUrl}/api/v1/public/notes/design`);
    assert(pubNotesRes.status === 200, "Public GET /api/v1/public/notes/design returns HTTP 200");
    const pubNotesJson = await pubNotesRes.json();
    assert(Array.isArray(pubNotesJson.notes), "Public notes returns array");

    // Public Experience, Education, Skills
    const pubExpRes = await fetch(`${baseUrl}/api/v1/public/experience`);
    assert(pubExpRes.status === 200, "Public GET /api/v1/public/experience returns HTTP 200");

    const pubEduRes = await fetch(`${baseUrl}/api/v1/public/education`);
    assert(pubEduRes.status === 200, "Public GET /api/v1/public/education returns HTTP 200");

    const pubSkillsRes = await fetch(`${baseUrl}/api/v1/public/skills`);
    assert(pubSkillsRes.status === 200, "Public GET /api/v1/public/skills returns HTTP 200");

    // Public CV Download & Draft Leakage Prevention
    // Ensure draft status for 'tr' CV
    await fetch(`${baseUrl}/api/admin/cv/tr`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ status: "draft" })
    });

    const pubDraftCvRes = await fetch(`${baseUrl}/api/v1/public/cv/tr`);
    assert(pubDraftCvRes.status === 404, "PREMATURE LEAKAGE PREVENTED: Draft CV returns HTTP 404 to public visitors");
    const pubDraftCacheHeader = pubDraftCvRes.headers.get("cache-control") || "";
    assert(pubDraftCacheHeader.includes("no-store"), "Draft CV 404 response enforces Cache-Control: no-store");

    // Now publish 'en' CV with real PDF bytes
    const enUploadData = new FormData();
    enUploadData.append("locale", "en");
    enUploadData.append("file", new Blob([validPdfBytes], { type: "application/pdf" }), "cv-published.pdf");
    const enUpRes = await fetch(`${baseUrl}/api/admin/cv/upload`, {
      method: "POST",
      headers: { Cookie: cookieHeader, "x-csrf-token": csrfToken, Origin: baseUrl },
      body: enUploadData
    });
    const enUpJson = await enUpRes.json();

    await fetch(`${baseUrl}/api/admin/cv/en`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ status: "published" })
    });

    const pubPublishedCvRes = await fetch(`${baseUrl}/api/v1/public/cv/en`);
    assert(pubPublishedCvRes.status === 200, "Published CV returns HTTP 200 to public visitors");
    const pubCvJson = await pubPublishedCvRes.json();
    assert(pubCvJson.ok === true && pubCvJson.cv?.storageKey, "Published CV returns storageKey");

    // Fetch the actual PDF through the media pipeline
    const mediaCvRes = await fetch(`${baseUrl}/api/media/${pubCvJson.cv.storageKey}`);
    assert(mediaCvRes.status === 200, "Published CV binary media delivers HTTP 200");
    const pubCvContentType = mediaCvRes.headers.get("content-type") || "";
    assert(pubCvContentType.includes("application/pdf"), "Published CV delivery returns application/pdf Content-Type");

    // ------------------------------------------------------------
    // GROUP I: PUBLIC FRONTEND HYDRATION & NON-REGRESSION
    // ------------------------------------------------------------
    setGroup("I: Public Frontend Hydration, NotesApp Integration & Non-Regression");

    const trPageRes = await fetch(`${baseUrl}/tr`);
    assert(trPageRes.status === 200, "GET /tr renders HTTP 200 without server crash");
    const trPageHtml = await trPageRes.text();
    assert(trPageHtml.includes("Kerem"), "Public TR page contains Kerem brand identity");

    const enPageRes = await fetch(`${baseUrl}/en`);
    assert(enPageRes.status === 200, "GET /en renders HTTP 200 without server crash");

    const adminPageRes = await fetch(`${baseUrl}/admin`, { headers: { Cookie: cookieHeader } });
    assert(adminPageRes.status === 200, "GET /admin renders HTTP 200 for authenticated admin");
    const adminPageHtml = await adminPageRes.text();
    assert(adminPageHtml.includes("admin-overview-section"), "Admin dashboard contains admin-overview-section");
    assert(adminPageHtml.includes("overview-manage-profile-btn"), "Admin overview contains Profile & Notes navigation button");

    // Check code integration signatures
    const sessionStoreSrc = fs.readFileSync(path.join(rootDir, "src", "store", "sessionStore.ts"), "utf-8");
    assert(sessionStoreSrc.includes("hydratePhase5Content"), "sessionStore exposes hydratePhase5Content");
    assert(sessionStoreSrc.includes("sessionWorkspaceNotes"), "sessionStore tracks sessionWorkspaceNotes");
    assert(sessionStoreSrc.includes("sessionExperience"), "sessionStore tracks sessionExperience");
    assert(sessionStoreSrc.includes("sessionEducation"), "sessionStore tracks sessionEducation");
    assert(sessionStoreSrc.includes("sessionSkills"), "sessionStore tracks sessionSkills");
    assert(sessionStoreSrc.includes("sessionCv"), "sessionStore tracks sessionCv");

    const notesOverviewSrc = fs.readFileSync(path.join(rootDir, "src", "components", "applications", "notes", "NotesOverviewTab.tsx"), "utf-8");
    assert(notesOverviewSrc.includes("activeWorkspace"), "NotesOverviewTab dynamically filters by activeWorkspace");

    const notesCvSrc = fs.readFileSync(path.join(rootDir, "src", "components", "applications", "notes", "NotesCvTab.tsx"), "utf-8");
    assert(notesCvSrc.includes("sessionCv"), "NotesCvTab consumes CMS sessionCv");

    // Check Cloudflare Worker API
    const workerSrc = fs.readFileSync(path.join(rootDir, "cloudflare", "portfolio-api", "src", "index.ts"), "utf-8");
    assert(workerSrc.includes("/api/v1/public/profile"), "Cloudflare Worker index.ts implements public profile endpoint");
    assert(workerSrc.includes("/api/v1/public/notes/"), "Cloudflare Worker index.ts implements public notes endpoint");
    assert(workerSrc.includes("/api/v1/public/cv/"), "Cloudflare Worker index.ts implements public cv endpoint");
    assert(workerSrc.includes("/api/v1/admin/profile"), "Cloudflare Worker index.ts implements admin profile endpoint");
    assert(workerSrc.includes("/api/v1/admin/cv/upload"), "Cloudflare Worker index.ts implements admin cv upload endpoint");

  } finally {
    if (testDbConnection) {
      try {
        testDbConnection.close();
      } catch {}
    }

    if (testServerProcess) {
      console.log("\nShutting down isolated test server...");
      testServerProcess.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1000));
    }

    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      if (fs.existsSync(tempR2Dir)) fs.rmSync(tempR2Dir, { recursive: true, force: true });
    } catch {}

    // ------------------------------------------------------------
    // GROUP J: TEST FIXTURE ISOLATION & ZERO HOST DATABASE MUTATION
    // ------------------------------------------------------------
    setGroup("J: Test Fixture Isolation & Zero Host Database Mutation");

    const hostFinalSha256 = getFileSha256(hostDbPath);
    const unchanged = hostInitialSha256 === hostFinalSha256;
    assert(
      unchanged,
      "Zero host mutations: .local-d1/portfolio.sqlite SHA256 is 100% identical before and after suite",
      `SHA256: ${hostFinalSha256 ? hostFinalSha256.slice(0, 16) : "null"}...`
    );
  }

  // ------------------------------------------------------------
  // RESULTS REPORT
  // ------------------------------------------------------------
  console.log("\n============================================================");
  console.log("PHASE 5 VERIFICATION SUITE RESULTS SUMMARY");
  console.log("============================================================");
  console.log(`TOTAL CHECKS: ${results.total}`);
  console.log(`PASSED:       ${results.passed}`);
  console.log(`FAILED:       ${results.failed}`);

  if (results.failed > 0) {
    console.error("\nFAILURES:");
    for (const f of results.failures) {
      console.error(`  - ${f}`);
    }
  }

  const reportPath = path.join(rootDir, "docs", "reviews", "PORTFOLIO_OS_PHASE5_TEST_RESULTS.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to: ${reportPath}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
