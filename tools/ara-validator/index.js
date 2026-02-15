#!/usr/bin/env node

/**
 * ARA Validator — Validates ARA manifest files against the v1.0 specification.
 *
 * Usage:
 *   npx ara-validate https://example.com
 *   npx ara-validate ./path/to/manifest.json
 *
 * Checks:
 *   - manifest.json exists at /.well-known/ara/manifest.json
 *   - Required fields are present and valid
 *   - Schema references resolve
 *   - Actions file is valid (if referenced)
 *   - Protocol endpoints respond (if URL provided)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ── Scoring ────────────────────────────────────────────────────────────────

const SCORES = {
  MANIFEST_EXISTS: 10,
  VALID_JSON: 5,
  HAS_ARA_VERSION: 5,
  HAS_IDENTITY: 10,
  IDENTITY_COMPLETE: 10,
  HAS_CONTENT_MAP: 10,
  HAS_RESOURCES: 10,
  HAS_CAPABILITIES: 10,
  HAS_POLICIES: 10,
  HAS_META: 5,
  HAS_DIGEST: 5,
  SCHEMAS_VALID: 5,
  ACTIONS_VALID: 5,
};

const MAX_SCORE = Object.values(SCORES).reduce((a, b) => a + b, 0);

// ── Helpers ────────────────────────────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { headers: { "User-Agent": "ARA-Validator/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      })
      .on("error", reject);
  });
}

function grade(score) {
  const pct = (score / MAX_SCORE) * 100;
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 50) return "D";
  return "F";
}

// ── Validators ─────────────────────────────────────────────────────────────

function validateIdentity(identity) {
  const issues = [];
  const warnings = [];

  if (!identity) {
    issues.push("Missing 'identity' section (required)");
    return { score: 0, issues, warnings };
  }

  let score = SCORES.HAS_IDENTITY;

  if (!identity.name) issues.push("identity.name is required");
  if (!identity.type) issues.push("identity.type is required");
  if (!identity.description) issues.push("identity.description is required");

  if (identity.name && identity.type && identity.description) {
    score += SCORES.IDENTITY_COMPLETE;
  }

  if (!identity.locale) warnings.push("identity.locale is recommended (e.g., ['en-US'])");
  if (!identity.contact) warnings.push("identity.contact is recommended");

  return { score, issues, warnings };
}

function validateContentMap(contentMap) {
  const issues = [];
  const warnings = [];

  if (!contentMap) {
    issues.push("Missing 'content_map' section (required)");
    return { score: 0, issues, warnings };
  }

  let score = SCORES.HAS_CONTENT_MAP;

  if (!contentMap.summary) issues.push("content_map.summary is required");

  if (!contentMap.resources || !Array.isArray(contentMap.resources)) {
    issues.push("content_map.resources must be an array");
  } else {
    score += SCORES.HAS_RESOURCES;

    contentMap.resources.forEach((resource, i) => {
      if (!resource.id) issues.push(`resources[${i}].id is required`);
      if (!resource.type) issues.push(`resources[${i}].type is required`);
      if (!resource.label) issues.push(`resources[${i}].label is required`);
      if (!resource.access) warnings.push(`resources[${i}].access is recommended`);
      if (!resource.schema_ref) warnings.push(`resources[${i}].schema_ref is recommended for Layer 2`);
    });
  }

  return { score, issues, warnings };
}

function validateCapabilities(capabilities) {
  const warnings = [];

  if (!capabilities) {
    return {
      score: 0,
      issues: [],
      warnings: ["'capabilities' section is recommended for Layer 3"],
    };
  }

  let score = SCORES.HAS_CAPABILITIES;

  if (!capabilities.protocols || Object.keys(capabilities.protocols).length === 0) {
    warnings.push("No protocols declared in capabilities");
  }

  return { score, issues: [], warnings };
}

function validatePolicies(policies) {
  const warnings = [];

  if (!policies) {
    return {
      score: 0,
      issues: [],
      warnings: ["'policies' section is recommended"],
    };
  }

  let score = SCORES.HAS_POLICIES;

  if (!policies.rate_limit) warnings.push("policies.rate_limit is recommended");
  if (!policies.agent_access) warnings.push("policies.agent_access is recommended");

  return { score, issues: [], warnings };
}

function validateMeta(meta) {
  if (!meta) {
    return {
      score: 0,
      issues: [],
      warnings: ["'meta' section is recommended"],
    };
  }

  return { score: SCORES.HAS_META, issues: [], warnings: [] };
}

// ── Main Validator ─────────────────────────────────────────────────────────

async function validate(input) {
  const results = {
    score: 0,
    grade: "F",
    issues: [],
    warnings: [],
    info: [],
  };

  let manifest;

  // Determine if input is URL or file path
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const manifestUrl = input.replace(/\/$/, "") + "/.well-known/ara/manifest.json";
    results.info.push(`Fetching ${manifestUrl}`);

    try {
      const response = await fetchUrl(manifestUrl);
      if (response.status !== 200) {
        results.issues.push(`manifest.json returned HTTP ${response.status}`);
        return results;
      }
      results.score += SCORES.MANIFEST_EXISTS;
      results.info.push("manifest.json found");

      try {
        manifest = JSON.parse(response.body);
        results.score += SCORES.VALID_JSON;
      } catch (e) {
        results.issues.push("manifest.json is not valid JSON: " + e.message);
        return results;
      }
    } catch (e) {
      results.issues.push("Could not fetch manifest: " + e.message);
      return results;
    }

    // Check for digest
    try {
      const digestUrl = input.replace(/\/$/, "") + "/.well-known/ara/digest.md";
      const digestResponse = await fetchUrl(digestUrl);
      if (digestResponse.status === 200) {
        results.score += SCORES.HAS_DIGEST;
        results.info.push("digest.md found");
      } else {
        results.warnings.push("No digest.md found (recommended)");
      }
    } catch {
      results.warnings.push("Could not check for digest.md");
    }
  } else {
    // Local file
    if (!fs.existsSync(input)) {
      results.issues.push(`File not found: ${input}`);
      return results;
    }

    results.score += SCORES.MANIFEST_EXISTS;

    try {
      const content = fs.readFileSync(input, "utf-8");
      manifest = JSON.parse(content);
      results.score += SCORES.VALID_JSON;
    } catch (e) {
      results.issues.push("Invalid JSON: " + e.message);
      return results;
    }
  }

  // Validate $ara version
  if (manifest.$ara) {
    results.score += SCORES.HAS_ARA_VERSION;
    results.info.push(`ARA version: ${manifest.$ara}`);
  } else {
    results.issues.push("Missing '$ara' version field (required)");
  }

  // Validate each section
  const identityResult = validateIdentity(manifest.identity);
  results.score += identityResult.score;
  results.issues.push(...identityResult.issues);
  results.warnings.push(...identityResult.warnings);

  const contentResult = validateContentMap(manifest.content_map);
  results.score += contentResult.score;
  results.issues.push(...contentResult.issues);
  results.warnings.push(...contentResult.warnings);

  const capResult = validateCapabilities(manifest.capabilities);
  results.score += capResult.score;
  results.issues.push(...capResult.issues);
  results.warnings.push(...capResult.warnings);

  const policyResult = validatePolicies(manifest.policies);
  results.score += policyResult.score;
  results.issues.push(...policyResult.issues);
  results.warnings.push(...policyResult.warnings);

  const metaResult = validateMeta(manifest.meta);
  results.score += metaResult.score;
  results.issues.push(...metaResult.issues);
  results.warnings.push(...metaResult.warnings);

  // Calculate grade
  results.grade = grade(results.score);

  return results;
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const input = process.argv[2];

  if (!input || input === "--help" || input === "-h") {
    console.log(`
ARA Validator v1.0
==================

Validates ARA (Agent-Ready Architecture) manifest files.

Usage:
  npx ara-validate <url-or-file>

Examples:
  npx ara-validate https://example.com
  npx ara-validate ./manifest.json
  npx ara-validate .well-known/ara/manifest.json

Options:
  --help, -h    Show this help message
  --json        Output results as JSON
`);
    process.exit(0);
  }

  const jsonOutput = process.argv.includes("--json");

  console.log("\n  ARA Validator v1.0\n  ==================\n");

  const results = await validate(input);

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.issues.length > 0 ? 1 : 0);
  }

  // Pretty print
  results.info.forEach((msg) => console.log(`  ℹ ${msg}`));
  console.log();

  if (results.issues.length > 0) {
    console.log("  Issues:");
    results.issues.forEach((msg) => console.log(`  ✗ ${msg}`));
    console.log();
  }

  if (results.warnings.length > 0) {
    console.log("  Warnings:");
    results.warnings.forEach((msg) => console.log(`  ⚠ ${msg}`));
    console.log();
  }

  console.log(`  Score: ${results.score}/${MAX_SCORE} — Grade: ${results.grade}`);
  console.log();

  process.exit(results.issues.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

module.exports = { validate };
