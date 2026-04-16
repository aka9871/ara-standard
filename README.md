<p align="center">
  <img src="https://img.shields.io/badge/ARA-v1.0-blue?style=for-the-badge" alt="ARA v1.0" />
  <img src="https://img.shields.io/badge/license-CC%20BY%204.0-green?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/status-Draft-orange?style=for-the-badge" alt="Status" />
</p>

# ARA — Agent-Ready Architecture

**An open web standard for making any website understandable and actionable by autonomous AI agents.**

> `robots.txt` taught crawlers where to go. `sitemap.xml` showed search engines what exists.
> **ARA tells AI agents what a site is, what it offers, and how to interact with it.**

---

## The Problem

The web was built for humans who browse visually. Search engines brought standards like `robots.txt`, `sitemap.xml`, and Schema.org for indexing. But **no standard exists for AI agents** that need to understand, navigate, and interact with a website programmatically.

Today, an AI agent visiting a website must:
- Parse raw HTML/DOM (thousands of tokens of noise)
- Take screenshots and interpret them visually (slow, expensive)
- Guess at site structure, available actions, and data schemas
- Interact through fragile UI automation (clicking buttons, filling forms)

**This costs 10-20x more tokens than necessary** and produces unreliable results.

## The Solution

ARA provides a **3-layer architecture** that lets any website declare itself "agent-ready":

```
┌─────────────────────────────────────────────────┐
│           LAYER 3 — INTERACTION                 │
│     Actions, MCP/A2A/REST Endpoints, Workflows  │
│         /.well-known/ara/actions.json            │
├─────────────────────────────────────────────────┤
│           LAYER 2 — UNDERSTANDING               │
│     Semantic Schemas, Knowledge Graph            │
│         /.well-known/ara/schemas/                │
├─────────────────────────────────────────────────┤
│           LAYER 1 — DISCOVERY                   │
│     Identity, Catalog, Content Map               │
│         /.well-known/ara/manifest.json           │
└─────────────────────────────────────────────────┘
```

**Core principle: "Understand in 1 request."** A single HTTP request to `manifest.json` gives an agent a complete understanding of any website.

## Quick Example

A minimal ARA manifest for an e-commerce site:

```json
{
  "$ara": "1.0",
  "identity": {
    "name": "TechShop",
    "type": "ecommerce",
    "description": "Online electronics store with 2,000+ products",
    "locale": ["en-US"]
  },
  "content_map": {
    "summary": "2,000 products across 15 categories",
    "resources": [
      {
        "id": "products",
        "type": "catalog",
        "label": "Product Catalog",
        "count": 2000,
        "schema_ref": "schemas/product.json",
        "endpoint": "/ara/resources/products"
      }
    ]
  },
  "capabilities": {
    "protocols": {
      "rest_api": {
        "openapi": "https://techshop.com/api/openapi.json"
      }
    }
  },
  "policies": {
    "agent_access": "open",
    "rate_limit": { "requests_per_minute": 60 }
  }
}
```

**That's ~30 lines of JSON** — and an agent now knows what TechShop is, what it sells, how to query its catalog, and what the access rules are.

## Token Cost Comparison

| Approach | Tokens to understand a site | Reliability |
|----------|----------------------------|-------------|
| DOM/HTML parsing | 15,000 – 50,000 | Fragile |
| Screenshot analysis | 5,000 – 15,000 per page | Approximate |
| **ARA manifest + digest** | **300 – 1,500** | **Structured & reliable** |

**ARA reduces agent token consumption by 12.8x (measured) vs raw HTML parsing.**

Real-world measurement on ara-standard.org:
- Without ARA: 10,830 tokens (HTML), ~55% of information retrieved
- With ARA: 844 tokens (manifest), 100% of information retrieved
- Result: **12.8x fewer tokens, 100% accuracy**

## How It Compares

| Capability | robots.txt | sitemap.xml | Schema.org | llms.txt | OpenAPI | **ARA** |
|------------|-----------|-------------|-----------|---------|---------|---------|
| Site discovery | — | Partial | — | Partial | — | **Complete** |
| Global overview | — | URLs only | — | Plain text | — | **Structured** |
| Data schemas | — | — | Fragmented | — | Yes | **Semantic** |
| Actions | — | — | Limited | — | Yes | **Multi-protocol** |
| Intent mapping | — | — | — | — | — | **Native** |
| MCP/A2A support | — | — | — | — | — | **Native** |
| LLM-optimized digest | — | — | — | Basic | — | **Optimized** |
| Agent policies | Basic | — | — | — | Partial | **Complete** |
| Incremental adoption | — | — | — | — | — | **4 levels** |

## Adoption Levels

You don't need to implement everything at once. ARA supports incremental adoption:

| Level | What you add | Effort | Agent benefit |
|-------|-------------|--------|---------------|
| **Level 0** | Nothing | None | Agent must parse HTML (slow, fragile) |
| **Level 1** | `manifest.json` only | 1 file | Discovery + global understanding |
| **Level 2** | Manifest + Schemas | 3-5 files | Full structural understanding |
| **Level 3** | Manifest + Actions | 5-10 files | Programmatic interaction |
| **Level 4** | Full ARA + MCP/A2A | Complete integration | Native agent experience |

**Even Level 1 (a single JSON file) reduces token consumption by 90%.**

## Claude Code Agents

The fastest way to make any site ARA-ready. Four agents covering the full lifecycle, available at [github.com/aka9871/claude-ara-agents](https://github.com/aka9871/claude-ara-agents).

| Agent | What it does | Command |
|-------|-------------|---------|
| `ara-auditor` | Scores any site A-F across 13 criteria, detects llms.txt | `/ara audit <url>` |
| `ara-transformer` | Generates all 4 ARA files from any URL or local codebase | `/ara transform <url>` |
| `ara-enforcer` | Injects content-negotiation middleware for 8+ frameworks | `/ara enforce <url>` |
| `ara-monitor` | Measures GEO impact — citation rate and semantic accuracy | `/ara monitor <url>` |

**Full workflow:**
```bash
/ara transform https://yoursite.com   # generates manifest.json, schemas/, actions.json, digest.md
/ara enforce https://yoursite.com     # injects middleware (Next.js / nginx / WordPress / ...)
/ara audit https://yoursite.com       # verifies score A-F
/ara monitor https://yoursite.com     # measures GEO impact after 7-14 days
```

### Enforcement — forcing AI bots to use ARA

AI bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and 10 others) don't know ARA exists yet. `ara-enforcer` solves this with server-side content negotiation:

```
GPTBot visits your site → server detects User-Agent
→ 302 redirect to /.well-known/ara/digest.md
→ bot reads 300 tokens of structured context
→ done (no ARA knowledge required on the bot's side)
```

This works via a 4-layer signal strategy:
1. **HTTP headers** — `Link: </.well-known/ara/manifest.json>; rel="ara-manifest"` on every response
2. **HTML `<head>` hints** — `<link rel="ara-manifest">` + `<meta name="ara:manifest">` tags
3. **JSON-LD** — `potentialAction` pointing to the manifest (Schema.org-compatible)
4. **Content negotiation** — 302 redirect for known AI bot User-Agents

Supported stacks: Next.js, Cloudflare Worker, nginx, Apache, WordPress, Laravel, Django, Vercel.

---

## Getting Started

### Make your site ARA-ready in 5 minutes

1. Create the directory:
```bash
mkdir -p .well-known/ara
```

2. Create your `manifest.json` — start from one of our [examples](spec/examples/):
```bash
cp examples/minimal-manifest.json .well-known/ara/manifest.json
# Edit with your site's details
```

3. Validate:
```bash
npx ara-validate https://yoursite.com
```

### For agents: discover an ARA site

```python
import requests

# One request to understand any ARA-ready site
manifest = requests.get("https://example.com/.well-known/ara/manifest.json").json()

print(manifest["identity"]["name"])        # "TechShop"
print(manifest["identity"]["type"])        # "ecommerce"
print(manifest["content_map"]["summary"])  # "2,000 products across 15 categories"

# Access resources via declared protocols
for resource in manifest["content_map"]["resources"]:
    print(f"{resource['label']}: {resource['count']} items")
```

## Documentation

- **[Full Specification (v1.0)](spec/v1.0/)** — Complete technical specification
  - [Layer 1 — Discovery (manifest.json)](spec/v1.0/manifest.md)
  - [Layer 2 — Understanding (schemas/)](spec/v1.0/schemas.md)
  - [Layer 3 — Interaction (actions.json)](spec/v1.0/actions.md)
- **[Examples](spec/examples/)** — Ready-to-use manifests for e-commerce, SaaS, media, restaurant
- **[Tools](tools/)** — `npx ara-validate` (scorer) and `npx ara-generate` (manifest generator)
- **[Claude Code Agents](https://github.com/aka9871/claude-ara-agents)** — 4 agents for the full lifecycle + middleware for 8+ stacks

## Use Cases

- **E-commerce**: An agent compares products across 15 ARA-ready stores in seconds, without parsing a single HTML page.
- **SaaS**: An enterprise agent evaluates CRM solutions by reading manifests, comparing features via schemas, and simulating pricing via actions.
- **Content/Media**: A monitoring agent ingests 500 news sites via Content Digests (~300 tokens each) and produces a daily synthesis.
- **Local business**: A personal assistant finds a restaurant, reads the menu, and books a table — all through structured ARA interactions.

## Roadmap

| Phase | Timeline | Goal |
|-------|----------|------|
| **Phase 1** — Specification | Q1 2026 | Publish ARA v1.0 spec |
| **Phase 2** — Tooling | Q2 2026 | CLI, CMS plugins (WordPress, Shopify), validator |
| **Phase 3** — Early adoption | Q3 2026 | 100 pilot sites, partnerships with 3 agent frameworks |
| **Phase 4** — Ecosystem | Q4 2026 | Multi-language SDKs, agent registry, certification |
| **Phase 5** — Standardization | 2027 | W3C / IETF submission |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- Report bugs and suggest features via [Issues](https://github.com/ARA-Standard/ara-standard/issues)
- Submit improvements via [Pull Requests](https://github.com/ARA-Standard/ara-standard/pulls)
- Discuss ideas in [Discussions](https://github.com/ARA-Standard/ara-standard/discussions)

## License

This specification is released under [Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE).

---

<p align="center">
  <strong>The agentic web is here. ARA gives every website a front door for AI agents.</strong>
</p>
<p align="center">
  <a href="https://ara-standard.org">Website</a> ·
  <a href="spec/v1.0/">Specification</a> ·
  <a href="spec/examples/">Examples</a> ·
  <a href="https://github.com/ARA-Standard/ara-standard/discussions">Discuss</a>
</p>
