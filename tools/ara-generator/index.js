#!/usr/bin/env node

/**
 * ARA Generator v2.0 — Generates ARA manifests + schemas from site metadata.
 *
 * Usage:
 *   npx ara-generate https://example.com
 *   npx ara-generate https://example.com --output .well-known/ara/
 *   npx ara-generate https://example.com --layer 1        (manifest only)
 *   npx ara-generate https://example.com --layer 2        (manifest + schemas)
 *   npx ara-generate https://example.com --crawl 5        (follow up to 5 pages)
 *
 * Layer 2 schema generation works best when the site has:
 *   - JSON-LD structured data (Schema.org Product, Article, Recipe, Event, etc.)
 *   - OpenGraph metadata with typed content
 *   - Microdata attributes (itemscope, itemprop)
 *   - An OpenAPI/Swagger endpoint
 *
 * If none of these are present, the generator produces Layer 1 only and
 * explains what the site owner needs to add manually.
 *
 * Zero dependencies — uses only Node.js stdlib.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// ── Constants ─────────────────────────────────────────────────────────────

const VERSION = "2.0.0";
const USER_AGENT = `ARA-Generator/${VERSION}`;

// Known JSON-LD types → ARA schema mappings
const JSONLD_TYPE_MAP = {
  Product: {
    resource_type: "catalog",
    schema_name: "product",
    properties: {
      name: { type: "string", required: true, semantic: "schema:name" },
      description: { type: "string", semantic: "schema:description" },
      price: { type: "number", required: true, semantic: "schema:price" },
      currency: { type: "string", semantic: "schema:priceCurrency" },
      image: { type: "string", format: "uri", semantic: "schema:image" },
      url: { type: "string", format: "uri", semantic: "schema:url" },
      sku: { type: "string", semantic: "schema:sku" },
      brand: { type: "string", semantic: "schema:brand" },
      availability: { type: "string", semantic: "schema:availability" },
      category: { type: "string", semantic: "schema:category" },
      rating: { type: "number", semantic: "schema:aggregateRating" },
      review_count: { type: "integer", semantic: "schema:reviewCount" },
    },
    search_hints: {
      filterable_by: ["category", "brand", "availability"],
      sortable_by: ["price", "rating", "name"],
      text_searchable: ["name", "description"],
    },
  },
  Article: {
    resource_type: "content",
    schema_name: "article",
    properties: {
      title: { type: "string", required: true, semantic: "schema:headline" },
      description: { type: "string", semantic: "schema:description" },
      author: { type: "string", semantic: "schema:author" },
      date_published: { type: "string", format: "date-time", semantic: "schema:datePublished" },
      date_modified: { type: "string", format: "date-time", semantic: "schema:dateModified" },
      image: { type: "string", format: "uri", semantic: "schema:image" },
      url: { type: "string", format: "uri", semantic: "schema:url" },
      category: { type: "string", semantic: "schema:articleSection" },
      word_count: { type: "integer", semantic: "schema:wordCount" },
    },
    search_hints: {
      filterable_by: ["category", "author"],
      sortable_by: ["date_published", "title"],
      text_searchable: ["title", "description"],
    },
  },
  NewsArticle: {
    resource_type: "content",
    schema_name: "article",
    properties: {
      title: { type: "string", required: true, semantic: "schema:headline" },
      description: { type: "string", semantic: "schema:description" },
      author: { type: "string", semantic: "schema:author" },
      date_published: { type: "string", format: "date-time", semantic: "schema:datePublished" },
      image: { type: "string", format: "uri", semantic: "schema:image" },
      url: { type: "string", format: "uri", semantic: "schema:url" },
      section: { type: "string", semantic: "schema:articleSection" },
    },
    search_hints: {
      filterable_by: ["section", "author"],
      sortable_by: ["date_published"],
      text_searchable: ["title", "description"],
    },
  },
  BlogPosting: {
    resource_type: "content",
    schema_name: "article",
    properties: {
      title: { type: "string", required: true, semantic: "schema:headline" },
      description: { type: "string", semantic: "schema:description" },
      author: { type: "string", semantic: "schema:author" },
      date_published: { type: "string", format: "date-time", semantic: "schema:datePublished" },
      image: { type: "string", format: "uri", semantic: "schema:image" },
      url: { type: "string", format: "uri", semantic: "schema:url" },
      category: { type: "string", semantic: "schema:articleSection" },
    },
    search_hints: {
      filterable_by: ["category", "author"],
      sortable_by: ["date_published", "title"],
      text_searchable: ["title", "description"],
    },
  },
  Recipe: {
    resource_type: "catalog",
    schema_name: "recipe",
    properties: {
      name: { type: "string", required: true, semantic: "schema:name" },
      description: { type: "string", semantic: "schema:description" },
      image: { type: "string", format: "uri", semantic: "schema:image" },
      author: { type: "string", semantic: "schema:author" },
      prep_time: { type: "string", semantic: "schema:prepTime" },
      cook_time: { type: "string", semantic: "schema:cookTime" },
      total_time: { type: "string", semantic: "schema:totalTime" },
      category: { type: "string", semantic: "schema:recipeCategory" },
      cuisine: { type: "string", semantic: "schema:recipeCuisine" },
      servings: { type: "string", semantic: "schema:recipeYield" },
      calories: { type: "number", semantic: "schema:calories" },
      rating: { type: "number", semantic: "schema:aggregateRating" },
      ingredients: { type: "array", items: { type: "string" }, semantic: "schema:recipeIngredient" },
    },
    search_hints: {
      filterable_by: ["category", "cuisine"],
      sortable_by: ["rating", "total_time", "name"],
      text_searchable: ["name", "description", "ingredients"],
    },
  },
  Event: {
    resource_type: "catalog",
    schema_name: "event",
    properties: {
      name: { type: "string", required: true, semantic: "schema:name" },
      description: { type: "string", semantic: "schema:description" },
      start_date: { type: "string", format: "date-time", required: true, semantic: "schema:startDate" },
      end_date: { type: "string", format: "date-time", semantic: "schema:endDate" },
      location: { type: "string", semantic: "schema:location" },
      image: { type: "string", format: "uri", semantic: "schema:image" },
      url: { type: "string", format: "uri", semantic: "schema:url" },
      organizer: { type: "string", semantic: "schema:organizer" },
      price: { type: "number", semantic: "schema:offers.price" },
      availability: { type: "string", semantic: "schema:offers.availability" },
    },
    search_hints: {
      filterable_by: ["location", "organizer"],
      sortable_by: ["start_date", "price", "name"],
      text_searchable: ["name", "description"],
    },
  },
  Restaurant: {
    resource_type: "catalog",
    schema_name: "restaurant",
    properties: {
      name: { type: "string", required: true, semantic: "schema:name" },
      description: { type: "string", semantic: "schema:description" },
      cuisine: { type: "string", semantic: "schema:servesCuisine" },
      address: { type: "string", semantic: "schema:address" },
      phone: { type: "string", semantic: "schema:telephone" },
      price_range: { type: "string", semantic: "schema:priceRange" },
      rating: { type: "number", semantic: "schema:aggregateRating" },
      hours: { type: "string", semantic: "schema:openingHours" },
      image: { type: "string", format: "uri", semantic: "schema:image" },
      url: { type: "string", format: "uri", semantic: "schema:url" },
    },
    search_hints: {
      filterable_by: ["cuisine", "price_range"],
      sortable_by: ["rating", "name"],
      text_searchable: ["name", "description", "cuisine"],
    },
  },
  LocalBusiness: {
    resource_type: "catalog",
    schema_name: "business",
    properties: {
      name: { type: "string", required: true, semantic: "schema:name" },
      description: { type: "string", semantic: "schema:description" },
      address: { type: "string", semantic: "schema:address" },
      phone: { type: "string", semantic: "schema:telephone" },
      email: { type: "string", format: "email", semantic: "schema:email" },
      hours: { type: "string", semantic: "schema:openingHours" },
      rating: { type: "number", semantic: "schema:aggregateRating" },
      image: { type: "string", format: "uri", semantic: "schema:image" },
      url: { type: "string", format: "uri", semantic: "schema:url" },
    },
    search_hints: {
      filterable_by: ["address"],
      sortable_by: ["rating", "name"],
      text_searchable: ["name", "description"],
    },
  },
  Course: {
    resource_type: "catalog",
    schema_name: "course",
    properties: {
      name: { type: "string", required: true, semantic: "schema:name" },
      description: { type: "string", semantic: "schema:description" },
      provider: { type: "string", semantic: "schema:provider" },
      url: { type: "string", format: "uri", semantic: "schema:url" },
      language: { type: "string", semantic: "schema:inLanguage" },
      price: { type: "number", semantic: "schema:offers.price" },
      duration: { type: "string", semantic: "schema:timeRequired" },
    },
    search_hints: {
      filterable_by: ["provider", "language"],
      sortable_by: ["price", "name"],
      text_searchable: ["name", "description"],
    },
  },
};

// ── HTTP Fetcher ──────────────────────────────────────────────────────────

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Too many redirects"));

    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { headers: { "User-Agent": USER_AGENT }, timeout: 10000 }, (res) => {
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
      .on("error", reject)
      .on("timeout", () => reject(new Error("Request timed out")));
  });
}

// ── HTML Extractors ───────────────────────────────────────────────────────

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
      const parsed = JSON.parse(match[1]);
      // Handle @graph arrays
      if (parsed["@graph"] && Array.isArray(parsed["@graph"])) {
        results.push(...parsed["@graph"]);
      } else {
        results.push(parsed);
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }
  return results;
}

function extractMicrodata(html) {
  const items = [];
  const scopeRegex = /itemscope\s+itemtype=["']https?:\/\/schema\.org\/(\w+)["']/gi;
  let match;
  while ((match = scopeRegex.exec(html)) !== null) {
    items.push(match[1]);
  }
  return [...new Set(items)];
}

function detectLanguage(html) {
  const match = html.match(/<html[^>]*\slang=["']([^"']*)["']/i);
  return match ? match[1] : null;
}

function extractInternalLinks(html, baseUrl) {
  const links = new Set();
  const parsed = new URL(baseUrl);
  const regex = /href=["'](\/[^"'#]*|https?:\/\/[^"'#]*)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const absolute = match[1].startsWith("http") ? match[1] : new URL(match[1], baseUrl).href;
      const linkUrl = new URL(absolute);
      if (linkUrl.hostname === parsed.hostname) {
        links.add(linkUrl.origin + linkUrl.pathname);
      }
    } catch {
      // Skip invalid URLs
    }
  }
  return [...links];
}

function detectOpenApiUrl(html, baseUrl) {
  // Look for common OpenAPI/Swagger patterns
  const patterns = [
    /["'](\/api\/(?:v\d+\/)?(?:openapi|swagger)\.(?:json|yaml))["']/i,
    /["'](\/swagger\.(?:json|yaml))["']/i,
    /["'](\/api-docs)["']/i,
    /["'](https?:\/\/[^"']*(?:openapi|swagger)\.(?:json|yaml))["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1].startsWith("http") ? match[1] : new URL(match[1], baseUrl).href;
    }
  }
  return null;
}

function inferSiteType(description, title, jsonLd) {
  const text = `${title || ""} ${description || ""}`.toLowerCase();

  for (const ld of jsonLd) {
    const type = ld["@type"] || "";
    if (typeof type === "string") {
      if (type.includes("Store") || type.includes("Product")) return "ecommerce";
      if (type.includes("Restaurant")) return "restaurant";
      if (type.includes("Blog") || type.includes("BlogPosting")) return "blog";
      if (type.includes("NewsArticle") || type.includes("NewsMediaOrganization")) return "news_media";
      if (type.includes("SoftwareApplication")) return "saas";
      if (type.includes("RealEstateAgent")) return "real_estate";
      if (type.includes("Course")) return "education";
    }
  }

  if (text.match(/shop|store|buy|cart|product|ecommerce/)) return "ecommerce";
  if (text.match(/restaurant|menu|dine|reserv/)) return "restaurant";
  if (text.match(/blog|article|post|writing/)) return "blog";
  if (text.match(/news|media|journal/)) return "news_media";
  if (text.match(/saas|software|platform|app|tool|dashboard/)) return "saas";
  if (text.match(/portfolio|freelanc|design|agency/)) return "portfolio";
  if (text.match(/docs|documentation|api|reference/)) return "documentation";
  if (text.match(/cours|learn|education|formation|training/)) return "education";

  return "website";
}

// ── Schema Builder (Layer 2) ──────────────────────────────────────────────

function buildSchemasFromJsonLd(jsonLdItems) {
  const schemas = {};
  const detectedTypes = new Set();

  for (const item of jsonLdItems) {
    let type = item["@type"];
    if (Array.isArray(type)) type = type[0];
    if (!type || typeof type !== "string") continue;

    // Normalize type
    const cleanType = type.replace("https://schema.org/", "").replace("http://schema.org/", "");

    if (JSONLD_TYPE_MAP[cleanType] && !detectedTypes.has(cleanType)) {
      detectedTypes.add(cleanType);
      const mapping = JSONLD_TYPE_MAP[cleanType];
      const schemaName = mapping.schema_name;

      // Build properties by enriching base mapping with actual data
      const enrichedProperties = { ...mapping.properties };

      // Detect extra properties from the actual JSON-LD data
      for (const [key, value] of Object.entries(item)) {
        if (key.startsWith("@")) continue;
        const normalizedKey = key
          .replace(/([A-Z])/g, "_$1")
          .toLowerCase()
          .replace(/^_/, "");

        if (!enrichedProperties[normalizedKey] && typeof value !== "object") {
          enrichedProperties[normalizedKey] = {
            type: typeof value === "number" ? "number" : "string",
            semantic: `schema:${key}`,
            _auto_detected: true,
          };
        }
      }

      schemas[schemaName] = {
        $ara_schema: "1.0",
        resource_id: schemaName + "s",
        label: cleanType + "s",
        description: `Schema for ${cleanType} resources — auto-generated from JSON-LD`,
        properties: enrichedProperties,
        search_hints: mapping.search_hints,
        _source: "json-ld",
        _source_type: cleanType,
        _confidence: "high",
        _note: "Auto-generated from JSON-LD structured data. Review and adjust properties as needed.",
      };
    }
  }

  return schemas;
}

function buildSchemasFromMicrodata(microdataTypes) {
  const schemas = {};

  for (const type of microdataTypes) {
    if (JSONLD_TYPE_MAP[type] && !schemas[JSONLD_TYPE_MAP[type].schema_name]) {
      const mapping = JSONLD_TYPE_MAP[type];

      schemas[mapping.schema_name] = {
        $ara_schema: "1.0",
        resource_id: mapping.schema_name + "s",
        label: type + "s",
        description: `Schema for ${type} resources — auto-generated from Microdata`,
        properties: mapping.properties,
        search_hints: mapping.search_hints,
        _source: "microdata",
        _source_type: type,
        _confidence: "medium",
        _note:
          "Auto-generated from Microdata attributes. Properties are based on Schema.org " +
          "defaults — the actual data may have additional fields. Review and enrich manually.",
      };
    }
  }

  return schemas;
}

// ── Sitemap Analyzer ──────────────────────────────────────────────────────

function analyzeSitemap(sitemapXml) {
  const urls = [];
  const locRegex = /<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(sitemapXml)) !== null) {
    urls.push(match[1]);
  }

  // Detect URL patterns → resource types
  const patterns = {};
  for (const url of urls) {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const prefix = segments[0];
      if (!patterns[prefix]) patterns[prefix] = { count: 0, examples: [] };
      patterns[prefix].count++;
      if (patterns[prefix].examples.length < 3) patterns[prefix].examples.push(path);
    }
  }

  return { total_urls: urls.length, patterns };
}

// ── Main Generator ────────────────────────────────────────────────────────

async function generate(siteUrl, options = {}) {
  const { maxLayer = 2, crawlPages = 0 } = options;
  const baseUrl = siteUrl.replace(/\/$/, "");
  const parsedUrl = new URL(baseUrl);
  const domain = parsedUrl.hostname;

  const log = (msg) => console.error(msg);

  log(`\n  ARA Generator v${VERSION}`);
  log(`  Target: ${baseUrl}`);
  log(`  Mode: Layer 1${maxLayer >= 2 ? " + Layer 2 (schemas)" : ""}`);
  log(`  ─────────────────────────────────────────\n`);

  // ── Step 1: Fetch main page ─────────────────────────────────────────
  let html = "";
  try {
    const response = await fetchUrl(baseUrl);
    html = response.body;
    log(`  ✓ Fetched main page (${(html.length / 1024).toFixed(1)} KB)`);
  } catch (e) {
    log(`  ✗ Could not fetch ${baseUrl}: ${e.message}`);
    process.exit(1);
  }

  // ── Step 2: Extract all metadata ────────────────────────────────────
  const title = extractMeta(html, "og:title") || extractTitle(html) || domain;
  const description =
    extractMeta(html, "og:description") ||
    extractMeta(html, "description") ||
    `Website at ${domain}`;
  const locale = detectLanguage(html);
  const image = extractMeta(html, "og:image");
  const jsonLd = extractJsonLd(html);
  const microdataTypes = extractMicrodata(html);
  const openApiUrl = detectOpenApiUrl(html, baseUrl);
  const siteType = inferSiteType(description, title, jsonLd);

  log(`  ✓ Extracted metadata: "${title}"`);
  log(`  ✓ Detected type: ${siteType}`);
  if (jsonLd.length > 0) log(`  ✓ Found ${jsonLd.length} JSON-LD block(s): ${jsonLd.map((ld) => ld["@type"]).filter(Boolean).join(", ")}`);
  if (microdataTypes.length > 0) log(`  ✓ Found Microdata: ${microdataTypes.join(", ")}`);
  if (openApiUrl) log(`  ✓ Detected OpenAPI: ${openApiUrl}`);

  // ── Step 3: Crawl additional pages (optional) ───────────────────────
  let additionalJsonLd = [];
  let additionalMicrodata = [];

  if (crawlPages > 0) {
    const links = extractInternalLinks(html, baseUrl);
    const toCrawl = links.slice(0, crawlPages);
    log(`\n  Crawling ${toCrawl.length} additional page(s)...`);

    for (const link of toCrawl) {
      try {
        const resp = await fetchUrl(link);
        const pageJsonLd = extractJsonLd(resp.body);
        const pageMicrodata = extractMicrodata(resp.body);
        additionalJsonLd.push(...pageJsonLd);
        additionalMicrodata.push(...pageMicrodata);
        log(`  ✓ ${new URL(link).pathname} — ${pageJsonLd.length} JSON-LD, ${pageMicrodata.length} Microdata`);
      } catch {
        log(`  — ${new URL(link).pathname} — skipped`);
      }
    }
  }

  const allJsonLd = [...jsonLd, ...additionalJsonLd];
  const allMicrodata = [...new Set([...microdataTypes, ...additionalMicrodata])];

  // ── Step 4: Check robots.txt & sitemap ──────────────────────────────
  let hasRobots = false;
  let hasSitemap = false;
  let sitemapData = null;

  try {
    const robotsResp = await fetchUrl(`${baseUrl}/robots.txt`);
    hasRobots = robotsResp.status === 200 && robotsResp.body.length > 10;
    log(`\n  ${hasRobots ? "✓" : "—"} robots.txt`);
  } catch {
    log("  — robots.txt (unreachable)");
  }

  try {
    const sitemapResp = await fetchUrl(`${baseUrl}/sitemap.xml`);
    hasSitemap = sitemapResp.status === 200 && sitemapResp.body.includes("<url");
    if (hasSitemap) {
      sitemapData = analyzeSitemap(sitemapResp.body);
      log(`  ✓ sitemap.xml (${sitemapData.total_urls} URLs, ${Object.keys(sitemapData.patterns).length} pattern(s))`);
    } else {
      log("  — sitemap.xml");
    }
  } catch {
    log("  — sitemap.xml (unreachable)");
  }

  // ── Step 5: Check existing ARA ──────────────────────────────────────
  let existingAra = false;
  try {
    const araResp = await fetchUrl(`${baseUrl}/.well-known/ara/manifest.json`);
    existingAra = araResp.status === 200;
    log(`  ${existingAra ? "⚠ Site already has ARA manifest!" : "— No existing ARA manifest"}`);
  } catch {
    log("  — No existing ARA manifest");
  }

  // ── Step 6: Build Layer 2 schemas ───────────────────────────────────
  let schemas = {};
  let schemaSource = "none";

  if (maxLayer >= 2) {
    log(`\n  ── Layer 2: Schema Detection ──────────────────`);

    // Priority 1: JSON-LD (highest confidence)
    if (allJsonLd.length > 0) {
      schemas = { ...schemas, ...buildSchemasFromJsonLd(allJsonLd) };
      if (Object.keys(schemas).length > 0) {
        schemaSource = "json-ld";
        log(`  ✓ Generated ${Object.keys(schemas).length} schema(s) from JSON-LD`);
      }
    }

    // Priority 2: Microdata (medium confidence)
    if (allMicrodata.length > 0) {
      const microdataSchemas = buildSchemasFromMicrodata(allMicrodata);
      for (const [name, schema] of Object.entries(microdataSchemas)) {
        if (!schemas[name]) {
          schemas[name] = schema;
          log(`  ✓ Generated schema "${name}" from Microdata`);
        }
      }
      if (Object.keys(microdataSchemas).length > 0 && schemaSource === "none") {
        schemaSource = "microdata";
      }
    }

    // Priority 3: Sitemap patterns (low confidence — resource detection only)
    if (sitemapData && Object.keys(sitemapData.patterns).length > 0) {
      log(`  ℹ Sitemap URL patterns detected:`);
      for (const [prefix, data] of Object.entries(sitemapData.patterns)) {
        if (data.count >= 3) {
          log(`    /${prefix}/ — ${data.count} pages (e.g. ${data.examples[0]})`);
        }
      }
    }

    if (Object.keys(schemas).length === 0) {
      log(`\n  ⚠ No structured data found for Layer 2 auto-generation.`);
      log(`    Layer 2 schemas require at least one of:`);
      log(`    - JSON-LD blocks (<script type="application/ld+json">)`);
      log(`    - Microdata attributes (itemscope, itemprop)`);
      log(`    - OpenAPI/Swagger endpoint`);
      log(`    → Generating Layer 1 only. Add schemas manually.`);
    }
  }

  // ── Step 7: Build manifest ──────────────────────────────────────────
  log(`\n  ── Building Manifest ─────────────────────────`);

  const resources = [];

  // Add resources from detected schemas
  for (const [name, schema] of Object.entries(schemas)) {
    resources.push({
      id: schema.resource_id,
      type: JSONLD_TYPE_MAP[schema._source_type]?.resource_type || "content",
      label: schema.label,
      ...(maxLayer >= 2 && { schema_ref: `schemas/${name}.json` }),
      access: "public",
      freshness: "weekly",
    });
  }

  // Add resources from sitemap patterns not covered by schemas
  if (sitemapData) {
    const coveredIds = new Set(resources.map((r) => r.id));
    for (const [prefix, data] of Object.entries(sitemapData.patterns)) {
      if (data.count >= 3 && !coveredIds.has(prefix)) {
        resources.push({
          id: prefix,
          type: "content",
          label: prefix.charAt(0).toUpperCase() + prefix.slice(1),
          description: `${data.count} pages detected under /${prefix}/`,
          count: data.count,
          access: "public",
          freshness: "weekly",
          _note: "Detected from sitemap URL patterns. Add schema_ref manually for Layer 2.",
        });
      }
    }
  }

  // Fallback: at least one generic resource
  if (resources.length === 0) {
    resources.push({
      id: "pages",
      type: "content",
      label: "Site Pages",
      description: "Pages available on this website",
      access: "public",
      freshness: "weekly",
    });
  }

  // Identity enrichment from JSON-LD Organization/LocalBusiness
  const identity = {
    name: title.replace(/\s*[-|–—].*$/, "").trim(),
    type: siteType,
    description: description,
    ...(locale && { locale: [locale] }),
    contact: {
      website: baseUrl,
    },
    ...(image && { branding: { logo: image } }),
  };

  for (const ld of allJsonLd) {
    const ldType = ld["@type"];
    if (ldType === "Organization" || ldType === "LocalBusiness" || ldType === "Restaurant") {
      if (ld.name) identity.name = ld.name;
      if (ld.telephone) identity.contact.phone = ld.telephone;
      if (ld.email) identity.contact.email = ld.email;
      if (ld.address) {
        const addr = typeof ld.address === "string" ? ld.address : ld.address.streetAddress || ld.address.name;
        if (addr) identity.geo = { address: addr };
        if (ld.address.addressLocality) {
          identity.geo = identity.geo || {};
          identity.geo.city = ld.address.addressLocality;
        }
      }
      if (ld.geo && ld.geo.latitude) {
        identity.geo = identity.geo || {};
        identity.geo.coordinates = [parseFloat(ld.geo.latitude), parseFloat(ld.geo.longitude)];
      }
    }
  }

  const manifest = {
    $ara: "1.0",
    $schema: "https://ara-standard.org/schema/manifest/v1",
    identity,
    content_map: {
      summary: `Content from ${domain}${resources.length > 1 ? ` — ${resources.length} resource types detected` : ""}`,
      resources,
    },
    capabilities: {
      protocols: {
        ...(openApiUrl && { rest_api: { openapi: openApiUrl } }),
      },
    },
    policies: {
      agent_access: "open",
      rate_limit: { requests_per_minute: 30, burst: 5 },
      data_usage: {
        caching_allowed: true,
        cache_ttl: 3600,
        redistribution: false,
        attribution_required: true,
      },
    },
    meta: {
      generated_at: new Date().toISOString(),
      generator: `ara-generator/${VERSION}`,
      generator_layer: Object.keys(schemas).length > 0 ? 2 : 1,
      human_site: baseUrl,
      ...(Object.keys(schemas).length > 0 && {
        schemas_generated: Object.keys(schemas).length,
        schema_source: schemaSource,
      }),
    },
  };

  // ── Summary ─────────────────────────────────────────────────────────
  const generatedLayer = Object.keys(schemas).length > 0 ? 2 : 1;

  log(`\n  ── Results ───────────────────────────────────`);
  log(`  ✓ Generated ARA manifest (Layer ${generatedLayer})`);
  log(`    Identity: ${identity.name} (${siteType})`);
  log(`    Resources: ${resources.length}`);
  log(`    Schemas: ${Object.keys(schemas).length}`);
  if (openApiUrl) log(`    OpenAPI: detected`);
  log(``);

  if (generatedLayer === 1 && maxLayer >= 2) {
    log(`  ── How to enable Layer 2 auto-generation ────`);
    log(`  Add structured data to your HTML:`);
    log(``);
    log(`  Option A — JSON-LD (recommended):`);
    log(`    <script type="application/ld+json">`);
    log(`    { "@type": "Product", "name": "...", "price": "..." }`);
    log(`    </script>`);
    log(``);
    log(`  Option B — Microdata:`);
    log(`    <div itemscope itemtype="https://schema.org/Product">`);
    log(`      <span itemprop="name">...</span>`);
    log(`    </div>`);
    log(``);
    log(`  Then re-run: npx ara-generate ${baseUrl}`);
    log(``);
  }

  if (generatedLayer >= 2) {
    log(`  ── Layer 2 Notes ────────────────────────────`);
    log(`  Schemas were auto-generated from ${schemaSource}.`);
    log(`  Confidence: ${schemaSource === "json-ld" ? "HIGH" : "MEDIUM"}`);
    log(`  Review generated schemas and:`);
    log(`    - Remove properties that don't apply to your site`);
    log(`    - Add custom properties specific to your business`);
    log(`    - Adjust search_hints (filterable_by, sortable_by)`);
    log(`    - Add Layer 3 actions.json manually if needed`);
    log(``);
  }

  return { manifest, schemas };
}

// ── Digest Generator (GEO Layer) ─────────────────────────────────────────
//
// Generates a 200-400 token LLM-optimized digest.md from the manifest.
// Rules (per ARA spec):
//   - Every sentence must contain at least one number, proper noun, or verifiable fact
//   - No marketing adjectives (best, amazing, powerful, etc.)
//   - First 3 lines are most important (AI engines weight them heavily)
//   - Target 200-400 tokens (~800-1600 characters)

function generateDigest(manifest, siteUrl) {
  const id = manifest.identity || {};
  const cm = manifest.content_map || {};
  const cap = manifest.capabilities || {};
  const pol = manifest.policies || {};

  const name = id.name || "This site";
  const type = id.type || "website";
  const description = id.description || "";
  const locale = Array.isArray(id.locale) ? id.locale[0] : (id.locale || "en");

  // Build protocol list
  const protocols = [];
  if (cap.protocols) {
    if (cap.protocols.rest_api) protocols.push("REST");
    if (cap.protocols.mcp) protocols.push("MCP");
    if (cap.protocols.a2a) protocols.push("A2A");
    if (cap.protocols.graphql) protocols.push("GraphQL");
  }

  // Build resource summary lines
  const resourceLines = [];
  if (Array.isArray(cm.resources)) {
    for (const r of cm.resources) {
      const count = r.count ? ` (${r.count} ${r.type === "catalog" ? "items" : "entries"})` : "";
      resourceLines.push(`- **${r.label}**${count}: ${r.description || r.type}`);
    }
  }

  // Build policies summary
  const accessPolicy = pol.agent_access === "open" ? "public — no authentication required" : pol.agent_access || "see manifest";
  const rateLimit = pol.rate_limit
    ? `${pol.rate_limit.requests_per_minute || "?"} req/min`
    : "not specified";

  const lines = [
    `# ${name} — ARA Agent Digest`,
    ``,
    `${name} is a ${type} site. ${description}`,
    ``,
    `## Site`,
    `- URL: ${siteUrl}`,
    `- Type: ${type}`,
    `- Language: ${locale}`,
    ...(protocols.length > 0 ? [`- Protocols: ${protocols.join(", ")}`] : []),
    ``,
    `## Content`,
    cm.summary ? `${cm.summary}` : "",
    ...(resourceLines.length > 0 ? ["", ...resourceLines] : []),
    ``,
    `## Access`,
    `- Agent access: ${accessPolicy}`,
    `- Rate limit: ${rateLimit}`,
    ``,
    `## ARA Files`,
    `- Layer 1 — manifest.json: identity, content map, capabilities, policies`,
    ...(Array.isArray(cm.resources) && cm.resources.some((r) => r.schema_ref)
      ? ["- Layer 2 — schemas/: semantic resource schemas with Schema.org annotations"]
      : []),
    ...(cap.actions_ref ? ["- Layer 3 — actions.json: agent actions with intent mapping"] : []),
    `- GEO — digest.md: this file`,
    ``,
    `## Quick Start`,
    `\`\`\``,
    `npx ara-validate ${siteUrl}`,
    `\`\`\``,
    ``,
    `---`,
    `_Auto-generated by ara-generate. Review and add specific facts (exact counts, prices, dates) to improve AI citation accuracy._`,
  ].filter((l) => l !== undefined);

  return lines.join("\n");
}

// ── CLI ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => a.startsWith("http"));
  const outputIdx = args.indexOf("--output");
  const outputDir = outputIdx !== -1 ? args[outputIdx + 1] : null;
  const layerIdx = args.indexOf("--layer");
  const maxLayer = layerIdx !== -1 ? parseInt(args[layerIdx + 1], 10) : 2;
  const crawlIdx = args.indexOf("--crawl");
  const crawlPages = crawlIdx !== -1 ? parseInt(args[crawlIdx + 1], 10) : 0;

  if (!url || args.includes("--help") || args.includes("-h")) {
    console.log(`
ARA Generator v${VERSION}
${"=".repeat(20 + VERSION.length)}

Generates ARA manifest + schemas from site metadata.
Zero dependencies. Uses JSON-LD, Microdata, OpenGraph, and sitemap analysis.

Usage:
  npx ara-generate <url>
  npx ara-generate <url> --output .well-known/ara/
  npx ara-generate <url> --layer 1          (manifest only, skip schemas)
  npx ara-generate <url> --layer 2          (manifest + schemas, default)
  npx ara-generate <url> --crawl 5          (crawl up to 5 internal pages)

Options:
  --output <dir>   Write files to directory (creates manifest.json + schemas/)
  --layer <n>      Max generation layer: 1 = manifest only, 2 = + schemas
  --crawl <n>      Crawl N internal pages to find more structured data

Layer 2 schema auto-generation works when the site has:
  ✓ JSON-LD structured data (<script type="application/ld+json">)   → HIGH confidence
  ✓ Microdata attributes (itemscope, itemprop)                      → MEDIUM confidence
  ✓ OpenAPI/Swagger endpoint (auto-detected)                        → protocol detection

Layer 2 CANNOT be auto-generated when:
  ✗ Site has no structured data (plain HTML only)
  ✗ Content is rendered client-side only (SPA without SSR)
  ✗ Data is behind authentication

Supported Schema.org types:
  Product, Article, NewsArticle, BlogPosting, Recipe, Event,
  Restaurant, LocalBusiness, Course

Examples:
  npx ara-generate https://myshop.com
  npx ara-generate https://myblog.com --output .well-known/ara/
  npx ara-generate https://mysite.com --crawl 10 --output .well-known/ara/
`);
    process.exit(0);
  }

  const { manifest, schemas } = await generate(url, { maxLayer, crawlPages });

  if (outputDir) {
    // Write manifest + schemas + digest to directory
    const dir = outputDir.replace(/\/$/, "");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.error(`  ✓ Saved ${dir}/manifest.json`);

    if (Object.keys(schemas).length > 0) {
      const schemasDir = path.join(dir, "schemas");
      if (!fs.existsSync(schemasDir)) fs.mkdirSync(schemasDir, { recursive: true });

      for (const [name, schema] of Object.entries(schemas)) {
        // Clean internal fields before writing
        const cleanSchema = { ...schema };
        delete cleanSchema._source;
        delete cleanSchema._source_type;
        delete cleanSchema._confidence;
        delete cleanSchema._note;

        // Add note as a proper field
        cleanSchema._generator_note =
          schema._note + ` Source: ${schema._source} (${schema._confidence} confidence).`;

        // Clean auto-detected markers from properties
        for (const prop of Object.values(cleanSchema.properties)) {
          delete prop._auto_detected;
        }

        fs.writeFileSync(path.join(schemasDir, `${name}.json`), JSON.stringify(cleanSchema, null, 2));
        console.error(`  ✓ Saved ${dir}/schemas/${name}.json`);
      }
    }

    // Generate digest.md (GEO layer)
    const digest = generateDigest(manifest, url);
    fs.writeFileSync(path.join(dir, "digest.md"), digest);
    console.error(`  ✓ Saved ${dir}/digest.md`);
    console.error(`  ⚠  digest.md is auto-generated — review and add specific facts (prices, counts, dates)`);
  } else {
    // Output manifest to stdout (schemas info embedded in meta)
    if (Object.keys(schemas).length > 0) {
      manifest._generated_schemas = {};
      for (const [name, schema] of Object.entries(schemas)) {
        const clean = { ...schema };
        delete clean._source;
        delete clean._source_type;
        delete clean._confidence;
        for (const prop of Object.values(clean.properties)) {
          delete prop._auto_detected;
        }
        manifest._generated_schemas[name] = clean;
      }
    }
    console.log(JSON.stringify(manifest, null, 2));
  }
}

main().catch((err) => {
  console.error(`\n  ✗ Error: ${err.message}\n`);
  process.exit(1);
});

module.exports = { generate };
