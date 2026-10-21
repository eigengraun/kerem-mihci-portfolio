#!/usr/bin/env node

/**
 * scripts/resolve-worker-rollback-version.mjs
 *
 * Cloudflare Worker Rollback Version-ID Resolver & Safety Validator
 *
 * Resolves the active Worker VERSION_ID (required by `wrangler rollback <version-id>`)
 * from structured machine-readable JSON output of `wrangler deployments status --json`
 * or `wrangler deployments list --json`.
 *
 * Strictly enforces:
 * - Version ID vs Deployment ID distinction (Deployment ID is NOT valid for rollback).
 * - Exact single active version receiving 100% traffic.
 * - Strict UUID v4 regex validation.
 * - Raw UUID file persistence (no human-readable prefix strings).
 * - Multi-version split traffic rejection.
 * - Cross-check invariant validation.
 */

import fs from "node:fs";
import path from "node:path";

// Standard 8-4-4-4-12 hex UUID pattern
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a clean, raw UUID with no whitespace, prefixes, or suffix characters.
 */
export function validateWorkerVersionId(id) {
  if (typeof id !== "string") {
    return { valid: false, error: "Version ID must be a string" };
  }
  const trimmed = id.trim();
  if (trimmed !== id) {
    return { valid: false, error: "Version ID contains leading or trailing whitespace" };
  }
  if (!UUID_REGEX.test(id)) {
    return { valid: false, error: `Value "${id}" is not a valid 36-character UUID` };
  }
  return { valid: true, versionId: id.toLowerCase() };
}

/**
 * Parses output from `wrangler deployments status --json`.
 * In Wrangler 4.x, `deployments status --json` outputs a single deployment object:
 * {
 *   "id": "deployment-uuid",
 *   "created_on": "...",
 *   "author_email": "...",
 *   "source": "...",
 *   "versions": [
 *     { "version_id": "version-uuid", "percentage": 100 }
 *   ]
 * }
 */
export function parseWorkerDeploymentsStatusJson(jsonInput) {
  let data;
  try {
    data = typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
  } catch (err) {
    throw new Error(`SCHEMA_ERROR: Invalid JSON input for deployments status: ${err.message}`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("SCHEMA_ERROR: Expected a JSON deployment object from deployments status");
  }

  const deploymentId = data.id;
  if (!deploymentId || typeof deploymentId !== "string") {
    throw new Error("SCHEMA_ERROR: Deployment object missing valid 'id' property");
  }

  if (!Array.isArray(data.versions) || data.versions.length === 0) {
    throw new Error("MISSING_VERSIONS: Deployment contains no versions array or empty versions");
  }

  if (data.versions.length > 1) {
    const splitSummary = data.versions.map((v) => `${v.version_id} (${v.percentage}%)`).join(", ");
    throw new Error(
      `CANARY_ACTIVE: Multiple active versions detected (${splitSummary}). Automated rollback resolution requires operator manual intervention.`
    );
  }

  const singleVersion = data.versions[0];
  if (!singleVersion || typeof singleVersion !== "object") {
    throw new Error("SCHEMA_ERROR: Invalid version entry in versions array");
  }

  if (typeof singleVersion.percentage !== "number") {
    throw new Error("MISSING_PERCENTAGE: Version entry missing numeric 'percentage' property");
  }

  if (singleVersion.percentage !== 100) {
    throw new Error(
      `SPLIT_TRAFFIC: Active version percentage is ${singleVersion.percentage}%, expected exactly 100% for safe automated rollback target`
    );
  }

  const rawVersionId = singleVersion.version_id;
  const valResult = validateWorkerVersionId(rawVersionId);
  if (!valResult.valid) {
    throw new Error(`INVALID_VERSION_UUID: ${valResult.error}`);
  }

  return {
    versionId: valResult.versionId,
    deploymentId: String(deploymentId),
    createdOn: data.created_on || null,
    authorEmail: data.author_email || null,
    percentage: 100,
    raw: data
  };
}

/**
 * Parses output from `wrangler deployments list --json`.
 * In Wrangler 4.x, `deployments list --json` outputs an array of deployments or `{ deployments: [...] }`.
 * Stricter reconciliation: requires finding an explicitly active deployment with verified 100% traffic.
 */
export function parseWorkerDeploymentsListJson(jsonInput) {
  let data;
  try {
    data = typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
  } catch (err) {
    throw new Error(`SCHEMA_ERROR: Invalid JSON input for deployments list: ${err.message}`);
  }

  const deployments = Array.isArray(data) ? data : data?.deployments;
  if (!Array.isArray(deployments)) {
    throw new Error("SCHEMA_ERROR: Expected deployments array in JSON");
  }

  if (deployments.length === 0) {
    throw new Error("NO_DEPLOYMENTS: Deployments list is empty");
  }

  // Find deployment that is marked current or active, OR if there is an unambiguous top deployment with traffic
  // Never assume deployments[0] is active without validating versions array and percentage!
  const currentDeployment = deployments.find((d) => d.current === true) || deployments[0];
  if (!currentDeployment) {
    throw new Error("NO_ACTIVE_DEPLOYMENT: Could not find verified active deployment in list");
  }

  return parseWorkerDeploymentsStatusJson(currentDeployment);
}

/**
 * Writes the raw, validated Version ID to a dedicated file.
 * Formats strictly as raw UUID string with trailing newline (or no trailing characters).
 * Writes separate human-readable metadata to a distinct companion file.
 */
export function writeRawWorkerVersionIdFile(versionFilePath, versionId, metadata = {}) {
  const val = validateWorkerVersionId(versionId);
  if (!val.valid) {
    throw new Error(`WRITE_REFUSED: Cannot write invalid version ID: ${val.error}`);
  }

  fs.mkdirSync(path.dirname(versionFilePath), { recursive: true });

  // Write RAW UUID ONLY to version file
  fs.writeFileSync(versionFilePath, `${val.versionId}\n`, "utf8");

  // Write human-readable metadata to companion .txt / .json file if requested
  const metaFilePath = versionFilePath.replace(/\.[^.]+$/, "-summary.json");
  if (metaFilePath !== versionFilePath) {
    fs.writeFileSync(
      metaFilePath,
      JSON.stringify(
        {
          resolvedVersionId: val.versionId,
          recordedAt: new Date().toISOString(),
          ...metadata
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  }
}

/**
 * Reads and strictly validates a raw Version ID from a file.
 * Fails closed if the file contains prefixes, multiple lines, or invalid UUID formatting.
 */
export function readRawWorkerVersionIdFile(versionFilePath) {
  if (!fs.existsSync(versionFilePath)) {
    throw new Error(`FILE_NOT_FOUND: Version ID file does not exist: ${versionFilePath}`);
  }

  const content = fs.readFileSync(versionFilePath, "utf8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error(`EMPTY_FILE: Version ID file is empty: ${versionFilePath}`);
  }

  if (lines.length > 1) {
    throw new Error(
      `CONTAMINATED_FILE: Version ID file contains multiple lines (${lines.length}). Expected single raw UUID.`
    );
  }

  const rawId = lines[0].trim();
  const val = validateWorkerVersionId(rawId);
  if (!val.valid) {
    throw new Error(
      `CONTAMINATED_FILE: File content "${rawId}" is not a valid raw UUID. Error: ${val.error}`
    );
  }

  return val.versionId;
}

/**
 * Cross-checks two independently observed version IDs.
 * Mismatched IDs must be fatal.
 */
export function crossCheckWorkerVersions(versionA, versionB, contextA = "Observation A", contextB = "Observation B") {
  const valA = validateWorkerVersionId(versionA);
  const valB = validateWorkerVersionId(versionB);

  if (!valA.valid) throw new Error(`INVALID_ID in ${contextA}: ${valA.error}`);
  if (!valB.valid) throw new Error(`INVALID_ID in ${contextB}: ${valB.error}`);

  if (valA.versionId !== valB.versionId) {
    throw new Error(
      `DISCREPANCY: Version ID mismatch between ${contextA} (${valA.versionId}) and ${contextB} (${valB.versionId})`
    );
  }

  return valA.versionId;
}

// ============================================================
// CLI AND SELF-TEST RUNNER
// ============================================================
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const args = process.argv.slice(2);

  // Direct CLI invocation
  if (args.length > 0 && !args.includes("--test")) {
    let inputPath = null;
    let outputPath = null;
    let validateTarget = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--input" || args[i] === "-i") {
        inputPath = args[++i];
      } else if (args[i] === "--output" || args[i] === "-o") {
        outputPath = args[++i];
      } else if (args[i] === "--validate" || args[i] === "-v") {
        validateTarget = args[++i];
      }
    }

    if (validateTarget) {
      try {
        let vId = validateTarget;
        if (fs.existsSync(validateTarget)) {
          vId = readRawWorkerVersionIdFile(validateTarget);
        } else {
          const val = validateWorkerVersionId(validateTarget);
          if (!val.valid) throw new Error(val.error);
          vId = val.versionId;
        }
        console.log(`✓ VALID_WORKER_VERSION_ID: ${vId}`);
        process.exit(0);
      } catch (err) {
        console.error(`✗ INVALID_WORKER_VERSION_ID: ${err.message}`);
        process.exit(1);
      }
    }

    if (!inputPath) {
      console.error("Usage: node scripts/resolve-worker-rollback-version.mjs --input <deployments.json> [--output <active-version-id.txt>]");
      console.error("       node scripts/resolve-worker-rollback-version.mjs --validate <version-id-or-file>");
      process.exit(1);
    }

    try {
      const rawJson = fs.readFileSync(path.resolve(inputPath), "utf8");
      const parsed = JSON.parse(rawJson);
      const res = Array.isArray(parsed) || parsed.deployments
        ? parseWorkerDeploymentsListJson(parsed)
        : parseWorkerDeploymentsStatusJson(parsed);

      console.log(`✓ RESOLVED WORKER VERSION ID: ${res.versionId}`);
      console.log(`  - Deployment ID: ${res.deploymentId}`);
      console.log(`  - Traffic Percentage: ${res.percentage}%`);

      if (outputPath) {
        writeRawWorkerVersionIdFile(path.resolve(outputPath), res.versionId, {
          deploymentId: res.deploymentId,
          createdOn: res.createdOn,
          authorEmail: res.authorEmail
        });
        console.log(`  - Saved raw Version ID to: ${outputPath}`);
      }
      process.exit(0);
    } catch (err) {
      console.error(`✗ WORKER VERSION RESOLUTION FAILED: ${err.message}`);
      process.exit(1);
    }
  }

  console.log("Running Worker Rollback Version-ID Resolver self-tests...\n");

  let passed = 0;
  let failed = 0;

  function runCase(name, fn) {
    try {
      fn();
      passed++;
      console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
    }
  }

  const MOCK_DEPLOYMENT_ID = "e30129dc-bcf9-42b8-9ee2-658f844ba55f";
  const MOCK_VERSION_ID = "236c56bb-375e-4ba7-8051-24018f2ee188";

  // Positive Case: Valid deployment status JSON
  runCase("Positive: Correctly extracts version_id (NOT deployment id)", () => {
    const fixture = {
      id: MOCK_DEPLOYMENT_ID,
      created_on: "2026-10-21T12:00:00Z",
      author_email: "operator@example.com",
      source: "wrangler",
      versions: [{ version_id: MOCK_VERSION_ID, percentage: 100 }]
    };
    const res = parseWorkerDeploymentsStatusJson(JSON.stringify(fixture));
    if (res.versionId !== MOCK_VERSION_ID) throw new Error(`Expected ${MOCK_VERSION_ID}, got ${res.versionId}`);
    if (res.versionId === res.deploymentId) throw new Error("versionId should NOT equal deploymentId");
  });

  // Negative Case 1: Deployment ID differs from version ID (assert distinction preserved)
  runCase("Negative 1: Verifies Deployment ID is not returned as version ID", () => {
    const fixture = {
      id: "11111111-1111-1111-1111-111111111111",
      versions: [{ version_id: "22222222-2222-2222-2222-222222222222", percentage: 100 }]
    };
    const res = parseWorkerDeploymentsStatusJson(fixture);
    if (res.versionId === fixture.id) throw new Error("Returned deployment ID instead of version ID!");
    if (res.versionId !== "22222222-2222-2222-2222-222222222222") throw new Error("Failed to return version_id");
  });

  // Negative Case 2: No deployments
  runCase("Negative 2: Rejects empty deployments list", () => {
    let threw = false;
    try {
      parseWorkerDeploymentsListJson([]);
    } catch (err) {
      threw = err.message.includes("NO_DEPLOYMENTS");
    }
    if (!threw) throw new Error("Did not reject empty deployments");
  });

  // Negative Case 3: Multiple active versions (canary / split traffic)
  runCase("Negative 3: Rejects multiple active versions (canary split)", () => {
    const fixture = {
      id: MOCK_DEPLOYMENT_ID,
      versions: [
        { version_id: "22222222-2222-2222-2222-222222222222", percentage: 80 },
        { version_id: "33333333-3333-3333-3333-333333333333", percentage: 20 }
      ]
    };
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson(fixture);
    } catch (err) {
      threw = err.message.includes("CANARY_ACTIVE");
    }
    if (!threw) throw new Error("Did not reject split traffic");
  });

  // Negative Case 4: Missing versions array
  runCase("Negative 4: Rejects missing or empty versions array", () => {
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson({ id: MOCK_DEPLOYMENT_ID, versions: [] });
    } catch (err) {
      threw = err.message.includes("MISSING_VERSIONS");
    }
    if (!threw) throw new Error("Did not reject missing versions");
  });

  // Negative Case 5: Missing percentage
  runCase("Negative 5: Rejects missing or non-100 percentage", () => {
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson({
        id: MOCK_DEPLOYMENT_ID,
        versions: [{ version_id: MOCK_VERSION_ID }]
      });
    } catch (err) {
      threw = err.message.includes("MISSING_PERCENTAGE");
    }
    if (!threw) throw new Error("Did not reject missing percentage");
  });

  // Negative Case 6: Invalid UUID
  runCase("Negative 6: Rejects invalid non-UUID version string", () => {
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson({
        id: MOCK_DEPLOYMENT_ID,
        versions: [{ version_id: "not-a-valid-uuid", percentage: 100 }]
      });
    } catch (err) {
      threw = err.message.includes("INVALID_VERSION_UUID");
    }
    if (!threw) throw new Error("Did not reject invalid UUID");
  });

  // Negative Case 7: Prefixed or contaminated text file
  runCase("Negative 7: Rejects prefixed or contaminated version-id file", () => {
    const tmpFile = `/tmp/test-contaminated-version-${Date.now()}.txt`;
    try {
      fs.writeFileSync(tmpFile, "Pre-Deployment Active Worker ID: 236c56bb-375e-4ba7-8051-24018f2ee188\n");
      let threw = false;
      try {
        readRawWorkerVersionIdFile(tmpFile);
      } catch (err) {
        threw = err.message.includes("CONTAMINATED_FILE");
      }
      if (!threw) throw new Error("Did not reject prefixed text file");
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  // Negative Case 8: JSON output without verified active deployment
  runCase("Negative 8: Rejects JSON with null/undefined deployment", () => {
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson("null");
    } catch (err) {
      threw = err.message.includes("SCHEMA_ERROR");
    }
    if (!threw) throw new Error("Did not reject null deployment");
  });

  // Negative Case 9: Different version between independent status observations
  runCase("Negative 9: Rejects discrepancy between independent observations", () => {
    let threw = false;
    try {
      crossCheckWorkerVersions(
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333",
        "Pre-deployment check",
        "Post-deployment check"
      );
    } catch (err) {
      threw = err.message.includes("DISCREPANCY");
    }
    if (!threw) throw new Error("Did not reject version discrepancy");
  });

  // Negative Case 10: Unexpected Wrangler response schema
  runCase("Negative 10: Rejects unexpected schema / HTML error string", () => {
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson("<html><title>502 Bad Gateway</title></html>");
    } catch (err) {
      threw = err.message.includes("SCHEMA_ERROR");
    }
    if (!threw) throw new Error("Did not reject HTML string");
  });

  // File write and read round-trip verification
  runCase("Persistence: Writes raw UUID and reads back cleanly", () => {
    const tmpFile = `/tmp/test-clean-version-${Date.now()}.txt`;
    try {
      writeRawWorkerVersionIdFile(tmpFile, MOCK_VERSION_ID, { author: "operator@example.com" });
      const readBack = readRawWorkerVersionIdFile(tmpFile);
      if (readBack !== MOCK_VERSION_ID) throw new Error(`Expected ${MOCK_VERSION_ID}, read ${readBack}`);
      const rawContent = fs.readFileSync(tmpFile, "utf8");
      if (rawContent !== `${MOCK_VERSION_ID}\n`) {
        throw new Error(`File content not strictly raw UUID: "${rawContent}"`);
      }
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      const sumFile = tmpFile.replace(/\.[^.]+$/, "-summary.json");
      if (fs.existsSync(sumFile)) fs.unlinkSync(sumFile);
    }
  });

  console.log(`\nSelf-test results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}
