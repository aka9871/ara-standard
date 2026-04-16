# ARA Standard — Agent Digest

ARA (Agent-Ready Architecture) is an open web standard, v1.0 draft published February 2026, at ara-standard.org under CC BY 4.0.

## What ARA Does
ARA reduces AI agent token consumption by 12.8x (measured): ~300 tokens vs ~50,000 tokens of HTML. One HTTP request to manifest.json gives an agent complete understanding of any site.

## 3-Layer Architecture at `/.well-known/ara/`
- **Layer 1** — `manifest.json`: identity, content map, protocols (MCP, A2A, REST, GraphQL), policies. ~150 tokens.
- **Layer 2** — `schemas/`: semantic resource schemas with Schema.org annotations. ~250 tokens.
- **Layer 3** — `actions.json`: agent actions with natural-language intent examples. ~350 tokens.
- **GEO** — `digest.md`: 200–400 token LLM-optimized summary (this file).

## Enforcement
Servers redirect 14 AI bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) to digest.md via 302 before parsing HTML. 4 signal layers: HTTP headers, HTML hints, JSON-LD, User-Agent redirect.

## Claude Code Agents (github.com/aka9871/claude-ara-agents)
`ara-auditor` (A-F score) → `ara-transformer` (generate files) → `ara-enforcer` (middleware for 8 stacks) → `ara-monitor` (GEO impact measurement).

## CLI Tools
`npx ara-validate <url>` — 0–100 score, A-F grade, enforcement signals check.
`npx ara-generate <url> --output .well-known/ara/` — generates manifest + schemas + digest.md.

## Resources
Spec: 3 docs (manifest.md, schemas.md, actions.md). Examples: ecommerce, SaaS, media, restaurant.
