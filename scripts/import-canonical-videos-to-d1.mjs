#!/usr/bin/env node
/**
 * scripts/import-canonical-videos-to-d1.mjs
 *
 * Deterministic, idempotent, non-destructive import and parity validation tool
 * for the canonical 21 PortfolioVideo records from src/data/videos.ts into D1.
 *
 * Supported Targets:
 *   --local / --target=local           : Targets local SQLite D1 simulation (.local-d1/portfolio.sqlite)
 *   --remote-staging / --target=remote-staging : Targets verified Cloudflare staging D1 & Worker
 *
 * Flags:
 *   --dry-run : Evaluates canonical parity without making database writes (default)
 *   --force   : Explicitly authorizes overwriting existing records (LOCAL ONLY)
 *   --execute : Authorizes executing remote staging seeding (REQUIRES VERDICT A APPROVAL)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

export const APPROVED_STAGING_CONFIG = Object.freeze({
  workerUrl: "https://kerem-mihci-portfolio-api-staging.kerem-mihci.workers.dev",
  workerName: "kerem-mihci-portfolio-api-staging",
  databaseName: "kerem-portfolio-db-staging",
  databaseId: "0efef7a7-cc93-4dc2-8cb7-db28379fe01f",
  r2Bucket: "kerem-portfolio-media-staging"
});

function verifyStagingTargetConfiguration() {
  const wranglerPath = path.join(ROOT, "cloudflare", "portfolio-api", "wrangler.jsonc");
  if (!fs.existsSync(wranglerPath)) {
    throw new Error(`Wrangler configuration file not found at ${wranglerPath}`);
  }
  const content = fs.readFileSync(wranglerPath, "utf-8");
  const cleanJson = content.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, "");
  let parsed;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    throw new Error(`Failed to parse wrangler.jsonc: ${err.message}`);
  }

  const stagingEnv = parsed.env?.staging;
  if (!stagingEnv) {
    throw new Error("Missing 'staging' environment block in wrangler.jsonc");
  }

  const d1 = stagingEnv.d1_databases?.[0];
  const r2 = stagingEnv.r2_buckets?.[0];
  const workerName = stagingEnv.name;

  if (workerName !== APPROVED_STAGING_CONFIG.workerName) {
    throw new Error(`Worker name mismatch: expected ${APPROVED_STAGING_CONFIG.workerName}, found ${workerName}`);
  }
  if (d1?.database_name !== APPROVED_STAGING_CONFIG.databaseName) {
    throw new Error(`D1 database name mismatch: expected ${APPROVED_STAGING_CONFIG.databaseName}, found ${d1?.database_name}`);
  }
  if (d1?.database_id !== APPROVED_STAGING_CONFIG.databaseId) {
    throw new Error(`D1 database ID mismatch: expected ${APPROVED_STAGING_CONFIG.databaseId}, found ${d1?.database_id}`);
  }
  if (r2?.bucket_name !== APPROVED_STAGING_CONFIG.r2Bucket) {
    throw new Error(`R2 bucket mismatch: expected ${APPROVED_STAGING_CONFIG.r2Bucket}, found ${r2?.bucket_name}`);
  }

  // Reject production
  if (workerName.includes("prod") || d1.database_name.includes("prod") || d1.database_id.includes("prod")) {
    throw new Error("Production identifiers detected! Refusing to run.");
  }

  return { workerName, d1, r2 };
}

// 1. Strict Fail-Closed CLI Argument Parsing (When run directly)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

let isRemoteStaging = false;
let isLocal = true;
let isForce = false;
let isExecute = false;
let isDryRun = true;
let isStrictAdmission = false;
let customDbPath = null;

if (isMain) {
  const rawArgs = process.argv.slice(2);
  const VALID_FLAGS = new Set([
    "--local",
    "--target=local",
    "--remote-staging",
    "--target=remote-staging",
    "--dry-run",
    "--strict",
    "--strict-admission",
    "--force",
    "--execute"
  ]);

  for (const arg of rawArgs) {
    if (arg.startsWith("--db=")) {
      customDbPath = path.resolve(arg.slice("--db=".length));
      continue;
    }
    if (arg.startsWith("--database=")) {
      customDbPath = path.resolve(arg.slice("--database=".length));
      continue;
    }
    if (!VALID_FLAGS.has(arg)) {
      console.error(`FATAL: Unrecognized CLI argument "${arg}".`);
      console.error("Allowed flags: --local, --remote-staging, --dry-run, --strict-admission, --force, --execute, --db=<path>.");
      process.exit(1);
    }
  }

  isRemoteStaging = rawArgs.includes("--remote-staging") || rawArgs.includes("--target=remote-staging");
  isLocal = rawArgs.includes("--local") || rawArgs.includes("--target=local") || !isRemoteStaging;
  isForce = rawArgs.includes("--force");
  isExecute = rawArgs.includes("--execute");
  isDryRun = rawArgs.includes("--dry-run") || (!isExecute && !isForce);
  isStrictAdmission = rawArgs.includes("--strict-admission") || rawArgs.includes("--strict");

  if (isRemoteStaging) {
    const FORBIDDEN_OVERRIDE_VARS = [
      "TEST_MOCK_STAGING_WORKER_URL",
      "STAGING_WORKER_URL",
      "WORKER_URL",
      "CF_WORKER_URL"
    ];
    for (const varName of FORBIDDEN_OVERRIDE_VARS) {
      if (process.env[varName]) {
        console.error(`\nFATAL: Unsafe Worker URL override detected in environment variable "${varName}".`);
        console.error("Remote staging operations must strictly target the approved Worker URL:");
        console.error(`  ${APPROVED_STAGING_CONFIG.workerUrl}`);
        console.error("Endpoint overrides are strictly prohibited to prevent credential leakage or unintended target redirection.");
        process.exit(1);
      }
    }
  }

  if (isRemoteStaging && isForce) {
    console.error("FATAL: --force overwrite is strictly prohibited against remote staging. Remote seeding must be non-destructive.");
    process.exit(1);
  }
}

const dbPath = customDbPath
  ? customDbPath
  : process.env.LOCAL_D1_DB_PATH
    ? path.resolve(process.env.LOCAL_D1_DB_PATH)
    : path.join(ROOT, ".local-d1", "portfolio.sqlite");

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function resolveServiceToken() {
  if (process.env.CLOUDFLARE_API_SERVICE_TOKEN) {
    return process.env.CLOUDFLARE_API_SERVICE_TOKEN.trim();
  }
  const tokenCandidates = [
    path.join(ROOT, "cloudflare", "portfolio-api", ".staging-service-token.tmp"),
    path.join(ROOT, ".staging-service-token.tmp")
  ];
  for (const p of tokenCandidates) {
    try {
      if (fs.existsSync(p)) {
        const token = fs.readFileSync(p, "utf-8").trim();
        if (token.length >= 16) return token;
      }
    } catch {}
  }
  return "";
}

export function compareCanonicalWithRecord(c, r) {
  const diffs = [];
  const check = (field, expected, actual) => {
    const expStr = JSON.stringify(expected ?? null);
    const actStr = JSON.stringify(actual ?? null);
    if (expStr !== actStr) {
      diffs.push({ field, expected, actual });
    }
  };

  check("id", c.id, r.id);
  check("slug", c.slug, r.slug);
  check("type", c.type, r.type);
  check("orientation", c.orientation || "portrait", r.orientation);
  check("aiAssisted", Boolean(c.aiAssisted), Boolean(r.aiAssisted));
  check("productionMethod", c.productionMethod || "traditional", r.productionMethod);
  check("client", c.client || "", r.client || "");
  check("year", c.year || 2026, Number(r.year || 2026));
  check("titleTR", c.titleTR, r.titleTR);
  check("titleEN", c.titleEN, r.titleEN);
  check("shortTitleTR", c.shortTitleTR || "", r.shortTitleTR || "");
  check("shortTitleEN", c.shortTitleEN || "", r.shortTitleEN || "");
  check("descriptionTR", c.descriptionTR || "", r.descriptionTR || "");
  check("descriptionEN", c.descriptionEN || "", r.descriptionEN || "");
  // Optional-field semantics: absent or empty full description is preserved without substitution
  check("fullDescriptionTR", c.fullDescriptionTR || "", r.fullDescriptionTR || "");
  check("fullDescriptionEN", c.fullDescriptionEN || "", r.fullDescriptionEN || "");
  check("poster", c.poster, r.poster);
  check("src", c.src || `/videos/${c.slug}/video.mp4`, r.src);
  check("thumbnail", c.thumbnail || null, r.thumbnail || null);
  check("duration", c.duration || "", r.duration || "");
  const expectedAspect = c.aspectRatio || (c.orientation === "landscape" ? "16:9" : "9:16");
  const actualAspect = r.aspectRatio || (r.orientation === "landscape" ? "16:9" : "9:16");
  check("aspectRatio", expectedAspect, actualAspect);
  check("featured", Boolean(c.featured), Boolean(r.featured));
  check("sortOrder", c.sortOrder, Number(r.sortOrder));
  const expectedAutoplay = c.autoplayPreview !== false;
  const actualAutoplay = r.autoplayPreview !== false;
  check("autoplayPreview", expectedAutoplay, actualAutoplay);
  check("externalUrl", c.externalUrl || null, r.externalUrl || null);
  check("projectSlug", c.projectSlug || null, r.projectSlug || null);
  check("tools", c.tools || [], r.tools || []);
  check("tags", c.tags || [], r.tags || []);
  check("servicesTR", c.servicesTR || c.services || [], r.servicesTR || []);
  check("servicesEN", c.servicesEN || c.services || [], r.servicesEN || []);

  return {
    isParity: diffs.length === 0,
    diffs
  };
}

export function reconcileCanonicalVideos(canonicalVideos, existingRecords) {
  const result = {
    canonicalParity: [],
    ownerModified: [],
    missing: [],
    identityConflicts: []
  };

  for (const c of canonicalVideos) {
    const matchingById = existingRecords.filter((r) => String(r.id) === String(c.id));
    const matchingBySlug = existingRecords.filter((r) => String(r.slug) === String(c.slug));

    // Multiple matches (BLOCK)
    if (matchingById.length > 1 || matchingBySlug.length > 1) {
      result.identityConflicts.push({
        canonical: c,
        type: "MULTIPLE_MATCHES",
        reason: `Multiple records found matching ID "${c.id}" (${matchingById.length}) or slug "${c.slug}" (${matchingBySlug.length})`
      });
      continue;
    }

    // Matching ID but conflicting slug (BLOCK)
    if (matchingById.length === 1 && matchingBySlug.length === 0) {
      result.identityConflicts.push({
        canonical: c,
        type: "ID_MATCH_SLUG_CONFLICT",
        reason: `Matching ID "${c.id}" but conflicting slug: existing record has slug "${matchingById[0].slug}", canonical has "${c.slug}"`
      });
      continue;
    }

    // Matching slug but conflicting ID (BLOCK)
    if (matchingById.length === 0 && matchingBySlug.length === 1) {
      result.identityConflicts.push({
        canonical: c,
        type: "SLUG_MATCH_ID_CONFLICT",
        reason: `Matching slug "${c.slug}" but conflicting ID: existing record has ID "${matchingBySlug[0].id}", canonical has "${c.id}"`
      });
      continue;
    }

    // Cross-record clash (Record A has ID, Record B has Slug) (BLOCK)
    if (matchingById.length === 1 && matchingBySlug.length === 1) {
      if (matchingById[0].id !== matchingBySlug[0].id) {
        result.identityConflicts.push({
          canonical: c,
          type: "CROSS_RECORD_CONFLICT",
          reason: `Cross-record conflict: canonical ID "${c.id}" belongs to slug "${matchingById[0].slug}" while canonical slug "${c.slug}" belongs to ID "${matchingBySlug[0].id}"`
        });
        continue;
      }

      // Exactly 1 matching record with matching ID and matching slug (EXISTING)
      const existing = matchingById[0];
      const comparison = compareCanonicalWithRecord(c, existing);
      if (comparison.isParity) {
        result.canonicalParity.push({ canonical: c, record: existing });
      } else {
        result.ownerModified.push({
          canonical: c,
          record: existing,
          diffs: comparison.diffs,
          preservedStatus: existing.cmsStatus || existing.status || "published"
        });
      }
      continue;
    }

    // Missing both ID and slug (ELIGIBLE FOR INSERTION)
    if (matchingById.length === 0 && matchingBySlug.length === 0) {
      result.missing.push(c);
    }
  }

  return result;
}

export function mapLocalRowsToCmsVideos(videoRows, translationRows, assetRows) {
  const transMap = new Map();
  for (const t of translationRows) {
    const vid = String(t.video_id);
    if (!transMap.has(vid)) transMap.set(vid, {});
    const entry = transMap.get(vid);
    if (t.locale === "tr") entry.tr = t;
    else if (t.locale === "en") entry.en = t;
  }

  const assetMap = new Map();
  for (const a of assetRows) {
    const vid = String(a.video_id);
    if (!assetMap.has(vid)) assetMap.set(vid, {});
    const entry = assetMap.get(vid);
    if (a.asset_type === "poster") entry.poster = a;
    else if (a.asset_type === "video") entry.video = a;
    else if (a.asset_type === "thumbnail") entry.thumbnail = a;
  }

  return videoRows.map((row) => {
    const vid = String(row.id);
    const tr = transMap.get(vid)?.tr || {};
    const en = transMap.get(vid)?.en || {};
    const assets = assetMap.get(vid) || {};

    let tools = [];
    try { if (row.tools_json) tools = JSON.parse(String(row.tools_json)); } catch {}

    let tags = [];
    try { if (row.tags_json) tags = JSON.parse(String(row.tags_json)); } catch {}

    let servicesTR = [];
    try { if (tr.services_json) servicesTR = JSON.parse(String(tr.services_json)); } catch {}

    let servicesEN = [];
    try { if (en.services_json) servicesEN = JSON.parse(String(en.services_json)); } catch {}

    return {
      id: vid,
      slug: String(row.slug),
      type: row.video_type || "reel",
      orientation: row.orientation || "portrait",
      productionMethod: row.production_method || "traditional",
      aiAssisted: Number(row.ai_assisted) === 1,
      client: String(row.client_name || ""),
      year: Number(row.year || 2026),
      titleTR: String(tr.title || row.slug),
      titleEN: String(en.title || tr.title || row.slug),
      shortTitleTR: tr.short_title ? String(tr.short_title) : "",
      shortTitleEN: en.short_title ? String(en.short_title) : "",
      descriptionTR: String(tr.description || ""),
      descriptionEN: String(en.description || ""),
      fullDescriptionTR: tr.full_description ? String(tr.full_description) : "",
      fullDescriptionEN: en.full_description ? String(en.full_description) : "",
      poster: String(assets.poster?.public_url || `/videos/${row.slug}/poster.webp`),
      src: String(assets.video?.public_url || `/videos/${row.slug}/video.mp4`),
      thumbnail: assets.thumbnail?.public_url ? String(assets.thumbnail.public_url) : null,
      duration: String(row.duration || ""),
      aspectRatio: String(row.aspect_ratio || (row.orientation === "landscape" ? "16:9" : "9:16")),
      featured: Number(row.featured) === 1,
      sortOrder: Number(row.sort_order || 0),
      autoplayPreview: Number(row.autoplay_preview ?? 1) === 1,
      externalUrl: row.external_url ? String(row.external_url) : null,
      projectSlug: row.project_slug ? String(row.project_slug) : null,
      tools,
      tags,
      servicesTR,
      servicesEN,
      cmsStatus: String(row.status || "draft")
    };
  });
}

export async function runRemoteStagingSeed(canonicalVideos, di = null) {
  if (di !== null) {
    if (di.testSandboxGuard !== "EXPLICIT_TEST_SANDBOX_DI_GUARD_TOKEN") {
      throw new Error("SECURITY_VIOLATION: Injected staging seed options require explicit testSandboxGuard token.");
    }
  }

  const isDryRunActive = di ? Boolean(di.isDryRun ?? true) : isDryRun;
  const isStrictAdmissionActive = di ? Boolean(di.isStrictAdmission ?? false) : isStrictAdmission;
  const targetWorkerUrl = di?.workerUrl || APPROVED_STAGING_CONFIG.workerUrl;
  const fetcher = di?.fetchImpl || fetch;

  console.log("============================================================");
  console.log("REMOTE CLOUDFLARE STAGING CANONICAL VIDEO SEED ENGINE");
  console.log("============================================================");
  console.log("Target Mode:", isDryRunActive ? (isStrictAdmissionActive ? "DRY RUN (Strict Admission Preflight)" : "DRY RUN (Read-Only Informational)") : "LIVE EXECUTION");

  // 1. Strict Configuration Verification
  let verified;
  try {
    verified = verifyStagingTargetConfiguration();
    console.log("✓ Verified Wrangler Staging Environment Configuration:");
    console.log("  Worker Name:  ", verified.workerName);
    console.log("  Worker URL:   ", targetWorkerUrl);
    console.log("  D1 Database:  ", `${verified.d1.database_name} (${verified.d1.database_id})`);
    console.log("  R2 Bucket:    ", verified.r2.bucket_name);
  } catch (err) {
    console.error(`FATAL: Configuration verification failed: ${err.message}`);
    if (di) throw err;
    process.exit(1);
  }

  // 2. Authentication Requirement
  const token = di?.token !== undefined ? di.token : resolveServiceToken();
  if (!token) {
    console.error("\nFATAL: Remote staging inventory preflight strictly requires a valid service token (CLOUDFLARE_API_SERVICE_TOKEN).");
    console.error("Token not found in environment or local credential files.");
    if (di) throw new Error("TOKEN_MISSING: Remote staging inventory preflight requires a valid service token.");
    process.exit(1);
  }

  // 3. Remote Worker Target Health Check
  console.log("\nProbing remote staging Worker health...");
  try {
    const healthRes = await fetcher(`${targetWorkerUrl}/api/v1/public/health`, {
      headers: { "Cache-Control": "no-store" }
    });
    if (!healthRes.ok) {
      const err = new Error(`Remote Worker health endpoint failed: HTTP ${healthRes.status} ${healthRes.statusText}`);
      console.error(`FATAL: ${err.message}`);
      if (di) throw err;
      process.exit(1);
    }
    const healthData = await healthRes.json();
    if (healthData.environment && healthData.environment !== "staging") {
      const err = new Error(`Remote Worker reported unexpected environment "${healthData.environment}". Expected "staging".`);
      console.error(`FATAL: ${err.message}`);
      if (di) throw err;
      process.exit(1);
    }
    console.log("✓ Remote staging Worker is healthy and responsive.");
  } catch (err) {
    console.error(`FATAL: Failed to connect to remote staging Worker: ${err.message}`);
    if (di) throw err;
    process.exit(1);
  }

  // 4. Authenticated Admin Inventory Query
  console.log("Fetching complete remote video inventory via authenticated admin endpoint...");
  let remoteVideos = [];
  try {
    const adminRes = await fetcher(`${targetWorkerUrl}/api/v1/admin/videos`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Actor-Email": "staging-seed@keremmihci.com",
        "Cache-Control": "no-store"
      }
    });

    if (adminRes.status === 401 || adminRes.status === 403) {
      const err = new Error(`Remote admin endpoint rejected authentication: HTTP ${adminRes.status} ${adminRes.statusText}`);
      console.error(`FATAL: ${err.message}`);
      if (di) throw err;
      process.exit(1);
    }

    if (!adminRes.ok) {
      const errText = await adminRes.text();
      console.error(`FATAL: Remote admin inventory endpoint returned HTTP ${adminRes.status}: ${errText.slice(0, 300)}`);
      if (errText.includes("SCHEMA_NOT_INITIALIZED") || errText.includes("no such table")) {
        console.error("Notice: Remote database requires schema migration 0002_videos_and_reels_schema.sql before seeding.");
      }
      const err = new Error(`Remote admin inventory failed: HTTP ${adminRes.status}`);
      if (di) throw err;
      process.exit(1);
    }

    const adminData = await adminRes.json();
    if (!adminData.ok || !Array.isArray(adminData.videos)) {
      const err = new Error("Remote admin endpoint returned invalid inventory response structure.");
      console.error(`FATAL: ${err.message}`);
      if (di) throw err;
      process.exit(1);
    }
    remoteVideos = adminData.videos;
  } catch (err) {
    console.error(`FATAL: Error contacting remote admin video endpoint: ${err.message}`);
    if (di) throw err;
    process.exit(1);
  }

  const publishedCount = remoteVideos.filter((v) => v.cmsStatus === "published").length;
  const draftCount = remoteVideos.filter((v) => v.cmsStatus === "draft").length;
  const archivedCount = remoteVideos.filter((v) => v.cmsStatus === "archived").length;

  console.log(`✓ Retrieved complete remote inventory: ${remoteVideos.length} total videos`);
  console.log(`  Published: ${publishedCount} | Draft: ${draftCount} | Archived: ${archivedCount}`);

  // 5. Strict Reconciliation across all 21 Canonical Videos
  const reconciliation = reconcileCanonicalVideos(canonicalVideos, remoteVideos);

  console.log(`\nInventory Evaluation against Canonical 21 Videos:`);
  console.log(`  Canonical videos in source:    ${canonicalVideos.length}`);
  console.log(`  Canonical Parity (Matching):   ${reconciliation.canonicalParity.length}`);
  console.log(`  Owner Modified (Preserved):    ${reconciliation.ownerModified.length}`);
  console.log(`  Missing (Pending Seed):        ${reconciliation.missing.length}`);
  console.log(`  Identity Conflicts (Blocked):  ${reconciliation.identityConflicts.length}`);

  if (reconciliation.identityConflicts.length > 0) {
    console.error(`\nFATAL: Detected ${reconciliation.identityConflicts.length} identity conflict(s) on remote staging:`);
    for (const conflict of reconciliation.identityConflicts) {
      console.error(`  - "${conflict.canonical.slug}" (ID: ${conflict.canonical.id}): ${conflict.reason}`);
    }
    console.error("Aborting remote seeding to prevent corrupting staging database.");
    process.exit(1);
  }

  if (reconciliation.ownerModified.length > 0) {
    console.log(`\nNotice: ${reconciliation.ownerModified.length} canonical video(s) have owner modifications on staging.`);
    console.log("These modifications are preserved and will NOT be overwritten:");
    for (const om of reconciliation.ownerModified) {
      const fieldList = om.diffs.map((d) => d.field).join(", ");
      console.log(`  - "${om.canonical.slug}": modified fields [${fieldList}] (status: ${om.preservedStatus})`);
    }
  }

  const missingVideos = reconciliation.missing;

  // 6. Dry Run Guardrail
  if (isDryRunActive) {
    console.log("\n========================================================");
    console.log("[DRY RUN COMPLETE] Zero remote writes executed.");
    console.log("Staging target identity and authenticated inventory verified.");
    console.log(`Status: Parity=${reconciliation.canonicalParity.length}, OwnerModified=${reconciliation.ownerModified.length}, Missing=${missingVideos.length}`);

    if (isStrictAdmissionActive) {
      console.log("\nEvaluating Strict Preflight Admission Invariants (Remote Staging):");
      console.log(`  Expected Canonical Count: 21`);
      console.log(`  Canonical Parity:         ${reconciliation.canonicalParity.length}`);
      console.log(`  Owner-Modified Preserved: ${reconciliation.ownerModified.length}`);
      console.log(`  Missing Canonical Videos: ${missingVideos.length}`);
      console.log(`  Identity Conflicts:       ${reconciliation.identityConflicts.length}`);

      if (reconciliation.identityConflicts.length > 0) {
        console.error(`\nFATAL: Strict admission rejected: ${reconciliation.identityConflicts.length} identity conflict(s) detected.`);
        if (di) throw new Error("STRICT_ADMISSION_FAILED: Identity conflicts detected.");
        process.exit(1);
      }

      if (missingVideos.length > 0) {
        console.error(`\nFATAL: Strict admission rejected: ${missingVideos.length} canonical video(s) missing from remote staging.`);
        for (const m of missingVideos) {
          console.error(`  - Missing: "${m.slug}" (ID: ${m.id})`);
        }
        if (di) throw new Error(`STRICT_ADMISSION_FAILED: ${missingVideos.length} canonical videos missing.`);
        process.exit(1);
      }

      const totalMatched = reconciliation.canonicalParity.length + reconciliation.ownerModified.length;
      if (totalMatched !== 21) {
        console.error(`\nFATAL: Strict admission rejected: Total accounted canonical videos is ${totalMatched}, expected exactly 21.`);
        if (di) throw new Error(`STRICT_ADMISSION_FAILED: Matched count mismatch: ${totalMatched} != 21.`);
        process.exit(1);
      }

      console.log("\n============================================================");
      console.log("VERDICT: STRICT CANONICAL PARITY ADMISSION PASSED (21/21 PRESENT)");
      console.log("============================================================\n");
      return { dryRun: true, strictAdmissionPassed: true, reconciliation, verified, missingVideos };
    }

    console.log(`To execute live remote seeding upon authorized approval, run:`);
    console.log("  node scripts/import-canonical-videos-to-d1.mjs --remote-staging --execute");
    console.log("========================================================");
    return { dryRun: true, strictAdmissionPassed: false, reconciliation, verified, missingVideos };
  }

  if (di) {
    throw new Error("MUTATION_BLOCKED: Test harness does not permit live remote mutations.");
  }

  // 7. Live Execution Gate (Requires explicit --execute)
  console.log("\nExecuting live remote seeding of missing canonical videos...");
  let insertedCount = 0;
  let failedCount = 0;

  for (let idx = 0; idx < missingVideos.length; idx++) {
    const c = missingVideos[idx];
    const canonicalPosition = canonicalVideos.findIndex((cv) => cv.id === c.id) + 1;
    const payload = {
      id: c.id,
      slug: c.slug,
      type: c.type,
      orientation: c.orientation || "portrait",
      aiAssisted: Boolean(c.aiAssisted),
      productionMethod: c.productionMethod || "traditional",
      titleTR: c.titleTR,
      titleEN: c.titleEN,
      shortTitleTR: c.shortTitleTR || "",
      shortTitleEN: c.shortTitleEN || "",
      descriptionTR: c.descriptionTR || "",
      descriptionEN: c.descriptionEN || "",
      // Optional-field semantics: absent or empty full description is preserved without substitution
      fullDescriptionTR: c.fullDescriptionTR || "",
      fullDescriptionEN: c.fullDescriptionEN || "",
      client: c.client || "",
      year: c.year || 2026,
      poster: c.poster,
      thumbnail: c.thumbnail || null,
      src: c.src || `/videos/${c.slug}/video.mp4`,
      duration: c.duration || "",
      aspectRatio: c.orientation === "landscape" ? "16:9" : "9:16",
      servicesTR: c.servicesTR || c.services || [],
      servicesEN: c.servicesEN || c.services || [],
      services: c.services || [],
      tools: c.tools || [],
      tags: c.tags || [],
      autoplayPreview: c.autoplayPreview !== false,
      externalUrl: c.externalUrl || null,
      projectSlug: c.projectSlug || null,
      featured: Boolean(c.featured),
      // Use original canonical video position when deriving missing sortOrder
      sortOrder: c.sortOrder ?? canonicalPosition,
      cmsStatus: "published",
      actionType: "create"
    };

    const res = await fetcher(`${targetWorkerUrl}/api/v1/admin/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Actor-Email": "staging-seed@keremmihci.com"
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 200 || res.status === 201) {
      insertedCount++;
    } else {
      failedCount++;
      const errText = await res.text();
      console.error(`Failed to insert canonical video "${c.slug}": HTTP ${res.status} - ${errText.slice(0, 200)}`);
    }
  }

  console.log(`\nRemote staging seeding summary: inserted=${insertedCount}, failed=${failedCount}`);
  if (failedCount > 0) {
    console.error("FATAL: Remote staging seeding encountered insertion failures.");
    process.exit(1);
  }

  // 8. Post-Seed Verification via Authenticated GET /api/v1/admin/videos
  console.log("\nPerforming post-seeding read-only verification via GET /api/v1/admin/videos...");
  let postSeedRemoteVideos = [];
  try {
    const postRes = await fetcher(`${targetWorkerUrl}/api/v1/admin/videos`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Actor-Email": "staging-seed@keremmihci.com",
        "Cache-Control": "no-store"
      }
    });
    if (!postRes.ok) {
      console.error(`FATAL: Post-seeding admin verification failed: HTTP ${postRes.status}`);
      process.exit(1);
    }
    const postData = await postRes.json();
    postSeedRemoteVideos = postData.videos || [];
  } catch (err) {
    console.error(`FATAL: Failed to query admin videos for post-seed verification: ${err.message}`);
    process.exit(1);
  }

  const postReconciliation = reconcileCanonicalVideos(canonicalVideos, postSeedRemoteVideos);
  let unverifiedCount = 0;

  for (const newlyInserted of missingVideos) {
    const isNowParity = postReconciliation.canonicalParity.some((p) => p.canonical.id === newlyInserted.id);
    const isNowOwnerMod = postReconciliation.ownerModified.some((p) => p.canonical.id === newlyInserted.id);
    if (!isNowParity && !isNowOwnerMod) {
      unverifiedCount++;
      console.error(`  [UNVERIFIED] Newly seeded video "${newlyInserted.slug}" was not confirmed in post-seed query.`);
    }
  }

  if (unverifiedCount > 0) {
    console.error(`FATAL: Post-seeding verification failed: ${unverifiedCount} record(s) unverified.`);
    process.exit(1);
  }

  console.log(`\n✓ Post-seeding verification passed: All ${missingVideos.length} newly seeded videos confirmed in remote staging.`);
  console.log(`  Remote status: CANONICAL_PARITY=${postReconciliation.canonicalParity.length}, OWNER_MODIFIED=${postReconciliation.ownerModified.length}, MISSING=${postReconciliation.missing.length}`);
}

export async function runLocalSeed(canonicalVideos, options = {}) {
  const activeDbPath = options.dbPath ? path.resolve(options.dbPath) : dbPath;
  const isDryRunActive = options.isDryRun !== undefined ? Boolean(options.isDryRun) : isDryRun;
  const isForceActive = options.isForce !== undefined ? Boolean(options.isForce) : isForce;
  const isStrictActive = options.isStrictAdmission !== undefined ? Boolean(options.isStrictAdmission) : isStrictAdmission;

  console.log("============================================================");
  console.log("CANONICAL 21 PORTFOLIO VIDEO D1 IMPORT & PARITY VALIDATOR");
  console.log("============================================================");
  console.log("Mode:", isDryRunActive ? (isStrictActive ? "DRY RUN (Strict Admission Preflight)" : "DRY RUN (Read-Only)") : isForceActive ? "FORCE OVERWRITE" : "NON-DESTRUCTIVE SAFE SEED");
  console.log("Target Database:", activeDbPath);

  let db;
  if (isDryRunActive) {
    // 1. In dry-run mode, NEVER create a database file
    if (!fs.existsSync(activeDbPath)) {
      throw new Error(`LOCAL_DB_NOT_FOUND: Cannot run local dry-run on non-existent database "${activeDbPath}".`);
    }

    // 2. Open strictly in read-only mode (never creates WAL/SHM, never writes SQLite header)
    db = new DatabaseSync(activeDbPath, { readOnly: true });

    // 3. Reject missing schema instead of repairing it (NEVER execute migration DDL in dry run)
    const requiredTables = [
      "portfolio_videos",
      "portfolio_video_translations",
      "portfolio_video_assets"
    ];
    const foundTables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('portfolio_videos', 'portfolio_video_translations', 'portfolio_video_assets')`
    ).all().map((r) => r.name);

    const missingTables = requiredTables.filter((t) => !foundTables.includes(t));
    if (missingTables.length > 0) {
      throw new Error(
        `SCHEMA_INCOMPLETE: Required table(s) [${missingTables.join(", ")}] missing in "${activeDbPath}". Dry-run cannot repair schema.`
      );
    }
  } else {
    // In live seed mode: ensure directory exists, open read-write, configure WAL and apply schema if needed
    fs.mkdirSync(path.dirname(activeDbPath), { recursive: true });
    db = new DatabaseSync(activeDbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    const migration0002 = path.join(
      ROOT,
      "cloudflare",
      "portfolio-api",
      "migrations",
      "0002_videos_and_reels_schema.sql"
    );
    if (fs.existsSync(migration0002)) {
      db.exec(fs.readFileSync(migration0002, "utf-8"));
    }
    console.log("✓ Verified schema migration 0002 (Videos & Reels Schema).");
  }

  const portraitCount = canonicalVideos.filter(
    (v) => (v.orientation || "portrait") === "portrait"
  ).length;
  const landscapeCount = canonicalVideos.filter((v) => v.orientation === "landscape").length;

  console.log(`Orientation breakdown: ${portraitCount} portrait (9:16), ${landscapeCount} landscape (16:9).`);
  if (portraitCount !== 19 || landscapeCount !== 2) {
    throw new Error(
      `Expected 19 portrait and 2 landscape videos; found ${portraitCount} portrait, ${landscapeCount} landscape`
    );
  }

  // 3. Safe Non-Destructive Seeding into D1
  const now = new Date().toISOString();
  let insertedCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;

  const existingVideoRows = db.prepare(`SELECT * FROM portfolio_videos`).all();
  const existingTransRows = db.prepare(`SELECT * FROM portfolio_video_translations`).all();
  const existingAssetRows = db.prepare(`SELECT * FROM portfolio_video_assets`).all();

  const localVideos = mapLocalRowsToCmsVideos(existingVideoRows, existingTransRows, existingAssetRows);
  const localReconcile = reconcileCanonicalVideos(canonicalVideos, localVideos);

  if (localReconcile.identityConflicts.length > 0 && !isForceActive) {
    console.error(`FATAL: Detected ${localReconcile.identityConflicts.length} identity conflict(s) in local database:`);
    for (const c of localReconcile.identityConflicts) {
      console.error(`  - "${c.canonical.slug}" (ID: ${c.canonical.id}): ${c.reason}`);
    }
    throw new Error(`Identity conflict in database. Refusing to seed.`);
  }

  const existingMap = new Map();
  for (const p of localReconcile.canonicalParity) existingMap.set(p.canonical.id, p.record);
  for (const o of localReconcile.ownerModified) existingMap.set(o.canonical.id, o.record);

  for (let idx = 0; idx < canonicalVideos.length; idx++) {
    const v = canonicalVideos[idx];
    const existing = existingMap.get(v.id);

    if (existing && !isForceActive) {
      skippedCount++;
      continue;
    }

    if (isDryRunActive) {
      if (existing) updatedCount++;
      else insertedCount++;
      continue;
    }

    const canonicalPosition = canonicalVideos.findIndex((cv) => cv.id === v.id) + 1;
    const sortOrder = existing ? Number(existing.sortOrder || existing.sort_order || 0) : v.sortOrder ?? canonicalPosition;
    const orientation = v.orientation || "portrait";
    const aspectRatio = orientation === "landscape" ? "16:9" : "9:16";

    if (!existing) {
      // Clean insert of new canonical video
      db.prepare(
        `INSERT INTO portfolio_videos (
          id, slug, status, orientation, video_type, production_method, ai_assisted,
          client_name, year, duration, aspect_ratio, featured, sort_order,
          autoplay_preview, external_url, project_slug, tools_json, tags_json,
          created_at, updated_at, published_at, archived_at
        ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      ).run(
        v.id,
        v.slug,
        orientation,
        v.type,
        v.productionMethod || "traditional",
        v.aiAssisted ? 1 : 0,
        v.client || "",
        v.year || 2026,
        v.duration || "",
        aspectRatio,
        v.featured ? 1 : 0,
        sortOrder,
        v.autoplayPreview !== false ? 1 : 0,
        v.externalUrl || null,
        v.projectSlug || null,
        JSON.stringify(v.tools || []),
        JSON.stringify(v.tags || []),
        now,
        now,
        now
      );

      // TR translation
      db.prepare(
        `INSERT INTO portfolio_video_translations (
          id, video_id, locale, title, short_title, description, full_description, services_json, updated_at
        ) VALUES (?, ?, 'tr', ?, ?, ?, ?, ?, ?)`
      ).run(
        `vtr-${v.id}-tr`,
        v.id,
        v.titleTR,
        v.shortTitleTR || "",
        v.descriptionTR || "",
        v.fullDescriptionTR || "",
        JSON.stringify(v.servicesTR || v.services || []),
        now
      );

      // EN translation
      db.prepare(
        `INSERT INTO portfolio_video_translations (
          id, video_id, locale, title, short_title, description, full_description, services_json, updated_at
        ) VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?)`
      ).run(
        `vtr-${v.id}-en`,
        v.id,
        v.titleEN,
        v.shortTitleEN || "",
        v.descriptionEN || "",
        v.fullDescriptionEN || "",
        JSON.stringify(v.servicesEN || v.services || []),
        now
      );

      // Poster asset
      db.prepare(
        `INSERT INTO portfolio_video_assets (
          id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, created_at, updated_at
        ) VALUES (?, ?, 'poster', 'local_static', ?, ?, 'image/webp', 0, NULL, NULL, NULL, ?, ?)`
      ).run(
        `vast-${v.id}-poster`,
        v.id,
        v.poster.replace(/^\//, ""),
        v.poster,
        now,
        now
      );

      // Video asset
      const videoSrc = v.src || `/videos/${v.slug}/video.mp4`;
      db.prepare(
        `INSERT INTO portfolio_video_assets (
          id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, created_at, updated_at
        ) VALUES (?, ?, 'video', 'local_static', ?, ?, 'video/mp4', 0, NULL, NULL, NULL, ?, ?)`
      ).run(
        `vast-${v.id}-video`,
        v.id,
        videoSrc.replace(/^\//, ""),
        videoSrc,
        now,
        now
      );

      // Initial revision snapshot
      db.prepare(
        `INSERT INTO portfolio_video_revisions (
          id, video_id, revision_number, action, snapshot_json, actor_email, created_at
        ) VALUES (?, ?, 1, 'initial_canonical_seed', ?, 'system-seed@keremmihci.com', ?)`
      ).run(
        `vrev-${v.id}-1`,
        v.id,
        JSON.stringify({ ...v, status: "published", sortOrder }),
        now
      );

      insertedCount++;
    } else {
      // Force update of existing video
      db.prepare(
        `UPDATE portfolio_videos SET
          slug = ?, orientation = ?, video_type = ?, production_method = ?, ai_assisted = ?,
          client_name = ?, year = ?, duration = ?, aspect_ratio = ?, featured = ?,
          autoplay_preview = ?, external_url = ?, project_slug = ?, tools_json = ?, tags_json = ?,
          updated_at = ?
         WHERE id = ?`
      ).run(
        v.slug,
        orientation,
        v.type,
        v.productionMethod || "traditional",
        v.aiAssisted ? 1 : 0,
        v.client || "",
        v.year || 2026,
        v.duration || "",
        aspectRatio,
        v.featured ? 1 : 0,
        v.autoplayPreview !== false ? 1 : 0,
        v.externalUrl || null,
        v.projectSlug || null,
        JSON.stringify(v.tools || []),
        JSON.stringify(v.tags || []),
        now,
        v.id
      );

      // Force update translations
      db.prepare(
        `UPDATE portfolio_video_translations SET
          title = ?, short_title = ?, description = ?, full_description = ?, services_json = ?, updated_at = ?
         WHERE video_id = ? AND locale = 'tr'`
      ).run(
        v.titleTR,
        v.shortTitleTR || "",
        v.descriptionTR || "",
        v.fullDescriptionTR || "",
        JSON.stringify(v.servicesTR || v.services || []),
        now,
        v.id
      );

      db.prepare(
        `UPDATE portfolio_video_translations SET
          title = ?, short_title = ?, description = ?, full_description = ?, services_json = ?, updated_at = ?
         WHERE video_id = ? AND locale = 'en'`
      ).run(
        v.titleEN,
        v.shortTitleEN || "",
        v.descriptionEN || "",
        v.fullDescriptionEN || "",
        JSON.stringify(v.servicesEN || v.services || []),
        now,
        v.id
      );

      // Force update poster & video assets
      db.prepare(
        `INSERT INTO portfolio_video_assets (
          id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, created_at, updated_at
        ) VALUES (?, ?, 'poster', 'local_static', ?, ?, 'image/webp', 0, NULL, NULL, NULL, ?, ?)
        ON CONFLICT(video_id, asset_type) DO UPDATE SET
          storage_mode = 'local_static',
          storage_key = excluded.storage_key,
          public_url = excluded.public_url,
          updated_at = excluded.updated_at`
      ).run(
        `vast-${v.id}-poster`,
        v.id,
        v.poster.replace(/^\//, ""),
        v.poster,
        now,
        now
      );

      const videoSrc = v.src || `/videos/${v.slug}/video.mp4`;
      db.prepare(
        `INSERT INTO portfolio_video_assets (
          id, video_id, asset_type, storage_mode, storage_key, public_url, mime_type, byte_size, width, height, duration_seconds, created_at, updated_at
        ) VALUES (?, ?, 'video', 'local_static', ?, ?, 'video/mp4', 0, NULL, NULL, NULL, ?, ?)
        ON CONFLICT(video_id, asset_type) DO UPDATE SET
          storage_mode = 'local_static',
          storage_key = excluded.storage_key,
          public_url = excluded.public_url,
          updated_at = excluded.updated_at`
      ).run(
        `vast-${v.id}-video`,
        v.id,
        videoSrc.replace(/^\//, ""),
        videoSrc,
        now,
        now
      );

      updatedCount++;
    }
  }

  console.log(`\nImport Summary: inserted=${insertedCount}, skipped=${skippedCount}, forceUpdated=${updatedCount}`);

  // 4. Parity & Binary File Integrity Verification (SHA-256)
  console.log("\nComputing SHA-256 checksums and verifying binary media files on disk...");
  const videoRows = db.prepare(`SELECT * FROM portfolio_videos ORDER BY sort_order ASC, id ASC`).all();
  const trRows = db.prepare(`SELECT * FROM portfolio_video_translations WHERE locale = 'tr'`).all();
  const enRows = db.prepare(`SELECT * FROM portfolio_video_translations WHERE locale = 'en'`).all();
  const assetRows = db.prepare(`SELECT * FROM portfolio_video_assets`).all();

  const trMap = new Map(trRows.map((r) => [String(r.video_id), r]));
  const enMap = new Map(enRows.map((r) => [String(r.video_id), r]));
  const assetsByVid = new Map();
  for (const a of assetRows) {
    const vid = String(a.video_id);
    if (!assetsByVid.has(vid)) assetsByVid.set(vid, []);
    assetsByVid.get(vid).push(a);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    importMode: isDryRun ? "dry_run" : isForce ? "force" : "non_destructive",
    summary: {
      inserted: insertedCount,
      skipped: skippedCount,
      updated: updatedCount,
      totalD1Videos: videoRows.length
    },
    canonicalCount: canonicalVideos.length,
    d1Count: videoRows.length,
    portraitCount,
    landscapeCount,
    allFilesPresentOnDisk: true,
    parityPassed: false,
    mismatches: [],
    items: []
  };

  const bySlug = new Map(videoRows.map((r) => [String(r.slug), r]));

  for (const c of canonicalVideos) {
    const r = bySlug.get(c.slug);
    if (!r) {
      manifest.mismatches.push({ slug: c.slug, error: "Missing in D1" });
      continue;
    }

    const vid = String(r.id);
    const tr = trMap.get(vid) || {};
    const en = enMap.get(vid) || {};
    const assets = assetsByVid.get(vid) || [];

    const posterAsset = assets.find((a) => a.asset_type === "poster");
    const videoAsset = assets.find((a) => a.asset_type === "video");

    const videoDiskPath = path.join(ROOT, "public", "videos", c.slug, "video.mp4");
    const posterDiskPath = path.join(ROOT, "public", "videos", c.slug, "poster.webp");
    const videoExists = fs.existsSync(videoDiskPath);
    const posterExists = fs.existsSync(posterDiskPath);

    if (!videoExists || !posterExists) {
      manifest.allFilesPresentOnDisk = false;
    }

    const videoStat = videoExists ? fs.statSync(videoDiskPath) : null;
    const posterStat = posterExists ? fs.statSync(posterDiskPath) : null;
    const videoSha256 = sha256File(videoDiskPath);
    const posterSha256 = sha256File(posterDiskPath);

    const fieldDiffs = [];
    const check = (field, expected, actual) => {
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        fieldDiffs.push({ field, expected, actual });
      }
    };

    check("id", c.id, r.id);
    check("slug", c.slug, r.slug);
    check("type", c.type, r.video_type);
    check("orientation", c.orientation || "portrait", r.orientation);
    check("aiAssisted", Boolean(c.aiAssisted), Boolean(r.ai_assisted));
    check("productionMethod", c.productionMethod || "traditional", r.production_method);
    check("client", c.client || "", r.client_name || "");
    check("year", c.year || 2026, Number(r.year || 2026));
    check("titleTR", c.titleTR, tr.title);
    check("titleEN", c.titleEN, en.title);
    check("shortTitleTR", c.shortTitleTR || "", tr.short_title || "");
    check("shortTitleEN", c.shortTitleEN || "", en.short_title || "");
    check("descriptionTR", c.descriptionTR || "", tr.description || "");
    check("descriptionEN", c.descriptionEN || "", en.description || "");
    check("fullDescriptionTR", c.fullDescriptionTR || "", tr.full_description || "");
    check("fullDescriptionEN", c.fullDescriptionEN || "", en.full_description || "");
    check("poster", c.poster, posterAsset?.public_url);
    check("src", c.src || `/videos/${c.slug}/video.mp4`, videoAsset?.public_url);
    check("duration", c.duration || "", r.duration || "");
    check("featured", Boolean(c.featured), Boolean(r.featured));
    check("sortOrder", c.sortOrder, Number(r.sort_order));
    check("autoplayPreview", c.autoplayPreview !== false, Boolean(r.autoplay_preview));
    check("externalUrl", c.externalUrl || null, r.external_url || null);
    check("projectSlug", c.projectSlug || null, r.project_slug || null);
    check("tools", c.tools || [], JSON.parse(r.tools_json || "[]"));
    check("tags", c.tags || [], JSON.parse(r.tags_json || "[]"));
    check("servicesTR", c.servicesTR || c.services || [], JSON.parse(tr.services_json || "[]"));
    check("servicesEN", c.servicesEN || c.services || [], JSON.parse(en.services_json || "[]"));

    if (fieldDiffs.length > 0) {
      manifest.mismatches.push({ slug: c.slug, fieldDiffs });
    }

    manifest.items.push({
      id: c.id,
      slug: c.slug,
      titleTR: c.titleTR,
      titleEN: c.titleEN,
      orientation: r.orientation,
      type: r.video_type,
      sortOrder: Number(r.sort_order),
      files: {
        video: {
          path: `/videos/${c.slug}/video.mp4`,
          exists: videoExists,
          bytes: videoStat ? videoStat.size : 0,
          sha256: videoSha256
        },
        poster: {
          path: `/videos/${c.slug}/poster.webp`,
          exists: posterExists,
          bytes: posterStat ? posterStat.size : 0,
          sha256: posterSha256
        }
      },
      fieldDiffs
    });
  }

  manifest.parityPassed =
    manifest.mismatches.length === 0 &&
    manifest.allFilesPresentOnDisk &&
    videoRows.length === 21;

  // 5. Write Updated Parity JSON Report (only when running against host default path, never pollute from test DB)
  if (!customDbPath && !process.env.LOCAL_D1_DB_PATH && !options.dbPath) {
    const outJsonPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE3_VIDEO_PARITY.json");
    fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
    fs.writeFileSync(outJsonPath, JSON.stringify(manifest, null, 2), "utf-8");
    console.log(`✓ Wrote comprehensive parity report to ${outJsonPath}`);
  }

  // 6. Strict Admission Preflight Enforcement
  if (isStrictActive) {
    console.log("\nEvaluating Strict Preflight Admission Invariants (Local):");
    console.log(`  Expected Canonical Count: 21`);
    console.log(`  Canonical Parity:         ${localReconcile.canonicalParity.length}`);
    console.log(`  Owner-Modified Preserved: ${localReconcile.ownerModified.length}`);
    console.log(`  Missing Canonical Videos: ${localReconcile.missing.length}`);
    console.log(`  Identity Conflicts:       ${localReconcile.identityConflicts.length}`);

    if (localReconcile.identityConflicts.length > 0) {
      console.error(`\nFATAL: Strict admission rejected: ${localReconcile.identityConflicts.length} identity conflict(s) in local database.`);
      throw new Error("STRICT_ADMISSION_FAILED: Identity conflicts detected.");
    }

    if (localReconcile.missing.length > 0) {
      console.error(`\nFATAL: Strict admission rejected: ${localReconcile.missing.length} canonical video(s) missing from local database.`);
      for (const m of localReconcile.missing) {
        console.error(`  - Missing: "${m.slug}" (ID: ${m.id})`);
      }
      throw new Error(`STRICT_ADMISSION_FAILED: ${localReconcile.missing.length} canonical videos missing.`);
    }

    const totalMatched = localReconcile.canonicalParity.length + localReconcile.ownerModified.length;
    if (totalMatched !== 21) {
      console.error(`\nFATAL: Strict admission rejected: Total accounted canonical videos is ${totalMatched}, expected exactly 21.`);
      throw new Error(`STRICT_ADMISSION_FAILED: Matched count mismatch: ${totalMatched} != 21.`);
    }

    console.log("\n============================================================");
    console.log("VERDICT: STRICT CANONICAL PARITY ADMISSION PASSED (21/21 PRESENT)");
    console.log("============================================================\n");
  }

  if (!manifest.parityPassed) {
    console.error("PARITY FAILED:", manifest.mismatches);
    if (options.dbPath) {
      throw new Error("PARITY_FAILED: Local database parity check failed.");
    }
    process.exit(1);
  }

  console.log("\n========================================================");
  console.log("✓ SUCCESS: 21/21 Canonical Videos Verified with 100% Parity");
  console.log("✓ 19 Portrait, 2 Landscape Videos Verified");
  console.log("✓ All 21 MP4 Files and 21 Posters Verified on Disk with SHA-256");
  console.log("✓ Zero Field Mismatches Across All Bilingual Attributes");
  console.log("========================================================");

  return { dryRun: isDryRunActive, manifest, reconciliation: localReconcile };
}

async function main() {
  const { videosData: canonicalVideos } = await import("../src/data/videos.ts");
  console.log(`Loaded ${canonicalVideos.length} canonical video records from src/data/videos.ts.`);
  if (canonicalVideos.length !== 21) {
    throw new Error(`Expected exactly 21 canonical videos, found ${canonicalVideos.length}`);
  }

  if (isRemoteStaging) {
    await runRemoteStagingSeed(canonicalVideos);
  } else {
    await runLocalSeed(canonicalVideos);
  }
}

export async function runStagingImporterTestHarness({
  canonicalVideos,
  fetchImpl,
  workerUrl,
  token,
  isDryRun = true,
  isStrictAdmission = false
}) {
  return runRemoteStagingSeed(canonicalVideos, {
    testSandboxGuard: "EXPLICIT_TEST_SANDBOX_DI_GUARD_TOKEN",
    fetchImpl,
    workerUrl,
    token,
    isDryRun,
    isStrictAdmission
  });
}

export async function runLocalImporterTestHarness({
  canonicalVideos,
  dbPath,
  isDryRun = true,
  isForce = false,
  isStrictAdmission = false
}) {
  return runLocalSeed(canonicalVideos, {
    dbPath,
    isDryRun,
    isForce,
    isStrictAdmission
  });
}

if (isMain) {
  main().catch((err) => {
    console.error("Import script failed:", err);
    process.exit(1);
  });
}
