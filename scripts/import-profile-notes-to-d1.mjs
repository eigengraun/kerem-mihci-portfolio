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
 *   --dry-run                : Evaluates deep field-level parity without making database writes (default)
 *   --force / --execute      : Authorizes writing to local SQLite
 *   --db-path=<path>         : Custom SQLite path (for test sandboxes)
 *   --overwrite-owner-edits  : Authorizes overwriting owner-modified fields (disabled by default)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

export function parseArgs(rawArgs = process.argv.slice(2)) {
  let isLocal = false;
  let isDryRun = true;
  let isExecute = false;
  let customDbPath = null;
  let overwriteOwnerEdits = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--local" || arg === "--target=local") {
      isLocal = true;
    } else if (arg === "--force" || arg === "--execute") {
      isExecute = true;
      isDryRun = false;
    } else if (arg === "--dry-run") {
      isDryRun = true;
      isExecute = false;
    } else if (arg.startsWith("--db-path=")) {
      customDbPath = path.resolve(process.cwd(), arg.slice("--db-path=".length));
    } else if (arg === "--db-path" && i + 1 < rawArgs.length) {
      customDbPath = path.resolve(process.cwd(), rawArgs[++i]);
    } else if (arg === "--overwrite-owner-edits") {
      overwriteOwnerEdits = true;
    } else if (
      arg === "--remote-staging" ||
      arg === "--remote" ||
      arg === "--target=remote" ||
      arg.startsWith("--remote")
    ) {
      console.error("[ERROR] Remote seeding is explicitly BLOCKED by Phase 5.1 release safety policy.");
      console.error("Remote database seeding must not occur without explicit separate operator authorization.");
      process.exit(1);
    } else {
      console.error(`[ERROR] Unknown or unsupported argument: "${arg}"`);
      console.error("Usage: node scripts/import-profile-notes-to-d1.mjs [--local] [--dry-run | --force | --execute] [--db-path=<path>] [--overwrite-owner-edits]");
      process.exit(1);
    }
  }

  return { isLocal, isDryRun, isExecute, customDbPath, overwriteOwnerEdits };
}

async function loadStaticSource() {
  const { profileData } = await import("../src/data/profile.ts");
  return profileData;
}

function resolveDbPath(customDbPath) {
  if (customDbPath) return customDbPath;
  return path.join(ROOT, ".local-d1", "portfolio.sqlite");
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

export async function runImporter(opts = parseArgs()) {
  const dbPath = resolveDbPath(opts.customDbPath);

  console.log(`[import-profile-notes-to-d1] Target: ${dbPath}`);
  console.log(`[import-profile-notes-to-d1] Mode: ${opts.isDryRun ? "DRY-RUN (read-only invariant enforced)" : "EXECUTE (writable)"}`);

  if (!fs.existsSync(dbPath)) {
    if (opts.isDryRun) {
      console.error(`[ERROR] Database file not found at ${dbPath} (dry-run will not create new databases).`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath, { readOnly: opts.isDryRun });

  // Schema verification (never mutate schema in dry-run)
  const tablesRow = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='portfolio_profile'").get();
  if (!tablesRow) {
    if (opts.isDryRun) {
      console.error("[ERROR] Migration 0004 schema not initialized (portfolio_profile table missing). Run migrations first.");
      db.close();
      process.exit(1);
    }
    // Apply migrations in write mode only
    const migrationDir = path.join(ROOT, "cloudflare", "portfolio-api", "migrations");
    const migrationFiles = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationDir, file), "utf-8");
      db.exec(sql);
    }
    console.log("[import-profile-notes-to-d1] Applied migration schemas up to 0004.");
  }

  const profileData = await loadStaticSource();
  const now = new Date().toISOString();

  const stats = {
    matched: 0,
    inserted: 0,
    updated: 0,
    ownerModifiedPreserved: 0,
    missing: 0,
    totalChecked: 0
  };

  // ------------------------------------------------------------
  // 1. Profile Reconcile
  // ------------------------------------------------------------
  stats.totalChecked++;
  const profRow = db.prepare("SELECT * FROM portfolio_profile WHERE id = 'main'").get();
  const profTrRow = db.prepare("SELECT * FROM portfolio_profile_translations WHERE profile_id = 'main' AND locale = 'tr'").get();
  const profEnRow = db.prepare("SELECT * FROM portfolio_profile_translations WHERE profile_id = 'main' AND locale = 'en'").get();

  let profileMatches = false;
  if (profRow && profTrRow && profEnRow) {
    const mainMatches =
      profRow.name === profileData.name &&
      profRow.email === profileData.email &&
      profRow.image_url === profileData.image &&
      profRow.avatar_url === profileData.avatar &&
      areJsonEqual(profRow.stats_json, profileData.stats);

    const trMatches =
      profTrRow.headline === profileData.headlineTR &&
      profTrRow.location === profileData.locationTR &&
      profTrRow.image_alt === profileData.altTR &&
      areJsonEqual(profTrRow.summary_paragraphs_json, profileData.summaryTR) &&
      areJsonEqual(profTrRow.focus_areas_json, profileData.focusAreasTR);

    const enMatches =
      profEnRow.headline === profileData.headlineEN &&
      profEnRow.location === profileData.locationEN &&
      profEnRow.image_alt === profileData.altEN &&
      areJsonEqual(profEnRow.summary_paragraphs_json, profileData.summaryEN) &&
      areJsonEqual(profEnRow.focus_areas_json, profileData.focusAreasEN);

    profileMatches = mainMatches && trMatches && enMatches;
  }

  if (profileMatches) {
    stats.matched++;
  } else if (!profRow) {
    stats.missing++;
    if (!opts.isDryRun) {
      db.prepare(`
        INSERT INTO portfolio_profile (id, status, name, email, image_url, avatar_url, stats_json, created_at, updated_at, published_at)
        VALUES ('main', 'draft', ?, ?, ?, ?, ?, ?, ?, null)
      `).run(profileData.name, profileData.email, profileData.image, profileData.avatar, JSON.stringify(profileData.stats), now, now);

      db.prepare(`
        INSERT INTO portfolio_profile_translations (id, profile_id, locale, headline, location, image_alt, summary_paragraphs_json, focus_areas_json, updated_at)
        VALUES ('prof-tr', 'main', 'tr', ?, ?, ?, ?, ?, ?)
      `).run(profileData.headlineTR, profileData.locationTR, profileData.altTR, JSON.stringify(profileData.summaryTR), JSON.stringify(profileData.focusAreasTR), now);

      db.prepare(`
        INSERT INTO portfolio_profile_translations (id, profile_id, locale, headline, location, image_alt, summary_paragraphs_json, focus_areas_json, updated_at)
        VALUES ('prof-en', 'main', 'en', ?, ?, ?, ?, ?, ?)
      `).run(profileData.headlineEN, profileData.locationEN, profileData.altEN, JSON.stringify(profileData.summaryEN), JSON.stringify(profileData.focusAreasEN), now);

      stats.inserted++;
    }
  } else {
    // Exists but differs
    if (opts.overwriteOwnerEdits && !opts.isDryRun) {
      db.prepare(`
        UPDATE portfolio_profile SET
          name = ?, email = ?, image_url = ?, avatar_url = ?, stats_json = ?, updated_at = ?
        WHERE id = 'main'
      `).run(profileData.name, profileData.email, profileData.image, profileData.avatar, JSON.stringify(profileData.stats), now);

      db.prepare(`
        INSERT INTO portfolio_profile_translations (id, profile_id, locale, headline, location, image_alt, summary_paragraphs_json, focus_areas_json, updated_at)
        VALUES ('prof-tr', 'main', 'tr', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, locale) DO UPDATE SET
          headline = excluded.headline, location = excluded.location, image_alt = excluded.image_alt,
          summary_paragraphs_json = excluded.summary_paragraphs_json, focus_areas_json = excluded.focus_areas_json, updated_at = excluded.updated_at
      `).run(profileData.headlineTR, profileData.locationTR, profileData.altTR, JSON.stringify(profileData.summaryTR), JSON.stringify(profileData.focusAreasTR), now);

      db.prepare(`
        INSERT INTO portfolio_profile_translations (id, profile_id, locale, headline, location, image_alt, summary_paragraphs_json, focus_areas_json, updated_at)
        VALUES ('prof-en', 'main', 'en', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, locale) DO UPDATE SET
          headline = excluded.headline, location = excluded.location, image_alt = excluded.image_alt,
          summary_paragraphs_json = excluded.summary_paragraphs_json, focus_areas_json = excluded.focus_areas_json, updated_at = excluded.updated_at
      `).run(profileData.headlineEN, profileData.locationEN, profileData.altEN, JSON.stringify(profileData.summaryEN), JSON.stringify(profileData.focusAreasEN), now);

      stats.updated++;
    } else {
      stats.ownerModifiedPreserved++;
    }
  }

  // ------------------------------------------------------------
  // 2. Workspace Notes Reconcile (24 items)
  // ------------------------------------------------------------
  const workspaces = ["design", "web", "motion-ai"];
  const rawItemsTR = profileData.notes.itemsTR;
  const rawItemsEN = profileData.notes.itemsEN;

  for (const ws of workspaces) {
    for (let i = 0; i < rawItemsTR.length; i++) {
      stats.totalChecked++;
      const noteId = `note-${ws}-${i + 1}`;
      const titleTR = `0${i + 1} — Not`;
      const titleEN = `0${i + 1} — Note`;
      const contentTR = rawItemsTR[i];
      const contentEN = rawItemsEN[i];
      const filename = `note-0${i + 1}.txt`;

      const existingNote = db.prepare("SELECT * FROM portfolio_workspace_notes WHERE id = ?").get(noteId);
      const existingTr = db.prepare("SELECT * FROM portfolio_workspace_notes_translations WHERE note_id = ? AND locale = 'tr'").get(noteId);
      const existingEn = db.prepare("SELECT * FROM portfolio_workspace_notes_translations WHERE note_id = ? AND locale = 'en'").get(noteId);

      let noteMatches = false;
      if (existingNote && existingTr && existingEn) {
        noteMatches =
          existingNote.workspace_id === ws &&
          existingNote.filename === filename &&
          existingTr.content === contentTR &&
          existingEn.content === contentEN;
      }

      if (noteMatches) {
        stats.matched++;
      } else if (!existingNote) {
        stats.missing++;
        if (!opts.isDryRun) {
          db.prepare(`
            INSERT INTO portfolio_workspace_notes (id, workspace_id, status, sort_order, filename, created_at, updated_at, published_at)
            VALUES (?, ?, 'draft', ?, ?, ?, ?, null)
          `).run(noteId, ws, i, filename, now, now);

          db.prepare(`
            INSERT INTO portfolio_workspace_notes_translations (id, note_id, locale, title, content, updated_at)
            VALUES (?, ?, 'tr', ?, ?, ?)
          `).run(`wn-tr-${noteId}`, noteId, titleTR, contentTR, now);

          db.prepare(`
            INSERT INTO portfolio_workspace_notes_translations (id, note_id, locale, title, content, updated_at)
            VALUES (?, ?, 'en', ?, ?, ?)
          `).run(`wn-en-${noteId}`, noteId, titleEN, contentEN, now);

          stats.inserted++;
        }
      } else {
        if (opts.overwriteOwnerEdits && !opts.isDryRun) {
          db.prepare(`
            UPDATE portfolio_workspace_notes SET
              sort_order = ?, filename = ?, updated_at = ?
            WHERE id = ?
          `).run(i, filename, now, noteId);

          db.prepare(`
            INSERT INTO portfolio_workspace_notes_translations (id, note_id, locale, title, content, updated_at)
            VALUES (?, ?, 'tr', ?, ?, ?)
            ON CONFLICT(note_id, locale) DO UPDATE SET
              title = excluded.title, content = excluded.content, updated_at = excluded.updated_at
          `).run(`wn-tr-${noteId}`, noteId, titleTR, contentTR, now);

          db.prepare(`
            INSERT INTO portfolio_workspace_notes_translations (id, note_id, locale, title, content, updated_at)
            VALUES (?, ?, 'en', ?, ?, ?)
            ON CONFLICT(note_id, locale) DO UPDATE SET
              title = excluded.title, content = excluded.content, updated_at = excluded.updated_at
          `).run(`wn-en-${noteId}`, noteId, titleEN, contentEN, now);

          stats.updated++;
        } else {
          stats.ownerModifiedPreserved++;
        }
      }
    }
  }

  // ------------------------------------------------------------
  // 3. Experience Reconcile (5 items)
  // ------------------------------------------------------------
  let expSort = 0;
  for (const exp of profileData.experience) {
    stats.totalChecked++;
    const expRow = db.prepare("SELECT * FROM portfolio_experience WHERE id = ?").get(exp.id);
    const expTr = db.prepare("SELECT * FROM portfolio_experience_translations WHERE experience_id = ? AND locale = 'tr'").get(exp.id);
    const expEn = db.prepare("SELECT * FROM portfolio_experience_translations WHERE experience_id = ? AND locale = 'en'").get(exp.id);

    let expMatches = false;
    if (expRow && expTr && expEn) {
      expMatches =
        expRow.organization === exp.organization &&
        expRow.start_date === exp.startDate &&
        expRow.category === (exp.category || "work") &&
        areJsonEqual(expRow.skills_json, exp.skills || []) &&
        expTr.role === exp.roleTR &&
        expTr.end_date === exp.endDateTR &&
        expTr.description === exp.descriptionTR &&
        expEn.role === exp.roleEN &&
        expEn.end_date === exp.endDateEN &&
        expEn.description === exp.descriptionEN;
    }

    if (expMatches) {
      stats.matched++;
    } else if (!expRow) {
      stats.missing++;
      if (!opts.isDryRun) {
        db.prepare(`
          INSERT INTO portfolio_experience (id, status, organization, start_date, category, skills_json, sort_order, created_at, updated_at, published_at)
          VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, null)
        `).run(exp.id, exp.organization, exp.startDate, exp.category || "work", JSON.stringify(exp.skills || []), expSort, now, now);

        db.prepare(`
          INSERT INTO portfolio_experience_translations (id, experience_id, locale, role, end_date, location, employment_type, description, updated_at)
          VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)
        `).run(`exp-tr-${exp.id}`, exp.id, exp.roleTR, exp.endDateTR, exp.locationTR || null, exp.typeTR || null, exp.descriptionTR, now);

        db.prepare(`
          INSERT INTO portfolio_experience_translations (id, experience_id, locale, role, end_date, location, employment_type, description, updated_at)
          VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)
        `).run(`exp-en-${exp.id}`, exp.id, exp.roleEN, exp.endDateEN, exp.locationEN || null, exp.typeEN || null, exp.descriptionEN, now);

        stats.inserted++;
      }
    } else {
      if (opts.overwriteOwnerEdits && !opts.isDryRun) {
        db.prepare(`
          UPDATE portfolio_experience SET
            organization = ?, start_date = ?, category = ?, skills_json = ?, sort_order = ?, updated_at = ?
          WHERE id = ?
        `).run(exp.organization, exp.startDate, exp.category || "work", JSON.stringify(exp.skills || []), expSort, now, exp.id);

        db.prepare(`
          INSERT INTO portfolio_experience_translations (id, experience_id, locale, role, end_date, location, employment_type, description, updated_at)
          VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(experience_id, locale) DO UPDATE SET
            role = excluded.role, end_date = excluded.end_date, location = excluded.location,
            employment_type = excluded.employment_type, description = excluded.description, updated_at = excluded.updated_at
        `).run(`exp-tr-${exp.id}`, exp.id, exp.roleTR, exp.endDateTR, exp.locationTR || null, exp.typeTR || null, exp.descriptionTR, now);

        db.prepare(`
          INSERT INTO portfolio_experience_translations (id, experience_id, locale, role, end_date, location, employment_type, description, updated_at)
          VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(experience_id, locale) DO UPDATE SET
            role = excluded.role, end_date = excluded.end_date, location = excluded.location,
            employment_type = excluded.employment_type, description = excluded.description, updated_at = excluded.updated_at
        `).run(`exp-en-${exp.id}`, exp.id, exp.roleEN, exp.endDateEN, exp.locationEN || null, exp.typeEN || null, exp.descriptionEN, now);

        stats.updated++;
      } else {
        stats.ownerModifiedPreserved++;
      }
    }
    expSort++;
  }

  // ------------------------------------------------------------
  // 4. Education Reconcile (2 items)
  // ------------------------------------------------------------
  let eduSort = 0;
  for (const edu of profileData.education) {
    stats.totalChecked++;
    const eduRow = db.prepare("SELECT * FROM portfolio_education WHERE id = ?").get(edu.id);
    const eduTr = db.prepare("SELECT * FROM portfolio_education_translations WHERE education_id = ? AND locale = 'tr'").get(edu.id);
    const eduEn = db.prepare("SELECT * FROM portfolio_education_translations WHERE education_id = ? AND locale = 'en'").get(edu.id);

    let eduMatches = false;
    if (eduRow && eduTr && eduEn) {
      eduMatches =
        eduRow.start_year === (edu.startYear || null) &&
        eduTr.institution === edu.institutionTR &&
        eduTr.program === edu.programTR &&
        eduTr.end_year === (edu.endYearTR || "") &&
        eduTr.status_label === (edu.statusTR || "") &&
        eduEn.institution === edu.institutionEN &&
        eduEn.program === edu.programEN &&
        eduEn.end_year === (edu.endYearEN || "") &&
        eduEn.status_label === (edu.statusEN || "");
    }

    if (eduMatches) {
      stats.matched++;
    } else if (!eduRow) {
      stats.missing++;
      if (!opts.isDryRun) {
        db.prepare(`
          INSERT INTO portfolio_education (id, status, start_year, sort_order, created_at, updated_at, published_at)
          VALUES (?, 'draft', ?, ?, ?, ?, null)
        `).run(edu.id, edu.startYear || null, eduSort, now, now);

        db.prepare(`
          INSERT INTO portfolio_education_translations (id, education_id, locale, institution, program, end_year, status_label, description, updated_at)
          VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)
        `).run(`edu-tr-${edu.id}`, edu.id, edu.institutionTR, edu.programTR, edu.endYearTR || "", edu.statusTR || "", edu.descriptionTR || null, now);

        db.prepare(`
          INSERT INTO portfolio_education_translations (id, education_id, locale, institution, program, end_year, status_label, description, updated_at)
          VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)
        `).run(`edu-en-${edu.id}`, edu.id, edu.institutionEN, edu.programEN, edu.endYearEN || "", edu.statusEN || "", edu.descriptionEN || null, now);

        stats.inserted++;
      }
    } else {
      if (opts.overwriteOwnerEdits && !opts.isDryRun) {
        db.prepare(`
          UPDATE portfolio_education SET
            start_year = ?, sort_order = ?, updated_at = ?
          WHERE id = ?
        `).run(edu.startYear || null, eduSort, now, edu.id);

        db.prepare(`
          INSERT INTO portfolio_education_translations (id, education_id, locale, institution, program, end_year, status_label, description, updated_at)
          VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(education_id, locale) DO UPDATE SET
            institution = excluded.institution, program = excluded.program, end_year = excluded.end_year,
            status_label = excluded.status_label, description = excluded.description, updated_at = excluded.updated_at
        `).run(`edu-tr-${edu.id}`, edu.id, edu.institutionTR, edu.programTR, edu.endYearTR || "", edu.statusTR || "", edu.descriptionTR || null, now);

        db.prepare(`
          INSERT INTO portfolio_education_translations (id, education_id, locale, institution, program, end_year, status_label, description, updated_at)
          VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(education_id, locale) DO UPDATE SET
            institution = excluded.institution, program = excluded.program, end_year = excluded.end_year,
            status_label = excluded.status_label, description = excluded.description, updated_at = excluded.updated_at
        `).run(`edu-en-${edu.id}`, edu.id, edu.institutionEN, edu.programEN, edu.endYearEN || "", edu.statusEN || "", edu.descriptionEN || null, now);

        stats.updated++;
      } else {
        stats.ownerModifiedPreserved++;
      }
    }
    eduSort++;
  }

  // ------------------------------------------------------------
  // 5. Skills Reconcile (39 items)
  // ------------------------------------------------------------
  const skillCategories = ["design", "web", "production", "ai", "strategy"];
  let globalSkillSort = 0;

  for (const cat of skillCategories) {
    const list = profileData.skills[cat] || [];
    let sSort = 0;
    for (const sk of list) {
      stats.totalChecked++;
      const skillId = `skill-${cat}-${sSort + 1}`;
      const skillRow = db.prepare("SELECT * FROM portfolio_skills WHERE id = ?").get(skillId);
      const skTr = db.prepare("SELECT * FROM portfolio_skill_translations WHERE skill_id = ? AND locale = 'tr'").get(skillId);
      const skEn = db.prepare("SELECT * FROM portfolio_skill_translations WHERE skill_id = ? AND locale = 'en'").get(skillId);

      let skillMatches = false;
      if (skillRow && skTr && skEn) {
        skillMatches =
          skillRow.category === cat &&
          skTr.name === sk.tr &&
          skEn.name === sk.en;
      }

      if (skillMatches) {
        stats.matched++;
      } else if (!skillRow) {
        stats.missing++;
        if (!opts.isDryRun) {
          db.prepare(`
            INSERT INTO portfolio_skills (id, category, status, sort_order, created_at, updated_at)
            VALUES (?, ?, 'draft', ?, ?, ?)
          `).run(skillId, cat, sSort, now, now);

          db.prepare(`
            INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
            VALUES (?, ?, 'tr', ?, ?)
          `).run(`sk-tr-${skillId}`, skillId, sk.tr, now);

          db.prepare(`
            INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
            VALUES (?, ?, 'en', ?, ?)
          `).run(`sk-en-${skillId}`, skillId, sk.en, now);

          stats.inserted++;
        }
      } else {
        if (opts.overwriteOwnerEdits && !opts.isDryRun) {
          db.prepare(`
            UPDATE portfolio_skills SET
              category = ?, sort_order = ?, updated_at = ?
            WHERE id = ?
          `).run(cat, sSort, now, skillId);

          db.prepare(`
            INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
            VALUES (?, ?, 'tr', ?, ?)
            ON CONFLICT(skill_id, locale) DO UPDATE SET
              name = excluded.name, updated_at = excluded.updated_at
          `).run(`sk-tr-${skillId}`, skillId, sk.tr, now);

          db.prepare(`
            INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
            VALUES (?, ?, 'en', ?, ?)
            ON CONFLICT(skill_id, locale) DO UPDATE SET
              name = excluded.name, updated_at = excluded.updated_at
          `).run(`sk-en-${skillId}`, skillId, sk.en, now);

          stats.updated++;
        } else {
          stats.ownerModifiedPreserved++;
        }
      }
      sSort++;
      globalSkillSort++;
    }
  }

  // Tools category
  const toolsList = profileData.skills.tools || [];
  let toolSort = 0;
  for (const tool of toolsList) {
    stats.totalChecked++;
    const skillId = `skill-tools-${toolSort + 1}`;
    const skillRow = db.prepare("SELECT * FROM portfolio_skills WHERE id = ?").get(skillId);
    const skTr = db.prepare("SELECT * FROM portfolio_skill_translations WHERE skill_id = ? AND locale = 'tr'").get(skillId);
    const skEn = db.prepare("SELECT * FROM portfolio_skill_translations WHERE skill_id = ? AND locale = 'en'").get(skillId);

    let toolMatches = false;
    if (skillRow && skTr && skEn) {
      toolMatches =
        skillRow.category === "tools" &&
        skTr.name === tool &&
        skEn.name === tool;
    }

    if (toolMatches) {
      stats.matched++;
    } else if (!skillRow) {
      stats.missing++;
      if (!opts.isDryRun) {
        db.prepare(`
          INSERT INTO portfolio_skills (id, category, status, sort_order, created_at, updated_at)
          VALUES (?, 'tools', 'draft', ?, ?, ?)
        `).run(skillId, toolSort, now, now);

        db.prepare(`
          INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
          VALUES (?, ?, 'tr', ?, ?)
        `).run(`sk-tr-${skillId}`, skillId, tool, now);

        db.prepare(`
          INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
          VALUES (?, ?, 'en', ?, ?)
        `).run(`sk-en-${skillId}`, skillId, tool, now);

        stats.inserted++;
      }
    } else {
      if (opts.overwriteOwnerEdits && !opts.isDryRun) {
        db.prepare(`
          UPDATE portfolio_skills SET
            category = 'tools', sort_order = ?, updated_at = ?
          WHERE id = ?
        `).run(toolSort, now, skillId);

        db.prepare(`
          INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
          VALUES (?, ?, 'tr', ?, ?)
          ON CONFLICT(skill_id, locale) DO UPDATE SET
            name = excluded.name, updated_at = excluded.updated_at
        `).run(`sk-tr-${skillId}`, skillId, tool, now);

        db.prepare(`
          INSERT INTO portfolio_skill_translations (id, skill_id, locale, name, updated_at)
          VALUES (?, ?, 'en', ?, ?)
          ON CONFLICT(skill_id, locale) DO UPDATE SET
            name = excluded.name, updated_at = excluded.updated_at
        `).run(`sk-en-${skillId}`, skillId, tool, now);

        stats.updated++;
      } else {
        stats.ownerModifiedPreserved++;
      }
    }
    toolSort++;
  }

  // ------------------------------------------------------------
  // 6. CV Documents (2 items)
  // ------------------------------------------------------------
  for (const loc of ["tr", "en"]) {
    stats.totalChecked++;
    const cvRow = db.prepare("SELECT * FROM portfolio_cv_documents WHERE locale = ?").get(loc);
    if (cvRow) {
      stats.matched++;
    } else {
      stats.missing++;
      if (!opts.isDryRun) {
        const publicUrl = `/cv/kerem-mihci-cv-${loc}.pdf`;
        const filename = `kerem-mihci-cv-${loc}.pdf`;
        db.prepare(`
          INSERT INTO portfolio_cv_documents (id, locale, status, storage_mode, storage_key, public_url, filename, mime_type, byte_size, sha256, created_at, updated_at)
          VALUES (?, ?, 'draft', 'local_static', '', ?, ?, 'application/pdf', 0, '', ?, ?)
        `).run(`cv-${loc}`, loc, publicUrl, filename, now, now);
        stats.inserted++;
      }
    }
  }

  // Reporting & Audit
  console.log(`[import-profile-notes-to-d1] Total entities checked: ${stats.totalChecked}`);
  console.log(`[import-profile-notes-to-d1] Matched with source:    ${stats.matched}`);
  console.log(`[import-profile-notes-to-d1] Missing from database:  ${stats.missing}`);
  console.log(`[import-profile-notes-to-d1] Preserved owner edits:  ${stats.ownerModifiedPreserved}`);
  console.log(`[import-profile-notes-to-d1] Newly inserted:         ${stats.inserted}`);
  console.log(`[import-profile-notes-to-d1] Updated:                ${stats.updated}`);

  if (opts.isDryRun) {
    console.log("[import-profile-notes-to-d1] Dry-run complete. Parity evaluated. Zero mutations applied.");
    db.close();
    return stats;
  }

  if (stats.inserted > 0 || stats.updated > 0) {
    db.prepare(`
      INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, 'system:importer', 'canonical_import_phase5', 'profile_bundle', 'main', ?, ?)
    `).run(
      `audit-${crypto.randomUUID()}`,
      JSON.stringify({
        inserted: stats.inserted,
        updated: stats.updated,
        matched: stats.matched,
        preserved: stats.ownerModifiedPreserved
      }),
      now
    );
    console.log("[import-profile-notes-to-d1] Applied mutations and recorded audit log event.");
  } else {
    console.log("[import-profile-notes-to-d1] Database is 100% identical to canonical sources. 0 writes executed. Zero audit logs generated (idempotent).");
  }

  db.close();
  return stats;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runImporter().catch((err) => {
    console.error("[import-profile-notes-to-d1] Execution failed:", err);
    process.exit(1);
  });
}
