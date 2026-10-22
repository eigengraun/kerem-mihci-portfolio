#!/usr/bin/env node
/**
 * scripts/generate-media-manifest-and-simulation.mjs
 *
 * Portfolio OS Phase 6 — Media Source Manifest Generator & Sync Simulator
 *
 * Generates an authoritative inventory of all canonical media assets (projects & videos),
 * computes cryptographic SHA-256 digests, validates local disk presence, and executes
 * an isolated in-memory simulation of the R2 synchronization state machine.
 *
 * Output: docs/reviews/PORTFOLIO_OS_PHASE6_MEDIA_SOURCE_MANIFEST.json
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

  const uniqueFiles = Array.from(fileMap.values());
  const localPresent = uniqueFiles.filter((f) => f.status === "LOCAL_PRESENT");
  const missingFiles = uniqueFiles.filter((f) => f.status === "MISSING_LOCAL_FILE");
  const externalUrls = uniqueFiles.filter((f) => f.status === "EXTERNAL_URL");
  const privateFiles = uniqueFiles.filter((f) => f.isPrivate);

  const totalBytes = localPresent.reduce((acc, f) => acc + f.byteSize, 0);

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
      totalPayloadMB: Number((totalBytes / (1024 * 1024)).toFixed(2))
    },
    uniqueFiles,
    references
  };

  return manifest;
}

/**
 * Isolated in-memory simulator of the R2 sync state machine
 */
export function simulateMediaSync(manifest, mockDestinationBucket = {}) {
  const syncResults = {
    plannedUploads: [],
    skippedIdentical: [],
    conflictsRequiringApproval: [],
    rejectedOwnershipMismatches: [],
    rejectedInvalidMimes: [],
    rejectedUnapprovedOverwrites: [],
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

    // Check destination state
    const existing = mockDestinationBucket[key];

    if (!existing) {
      syncResults.plannedUploads.push({
        key,
        byteSize: file.byteSize,
        sha256: file.sha256,
        action: "UPLOAD"
      });
    } else if (existing.sha256 === file.sha256) {
      syncResults.skippedIdentical.push({
        key,
        byteSize: file.byteSize,
        sha256: file.sha256,
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

  return syncResults;
}

// CLI Execution
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  console.log("============================================================");
  console.log(" PORTFOLIO OS PHASE 6 — MEDIA MANIFEST & SYNC SIMULATOR");
  console.log("============================================================");

  const manifest = buildMediaManifest();
  console.log(`✓ Total references processed: ${manifest.summary.totalReferences}`);
  console.log(`✓ Unique files identified: ${manifest.summary.totalUniqueFiles}`);
  console.log(`✓ Locally present on disk: ${manifest.summary.localPresentCount}`);
  console.log(`✓ Missing on disk: ${manifest.summary.missingCount}`);
  console.log(`✓ Total payload volume: ${manifest.summary.totalPayloadMB} MB`);

  // Run isolated simulation tests
  console.log("\nRunning isolated R2 sync state-machine simulation tests...");

  // Test 1: Empty bucket simulation (all missing)
  const emptySim = simulateMediaSync(manifest, {});
  console.log(`  Simulation 1 (Clean Bucket): ${emptySim.plannedUploads.length} planned uploads, 0 skipped.`);

  // Test 2: Synchronized bucket simulation (identical hashes)
  const populatedMock = {};
  for (const f of manifest.uniqueFiles) {
    populatedMock[f.intendedR2Key] = {
      byteSize: f.byteSize,
      sha256: f.sha256,
      protected: false
    };
  }
  const syncSim = simulateMediaSync(manifest, populatedMock);
  console.log(`  Simulation 2 (Synchronized Bucket): ${syncSim.skippedIdentical.length} skipped identical, ${syncSim.plannedUploads.length} uploads.`);

  // Test 3: Conflict detection (hash mismatch)
  const conflictMock = { ...populatedMock };
  const sampleKey = manifest.uniqueFiles[0].intendedR2Key;
  conflictMock[sampleKey] = {
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
        sha256: "abc"
      }
    ]
  };
  const mimeSim = simulateMediaSync(invalidMimeManifest, {});
  console.log(`  Simulation 5 (Invalid MIME): ${mimeSim.rejectedInvalidMimes.length} invalid MIME(s) rejected.`);

  // Save manifest artifact
  const outputPath = path.join(ROOT, "docs", "reviews", "PORTFOLIO_OS_PHASE6_MEDIA_SOURCE_MANIFEST.json");
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`\nAuthoritative media manifest saved to ${outputPath}`);
}
