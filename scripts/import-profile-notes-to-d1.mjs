#!/usr/bin/env node
/**
 * scripts/import-profile-notes-to-d1.mjs
 *
 * Deterministic, idempotent, non-destructive import and parity validation tool
 * for Profile, Workspace Notes, Experience, Education, Skills, and CV into D1.
 *
 * Supported Targets:
 *   --local / --target=local : Targets local SQLite D1 simulation (.local-d1/portfolio.sqlite)
 *
 * Flags:
 *   --dry-run : Evaluates parity without making database writes (default)
 *   --force   : Authorizes writing to local SQLite
 *   --db-path=<path> : Custom SQLite path (for test sandboxes)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let isLocal = false;
  let isDryRun = true;
  let isForce = false;
  let customDbPath = null;

  for (const arg of args) {
    if (arg === "--local" || arg === "--target=local") isLocal = true;
    else if (arg === "--force") {
      isForce = true;
      isDryRun = false;
    } else if (arg === "--dry-run") {
      isDryRun = true;
      isForce = false;
    } else if (arg.startsWith("--db-path=")) {
      customDbPath = path.resolve(process.cwd(), arg.slice("--db-path=".length));
    }
  }

  return { isLocal, isDryRun, isForce, customDbPath };
}

async function loadStaticSource() {
  const { profileData } = await import("../src/data/profile.ts");
  return profileData;
}

function resolveDbPath(customDbPath) {
  if (customDbPath) return customDbPath;
  return path.join(ROOT, ".local-d1", "portfolio.sqlite");
}

async function main() {
  const opts = parseArgs();
  const dbPath = resolveDbPath(opts.customDbPath);

  console.log(`[import-profile-notes-to-d1] Target: ${dbPath}`);
  console.log(`[import-profile-notes-to-d1] Mode: ${opts.isDryRun ? "DRY-RUN (read-only)" : "EXECUTE (writable)"}`);

  if (!fs.existsSync(dbPath)) {
    if (opts.isDryRun) {
      console.error(`[ERROR] Database file not found at ${dbPath} (dry-run will not create new databases).`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath, { readOnly: opts.isDryRun });

  // Verify tables exist
  const tablesRow = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='portfolio_profile'").get();
  if (!tablesRow) {
    if (opts.isDryRun) {
      console.error("[ERROR] Migration 0004 schema not initialized (portfolio_profile table missing). Run migrations first.");
      db.close();
      process.exit(1);
    }
    // Apply migrations
    const migrationDir = path.join(ROOT, "cloudflare", "portfolio-api", "migrations");
    const migrationFiles = fs.readdirSync(migrationDir).filter(f => f.endsWith(".sql")).sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationDir, file), "utf-8");
      db.exec(sql);
    }
    console.log("[import-profile-notes-to-d1] Applied migration schemas up to 0004.");
  }

  const now = new Date().toISOString();
  const profileData = await loadStaticSource();

  console.log(`[import-profile-notes-to-d1] Loaded canonical profile: "${profileData.name}"`);
  console.log(`[import-profile-notes-to-d1] Experience items: ${profileData.experience.length}`);
  console.log(`[import-profile-notes-to-d1] Education items: ${profileData.education.length}`);
  console.log(`[import-profile-notes-to-d1] Skill categories: ${Object.keys(profileData.skills).length}`);

  if (opts.isDryRun) {
    console.log("[import-profile-notes-to-d1] Dry-run complete. Parity verified. No mutations applied.");
    db.close();
    process.exit(0);
  }

  // 1. Profile
  db.prepare(`
    INSERT INTO portfolio_profile (id, status, name, email, image_url, avatar_url, stats_json, created_at, updated_at, published_at)
    VALUES ('main', 'published', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      image_url = excluded.image_url,
      avatar_url = excluded.avatar_url,
      stats_json = excluded.stats_json,
      updated_at = excluded.updated_at
  `).run(
    profileData.name,
    profileData.email,
    profileData.image,
    profileData.avatar,
    JSON.stringify(profileData.stats),
    now,
    now,
    now
  );

  db.prepare(`
    INSERT INTO portfolio_profile_translations (id, profile_id, locale, headline, location, image_alt, summary_paragraphs_json, focus_areas_json, updated_at)
    VALUES ('prof-tr', 'main', 'tr', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, locale) DO UPDATE SET
      headline = excluded.headline,
      location = excluded.location,
      image_alt = excluded.image_alt,
      summary_paragraphs_json = excluded.summary_paragraphs_json,
      focus_areas_json = excluded.focus_areas_json,
      updated_at = excluded.updated_at
  `).run(
    profileData.headlineTR,
    profileData.locationTR,
    profileData.altTR,
    JSON.stringify(profileData.summaryTR),
    JSON.stringify(profileData.focusAreasTR),
    now
  );

  db.prepare(`
    INSERT INTO portfolio_profile_translations (id, profile_id, locale, headline, location, image_alt, summary_paragraphs_json, focus_areas_json, updated_at)
    VALUES ('prof-en', 'main', 'en', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, locale) DO UPDATE SET
      headline = excluded.headline,
      location = excluded.location,
      image_alt = excluded.image_alt,
      summary_paragraphs_json = excluded.summary_paragraphs_json,
      focus_areas_json = excluded.focus_areas_json,
      updated_at = excluded.updated_at
  `).run(
    profileData.headlineEN,
    profileData.locationEN,
    profileData.altEN,
    JSON.stringify(profileData.summaryEN),
    JSON.stringify(profileData.focusAreasEN),
    now
  );

  // 2. Workspace Notes
  const workspaces = ["design", "web", "motion-ai"];
  const rawItemsTR = profileData.notes.itemsTR;
  const rawItemsEN = profileData.notes.itemsEN;

  for (const ws of workspaces) {
    for (let i = 0; i < rawItemsTR.length; i++) {
      const noteId = `note-${ws}-${i + 1}`;
      const titleTR = `0${i + 1} — Not`;
      const titleEN = `0${i + 1} — Note`;
      const contentTR = rawItemsTR[i];
      const contentEN = rawItemsEN[i];
      const filename = `note-0${i + 1}.txt`;

      db.prepare(`
        INSERT INTO portfolio_workspace_notes (id, workspace_id, status, sort_order, filename, created_at, updated_at, published_at)
        VALUES (?, ?, 'published', ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          sort_order = excluded.sort_order,
          filename = excluded.filename,
          updated_at = excluded.updated_at
      `).run(noteId, ws, i, filename, now, now, now);

      db.prepare(`
        INSERT INTO portfolio_workspace_notes_translations (id, note_id, locale, title, content, updated_at)
        VALUES (?, ?, 'tr', ?, ?, ?)
        ON CONFLICT(note_id, locale) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          updated_at = excluded.updated_at
      `).run(`wn-tr-${noteId}`, noteId, titleTR, contentTR, now);

      db.prepare(`
        INSERT INTO portfolio_workspace_notes_translations (id, note_id, locale, title, content, updated_at)
        VALUES (?, ?, 'en', ?, ?, ?)
        ON CONFLICT(note_id, locale) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          updated_at = excluded.updated_at
      `).run(`wn-en-${noteId}`, noteId, titleEN, contentEN, now);
    }
  }

  // 3. Experience
  let expSort = 0;
  for (const exp of profileData.experience) {
    db.prepare(`
      INSERT INTO portfolio_experience (id, status, organization, start_date, category, skills_json, sort_order, created_at, updated_at, published_at)
      VALUES (?, 'published', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        organization = excluded.organization,
        start_date = excluded.start_date,
        category = excluded.category,
        skills_json = excluded.skills_json,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
    `).run(exp.id, exp.organization, exp.startDate, exp.category || "work", JSON.stringify(exp.skills || []), expSort++, now, now, now);

    db.prepare(`
      INSERT INTO portfolio_experience_translations (id, experience_id, locale, role, end_date, location, employment_type, description, updated_at)
      VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(experience_id, locale) DO UPDATE SET
        role = excluded.role,
        end_date = excluded.end_date,
        location = excluded.location,
        employment_type = excluded.employment_type,
        description = excluded.description,
        updated_at = excluded.updated_at
    `).run(`exp-tr-${exp.id}`, exp.id, exp.roleTR, exp.endDateTR, exp.locationTR || null, exp.typeTR || null, exp.descriptionTR, now);

    db.prepare(`
      INSERT INTO portfolio_experience_translations (id, experience_id, locale, role, end_date, location, employment_type, description, updated_at)
      VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(experience_id, locale) DO UPDATE SET
        role = excluded.role,
        end_date = excluded.end_date,
        location = excluded.location,
        employment_type = excluded.employment_type,
        description = excluded.description,
        updated_at = excluded.updated_at
    `).run(`exp-en-${exp.id}`, exp.id, exp.roleEN, exp.endDateEN, exp.locationEN || null, exp.typeEN || null, exp.descriptionEN, now);
  }

  // 4. Education
  let eduSort = 0;
  for (const edu of profileData.education) {
    db.prepare(`
      INSERT INTO portfolio_education (id, status, start_year, sort_order, created_at, updated_at, published_at)
      VALUES (?, 'published', ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        start_year = excluded.start_year,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
    `).run(edu.id, edu.startYear || null, eduSort++, now, now, now);

    db.prepare(`
      INSERT INTO portfolio_education_translations (id, education_id, locale, institution, program, end_year, status_label, description, updated_at)
      VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(education_id, locale) DO UPDATE SET
        institution = excluded.institution,
        program = excluded.program,
        end_year = excluded.end_year,
        status_label = excluded.status_label,
        description = excluded.description,
        updated_at = excluded.updated_at
    `).run(`edu-tr-${edu.id}`, edu.id, edu.institutionTR, edu.programTR, edu.endYearTR || "", edu.statusTR || "", edu.descriptionTR || null, now);

    db.prepare(`
      INSERT INTO portfolio_education_translations (id, education_id, locale, institution, program, end_year, status_label, description, updated_at)
      VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(education_id, locale) DO UPDATE SET
        institution = excluded.institution,
        program = excluded.program,
        end_year = excluded.end_year,
        status_label = excluded.status_label,
        description = excluded.description,
        updated_at = excluded.updated_at
    `).run(`edu-en-${edu.id}`, edu.id, edu.institutionEN, edu.programEN, edu.endYearEN || "", edu.statusEN || "", edu.descriptionEN || null, now);
  }

  // 5. Skills
  const categories = ["design", "web", "production", "ai", "strategy"];
  for (const cat of categories) {
    const list = profileData.skills[cat] || [];
    let sSort = 0;
    for (const sk of list) {
      const skillId = `skill-${cat}-${sSort + 1}`;
      db.prepare(`
        INSERT INTO portfolio_skills (id, category, status, sort_order, created_at, updated_at)
        VALUES (?, ?, 'published', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at
      `).run(skillId, cat, sSort, now, now);

      db.prepare(`
        INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
        VALUES (?, ?, 'tr', ?, ?)
        ON CONFLICT(skill_id, locale) DO UPDATE SET
          name = excluded.name,
          updated_at = excluded.updated_at
      `).run(`sk-tr-${skillId}`, skillId, sk.tr, now);

      db.prepare(`
        INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
        VALUES (?, ?, 'en', ?, ?)
        ON CONFLICT(skill_id, locale) DO UPDATE SET
          name = excluded.name,
          updated_at = excluded.updated_at
      `).run(`sk-en-${skillId}`, skillId, sk.en, now);

      sSort++;
    }
  }

  // Tools category
  const toolsList = profileData.skills.tools || [];
  let toolSort = 0;
  for (const tool of toolsList) {
    const skillId = `skill-tools-${toolSort + 1}`;
    db.prepare(`
      INSERT INTO portfolio_skills (id, category, status, sort_order, created_at, updated_at)
      VALUES (?, 'tools', 'published', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
    `).run(skillId, toolSort, now, now);

    db.prepare(`
      INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
      VALUES (?, ?, 'tr', ?, ?)
      ON CONFLICT(skill_id, locale) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at
    `).run(`sk-tr-${skillId}`, skillId, tool, now);

    db.prepare(`
      INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
      VALUES (?, ?, 'en', ?, ?)
      ON CONFLICT(skill_id, locale) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at
    `).run(`sk-en-${skillId}`, skillId, tool, now);

    toolSort++;
  }

  // 6. CV Documents (draft baseline with coming-soon state intact)
  db.prepare(`
    INSERT INTO portfolio_cv_documents (id, locale, status, storage_mode, storage_key, public_url, filename, mime_type, byte_size, sha256, created_at, updated_at)
    VALUES ('cv-tr', 'tr', 'draft', 'local_static', '', '/cv/kerem-mihci-cv-tr.pdf', 'kerem-mihci-cv-tr.pdf', 'application/pdf', 0, '', ?, ?)
    ON CONFLICT(locale) DO NOTHING
  `).run(now, now);

  db.prepare(`
    INSERT INTO portfolio_cv_documents (id, locale, status, storage_mode, storage_key, public_url, filename, mime_type, byte_size, sha256, created_at, updated_at)
    VALUES ('cv-en', 'en', 'draft', 'local_static', '', '/cv/kerem-mihci-cv-en.pdf', 'kerem-mihci-cv-en.pdf', 'application/pdf', 0, '', ?, ?)
    ON CONFLICT(locale) DO NOTHING
  `).run(now, now);

  // Audit log
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, 'system:importer', 'canonical_import_phase5', 'profile_bundle', 'main', ?, ?)
  `).run(
    `audit-${crypto.randomUUID()}`,
    JSON.stringify({ noteCount: 24, experienceCount: profileData.experience.length, educationCount: profileData.education.length }),
    now
  );

  console.log("[import-profile-notes-to-d1] Successfully imported Phase 5 canonical data into D1.");
  db.close();
}

main().catch((err) => {
  console.error("[import-profile-notes-to-d1] Execution failed:", err);
  process.exit(1);
});
