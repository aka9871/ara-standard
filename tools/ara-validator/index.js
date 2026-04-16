#!/usr/bin/env node

/**
 * ARA Validator v1.1 — Validates ARA manifest files against the v1.0 specification.
 *
 * Usage:
 *   npx ara-validate https://example.com
 *   npx ara-validate ./path/to/manifest.json
 *
 * Checks:
 *   - manifest.json exists at /.well-known/ara/manifest.json
 *   - Required fields are present and valid
 *   - Schema files are fetchable and valid JSON (URL mode)
 *   - actions.json is fetchable and has required structure (URL mode)
 *   - digest.md exists and has acceptable token count (200-400 tokens)
 *   - Enforcement signals present: ARA HTTP headers (URL mode)
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

function fetchUrl(url, includeHeaders = false) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { headers: { "User-Agent": "ARA-Validator/1.1" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location, includeHeaders).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: data,
            headers: includeHeaders ? res.headers : undefined,
          })
        );
      })
      .on("error", reject);
  });
}

// Rough token estimate: ~4 characters per token (conservative)
function estimateTokens(text) {
  return Math.round(text.length / 4);
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
    enforcement: null,
  };

  let manifest;
  const isUrl = input.startsWith("http://") || input.startsWith("https://");
  const baseUrl = isUrl ? input.replace(/\/$/, "") : null;

  // ── Fetch or read manifest ──────────────────────────────────────────────
  if (isUrl) {
    const manifestUrl = baseUrl + "/.well-known/ara/manifest.json";
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

    // ── Check digest.md (fetch + quality) ──────────────────────────────────
    try {
      const digestUrl = baseUrl + "/.well-known/ara/digest.md";
      const digestResponse = await fetchUrl(digestUrl);
      if (digestResponse.status === 200) {
        results.score += SCORES.HAS_DIGEST;
        const tokens = estimateTokens(digestResponse.body);
        results.info.push(`digest.md found (~${tokens} tokens)`);
        if (tokens < 150) {
          results.warnings.push(`digest.md is too short (~${tokens} tokens) — target 200-400 tokens with specific facts`);
        } else if (tokens > 500) {
          results.warnings.push(`digest.md is too long (~${tokens} tokens) — trim to 200-400 tokens for optimal agent consumption`);
        }
      } else {
        results.warnings.push("No digest.md found — add /.well-known/ara/digest.md (200-400 tokens, GEO layer)");
      }
    } catch {
      results.warnings.push("Could not check for digest.md");
    }

    // ── Check schemas/ (fetch first schema_ref found) ──────────────────────
    const schemaRefs = [];
    if (manifest.content_map && Array.isArray(manifest.content_map.resources)) {
      manifest.content_map.resources.forEach((r) => {
        if (r.schema_ref) schemaRefs.push(r.schema_ref);
      });
    }

    if (schemaRefs.length > 0) {
      try {
        const schemaUrl = baseUrl + "/" + schemaRefs[0].replace(/^\//, "");
        const schemaResponse = await fetchUrl(schemaUrl);
        if (schemaResponse.status === 200) {
          try {
            const schema = JSON.parse(schemaResponse.body);
            if (schema.properties || schema.resource) {
              results.score += SCORES.SCHEMAS_VALID;
              results.info.push(`schemas/ valid (checked ${schemaRefs[0]})`);
            } else {
              results.warnings.push(`Schema ${schemaRefs[0]} is missing 'properties' or 'resource' fields`);
            }
          } catch {
            results.issues.push(`Schema ${schemaRefs[0]} is not valid JSON`);
          }
        } else {
          results.warnings.push(`schema_ref '${schemaRefs[0]}' returned HTTP ${schemaResponse.status}`);
        }
      } catch {
        results.warnings.push("Could not fetch schema file");
      }
    } else {
      results.warnings.push("No schema_ref found on resources — add schemas/ for Layer 2 (run /ara transform)");
    }

    // ── Check actions.json ─────────────────────────────────────────────────
    const actionsRef =
      (manifest.capabilities && manifest.capabilities.actions_ref) ||
      "/.well-known/ara/actions.json";
    try {
      const actionsUrl = baseUrl + actionsRef.replace(/^\//, "/");
      const actionsResponse = await fetchUrl(actionsUrl);
      if (actionsResponse.status === 200) {
        try {
          const actions = JSON.parse(actionsResponse.body);
          if (Array.isArray(actions.actions) && actions.actions.length > 0) {
            results.score += SCORES.ACTIONS_VALID;
            results.info.push(`actions.json valid (${actions.actions.length} actions)`);
          } else {
            results.warnings.push("actions.json exists but has no actions defined");
          }
        } catch {
          results.issues.push("actions.json is not valid JSON");
        }
      } else {
        results.warnings.push("No actions.json found — add Layer 3 for agent interaction (run /ara transform)");
      }
    } catch {
      results.warnings.push("Could not check for actions.json");
    }

    // ── Check enforcement signals (ARA HTTP headers) ───────────────────────
    try {
      const homeResponse = await fetchUrl(baseUrl, true);
      const headers = homeResponse.headers || {};
      const linkHeader = headers["link"] || "";
      const araManifestHeader = headers["x-ara-manifest"] || "";
      const araVersionHeader = headers["x-ara-version"] || "";

      const hasLinkHeader = linkHeader.includes("ara-manifest");
      const hasXAraHeader = Boolean(araManifestHeader);
      const hasVersionHeader = Boolean(araVersionHeader);

      results.enforcement = {
        link_header: hasLinkHeader,
        x_ara_manifest: hasXAraHeader,
        x_ara_version: hasVersionHeader,
        enforced: hasLinkHeader || hasXAraHeader,
      };

      if (!hasLinkHeader && !hasXAraHeader) {
        results.warnings.push(
          "No ARA enforcement signals detected (no Link: rel=ara-manifest or X-ARA-Manifest header) — run /ara enforce to inject middleware"
        );
      } else {
        results.info.push("ARA enforcement signals present (HTTP headers)");
      }
    } catch {
      // Non-blocking — enforcement check is advisory
    }
  } else {
    // ── Local file mode ────────────────────────────────────────────────────
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

    // Local: check for schemas/ and actions.json relative to manifest location
    const dir = path.dirname(input);
    const schemasDir = path.join(dir, "schemas");
    const actionsFile = path.join(dir, "actions.json");
    const digestFile = path.join(dir, "digest.md");

    if (fs.existsSync(schemasDir)) {
      const schemaFiles = fs.readdirSync(schemasDir).filter((f) => f.endsWith(".json"));
      if (schemaFiles.length > 0) {
        try {
          const firstSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, schemaFiles[0]), "utf-8"));
          if (firstSchema.properties || firstSchema.resource) {
            results.score += SCORES.SCHEMAS_VALID;
            results.info.push(`schemas/ found (${schemaFiles.length} schema files)`);
          }
        } catch {
          results.warnings.push("schemas/ directory found but schema files are not valid JSON");
        }
      } else {
        results.warnings.push("schemas/ directory is empty");
      }
    } else {
      results.warnings.push("No schemas/ directory found — add Layer 2 schemas");
    }

    if (fs.existsSync(actionsFile)) {
      try {
        const actions = JSON.parse(fs.readFileSync(actionsFile, "utf-8"));
        if (Array.isArray(actions.actions) && actions.actions.length > 0) {
          results.score += SCORES.ACTIONS_VALID;
          results.info.push(`actions.json found (${actions.actions.length} actions)`);
        } else {
          results.warnings.push("actions.json exists but has no actions defined");
        }
      } catch {
        results.issues.push("actions.json is not valid JSON");
      }
    } else {
      results.warnings.push("No actions.json found — add Layer 3 actions");
    }

    if (fs.existsSync(digestFile)) {
      const digestContent = fs.readFileSync(digestFile, "utf-8");
      const tokens = estimateTokens(digestContent);
      results.score += SCORES.HAS_DIGEST;
      results.info.push(`digest.md found (~${tokens} tokens)`);
      if (tokens < 150) {
        results.warnings.push(`digest.md is too short (~${tokens} tokens) — target 200-400 tokens`);
      } else if (tokens > 500) {
        results.warnings.push(`digest.md is too long (~${tokens} tokens) — trim to 200-400 tokens`);
      }
    } else {
      results.warnings.push("No digest.md found — add the GEO layer summary");
    }
  }

  // ── Field validation (common) ──────────────────────────────────────────
  if (manifest.$ara) {
    results.score += SCORES.HAS_ARA_VERSION;
    results.info.push(`ARA version: ${manifest.$ara}`);
  } else {
    results.issues.push("Missing '$ara' version field (required)");
  }

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

  results.grade = grade(results.score);

  return results;
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const input = process.argv[2];

  if (!input || input === "--help" || input === "-h") {
    console.log(`
ARA Validator v1.1
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

Scoring (100 points):
  manifest.json exists      10 pts
  Valid JSON                  5 pts
  $ara version field          5 pts
  identity section           10 pts
  identity complete          10 pts
  content_map section        10 pts
  resources array            10 pts
  capabilities section       10 pts
  policies section           10 pts
  meta section                5 pts
  digest.md present           5 pts
  schemas/ valid              5 pts
  actions.json valid          5 pts
`);
    process.exit(0);
  }

  const jsonOutput = process.argv.includes("--json");

  console.log("\n  ARA Validator v1.1\n  ==================\n");

  const results = await validate(input);

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.issues.length > 0 ? 1 : 0);
  }

  // Pretty print
  results.info.forEach((msg) => console.log(`  ℹ  ${msg}`));
  console.log();

  if (results.issues.length > 0) {
    console.log("  Issues:");
    results.issues.forEach((msg) => console.log(`  ✗  ${msg}`));
    console.log();
  }

  if (results.warnings.length > 0) {
    console.log("  Warnings:");
    results.warnings.forEach((msg) => console.log(`  ⚠  ${msg}`));
    console.log();
  }

  if (results.enforcement !== null) {
    const e = results.enforcement;
    console.log("  Enforcement signals:");
    console.log(`  ${e.link_header ? "✓" : "✗"}  Link: rel="ara-manifest" header`);
    console.log(`  ${e.x_ara_manifest ? "✓" : "✗"}  X-ARA-Manifest header`);
    console.log(`  ${e.x_ara_version ? "✓" : "✗"}  X-ARA-Version header`);
    if (!e.enforced) {
      console.log("     → Run /ara enforce to inject middleware for your stack");
    }
    console.log();
  }

  const gradeEmoji = { A: "🟢", B: "🟡", C: "🟠", D: "🔴", F: "⛔" };
  console.log(
    `  Score: ${results.score}/${MAX_SCORE} — Grade: ${results.grade} ${gradeEmoji[results.grade] || ""}`
  );
  console.log();

  process.exit(results.issues.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

module.exports = { validate };
