# ARA Specification v1.0 — Layer 1: Discovery

## The Manifest (`manifest.json`)

**Location**: `/.well-known/ara/manifest.json`

The manifest is the **single entry point** for any agent. It combines the roles of `robots.txt`, `sitemap.xml`, and a semantic identity card into one structured, machine-readable file.

## Design Principle

**"Understand in 1 request."** An agent should be able to understand an entire website by reading one JSON file. The manifest provides enough context for an agent to decide whether and how to interact with a site, without loading any HTML.

## Schema

```
GET /.well-known/ara/manifest.json
Content-Type: application/json
```

## Top-Level Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$ara` | string | Yes | ARA specification version (e.g., `"1.0"`) |
| `$schema` | string | No | URL to the JSON Schema for validation |
| `identity` | object | Yes | Who is this site? |
| `content_map` | object | Yes | What does it contain? |
| `capabilities` | object | No | How can agents interact? |
| `policies` | object | No | What are the rules? |
| `meta` | object | No | Metadata about the manifest itself |

---

## `identity` — Site Identity

Describes the site's fundamental nature. This is the semantic equivalent of a business card.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable site name |
| `type` | string | Yes | Site type (see taxonomy below) |
| `description` | string | Yes | One-paragraph description optimized for agent understanding |
| `sector` | string | No | Industry sector |
| `locale` | array[string] | No | Supported locales (BCP 47 format, e.g., `"en-US"`, `"fr-FR"`) |
| `geo` | object | No | Geographic information |
| `contact` | object | No | Contact details |
| `branding` | object | No | Visual identity (logo, colors) |

### Site Types (non-exhaustive)

`ecommerce`, `saas`, `blog`, `news_media`, `portfolio`, `documentation`, `marketplace`, `restaurant`, `car_dealership`, `real_estate`, `healthcare`, `education`, `government`, `nonprofit`, `entertainment`, `social_platform`, `api_service`, `directory`

### `geo` Object

| Field | Type | Description |
|-------|------|-------------|
| `address` | string | Physical address |
| `coordinates` | array[number] | `[latitude, longitude]` |
| `service_area` | string | Geographic service area |
| `country_code` | string | ISO 3166-1 alpha-2 |

---

## `content_map` — Site Content

Describes what the site contains — its resources, their structure, and how to access them.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `summary` | string | Yes | One-line overview of site content |
| `resources` | array[Resource] | Yes | List of available resources |
| `taxonomy` | object | No | Classification system (categories, tags, etc.) |

### Resource Object

Each resource represents a collection of items on the site (products, articles, services, etc.).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for this resource |
| `type` | string | Yes | Resource type: `catalog`, `content`, `service_list`, `reviews`, `faq`, `events`, `directory` |
| `label` | string | Yes | Human-readable label |
| `description` | string | No | What this resource contains |
| `count` | integer | No | Number of items |
| `schema_ref` | string | No | Reference to Layer 2 schema (e.g., `"schemas/product.json"`) |
| `freshness` | string | No | Update frequency: `realtime`, `hourly`, `daily`, `weekly`, `monthly`, `static` |
| `access` | string | Yes | Access level: `public`, `authenticated`, `premium` |
| `formats` | array[string] | No | Available data formats: `json`, `xml`, `csv`, `rss` |
| `endpoint` | string | No | URL path to access this resource's data |

---

## `capabilities` — Interaction Methods

Declares which protocols an agent can use to interact with the site.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `protocols` | object | No | Available communication protocols |
| `actions_ref` | string | No | Reference to Layer 3 actions file (e.g., `"actions.json"`) |

### Protocol Objects

#### MCP (Model Context Protocol)

```json
{
  "mcp": {
    "endpoint": "https://example.com/mcp",
    "version": "2025-03",
    "tools": ["search", "get_details", "book"],
    "description": "Full MCP server for agent interactions"
  }
}
```

#### A2A (Agent-to-Agent)

```json
{
  "a2a": {
    "endpoint": "https://example.com/.well-known/agent.json",
    "version": "1.0",
    "skills": ["search", "booking", "pricing"]
  }
}
```

#### REST API

```json
{
  "rest_api": {
    "openapi": "https://example.com/api/openapi.json",
    "base_url": "https://example.com/api/v2"
  }
}
```

#### GraphQL

```json
{
  "graphql": {
    "endpoint": "https://example.com/graphql",
    "schema": "https://example.com/graphql/schema"
  }
}
```

### Protocol Negotiation

Agents select the best protocol based on their capabilities:

| Protocol | Best for | Advantage |
|----------|----------|-----------|
| **MCP** | LLM-connected agents (Claude, GPT) | Native tool integration |
| **A2A** | Agent-to-agent communication | Autonomy, task delegation |
| **REST** | Simple programmatic access | Universal, cacheable |
| **GraphQL** | Complex queries, linked data | Flexible, single endpoint |

---

## `policies` — Rules of Engagement

Tells agents what they can and cannot do.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_access` | string | No | Default access policy: `open`, `restricted`, `authenticated` |
| `rate_limit` | object | No | Rate limiting rules |
| `authentication` | object | No | Auth requirements |
| `data_usage` | object | No | Data usage policies |
| `terms` | string | No | URL to agent-specific terms of service |

### Rate Limit Object

```json
{
  "rate_limit": {
    "requests_per_minute": 60,
    "burst": 10
  }
}
```

### Authentication Object

```json
{
  "authentication": {
    "required_for": ["request_quote", "book_appointment"],
    "methods": ["api_key", "oauth2"],
    "registration": "https://example.com/developer"
  }
}
```

### Data Usage Object

```json
{
  "data_usage": {
    "caching_allowed": true,
    "cache_ttl": 3600,
    "redistribution": false,
    "attribution_required": true
  }
}
```

---

## `meta` — Manifest Metadata

Information about the manifest itself.

| Field | Type | Description |
|-------|------|-------------|
| `generated_at` | string (ISO 8601) | When this manifest was generated |
| `generator` | string | Tool that generated this manifest |
| `checksum` | string | Integrity checksum |
| `next_update` | string (ISO 8601) | When the manifest will next be updated |
| `human_site` | string (URL) | The human-facing website URL |
| `support` | string (email) | Support contact for ARA-related issues |

---

## Content Digest (`digest.md`)

**Location**: `/.well-known/ara/digest.md`

An optional but highly recommended companion to the manifest. The digest is a **Markdown summary optimized for LLM consumption** — designed to be read directly as context, not parsed.

### Design Goals
- **Minimal tokens**: a complete site overview in ~200-400 tokens
- **Human-readable**: also useful for developers inspecting the site
- **Structured but natural**: uses Markdown headings and lists, not JSON

### Example

```markdown
# TechShop — Agent Digest

## Identity
Online electronics retailer. Founded 2019. Rating: 4.5/5 (1,200 reviews).

## Catalog
2,000 products | $10 — $5,000
Categories: Laptops (400), Smartphones (350), Audio (300), Cameras (200), Gaming (250), Accessories (500)
Top brands: Apple, Samsung, Sony, Bose, Dell

## Top Products (by popularity)
1. MacBook Air M3 2025 — $1,099 — in stock
2. Samsung Galaxy S25 — $799 — in stock
3. Sony WH-1000XM6 — $349 — in stock

## Services
- Free shipping over $50
- 30-day returns
- Price match guarantee
- Expert live chat

## Quick Info
- Hours: 24/7 online, customer service 9am-9pm EST
- Delivery: 1-5 business days
- Payment: Visa, Mastercard, PayPal, Apple Pay
```

This digest costs ~250 tokens and gives an agent a complete understanding of the site.

---

## JSON Schema for Validation

The manifest JSON Schema is available at:
- `https://ara-standard.org/schema/manifest/v1`
- `spec/v1.0/schema/manifest.schema.json` (in this repo)

Use it to validate your manifest:

```bash
npx ara-validate https://yoursite.com
```
