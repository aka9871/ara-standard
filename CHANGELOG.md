# Changelog

All notable changes to the ARA specification will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] — 2026-04-16

### Added
- **Claude Code agent stack** — 4 agents covering the full ARA lifecycle:
  - `ara-auditor`: scores any site A-F across 13 criteria, detects llms.txt
  - `ara-transformer`: generates all 4 ARA files from any URL or local codebase
  - `ara-enforcer`: injects content-negotiation middleware for 8+ frameworks (Next.js, nginx, WordPress, Laravel, Django, Cloudflare Worker, Apache, Vercel)
  - `ara-monitor`: measures GEO impact via citation probes and semantic accuracy
  - Available at: https://github.com/aka9871/claude-ara-agents
- **Enforcement specification** — 4-layer signal strategy for forcing AI bots to use ARA without native standard support:
  - Layer 1: HTTP headers (`Link: rel="ara-manifest"`, `X-ARA-Manifest`, `X-ARA-Version`)
  - Layer 2: HTML `<head>` meta hints (`<link rel="ara-manifest">`, `<meta name="ara:manifest">`)
  - Layer 3: JSON-LD `potentialAction` reference to manifest
  - Layer 4: Content negotiation — 302 redirect for known AI bot User-Agents
- **GEO monitoring framework** — `ara-monitor` uses `actions.json` intent examples as AI search probes and compares results against `digest.md` facts (ground truth). Semantic accuracy classification: exact (+2), approximate (+1), vague (0), missing (0), inaccurate (-1).
- **digest.md quality rules** — formal spec: 200-400 tokens, every sentence must contain a number/proper noun/verifiable fact, no marketing adjectives, first 3 lines weighted most heavily.
- `ara-generate` now generates `digest.md` (GEO layer) alongside manifest and schemas.
- **`ara-validate` v1.1.0**:
  - Schemas actually fetched and validated in URL mode (not just presence check)
  - `actions.json` actually fetched and structure-checked in URL mode
  - digest.md token count estimated with quality warnings (under 150 / over 500)
  - Enforcement signals checked: `Link`, `X-ARA-Manifest`, `X-ARA-Version` headers
  - Enforcement status shown in output
  - Grade emoji in output (🟢 A, 🟡 B, 🟠 C, 🔴 D, ⛔ F)

### Changed
- `manifest.json` spec: `human_site` field is now `boolean` (was incorrectly documented as URL string)
- `manifest.json` spec: `locale` values should be BCP-47 (e.g., `"en-US"`, not `"en"`)
- `manifest.json` spec: `capabilities.protocols` should always have at least one protocol declared (empty object warns)
- `capabilities.actions_ref` added as a recommended field pointing to `/.well-known/ara/actions.json`
- Token cost comparison updated with real measurement: **12.8x** fewer tokens (844 vs 10,830 tokens, 100% vs ~55% information retrieved on ara-standard.org)
- README updated with enforcement section and Claude Code agents section
- Own `manifest.json` updated: locale, capabilities, policies, resources (4 resources including agents)
- Own `digest.md` updated to reflect v1.1 additions

### Fixed
- `manifest.json` in `.well-known/ara/`: fixed `locale: ["en"]` → `["en-US"]`
- `manifest.json` in `.well-known/ara/`: fixed `capabilities.protocols: {}` — now declares `rest_api: true`
- `manifest.json` in `.well-known/ara/`: fixed `human_site: URL` → `true`
- `manifest.json` in `.well-known/ara/`: added `schema_ref` to all resources
- `manifest.json` in `.well-known/ara/`: added `rate_limit` to policies (60 req/min)

---

## [1.0.0] — 2026-02-15

### Added
- Initial ARA v1.0 specification release.
- **Layer 1 — Discovery**: `manifest.json` with identity, content map, capabilities, and policies.
- **Layer 2 — Understanding**: Semantic schemas with search hints and relationships.
- **Layer 3 — Interaction**: Actions with intent mapping, protocol negotiation, and workflows.
- **Content Digest**: LLM-optimized Markdown summary format (digest.md).
- **HTML integration**: `<meta name="ara:*">` tags and JSON-LD reference.
- Protocol support: MCP, A2A, REST API, GraphQL.
- 4-level incremental adoption model (Level 0 → Level 4).
- Security framework: agent identification, trust levels, rate limiting, scoped access.
- Examples: e-commerce (UrbanStyle), SaaS (FlowBoard), media (ByteWire), restaurant (Le Jardin).
- Tools: `npx ara-validate` (validator, 13 criteria, A-F grade) and `npx ara-generate` (manifest generator from HTML/JSON-LD).
- Client libraries: Node.js (`ara-discover`) and Python (`ara-client`).
