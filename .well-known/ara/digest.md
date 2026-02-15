# ARA Standard — Agent Digest

## Identity
Open web standard for making websites agent-ready. Version 1.0 (February 2026). Draft specification.

## Architecture
3 layers: Discovery (manifest.json) → Understanding (schemas/) → Interaction (actions.json)
All files at /.well-known/ara/

## Key Concepts
- "Understand in 1 request": agents read one JSON file to understand any site
- Protocol negotiation: MCP, A2A, REST, GraphQL — agents pick the best channel
- Incremental adoption: 4 levels from a single manifest to full agent integration
- Content Digest: LLM-optimized summaries in ~300 tokens
- Token reduction: 10-20x fewer tokens vs DOM/screenshot parsing

## Resources
- Full specification: 3 documents (manifest, schemas, actions)
- Examples: 4 sectors (e-commerce, SaaS, media, restaurant)
- Tools: validator (ara-validate), generator (ara-generate)

## Quick Start
1. Create /.well-known/ara/manifest.json
2. Add identity, content_map, capabilities, policies
3. Validate with: npx ara-validate https://yoursite.com
