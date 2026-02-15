#!/usr/bin/env node

/**
 * ARA Generator — Generates a basic ARA manifest from site metadata.
 *
 * Usage:
 *   npx ara-generate https://example.com
 *   npx ara-generate https://example.com --output .well-known/ara/manifest.json
 *
 * This tool:
 *   1. Fetches the site's HTML
 *   2. Extracts metadata (title, description, OpenGraph, Schema.org/JSON-LD)
 *   3. Checks for robots.txt and sitemap.xml
 *   4. Generates a Level 1 ARA manifest
 *
 * The generated manifest is a starting point — you'll want to enrich it
 * with Layer 2 schemas and Layer 3 actions manually.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// ── Helpers ────────────────────────────────────────────────────────────────

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Too many redirects"));

    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { headers: { "User-Agent": "ARA-Generator/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return fetchUrl(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data, url }));
      })
      .on("error", reject);
  });
}

function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+name=["']${name}["']`, "i"),
    new RegExp(`<meta\\s+property=["']${name}["']\\s+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+property=["']${name}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractJsonLd(html) {
  const results = [];
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1]));
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  return results;
}

function detectLanguage(html) {
  const match = html.match(/<html[^>]*\slang=["']([^"']*)["']/i);
  return match ? match[1] : null;
}

function inferSiteType(description, title, jsonLd) {
  const text = `${title || ""} ${description || ""}`.toLowerCase();

  // Check JSON-LD types first
  for (const ld of jsonLd) {
    const type = ld["@type"] || "";
    if (typeof type === "string") {
      if (type.includes("Store") || type.includes("Product")) return "ecommerce";
      if (type.includes("Restaurant")) return "restaurant";
      if (type.includes("Blog")) return "blog";
      if (type.includes("NewsArticle") || type.includes("NewsMediaOrganization")) return "news_media";
      if (type.includes("SoftwareApplication")) return "saas";
      if (type.includes("RealEstateAgent")) return "real_estate";
    }
  }

  // Keyword-based inference
  if (text.match(/shop|store|buy|cart|product|ecommerce/)) return "ecommerce";
  if (text.match(/restaurant|menu|dine|reserv/)) return "restaurant";
  if (text.match(/blog|article|post|writing/)) return "blog";
  if (text.match(/news|media|journal/)) return "news_media";
  if (text.match(/saas|software|platform|app|tool|dashboard/)) return "saas";
  if (text.match(/portfolio|freelanc|design|agency/)) return "portfolio";
  if (text.match(/docs|documentation|api|reference/)) return "documentation";

  return "website";
}

// ── Generator ──────────────────────────────────────────────────────────────

async function generate(siteUrl) {
  const baseUrl = siteUrl.replace(/\/$/, "");
  const parsedUrl = new URL(baseUrl);
  const domain = parsedUrl.hostname;

  console.error(`\n  ARA Generator v1.0`);
  console.error(`  Analyzing ${baseUrl}...\n`);

  // Fetch main page
  let html = "";
  try {
    const response = await fetchUrl(baseUrl);
    html = response.body;
    console.error(`  ✓ Fetched main page (${html.length} bytes)`);
  } catch (e) {
    console.error(`  ✗ Could not fetch ${baseUrl}: ${e.message}`);
    process.exit(1);
  }

  // Extract metadata
  const title = extractMeta(html, "og:title") || extractTitle(html) || domain;
  const description =
    extractMeta(html, "og:description") ||
    extractMeta(html, "description") ||
    `Website at ${domain}`;
  const locale = detectLanguage(html);
  const image = extractMeta(html, "og:image");
  const jsonLd = extractJsonLd(html);
  const siteType = inferSiteType(description, title, jsonLd);

  console.error(`  ✓ Extracted metadata: "${title}"`);
  console.error(`  ✓ Detected type: ${siteType}`);
  if (jsonLd.length > 0) {
    console.error(`  ✓ Found ${jsonLd.length} JSON-LD block(s)`);
  }

  // Check robots.txt
  let hasRobots = false;
  try {
    const robotsResponse = await fetchUrl(`${baseUrl}/robots.txt`);
    hasRobots = robotsResponse.status === 200;
    console.error(`  ${hasRobots ? "✓" : "—"} robots.txt ${hasRobots ? "found" : "not found"}`);
  } catch {
    console.error("  — Could not check robots.txt");
  }

  // Check sitemap
  let hasSitemap = false;
  try {
    const sitemapResponse = await fetchUrl(`${baseUrl}/sitemap.xml`);
    hasSitemap = sitemapResponse.status === 200;
    console.error(`  ${hasSitemap ? "✓" : "—"} sitemap.xml ${hasSitemap ? "found" : "not found"}`);
  } catch {
    console.error("  — Could not check sitemap.xml");
  }

  // Build manifest
  const manifest = {
    $ara: "1.0",
    $schema: "https://ara-standard.org/schema/manifest/v1",

    identity: {
      name: title.replace(/\s*[-|–—].*$/, "").trim(), // Remove taglines
      type: siteType,
      description: description,
      ...(locale && { locale: [locale] }),
      contact: {
        website: baseUrl,
      },
      ...(image && {
        branding: {
          logo: image,
        },
      }),
    },

    content_map: {
      summary: `Content from ${domain}`,
      resources: [
        {
          id: "pages",
          type: "content",
          label: "Site Pages",
          description: "Pages available on this website",
          access: "public",
          freshness: "weekly",
        },
      ],
      // TODO: Enrich with detected resources from JSON-LD and sitemap
    },

    capabilities: {
      protocols: {},
      // TODO: Add detected APIs, MCP endpoints, etc.
    },

    policies: {
      agent_access: "open",
      rate_limit: {
        requests_per_minute: 30,
        burst: 5,
      },
      data_usage: {
        caching_allowed: true,
        cache_ttl: 3600,
        redistribution: false,
        attribution_required: true,
      },
    },

    meta: {
      generated_at: new Date().toISOString(),
      generator: "ara-generator/1.0",
      human_site: baseUrl,
    },
  };

  // Enrich from JSON-LD
  if (jsonLd.length > 0) {
    jsonLd.forEach((ld) => {
      if (ld["@type"] === "Organization" || ld["@type"] === "LocalBusiness") {
        if (ld.name) manifest.identity.name = ld.name;
        if (ld.address) {
          manifest.identity.geo = { address: typeof ld.address === "string" ? ld.address : ld.address.streetAddress };
        }
        if (ld.telephone) manifest.identity.contact.phone = ld.telephone;
        if (ld.email) manifest.identity.contact.email = ld.email;
      }
    });
  }

  console.error(`\n  ✓ Generated ARA manifest (Level 1)`);
  console.error(`  ℹ Enrich with schemas (Layer 2) and actions (Layer 3) for full ARA support.\n`);

  return manifest;
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => a.startsWith("http"));
  const outputIdx = args.indexOf("--output");
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

  if (!url || args.includes("--help") || args.includes("-h")) {
    console.log(`
ARA Generator v1.0
===================

Generates a basic ARA manifest from site metadata.

Usage:
  npx ara-generate <url>
  npx ara-generate <url> --output <file>

Examples:
  npx ara-generate https://example.com
  npx ara-generate https://myshop.com --output .well-known/ara/manifest.json

The generated manifest is a Level 1 starting point.
Add schemas (Layer 2) and actions (Layer 3) manually for full ARA support.
`);
    process.exit(0);
  }

  const manifest = await generate(url);
  const json = JSON.stringify(manifest, null, 2);

  if (outputFile) {
    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputFile, json);
    console.error(`  ✓ Saved to ${outputFile}`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

module.exports = { generate };
