#!/usr/bin/env node
/**
 * scripts/generate-media-manifest-and-simulation.mjs
 *
 * Portfolio OS Phase 6 — Media Source Manifest Generator & Sync Simulator
 *
 * Generates an authoritative inventory of all canonical media assets (projects & videos),
 * computes cryptographic SHA-256 digests, validates local disk presence, applies privacy
 * segregation scopes (projects, videos, profile/cv), and executes an isolated in-memory
 * simulation of the R2 synchronization state machine with strict ownership validation.
 *
 * Outputs:
 *   - docs/reviews/PORTFOLIO_OS_PHASE6_MEDIA_SOURCE_MANIFEST.json
 *   - docs/reviews/PORTFOLIO_OS_PHASE6_MEDIA_TRANSFER_SCOPE.json
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

export const MIME_BY_EXT = Object.freeze({
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".pdf": "application/pdf"
});

export const ALLOWED_MIME_TYPES = new Set([
  "image/webp",
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf"
]);

export const MEDIA_SCOPES = Object.freeze({
  CANONICAL_PROJECT_MEDIA: "CANONICAL_PROJECT_MEDIA",
  CANONICAL_VIDEO_MEDIA: "CANONICAL_VIDEO_MEDIA",
  OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA: "OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA",
  OTHER_PRIVATE_MEDIA_IF_PRESENT: "OTHER_PRIVATE_MEDIA_IF_PRESENT"
});

export function normalizeSlug(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function buildMediaManifest(options = {}) {
  const rootDir = options.rootDir || ROOT;
  const publicDir = path.join(rootDir, "public");

  // 1. Projects
  const projectsTsPath = path.join(rootDir, "src", "data", "projects.ts");
  const rawTs = fs.readFileSync(projectsTsPath, "utf-8");
  const marker = "export const projectsData: Project[] =";
  const startIdx = rawTs.indexOf(marker);
  const endMarker = "export const projectsItemsByWorkspace";
  const endIdx = rawTs.indexOf(endMarker);
  const arrayLiteral = rawTs.slice(startIdx + marker.length, endIdx).trim().replace(/;$/, "");
  const projects = new Function(`return (${arrayLiteral});`)();

  // 2. Videos
  const videosTsPath = path.join(rootDir, "src", "data", "videos.ts");
  const rawVideoTs = fs.readFileSync(videosTsPath, "utf-8");
  const vMarker = "export const videosData: PortfolioVideo[] = [";
  const vStartIdx = rawVideoTs.indexOf(vMarker);
  const vEndMarker = "export function getSortedVideos";
  const vEndIdx = rawVideoTs.indexOf(vEndMarker);
  const vArrayLiteral = rawVideoTs.slice(vStartIdx + "export const videosData: PortfolioVideo[] =".length, vEndIdx).trim().replace(/;$/, "");
  const videos = new Function(`return (${vArrayLiteral});`)();

  const fileMap = new Map();
  const references = [];

  function recordAsset(relPath, entityType, entityId, assetRole, isPrivate = false) {
    if (!relPath) return;
    const isExternal = relPath.startsWith("http://") || relPath.startsWith("https://");
    const cleanKey = relPath.replace(/^\//, "");
    const diskPath = path.join(publicDir, cleanKey);
    const exists = !isExternal && fs.existsSync(diskPath);

    let byteSize = 0;
    let sha256 = null;
    let mimeType = getMimeType(cleanKey);

    if (exists) {
      const buf = fs.readFileSync(diskPath);
      byteSize = buf.length;
      sha256 = sha256Buffer(buf);
    }

    references.push({
      relPath,
      cleanKey,
      entityType,
      entityId,
      assetRole,
      isExternal,
      isPrivate
    });

    if (!fileMap.has(cleanKey)) {
      fileMap.set(cleanKey, {
        sourcePath: `public/${cleanKey}`,
        intendedR2Key: cleanKey,
        mimeType,
        byteSize,
        sha256,
        isExternal,
        isPrivate,
        status: isExternal ? "EXTERNAL_URL" : exists ? "LOCAL_PRESENT" : "MISSING_LOCAL_FILE",
        owners: []
      });
    }

    fileMap.get(cleanKey).owners.push({ entityType, entityId, assetRole });
  }

  // Record project assets
  for (const p of projects) {
    recordAsset(p.cover, "project", p.id, "cover");
    recordAsset(p.thumbnail, "project", p.id, "thumbnail");
    recordAsset(p.desktopIcon, "project", p.id, "desktopIcon");
    recordAsset(p.ogImage, "project", p.id, "ogImage");
    if (p.desktopThumbnail?.src) recordAsset(p.desktopThumbnail.src, "project", p.id, "desktopThumbnail");
    for (let idx = 0; idx < (p.media || []).length; idx++) {
      const m = p.media[idx];
      recordAsset(m.src, "project", p.id, `media_gallery_${idx + 1}`);
      if (m.poster) recordAsset(m.poster, "project", p.id, `media_poster_${idx + 1}`);
      if (m.thumbnail) recordAsset(m.thumbnail, "project", p.id, `media_thumbnail_${idx + 1}`);
    }
  }

  // Record video assets
  for (const v of videos) {
    recordAsset(v.src, "video", v.id, "video_mp4");
    recordAsset(v.poster, "video", v.id, "video_poster");
  }

  // Personal data assets check (private)
  const profileDir = path.join(publicDir, "profile");
  if (fs.existsSync(profileDir)) {
    for (const f of fs.readdirSync(profileDir)) {
      if (f.startsWith(".")) continue;
      recordAsset(`/profile/${f}`, "profile", "owner-profile", "personal_biography_image", true);
    }
  }

  const cvDir = path.join(publicDir, "cv");
  if (fs.existsSync(cvDir)) {
    for (const f of fs.readdirSync(cvDir)) {
      if (f.startsWith(".")) continue;
      recordAsset(`/cv/${f}`, "cv", "owner-cv", "personal_cv_document", true);
    }
  }

  // Scope Classification & Metadata Enrichment
  const uniqueFiles = Array.from(fileMap.values());
  for (const file of uniqueFiles) {
    let scope = MEDIA_SCOPES.OTHER_PRIVATE_MEDIA_IF_PRESENT;
    if (file.intendedR2Key.startsWith("profile/") || file.intendedR2Key.startsWith("cv/")) {
      scope = MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA;
    } else if (file.owners.some((o) => o.entityType === "project")) {
      scope = MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA;
    } else if (file.owners.some((o) => o.entityType === "video")) {
      scope = MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA;
    }
    file.scope = scope;
  }

  const localPresent = uniqueFiles.filter((f) => f.status === "LOCAL_PRESENT");
  const missingFiles = uniqueFiles.filter((f) => f.status === "MISSING_LOCAL_FILE");
  const externalUrls = uniqueFiles.filter((f) => f.status === "EXTERNAL_URL");
  const privateFiles = uniqueFiles.filter((f) => f.isPrivate);

  const totalBytes = localPresent.reduce((acc, f) => acc + f.byteSize, 0);

  const scopeBreakdown = {
    [MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA]: { count: 0, bytes: 0, decimalMB: 0, binaryMiB: 0 },
    [MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA]: { count: 0, bytes: 0, decimalMB: 0, binaryMiB: 0 },
    [MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA]: { count: 0, bytes: 0, decimalMB: 0, binaryMiB: 0 },
    [MEDIA_SCOPES.OTHER_PRIVATE_MEDIA_IF_PRESENT]: { count: 0, bytes: 0, decimalMB: 0, binaryMiB: 0 }
  };

  for (const f of localPresent) {
    if (scopeBreakdown[f.scope]) {
      scopeBreakdown[f.scope].count++;
      scopeBreakdown[f.scope].bytes += f.byteSize;
    }
  }

  for (const k of Object.keys(scopeBreakdown)) {
    const b = scopeBreakdown[k].bytes;
    scopeBreakdown[k].decimalMB = Number((b / 1_000_000).toFixed(2));
    scopeBreakdown[k].binaryMiB = Number((b / (1024 * 1024)).toFixed(2));
  }

  const canonicalCandidates = localPresent.filter(
    (f) => f.scope === MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA || f.scope === MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA
  );
  const canonicalCandidateBytes = canonicalCandidates.reduce((acc, f) => acc + f.byteSize, 0);

  const manifest = {
    timestamp: new Date().toISOString(),
    summary: {
      totalReferences: references.length,
      totalUniqueFiles: uniqueFiles.length,
      localPresentCount: localPresent.length,
      missingCount: missingFiles.length,
      externalCount: externalUrls.length,
      privateCount: privateFiles.length,
      totalPayloadBytes: totalBytes,
      totalPayloadDecimalMB: Number((totalBytes / 1_000_000).toFixed(2)),
      totalPayloadBinaryMiB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
      canonicalCandidateCount: canonicalCandidates.length,
      canonicalCandidateBytes,
      canonicalCandidateDecimalMB: Number((canonicalCandidateBytes / 1_000_000).toFixed(2)),
      canonicalCandidateBinaryMiB: Number((canonicalCandidateBytes / (1024 * 1024)).toFixed(2)),
      excludedOwnerApprovalCount: scopeBreakdown[MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA].count,
      scopes: scopeBreakdown
    },
    uniqueFiles,
    references
  };

  return manifest;
}

/**
 * Validates entity ownership, asset role, namespace boundaries, and destination collision.
 */
export function validateMediaAssetOwnership(file, destinationBucket = {}) {
  const errors = [];
  const key = file.intendedR2Key;

  for (const owner of file.owners || []) {
    // 1. Entity type vs namespace checks
    if (owner.entityType === "project") {
      if (!key.startsWith("projects/")) {
        errors.push({
          key,
          entityType: owner.entityType,
          entityId: owner.entityId,
          assetRole: owner.assetRole,
          reason: `Namespace violation: project asset must reside in 'projects/' namespace (got '${key}')`
        });
      }
      const match = key.match(/^projects\/([^/]+)\//);
      if (!match) {
        if (key.startsWith("projects/")) {
          errors.push({
            key,
            entityType: owner.entityType,
            entityId: owner.entityId,
            assetRole: owner.assetRole,
            reason: `Namespace violation: project asset missing project slug in path '${key}'`
          });
        }
      } else {
        const pathSlug = match[1];
        if (owner.entityId !== pathSlug && normalizeSlug(owner.entityId) !== pathSlug) {
          errors.push({
            key,
            entityType: owner.entityType,
            entityId: owner.entityId,
            assetRole: owner.assetRole,
            reason: `Entity ID mismatch: asset namespace '${pathSlug}' does not match owner entityId '${owner.entityId}'`
          });
        }
      }
    } else if (owner.entityType === "video") {
      if (!key.startsWith("videos/")) {
        errors.push({
          key,
          entityType: owner.entityType,
          entityId: owner.entityId,
          assetRole: owner.assetRole,
          reason: `Namespace violation: video asset must reside in 'videos/' namespace (got '${key}')`
        });
      }
      const match = key.match(/^videos\/([^/]+)\//);
      if (!match) {
        if (key.startsWith("videos/")) {
          errors.push({
            key,
            entityType: owner.entityType,
            entityId: owner.entityId,
            assetRole: owner.assetRole,
            reason: `Namespace violation: video asset missing video slug in path '${key}'`
          });
        }
      } else {
        const pathSlug = match[1];
        if (owner.entityId !== pathSlug && normalizeSlug(owner.entityId) !== pathSlug) {
          errors.push({
            key,
            entityType: owner.entityType,
            entityId: owner.entityId,
            assetRole: owner.assetRole,
            reason: `Entity ID mismatch: video namespace '${pathSlug}' does not match owner entityId '${owner.entityId}'`
          });
        }
      }
    } else if (owner.entityType === "profile" || owner.entityType === "cv") {
      if (!key.startsWith("profile/") && !key.startsWith("cv/")) {
        errors.push({
          key,
          entityType: owner.entityType,
          entityId: owner.entityId,
          assetRole: owner.assetRole,
          reason: `Namespace violation: personal asset must reside in 'profile/' or 'cv/' namespace (got '${key}')`
        });
      }
    } else {
      errors.push({
        key,
        entityType: owner.entityType,
        entityId: owner.entityId,
        assetRole: owner.assetRole,
        reason: `Unrecognized owner entity type '${owner.entityType}'`
      });
    }

    // Role validation
    if (!owner.assetRole || typeof owner.assetRole !== "string" || owner.assetRole.trim() === "") {
      errors.push({
        key,
        entityType: owner.entityType,
        entityId: owner.entityId,
        assetRole: owner.assetRole,
        reason: "Invalid or missing asset role"
      });
    }
  }

  // 2. Collision with existing destination object owned by a different entity
  const existing = destinationBucket[key];
  if (existing && existing.ownerEntityId) {
    const primaryOwner = file.owners?.[0];
    if (primaryOwner && existing.ownerEntityId !== primaryOwner.entityId) {
      errors.push({
        key,
        existingOwner: existing.ownerEntityId,
        incomingOwner: primaryOwner.entityId,
        reason: `Destination key ownership collision: already owned by entity '${existing.ownerEntityId}', incoming owner is '${primaryOwner.entityId}'`
      });
    }
  }

  return errors;
}

/**
 * Isolated in-memory simulator of the R2 sync state machine with strict scope & ownership gating.
 */
export function simulateMediaSync(manifest, mockDestinationBucket = {}, options = {}) {
  const allowProfileMedia = options.allowProfileMedia ?? false;
  const validateOwnership = options.validateOwnership ?? true;
  const allowedScopes = new Set(
    options.allowedScopes ||
      (allowProfileMedia
        ? [
            MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA,
            MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA,
            MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA
          ]
        : [
            MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA,
            MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA
          ])
  );

  const syncResults = {
    plannedUploads: [],
    skippedIdentical: [],
    conflictsRequiringApproval: [],
    rejectedOwnershipMismatches: [],
    rejectedInvalidMimes: [],
    rejectedMissingFiles: [],
    rejectedUnapprovedOverwrites: [],
    excludedUnapprovedScopes: [],
    zeroUnexpectedWrites: true
  };

  for (const file of manifest.uniqueFiles) {
    const key = file.intendedR2Key;

    // Check invalid MIME type
    if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
      syncResults.rejectedInvalidMimes.push({
        key,
        mimeType: file.mimeType,
        reason: "Disallowed MIME type"
      });
      continue;
    }

    // Check missing local file or unverified hash
    if (file.status !== "LOCAL_PRESENT" || !file.sha256 || typeof file.byteSize !== "number" || file.byteSize < 0) {
      syncResults.rejectedMissingFiles.push({
        key,
        status: file.status || "UNKNOWN",
        sha256: file.sha256 || null,
        reason: "Local file is missing or has unverified hash/byte size; rejected from upload planning"
      });
      continue;
    }

    // Check scope privacy & owner approval gate
    if (!allowedScopes.has(file.scope)) {
      syncResults.excludedUnapprovedScopes.push({
        key,
        scope: file.scope,
        reason:
          file.scope === MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA
            ? "Personal profile/CV asset strictly requires explicit human owner approval before transfer"
            : "Asset scope not authorized for transfer"
      });
      continue;
    }

    // Ownership & namespace validation
    if (validateOwnership) {
      const ownershipErrors = validateMediaAssetOwnership(file, mockDestinationBucket);
      if (ownershipErrors.length > 0) {
        syncResults.rejectedOwnershipMismatches.push(...ownershipErrors);
        continue;
      }
    }

    // Check destination state
    const existing = mockDestinationBucket[key];

    if (!existing) {
      syncResults.plannedUploads.push({
        key,
        byteSize: file.byteSize,
        sha256: file.sha256,
        scope: file.scope,
        action: "UPLOAD"
      });
    } else if (existing.sha256 === file.sha256) {
      syncResults.skippedIdentical.push({
        key,
        byteSize: file.byteSize,
        sha256: file.sha256,
        scope: file.scope,
        action: "SKIP"
      });
    } else {
      // Hash mismatch
      if (existing.protected) {
        syncResults.rejectedUnapprovedOverwrites.push({
          key,
          existingSha256: existing.sha256,
          incomingSha256: file.sha256,
          reason: "Target object is marked protected against overwrite"
        });
      } else {
        syncResults.conflictsRequiringApproval.push({
          key,
          existingSha256: existing.sha256,
          incomingSha256: file.sha256,
          action: "REQUIRE_HUMAN_APPROVAL"
        });
      }
    }
  }

  // Verify zero unexpected writes: ensure all planned uploads belong to allowed scopes
  const hasUnexpected = syncResults.plannedUploads.some((u) => !allowedScopes.has(u.scope));
  syncResults.zeroUnexpectedWrites = !hasUnexpected;

  return syncResults;
}

// -----------------------------------------------------------------------------
// CLI Execution
// -----------------------------------------------------------------------------
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  console.log("================================================================================");
  console.log(" PORTFOLIO OS PHASE 6 — MEDIA MANIFEST & SYNC SIMULATOR");
  console.log("================================================================================");

  const manifest = buildMediaManifest();
  console.log(`✓ Total references processed: ${manifest.summary.totalReferences}`);
  console.log(`✓ Total unique files identified: ${manifest.summary.totalUniqueFiles}`);
  console.log(`✓ Locally present on disk: ${manifest.summary.localPresentCount}`);
  console.log(`✓ Missing on disk: ${manifest.summary.missingCount}`);
  console.log(`✓ Total payload volume: ${manifest.summary.totalPayloadDecimalMB} MB (${manifest.summary.totalPayloadBinaryMiB} MiB)`);
  console.log(`✓ Canonical candidate pool (Projects + Videos): ${manifest.summary.canonicalCandidateCount} files (${manifest.summary.canonicalCandidateDecimalMB} MB / ${manifest.summary.canonicalCandidateBinaryMiB} MiB)`);
  console.log(`✓ Excluded profile/CV media: ${manifest.summary.excludedOwnerApprovalCount} files (OWNER_APPROVAL_REQUIRED)`);

  // Run isolated simulation tests
  console.log("\nRunning isolated R2 sync state-machine simulation tests...");

  // Test 1: Clean bucket simulation (canonical scopes only, profile excluded)
  const emptySim = simulateMediaSync(manifest, {});
  console.log(`  Simulation 1 (Clean Bucket): ${emptySim.plannedUploads.length} planned uploads, ${emptySim.excludedUnapprovedScopes.length} excluded profile/cv items.`);

  // Test 2: Synchronized bucket simulation (identical hashes)
  const populatedMock = {};
  for (const f of manifest.uniqueFiles) {
    if (f.scope === MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA || f.scope === MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA) {
      populatedMock[f.intendedR2Key] = {
        byteSize: f.byteSize,
        sha256: f.sha256,
        ownerEntityId: f.owners[0]?.entityId,
        ownerEntityType: f.owners[0]?.entityType,
        protected: false
      };
    }
  }
  const syncSim = simulateMediaSync(manifest, populatedMock);
  console.log(`  Simulation 2 (Synchronized Bucket): ${syncSim.skippedIdentical.length} skipped identical, ${syncSim.plannedUploads.length} uploads.`);

  // Test 3: Conflict detection (hash mismatch)
  const conflictMock = { ...populatedMock };
  const sampleKey = manifest.uniqueFiles[0].intendedR2Key;
  conflictMock[sampleKey] = {
    ...conflictMock[sampleKey],
    byteSize: 100,
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
    protected: false
  };
  const conflictSim = simulateMediaSync(manifest, conflictMock);
  console.log(`  Simulation 3 (Hash Mismatch): ${conflictSim.conflictsRequiringApproval.length} conflict(s) requiring approval.`);

  // Test 4: Protected object rejection
  conflictMock[sampleKey].protected = true;
  const protectedSim = simulateMediaSync(manifest, conflictMock);
  console.log(`  Simulation 4 (Protected Object): ${protectedSim.rejectedUnapprovedOverwrites.length} unapproved overwrite(s) rejected.`);

  // Test 5: Invalid MIME type rejection
  const invalidMimeManifest = {
    uniqueFiles: [
      {
        intendedR2Key: "malicious.sh",
        mimeType: "application/x-sh",
        byteSize: 50,
        sha256: "abc",
        scope: MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA,
        owners: [{ entityType: "project", entityId: "proj-1", assetRole: "cover" }]
      }
    ]
  };
  const mimeSim = simulateMediaSync(invalidMimeManifest, {});
  console.log(`  Simulation 5 (Invalid MIME): ${mimeSim.rejectedInvalidMimes.length} invalid MIME(s) rejected.`);

  // Test 6: Ownership Mismatch (wrong entity ID)
  const wrongEntityManifest = {
    uniqueFiles: [
      {
        intendedR2Key: "projects/project-alpha/cover.webp",
        mimeType: "image/webp",
        byteSize: 1000,
        sha256: "aaa",
        status: "LOCAL_PRESENT",
        scope: MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA,
        owners: [{ entityType: "project", entityId: "project-beta", assetRole: "cover" }]
      }
    ]
  };
  const wrongEntitySim = simulateMediaSync(wrongEntityManifest, {});
  console.log(`  Simulation 6 (Entity ID Mismatch): ${wrongEntitySim.rejectedOwnershipMismatches.length} mismatch rejected.`);

  // Test 7: Namespace Violation (project in video namespace)
  const namespaceViolationManifest = {
    uniqueFiles: [
      {
        intendedR2Key: "videos/some-video/hacked.webp",
        mimeType: "image/webp",
        byteSize: 1000,
        sha256: "bbb",
        status: "LOCAL_PRESENT",
        scope: MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA,
        owners: [{ entityType: "project", entityId: "proj-1", assetRole: "cover" }]
      }
    ]
  };
  const namespaceSim = simulateMediaSync(namespaceViolationManifest, {});
  console.log(`  Simulation 7 (Namespace Violation): ${namespaceSim.rejectedOwnershipMismatches.length} violation rejected.`);

  // Test 8: Destination Key Collision (different owner)
  const collisionMock = {
    "projects/project-alpha/cover.webp": {
      byteSize: 1000,
      sha256: "ccc",
      ownerEntityId: "original-owner",
      ownerEntityType: "project"
    }
  };
  const collisionManifest = {
    uniqueFiles: [
      {
        intendedR2Key: "projects/project-alpha/cover.webp",
        mimeType: "image/webp",
        byteSize: 1000,
        sha256: "ccc",
        status: "LOCAL_PRESENT",
        scope: MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA,
        owners: [{ entityType: "project", entityId: "intruder-owner", assetRole: "cover" }]
      }
    ]
  };
  const collisionSim = simulateMediaSync(collisionManifest, collisionMock);
  console.log(`  Simulation 8 (Destination Collision): ${collisionSim.rejectedOwnershipMismatches.length} collision rejected.`);

  // Test 9: Missing Local File Rejection (Fail-closed on unverified local presence)
  const missingFileManifest = {
    uniqueFiles: [
      {
        intendedR2Key: "projects/project-alpha/missing.webp",
        mimeType: "image/webp",
        byteSize: 0,
        sha256: null,
        status: "MISSING_LOCAL_FILE",
        scope: MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA,
        owners: [{ entityType: "project", entityId: "project-alpha", assetRole: "cover" }]
      }
    ]
  };
  const missingFileSim = simulateMediaSync(missingFileManifest, {});
  console.log(`  Simulation 9 (Missing Local File Rejection): ${missingFileSim.rejectedMissingFiles.length} missing file(s) rejected from upload planning.`);

  // Save manifest artifact
  const manifestOutputPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE6_MEDIA_SOURCE_MANIFEST.json");
  fs.writeFileSync(manifestOutputPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`\nAuthoritative media manifest saved to ${manifestOutputPath}`);

  // Save transfer scope artifact
  const transferScopePayload = {
    timestamp: new Date().toISOString(),
    status: "GATEB_MEDIA_SCOPE_SEGREGATED",
    contract: "PORTFOLIO_OS_GATE_B_MEDIA_TRANSFER_SCOPE_POLICY",
    summary: {
      totalUniqueFiles: manifest.summary.totalUniqueFiles,
      totalPayloadBytes: manifest.summary.totalPayloadBytes,
      totalPayloadDecimalMB: manifest.summary.totalPayloadDecimalMB,
      totalPayloadBinaryMiB: manifest.summary.totalPayloadBinaryMiB,
      canonicalCandidateFiles: manifest.summary.canonicalCandidateCount,
      canonicalCandidateBytes: manifest.summary.canonicalCandidateBytes,
      canonicalCandidateDecimalMB: manifest.summary.canonicalCandidateDecimalMB,
      canonicalCandidateBinaryMiB: manifest.summary.canonicalCandidateBinaryMiB,
      excludedOwnerApprovalFiles: manifest.summary.excludedOwnerApprovalCount,
      excludedOwnerApprovalBytes: manifest.summary.scopes[MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA].bytes,
      excludedOwnerApprovalDecimalMB: manifest.summary.scopes[MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA].decimalMB,
      excludedOwnerApprovalBinaryMiB: manifest.summary.scopes[MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA].binaryMiB,
      otherPrivateFiles: manifest.summary.scopes[MEDIA_SCOPES.OTHER_PRIVATE_MEDIA_IF_PRESENT].count
    },
    scopes: {
      [MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA]: {
        count: manifest.summary.scopes[MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA].count,
        bytes: manifest.summary.scopes[MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA].bytes,
        decimalMB: manifest.summary.scopes[MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA].decimalMB,
        binaryMiB: manifest.summary.scopes[MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA].binaryMiB,
        defaultTransferAllowed: true,
        r2NamespacePrefix: "projects/"
      },
      [MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA]: {
        count: manifest.summary.scopes[MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA].count,
        bytes: manifest.summary.scopes[MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA].bytes,
        decimalMB: manifest.summary.scopes[MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA].decimalMB,
        binaryMiB: manifest.summary.scopes[MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA].binaryMiB,
        defaultTransferAllowed: true,
        r2NamespacePrefix: "videos/"
      },
      [MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA]: {
        count: manifest.summary.scopes[MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA].count,
        bytes: manifest.summary.scopes[MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA].bytes,
        decimalMB: manifest.summary.scopes[MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA].decimalMB,
        binaryMiB: manifest.summary.scopes[MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA].binaryMiB,
        defaultTransferAllowed: false,
        transferGate: "OWNER_EXPLICIT_APPROVAL_REQUIRED",
        files: manifest.uniqueFiles
          .filter((f) => f.scope === MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA)
          .map((f) => f.intendedR2Key)
      },
      [MEDIA_SCOPES.OTHER_PRIVATE_MEDIA_IF_PRESENT]: {
        count: manifest.summary.scopes[MEDIA_SCOPES.OTHER_PRIVATE_MEDIA_IF_PRESENT].count,
        bytes: manifest.summary.scopes[MEDIA_SCOPES.OTHER_PRIVATE_MEDIA_IF_PRESENT].bytes,
        decimalMB: manifest.summary.scopes[MEDIA_SCOPES.OTHER_PRIVATE_MEDIA_IF_PRESENT].decimalMB,
        binaryMiB: manifest.summary.scopes[MEDIA_SCOPES.OTHER_PRIVATE_MEDIA_IF_PRESENT].binaryMiB,
        defaultTransferAllowed: false,
        files: []
      }
    },
    transferPolicy: {
      defaultGateBTransferScope: [
        MEDIA_SCOPES.CANONICAL_PROJECT_MEDIA,
        MEDIA_SCOPES.CANONICAL_VIDEO_MEDIA
      ],
      strictlyExcludedScopes: [
        MEDIA_SCOPES.OWNER_APPROVAL_REQUIRED_PROFILE_MEDIA,
        MEDIA_SCOPES.OTHER_PRIVATE_MEDIA_IF_PRESENT
      ],
      zeroRemoteExecution: true,
      failClosedOnScopeViolation: true
    }
  };

  const scopeOutputPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE6_MEDIA_TRANSFER_SCOPE.json");
  fs.writeFileSync(scopeOutputPath, JSON.stringify(transferScopePayload, null, 2), "utf-8");
  console.log(`Media transfer scope specification saved to ${scopeOutputPath}\n`);
}
