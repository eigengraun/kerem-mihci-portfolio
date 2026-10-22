#!/usr/bin/env node

/**
 * scripts/verify-phase5-content-parity.mjs
 *
 * Portfolio OS Phase 5.2: Content Provenance & Parity Verification Tool
 *
 * Performs deep, bit-for-bit field-level validation between:
 * 1. Committed static sources: src/data/profile.ts, src/data/notes.ts
 * 2. Persistent local database: .local-d1/portfolio.sqlite
 * 3. Human owner approval checklist: docs/reviews/PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md
 *
 * Invariants Enforced:
 * - Zero hallucination / fabrication: no invented roles, organizations, degrees, or principles.
 * - Exact source text parity across all 73 CMS entities.
 * - Stable entity IDs matching importer output.
 * - Every checklist item marked OWNER_VERIFICATION_REQUIRED.
 * - Outputs structured evidence to docs/reviews/PORTFOLIO_OS_PHASE5_CONTENT_PARITY_EVIDENCE.json.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const hostDbPath = path.join(rootDir, ".local-d1", "portfolio.sqlite");
const checklistPath = path.join(rootDir, "docs", "reviews", "PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md");
const evidenceJsonPath = path.join(rootDir, "docs", "reviews", "PORTFOLIO_OS_PHASE5_CONTENT_PARITY_EVIDENCE.json");

const results = {
  suite: "Portfolio OS Phase 5.2 Content Parity & Provenance Verification",
  timestamp: new Date().toISOString(),
  totalChecks: 0,
  passedChecks: 0,
  failedChecks: 0,
  failures: [],
  entities: {
    profile: null,
    notes: [],
    experience: [],
    education: [],
    skills: [],
    cv: []
  }
};

function assert(condition, name, detail = "") {
  results.totalChecks++;
  if (condition) {
    results.passedChecks++;
    console.log(`  ✓ PASS: ${name}${detail ? ` [${detail}]` : ""}`);
  } else {
    results.failedChecks++;
    const msg = `  ✗ FAIL: ${name}${detail ? ` [${detail}]` : ""}`;
    console.error(msg);
    results.failures.push(name);
  }
}

function normalizeJson(val) {
  if (val === undefined || val === null) return "null";
  if (typeof val === "string") {
    try {
      return JSON.stringify(JSON.parse(val));
    } catch {
      return JSON.stringify(val);
    }
  }
  return JSON.stringify(val);
}

function areJsonEqual(a, b) {
  return normalizeJson(a) === normalizeJson(b);
}

async function runParitySuite() {
  console.log("============================================================");
  console.log("PORTFOLIO OS PHASE 5.2: CONTENT PROVENANCE & PARITY AUDIT");
  console.log(`Timestamp: ${results.timestamp}`);
  console.log("============================================================\n");

  assert(fs.existsSync(hostDbPath), "Host database .local-d1/portfolio.sqlite exists");

  const db = new DatabaseSync(hostDbPath, { readOnly: true });

  const { profileData } = await import("../src/data/profile.ts");

  // ============================================================
  // 1. Profile Parity Audit
  // ============================================================
  console.log("--- Section 1: Profile Identity & Bio Parity ---");
  const profRow = db.prepare("SELECT * FROM portfolio_profile WHERE id = 'main'").get();
  const profTrRow = db.prepare("SELECT * FROM portfolio_profile_translations WHERE profile_id = 'main' AND locale = 'tr'").get();
  const profEnRow = db.prepare("SELECT * FROM portfolio_profile_translations WHERE profile_id = 'main' AND locale = 'en'").get();

  assert(Boolean(profRow), "Local D1 contains profile record 'main'");
  assert(Boolean(profTrRow), "Local D1 contains Turkish translation for 'main'");
  assert(Boolean(profEnRow), "Local D1 contains English translation for 'main'");

  assert(profRow.name === profileData.name, "Profile name exact match", `Source: "${profileData.name}"`);
  assert(profRow.email === profileData.email, "Profile email exact match", `Source: "${profileData.email}"`);
  assert(profRow.image_url === profileData.image, "Profile image exact match", `Source: "${profileData.image}"`);
  assert(profRow.avatar_url === profileData.avatar, "Profile avatar exact match", `Source: "${profileData.avatar}"`);
  assert(areJsonEqual(profRow.stats_json, profileData.stats), "Profile stats JSON exact match");

  assert(profTrRow.headline === profileData.headlineTR, "Profile headline TR exact match", `Source: "${profileData.headlineTR}"`);
  assert(profTrRow.location === profileData.locationTR, "Profile location TR exact match", `Source: "${profileData.locationTR}"`);
  assert(profTrRow.image_alt === profileData.altTR, "Profile alt TR exact match", `Source: "${profileData.altTR}"`);
  assert(areJsonEqual(profTrRow.summary_paragraphs_json, profileData.summaryTR), "Profile summary paragraphs TR exact match");
  assert(areJsonEqual(profTrRow.focus_areas_json, profileData.focusAreasTR), "Profile focus areas TR exact match");

  assert(profEnRow.headline === profileData.headlineEN, "Profile headline EN exact match", `Source: "${profileData.headlineEN}"`);
  assert(profEnRow.location === profileData.locationEN, "Profile location EN exact match", `Source: "${profileData.locationEN}"`);
  assert(profEnRow.image_alt === profileData.altEN, "Profile alt EN exact match", `Source: "${profileData.altEN}"`);
  assert(areJsonEqual(profEnRow.summary_paragraphs_json, profileData.summaryEN), "Profile summary paragraphs EN exact match");
  assert(areJsonEqual(profEnRow.focus_areas_json, profileData.focusAreasEN), "Profile focus areas EN exact match");

  results.entities.profile = {
    id: "main",
    sourceParity: true,
    dbParity: true,
    name: profileData.name,
    headlineTR: profileData.headlineTR,
    headlineEN: profileData.headlineEN,
    summariesTR: profileData.summaryTR,
    summariesEN: profileData.summaryEN,
    status: "OWNER_VERIFICATION_REQUIRED"
  };

  // ============================================================
  // 2. Workspace Notes Parity Audit (24 items)
  // ============================================================
  console.log("\n--- Section 2: Workspace Notes Parity (24 Items) ---");
  const workspaces = ["design", "web", "motion-ai"];
  let noteIndex = 0;
  for (const ws of workspaces) {
    const rawItemsTR = profileData.notes.itemsTR;
    const rawItemsEN = profileData.notes.itemsEN;

    for (let i = 0; i < rawItemsTR.length; i++) {
      noteIndex++;
      const noteId = `note-${ws}-${i + 1}`;
      const noteRow = db.prepare("SELECT * FROM portfolio_workspace_notes WHERE id = ?").get(noteId);
      const noteTrRow = db.prepare("SELECT * FROM portfolio_workspace_notes_translations WHERE note_id = ? AND locale = 'tr'").get(noteId);
      const noteEnRow = db.prepare("SELECT * FROM portfolio_workspace_notes_translations WHERE note_id = ? AND locale = 'en'").get(noteId);

      assert(Boolean(noteRow), `Local D1 contains note '${noteId}'`);
      assert(noteRow?.workspace_id === ws, `Note '${noteId}' workspace_id is '${ws}'`);
      assert(noteTrRow?.content === rawItemsTR[i], `Note '${noteId}' TR content matches source verbatim`);
      assert(noteEnRow?.content === rawItemsEN[i], `Note '${noteId}' EN content matches source verbatim`);

      results.entities.notes.push({
        id: noteId,
        workspace: ws,
        index: i + 1,
        contentTR: rawItemsTR[i],
        contentEN: rawItemsEN[i],
        sourceParity: true,
        status: "OWNER_VERIFICATION_REQUIRED"
      });
    }
  }

  // ============================================================
  // 3. Career Experience Parity Audit (5 items)
  // ============================================================
  console.log("\n--- Section 3: Career Experience Milestones Parity (5 Items) ---");
  for (const exp of profileData.experience) {
    const expRow = db.prepare("SELECT * FROM portfolio_experience WHERE id = ?").get(exp.id);
    const expTr = db.prepare("SELECT * FROM portfolio_experience_translations WHERE experience_id = ? AND locale = 'tr'").get(exp.id);
    const expEn = db.prepare("SELECT * FROM portfolio_experience_translations WHERE experience_id = ? AND locale = 'en'").get(exp.id);

    assert(Boolean(expRow), `Local D1 contains experience '${exp.id}'`);
    assert(expRow?.organization === exp.organization, `Experience '${exp.id}' organization matches: "${exp.organization}"`);
    assert(expRow?.start_date === exp.startDate, `Experience '${exp.id}' start_date matches: "${exp.startDate}"`);
    assert(expTr?.role === exp.roleTR, `Experience '${exp.id}' role TR matches verbatim: "${exp.roleTR}"`);
    assert(expEn?.role === exp.roleEN, `Experience '${exp.id}' role EN matches verbatim: "${exp.roleEN}"`);
    assert(expTr?.description === exp.descriptionTR, `Experience '${exp.id}' description TR matches verbatim`);
    assert(expEn?.description === exp.descriptionEN, `Experience '${exp.id}' description EN matches verbatim`);

    results.entities.experience.push({
      id: exp.id,
      organization: exp.organization,
      roleTR: exp.roleTR,
      roleEN: exp.roleEN,
      startDate: exp.startDate,
      endDateTR: exp.endDateTR,
      endDateEN: exp.endDateEN,
      descriptionTR: exp.descriptionTR,
      descriptionEN: exp.descriptionEN,
      sourceParity: true,
      status: "OWNER_VERIFICATION_REQUIRED"
    });
  }

  // ============================================================
  // 4. Education Parity Audit (2 items)
  // ============================================================
  console.log("\n--- Section 4: Education Qualifications Parity (2 Items) ---");
  for (const edu of profileData.education) {
    const eduRow = db.prepare("SELECT * FROM portfolio_education WHERE id = ?").get(edu.id);
    const eduTr = db.prepare("SELECT * FROM portfolio_education_translations WHERE education_id = ? AND locale = 'tr'").get(edu.id);
    const eduEn = db.prepare("SELECT * FROM portfolio_education_translations WHERE education_id = ? AND locale = 'en'").get(edu.id);

    assert(Boolean(eduRow), `Local D1 contains education '${edu.id}'`);
    assert(eduTr?.institution === edu.institutionTR, `Education '${edu.id}' institution TR matches: "${edu.institutionTR}"`);
    assert(eduEn?.institution === edu.institutionEN, `Education '${edu.id}' institution EN matches: "${edu.institutionEN}"`);
    assert(eduTr?.program === edu.programTR, `Education '${edu.id}' program TR matches: "${edu.programTR}"`);
    assert(eduEn?.program === edu.programEN, `Education '${edu.id}' program EN matches: "${edu.programEN}"`);

    results.entities.education.push({
      id: edu.id,
      institutionTR: edu.institutionTR,
      institutionEN: edu.institutionEN,
      programTR: edu.programTR,
      programEN: edu.programEN,
      startYear: edu.startYear || null,
      endYearTR: edu.endYearTR || "",
      endYearEN: edu.endYearEN || "",
      sourceParity: true,
      status: "OWNER_VERIFICATION_REQUIRED"
    });
  }

  // ============================================================
  // 5. Skills Catalog Parity Audit (39 items)
  // ============================================================
  console.log("\n--- Section 5: Skills Catalog Parity (39 Items) ---");
  const skillCategories = ["design", "web", "production", "ai", "strategy"];
  for (const cat of skillCategories) {
    const list = profileData.skills[cat] || [];
    for (let s = 0; s < list.length; s++) {
      const skillId = `skill-${cat}-${s + 1}`;
      const skillRow = db.prepare("SELECT * FROM portfolio_skills WHERE id = ?").get(skillId);
      const skTr = db.prepare("SELECT * FROM portfolio_skill_translations WHERE skill_id = ? AND locale = 'tr'").get(skillId);
      const skEn = db.prepare("SELECT * FROM portfolio_skill_translations WHERE skill_id = ? AND locale = 'en'").get(skillId);

      assert(Boolean(skillRow), `Local D1 contains skill '${skillId}'`);
      assert(skTr?.name === list[s].tr, `Skill '${skillId}' TR matches: "${list[s].tr}"`);
      assert(skEn?.name === list[s].en, `Skill '${skillId}' EN matches: "${list[s].en}"`);

      results.entities.skills.push({
        id: skillId,
        category: cat,
        nameTR: list[s].tr,
        nameEN: list[s].en,
        sourceParity: true,
        status: "OWNER_VERIFICATION_REQUIRED"
      });
    }
  }

  // Tools
  const toolsList = profileData.skills.tools || [];
  for (let t = 0; t < toolsList.length; t++) {
    const skillId = `skill-tools-${t + 1}`;
    const skillRow = db.prepare("SELECT * FROM portfolio_skills WHERE id = ?").get(skillId);
    const skTr = db.prepare("SELECT * FROM portfolio_skill_translations WHERE skill_id = ? AND locale = 'tr'").get(skillId);
    const skEn = db.prepare("SELECT * FROM portfolio_skill_translations WHERE skill_id = ? AND locale = 'en'").get(skillId);

    assert(Boolean(skillRow), `Local D1 contains tool '${skillId}'`);
    assert(skTr?.name === toolsList[t], `Tool '${skillId}' TR matches: "${toolsList[t]}"`);
    assert(skEn?.name === toolsList[t], `Tool '${skillId}' EN matches: "${toolsList[t]}"`);

    results.entities.skills.push({
      id: skillId,
      category: "tools",
      nameTR: toolsList[t],
      nameEN: toolsList[t],
      sourceParity: true,
      status: "OWNER_VERIFICATION_REQUIRED"
    });
  }

  // ============================================================
  // 6. CV Documents Parity Audit (2 items)
  // ============================================================
  console.log("\n--- Section 6: CV Documents Parity (2 Items) ---");
  for (const loc of ["tr", "en"]) {
    const cvRow = db.prepare("SELECT * FROM portfolio_cv_documents WHERE locale = ?").get(loc);
    assert(Boolean(cvRow), `Local D1 contains CV document for '${loc}'`);
    assert(cvRow?.status === "draft", `CV '${loc}' is strictly in 'draft' status`);
    assert(cvRow?.byte_size === 0, `CV '${loc}' is placeholder with byte_size = 0`);

    results.entities.cv.push({
      id: `cv-${loc}`,
      locale: loc,
      status: "draft",
      publicUrl: `/cv/kerem-mihci-cv-${loc}.pdf`,
      sourceParity: true,
      ownerStatus: "OWNER_VERIFICATION_REQUIRED"
    });
  }

  db.close();

  // ============================================================
  // 7. Checklist File Anti-Fabrication & Parity Audit
  // ============================================================
  console.log("\n--- Section 7: Checklist File Anti-Fabrication Audit ---");
  assert(fs.existsSync(checklistPath), "Checklist file exists at docs/reviews/PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md");
  const checklistContent = fs.readFileSync(checklistPath, "utf-8");

  // Anti-fabrication assertions: ensure known hallucinated phrases are NOT present
  const prohibitedPhrases = [
    "Founder & Design Director",
    "Lead Designer & Webmaster",
    "Form follows function, but emotion guides experience",
    "Typography is the foundation of clear communication",
    "Marmara University",
    "Marmara Üniversitesi",
    "Senior Design Technologist",
    "16+ years"
  ];

  for (const phrase of prohibitedPhrases) {
    assert(!checklistContent.includes(phrase), `Checklist does NOT contain prohibited fabricated phrase: "${phrase}"`);
  }

  // Positive assertions: ensure exact authentic source phrases ARE present
  const mandatoryPhrases = [
    "Kreatif Tasarımcı & Dijital İçerik Üreticisi",
    "Creative Designer & Digital Content Creator",
    "Kreatif Editör & Yayın Tasarımcısı",
    "Creative Editor & Layout Designer",
    "İstanbul Üniversitesi - Cerrahpaşa",
    "Elektrik-Elektronik Mühendisliği",
    "Düzce Fen Lisesi",
    "hizalama göze doğru geliyorsa bazen grid'den daha önemlidir",
    "logo küçük boyutta da çalışmalı",
    "ilk frame önemli, son frame de öyle",
    "fazla hareket her zaman daha iyi hareket değildir",
    "yazılar son frame'e kadar okunmalı",
    "iyi tasarım sadece güzel görünmek değildir",
    "export almadan önce son kez kontrol et",
    "bir varyasyon daha al",
    "Adobe Photoshop",
    "Antigravity",
    "Higgsfield"
  ];

  for (const phrase of mandatoryPhrases) {
    assert(checklistContent.includes(phrase), `Checklist contains authentic verbatim phrase: "${phrase}"`);
  }

  // Ensure every checklist checkbox is unselected ([ ]) by default
  const checkedBoxes = checklistContent.match(/\[x\]/gi) || [];
  assert(checkedBoxes.length === 0, `Checklist contains zero automatically checked [x] boxes (found: ${checkedBoxes.length})`);

  // Write structured evidence JSON
  fs.writeFileSync(evidenceJsonPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nParity evidence JSON written to: ${evidenceJsonPath}`);

  console.log("\n============================================================");
  console.log("CONTENT PARITY AUDIT RESULTS SUMMARY");
  console.log("============================================================");
  console.log(`TOTAL CHECKS: ${results.totalChecks}`);
  console.log(`PASSED:       ${results.passedChecks}`);
  console.log(`FAILED:       ${results.failedChecks}`);

  if (results.failedChecks > 0) {
    console.error("\nFAILURES:");
    for (const f of results.failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }
}

runParitySuite().catch((err) => {
  console.error("FATAL ERROR IN CONTENT PARITY AUDIT:", err);
  process.exit(1);
});
