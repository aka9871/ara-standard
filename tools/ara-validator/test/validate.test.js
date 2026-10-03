"use strict";

// Run with `npm test` (Node ≥ 18, no dependencies).
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const MANIFEST = (refs) => ({
  $ara: "1.0",
  identity: {
    name: "Test Site",
    type: "ecommerce",
    description: "Fixture site for the validator tests",
    locale: ["en-US"],
    contact: { email: "ara@example.com" },
  },
  content_map: {
    summary: "Products",
    resources: [
      { id: "products", type: "catalog", label: "Products", access: "public", schema_ref: refs.schema },
    ],
  },
  capabilities: {
    protocols: { rest_api: { base_url: "https://example.com/api" } },
    ...(refs.actions !== undefined && { actions_ref: refs.actions }),
  },
  policies: { agent_access: "open", rate_limit: { requests_per_minute: 60 } },
  meta: { generated_at: "2026-10-03T00:00:00Z" },
});

const SCHEMA = { $ara_schema: "1.0", resource: "products", description: "A product", properties: {} };
const ACTIONS = { $ara_actions: "1.0", actions: [{ id: "search", name: "Search", description: "Search", type: "query", input: {}, output: {} }] };
const DIGEST = "# Test Site\n\n" + "A digest with enough concrete facts to reach the recommended size. ".repeat(14);

/** Serves a fixture site; `files` maps a path to [contentType, body]. */
async function serve(files, headers = {}) {
  const server = http.createServer((req, res) => {
    const file = files[req.url];
    if (!file) return res.writeHead(404, headers).end();
    res.writeHead(200, { "Content-Type": file[0], ...headers }).end(file[1]);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

function site(refs, extraFiles = {}) {
  return {
    "/": ["text/html", "<html></html>"],
    "/.well-known/ara/manifest.json": ["application/json", JSON.stringify(MANIFEST(refs))],
    "/.well-known/ara/digest.md": ["text/markdown", DIGEST],
    ...extraFiles,
  };
}

const ARA_FILES = {
  "/.well-known/ara/schemas/product.json": ["application/json", JSON.stringify(SCHEMA)],
  "/.well-known/ara/actions.json": ["application/json", JSON.stringify(ACTIONS)],
};

test("requiring the module does not run the CLI and exposes validate()", () => {
  const validator = require("../index.js");
  assert.equal(typeof validator.validate, "function");
  assert.equal(validator.MAX_SCORE, 100);
});

test("resolves references relative to the manifest URL (RFC 3986)", () => {
  const { resolveRef } = require("../index.js");
  const manifest = "https://example.com/.well-known/ara/manifest.json";
  assert.equal(resolveRef("schemas/product.json", manifest), "https://example.com/.well-known/ara/schemas/product.json");
  assert.equal(resolveRef("actions.json", manifest), "https://example.com/.well-known/ara/actions.json");
  assert.equal(resolveRef("/.well-known/ara/actions.json", manifest), "https://example.com/.well-known/ara/actions.json");
  assert.equal(resolveRef("https://cdn.example.org/s.json", manifest), "https://cdn.example.org/s.json");
});

test("a site following the spec examples (relative refs) scores 100", async () => {
  const s = await serve(site({ schema: "schemas/product.json", actions: "actions.json" }, ARA_FILES), {
    Link: '</.well-known/ara/manifest.json>; rel="ara-manifest"',
  });
  try {
    const result = await require("../index.js").validate(s.url);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.score, 100);
  } finally {
    await s.close();
  }
});

test("absolute-path refs and the default actions location still score 100", async () => {
  const s = await serve(site({ schema: "/.well-known/ara/schemas/product.json" }, ARA_FILES), { Link: '</.well-known/ara/manifest.json>; rel="ara-manifest"' });
  try {
    const result = await require("../index.js").validate(s.url);
    assert.equal(result.score, 100);
    assert.ok(result.info.some((i) => i.startsWith("actions.json valid")));
  } finally {
    await s.close();
  }
});

test("a schema_ref that does not resolve is reported", async () => {
  const s = await serve(site({ schema: "schemas/missing.json", actions: "actions.json" }, ARA_FILES));
  try {
    const result = await require("../index.js").validate(s.url);
    assert.equal(result.score, 95);
    assert.ok(result.warnings.some((w) => w.includes("schemas/missing.json") && w.includes("404")));
  } finally {
    await s.close();
  }
});

test("unknown extension keys are ignored, not penalised", async () => {
  const withExtension = MANIFEST({ schema: "schemas/product.json", actions: "actions.json" });
  withExtension["x-example"] = { anything: true };
  const files = site({}, ARA_FILES);
  files["/.well-known/ara/manifest.json"] = ["application/json", JSON.stringify(withExtension)];
  const s = await serve(files, { Link: '</.well-known/ara/manifest.json>; rel="ara-manifest"' });
  try {
    const result = await require("../index.js").validate(s.url);
    assert.equal(result.score, 100);
    assert.deepEqual(result.issues, []);
  } finally {
    await s.close();
  }
});
