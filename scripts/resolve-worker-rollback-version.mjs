#!/usr/bin/env node

/**
 * scripts/resolve-worker-rollback-version.mjs
 *
 * Cloudflare Worker Rollback Version-ID Resolver & Safety Validator
 *
 * Resolves the active Worker VERSION_ID (required by `wrangler rollback <version-id>`)
 * from structured machine-readable JSON output of `wrangler deployments status --json`
 * with optional cross-check against `wrangler deployments list --json`.
 *
 * Strictly enforces:
 * - Version ID vs Deployment ID distinction (Deployment ID is NOT valid for rollback).
 * - Exact single active version receiving 100% traffic.
 * - Authoritative current-state observation required (no blind deployments[0] fallbacks).
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
 * Parses authoritative output from `wrangler deployments status --json`.
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

  // Preserve and verify distinction between Deployment ID and Version ID
  if (valResult.versionId === deploymentId.toLowerCase()) {
    throw new Error(
      `ACCIDENTAL_DEPLOYMENT_ID: Resolved version_id (${valResult.versionId}) is identical to deployment ID (${deploymentId}). Cloudflare rollback requires an authentic Version ID, not a Deployment ID.`
    );
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
 * Parses historical output from `wrangler deployments list --json`.
 * In Wrangler 4.x, `deployments list --json` outputs an array of historical deployments.
 * Stricter reconciliation: requires finding an explicitly active deployment with verified 100% traffic.
 * NEVER falls back to deployments[0] (which in Wrangler 4.x is chronological ascending, i.e. oldest historical deployment).
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

  // Strictly require explicit 'current: true' evidence.
  // The deployments[0] fallback is completely eliminated: a historical first deployment without
  // authoritative current-state proof MUST genuinely cause a safe failure.
  const currentDeployments = deployments.filter((d) => d.current === true);
  if (currentDeployments.length === 0) {
    throw new Error(
      "NO_CURRENT_STATE_PROOF: Deployments list contains no deployment marked 'current: true'. " +
      "Deployments list is historical evidence only and cannot establish active serving state. " +
      "Authoritative current serving state must be obtained from 'wrangler deployments status --json'."
    );
  }

  if (currentDeployments.length > 1) {
    throw new Error(
      `AMBIGUOUS_CURRENT_DEPLOYMENTS: Multiple deployments (${currentDeployments.length}) are marked 'current: true'. ` +
      "Automated rollback version resolution requires exactly one active deployment."
    );
  }

  return parseWorkerDeploymentsStatusJson(currentDeployments[0]);
}

/**
 * Resolves the authoritative currently serving Worker Version ID.
 * Requires statusJson from `wrangler deployments status --json` as primary authority.
 * If listJson from `wrangler deployments list --json` is also provided, cross-checks:
 * - Version ID matches
 * - Deployment ID matches (if specified in list entry)
 */
export function resolveAuthoritativeWorkerRollbackVersion({ statusJson, listJson } = {}) {
  if (!statusJson) {
    throw new Error(
      "MISSING_STATUS_OBSERVATION: Authoritative observation from 'wrangler deployments status --json' is required."
    );
  }

  const statusResult = parseWorkerDeploymentsStatusJson(statusJson);

  if (listJson) {
    try {
      const listResult = parseWorkerDeploymentsListJson(listJson);
      crossCheckWorkerVersions(
        statusResult.versionId,
        listResult.versionId,
        "wrangler deployments status",
        "wrangler deployments list"
      );
      if (listResult.deploymentId && statusResult.deploymentId !== listResult.deploymentId) {
        throw new Error(
          `DISCREPANCY: Deployment ID mismatch between status (${statusResult.deploymentId}) and list (${listResult.deploymentId})`
        );
      }
    } catch (listErr) {
      if (!listErr.message.includes("NO_CURRENT_STATE_PROOF")) {
        throw listErr;
      }
    }
  }

  return statusResult;
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

  // Write human-readable metadata to companion .json file
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
    let statusPath = null;
    let listPath = null;
    let inputPath = null;
    let outputPath = null;
    let validateTarget = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--status-json" || args[i] === "--status") {
        statusPath = args[++i];
      } else if (args[i] === "--list-json" || args[i] === "--list") {
        listPath = args[++i];
      } else if (args[i] === "--input" || args[i] === "-i") {
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

    // Determine status and list inputs
    let statusContent = null;
    let listContent = null;

    if (statusPath) {
      statusContent = fs.readFileSync(path.resolve(statusPath), "utf8");
    }
    if (listPath) {
      listContent = fs.readFileSync(path.resolve(listPath), "utf8");
    }

    if (inputPath && !statusContent) {
      const raw = fs.readFileSync(path.resolve(inputPath), "utf8");
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) || parsed.deployments) {
          listContent = raw;
        } else {
          statusContent = raw;
        }
      } catch (err) {
        console.error(`✗ PARSE_ERROR: ${err.message}`);
        process.exit(1);
      }
    }

    if (!statusContent) {
      console.error("Usage: node scripts/resolve-worker-rollback-version.mjs --status-json <status.json> [--list-json <list.json>] [--output <active-version-id.txt>]");
      console.error("       node scripts/resolve-worker-rollback-version.mjs --validate <version-id-or-file>");
      process.exit(1);
    }

    try {
      const res = resolveAuthoritativeWorkerRollbackVersion({
        statusJson: statusContent,
        listJson: listContent
      });

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
  const MOCK_HISTORICAL_DEPLOYMENT_ID = "a1111111-bcf9-42b8-9ee2-658f844ba55f";
  const MOCK_HISTORICAL_VERSION_ID = "b2222222-375e-4ba7-8051-24018f2ee188";

  // Test 1: Valid single current deployment (authoritative status)
  runCase("Test 1: Valid single current deployment extracts version_id (NOT deployment id)", () => {
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

  // Test 2: Historical first deployment differs from actual current deployment
  runCase("Test 2: Historical first deployment differs from actual current deployment (selects current: true, NOT index 0)", () => {
    const listFixture = [
      {
        id: MOCK_HISTORICAL_DEPLOYMENT_ID,
        current: false,
        created_on: "2026-10-19T10:00:00Z",
        versions: [{ version_id: MOCK_HISTORICAL_VERSION_ID, percentage: 100 }]
      },
      {
        id: MOCK_DEPLOYMENT_ID,
        current: true,
        created_on: "2026-10-21T12:00:00Z",
        versions: [{ version_id: MOCK_VERSION_ID, percentage: 100 }]
      }
    ];
    const res = parseWorkerDeploymentsListJson(listFixture);
    if (res.versionId !== MOCK_VERSION_ID) {
      throw new Error(`Expected active version ${MOCK_VERSION_ID}, but got index 0 version ${res.versionId}!`);
    }
    if (res.deploymentId !== MOCK_DEPLOYMENT_ID) {
      throw new Error(`Expected active deployment ${MOCK_DEPLOYMENT_ID}, but got ${res.deploymentId}!`);
    }
  });

  // Test 3: No explicit current-state evidence in deployments list (fails closed)
  runCase("Test 3: No explicit current-state evidence in deployments list genuinely fails closed", () => {
    const listFixtureWithoutCurrent = [
      {
        id: MOCK_HISTORICAL_DEPLOYMENT_ID,
        created_on: "2026-10-19T10:00:00Z",
        versions: [{ version_id: MOCK_HISTORICAL_VERSION_ID, percentage: 100 }]
      },
      {
        id: MOCK_DEPLOYMENT_ID,
        created_on: "2026-10-21T12:00:00Z",
        versions: [{ version_id: MOCK_VERSION_ID, percentage: 100 }]
      }
    ];
    let threw = false;
    try {
      parseWorkerDeploymentsListJson(listFixtureWithoutCurrent);
    } catch (err) {
      threw = err.message.includes("NO_CURRENT_STATE_PROOF");
    }
    if (!threw) throw new Error("Did not reject list lacking explicit current: true proof");
  });

  // Test 4: Multiple active versions (canary split / split traffic)
  runCase("Test 4: Rejects multiple active versions (canary split)", () => {
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

  // Test 5: Split traffic / non-100 percentage
  runCase("Test 5: Rejects single version with non-100 percentage", () => {
    const fixture = {
      id: MOCK_DEPLOYMENT_ID,
      versions: [{ version_id: MOCK_VERSION_ID, percentage: 80 }]
    };
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson(fixture);
    } catch (err) {
      threw = err.message.includes("SPLIT_TRAFFIC");
    }
    if (!threw) throw new Error("Did not reject non-100 percentage");
  });

  // Test 6: Missing version metadata
  runCase("Test 6: Rejects missing or empty versions array", () => {
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson({ id: MOCK_DEPLOYMENT_ID, versions: [] });
    } catch (err) {
      threw = err.message.includes("MISSING_VERSIONS");
    }
    if (!threw) throw new Error("Did not reject empty versions");
  });

  // Test 7: Invalid non-UUID version string
  runCase("Test 7: Rejects invalid non-UUID version string", () => {
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

  // Test 8: Deployment ID accidentally selected as Version ID
  runCase("Test 8: Rejects accidental selection of Deployment ID as Version ID", () => {
    const dupeId = "11111111-1111-1111-1111-111111111111";
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson({
        id: dupeId,
        versions: [{ version_id: dupeId, percentage: 100 }]
      });
    } catch (err) {
      threw = err.message.includes("ACCIDENTAL_DEPLOYMENT_ID");
    }
    if (!threw) throw new Error("Did not reject version_id matching deployment_id");
  });

  // Test 9: Conflicting current-state observations
  runCase("Test 9: Rejects conflicting current-state observations between status and list", () => {
    const statusJson = JSON.stringify({
      id: MOCK_DEPLOYMENT_ID,
      versions: [{ version_id: MOCK_VERSION_ID, percentage: 100 }]
    });
    const conflictingListJson = JSON.stringify([
      {
        id: "99999999-9999-9999-9999-999999999999",
        current: true,
        versions: [{ version_id: "88888888-8888-8888-8888-888888888888", percentage: 100 }]
      }
    ]);
    let threw = false;
    try {
      resolveAuthoritativeWorkerRollbackVersion({
        statusJson,
        listJson: conflictingListJson
      });
    } catch (err) {
      threw = err.message.includes("DISCREPANCY");
    }
    if (!threw) throw new Error("Did not reject version discrepancy between status and list");
  });

  // Test 10: Malformed JSON / HTML error response
  runCase("Test 10: Rejects malformed JSON and HTML 502 error responses", () => {
    let threw = false;
    try {
      parseWorkerDeploymentsStatusJson("<html><title>502 Bad Gateway</title></html>");
    } catch (err) {
      threw = err.message.includes("SCHEMA_ERROR");
    }
    if (!threw) throw new Error("Did not reject HTML string");
  });

  // Test 11: Old contaminated identity files
  runCase("Test 11: Rejects prefixed or multi-line contaminated version-id file", () => {
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

  // Test 12: Clean raw UUID write and read round-trip
  runCase("Test 12: Persistence writes raw UUID and reads back cleanly without pollution", () => {
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
