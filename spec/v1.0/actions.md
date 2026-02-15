# ARA Specification v1.0 — Layer 3: Interaction

## Actions (`actions.json`)

**Location**: `/.well-known/ara/actions.json`

The actions file describes everything an agent **can do** on the site — from searching products to booking appointments to requesting quotes. It includes input/output schemas, protocol mappings, and intent-to-action routing.

## Design Principle

**"Know what you can do before you do it."** An agent reads the actions file and immediately knows every available interaction, what parameters are required, what responses to expect, and which protocol to use.

---

## Top-Level Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$ara_actions` | string | Yes | ARA actions spec version |
| `intents` | object | No | Maps natural language intents to actions |
| `actions` | array[Action] | Yes | Available actions |
| `workflows` | array[Workflow] | No | Multi-step action sequences |

---

## Intent Mapping

Intents bridge the gap between what a user says and what an agent should do. They provide example phrases that map to specific actions.

```json
{
  "intents": {
    "description": "Maps user intents to available actions",
    "mappings": [
      {
        "intent": "find_product",
        "description": "User is looking for a product",
        "examples": [
          "I need a laptop under $1000",
          "Show me wireless headphones",
          "Find a 4K monitor for gaming"
        ],
        "action": "search_products"
      },
      {
        "intent": "get_price",
        "description": "User wants pricing information",
        "examples": [
          "How much is this?",
          "What's the price with discount?"
        ],
        "action": "get_product_details"
      },
      {
        "intent": "make_purchase",
        "description": "User wants to buy something",
        "action": "create_order",
        "requires_auth": true
      }
    ]
  }
}
```

This allows LLM-powered agents to match user requests to the right action without hardcoded keyword matching.

---

## Action Definition

Each action is a complete description of an operation an agent can perform.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique action identifier |
| `name` | string | Yes | Human-readable action name |
| `description` | string | Yes | What this action does |
| `type` | string | Yes | `query` (read-only) or `mutation` (modifies state) |
| `idempotent` | boolean | No | Whether repeating the action has the same effect |
| `auth_required` | boolean | No | Whether authentication is needed |
| `confirmation_required` | boolean | No | Whether the agent should confirm with the user before executing |
| `input` | object | Yes | Input parameters (JSON Schema) |
| `output` | object | Yes | Response format (JSON Schema) |
| `protocols` | object | No | Protocol-specific endpoint mappings |
| `errors` | array | No | Possible error responses |

### Action Types

| Type | Description | Example |
|------|-------------|---------|
| `query` | Read-only, no side effects | Search products, get details |
| `mutation` | Modifies state on the server | Place order, book appointment, submit form |

**Important**: `mutation` actions with `confirmation_required: true` signal that an agent should ask the user for confirmation before executing. This is a safety mechanism.

---

## Input / Output Schemas

Action inputs and outputs follow JSON Schema format, with the same semantic extensions as Layer 2 schemas.

### Input Example

```json
{
  "input": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Free-text search query"
      },
      "category": {
        "type": "string",
        "enum": ["laptops", "phones", "audio", "cameras"],
        "description": "Filter by category"
      },
      "price_max": {
        "type": "number",
        "description": "Maximum price in USD"
      },
      "sort": {
        "type": "string",
        "enum": ["relevance", "price_asc", "price_desc", "rating", "newest"],
        "default": "relevance"
      },
      "limit": {
        "type": "integer",
        "default": 10,
        "maximum": 50
      }
    }
  }
}
```

### Output Example

```json
{
  "output": {
    "type": "object",
    "properties": {
      "total": {
        "type": "integer",
        "description": "Total matching results"
      },
      "results": {
        "type": "array",
        "items": { "$ref": "schemas/product.json" }
      },
      "facets": {
        "type": "object",
        "description": "Aggregated counts per filter for refinement"
      }
    }
  }
}
```

---

## Protocol Mappings

Each action can declare how to execute it via different protocols:

```json
{
  "protocols": {
    "mcp_tool": "search_products",
    "rest": {
      "method": "GET",
      "path": "/api/v2/products",
      "params_mapping": "query_string"
    },
    "a2a_skill": "product_search",
    "graphql": {
      "query": "searchProducts",
      "type": "query"
    }
  }
}
```

The agent picks the protocol it supports best:
1. If it's an MCP-connected agent → use `mcp_tool`
2. If it's an A2A agent → use `a2a_skill`
3. Fallback → use `rest` (universal)

---

## Error Definitions

Actions can declare expected error responses:

```json
{
  "errors": [
    {
      "code": "NOT_FOUND",
      "description": "The requested resource doesn't exist",
      "http_status": 404
    },
    {
      "code": "RATE_LIMITED",
      "description": "Too many requests, try again later",
      "http_status": 429,
      "retry_after": "header"
    },
    {
      "code": "AUTH_REQUIRED",
      "description": "This action requires authentication",
      "http_status": 401,
      "resolution": "Obtain an API key at /developer"
    }
  ]
}
```

---

## Workflows

Workflows define common multi-step sequences that agents can follow:

```json
{
  "workflows": [
    {
      "id": "purchase_journey",
      "name": "Complete Purchase Flow",
      "description": "From search to checkout",
      "steps": [
        {
          "action": "search_products",
          "description": "Find matching products"
        },
        {
          "action": "get_product_details",
          "description": "Examine a specific product"
        },
        {
          "action": "add_to_cart",
          "description": "Add product to cart",
          "requires_auth": true
        },
        {
          "action": "create_order",
          "description": "Complete purchase",
          "requires_auth": true,
          "confirmation_required": true
        }
      ]
    }
  ]
}
```

Workflows are hints, not constraints. Agents can skip steps, repeat them, or follow a different order. They help agents understand the typical user journey.

---

## Complete Example

```json
{
  "$ara_actions": "1.0",

  "intents": {
    "mappings": [
      {
        "intent": "find_product",
        "examples": ["I need a laptop", "Show me phones under $500"],
        "action": "search_products"
      },
      {
        "intent": "book_appointment",
        "examples": ["I'd like to schedule a demo", "Can I book a consultation?"],
        "action": "book_demo",
        "requires_auth": true
      }
    ]
  },

  "actions": [
    {
      "id": "search_products",
      "name": "Search Products",
      "description": "Search the product catalog with filters",
      "type": "query",
      "idempotent": true,
      "auth_required": false,
      "input": {
        "type": "object",
        "properties": {
          "query": { "type": "string" },
          "category": { "type": "string" },
          "price_min": { "type": "number" },
          "price_max": { "type": "number" },
          "sort": { "type": "string", "default": "relevance" },
          "limit": { "type": "integer", "default": 10 }
        }
      },
      "output": {
        "type": "object",
        "properties": {
          "total": { "type": "integer" },
          "results": { "type": "array", "items": { "$ref": "schemas/product.json" } }
        }
      },
      "protocols": {
        "mcp_tool": "search_products",
        "rest": { "method": "GET", "path": "/api/v2/products" }
      }
    },
    {
      "id": "book_demo",
      "name": "Book a Demo",
      "description": "Schedule a product demonstration",
      "type": "mutation",
      "auth_required": true,
      "confirmation_required": true,
      "input": {
        "type": "object",
        "required": ["date", "contact_email"],
        "properties": {
          "date": { "type": "string", "format": "date" },
          "time_preference": { "type": "string", "enum": ["morning", "afternoon"] },
          "contact_email": { "type": "string", "format": "email" },
          "notes": { "type": "string" }
        }
      },
      "output": {
        "type": "object",
        "properties": {
          "booking_id": { "type": "string" },
          "confirmed_datetime": { "type": "string", "format": "date-time" },
          "meeting_link": { "type": "string", "format": "uri" }
        }
      },
      "protocols": {
        "mcp_tool": "book_demo",
        "rest": { "method": "POST", "path": "/api/v2/bookings" }
      }
    }
  ],

  "workflows": [
    {
      "id": "evaluation_flow",
      "name": "Product Evaluation",
      "steps": [
        { "action": "search_products" },
        { "action": "get_product_details" },
        { "action": "book_demo", "confirmation_required": true }
      ]
    }
  ]
}
```

---

## Best Practices

1. **Mark mutations clearly** — always set `type: "mutation"` for state-changing actions.
2. **Use `confirmation_required`** — for any action with real-world consequences (purchases, bookings, submissions).
3. **Provide intent examples** — the more varied, the better agents can match user requests.
4. **Include error definitions** — agents handle failures gracefully when they know what to expect.
5. **Map multiple protocols** — always include `rest` as a fallback, even if you prefer MCP or A2A.
