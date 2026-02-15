# ARA Specification v1.0 — Layer 2: Understanding

## Semantic Schemas (`schemas/`)

**Location**: `/.well-known/ara/schemas/{resource}.json`

Each resource declared in the manifest has a corresponding semantic schema that describes the **structure and meaning** of its data. Schemas extend standard JSON Schema with semantic annotations that help agents understand not just the shape of the data, but its purpose.

## Design Principle

**"Know the data before requesting it."** An agent should understand exactly what fields a resource contains, what they mean, and how to search/filter them — before making a single data request.

## Schema Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$ara_schema` | string | Yes | ARA schema spec version |
| `resource` | string | Yes | Resource name (matches `content_map.resources[].id`) |
| `description` | string | Yes | Human-readable description of this resource type |
| `extends` | string | No | Schema.org type this extends (e.g., `"schema:Product"`) |
| `properties` | object | Yes | Property definitions |
| `search_hints` | object | No | How agents can search/filter this resource |
| `relationships` | array | No | Links to other resources |

---

## Property Definitions

Each property in the schema includes standard JSON Schema fields plus ARA-specific semantic extensions:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Data type: `string`, `integer`, `number`, `boolean`, `array`, `object` |
| `description` | string | Yes | What this field represents |
| `semantic` | string | No | Semantic meaning — maps to Schema.org or ARA vocabulary |
| `example` | any | No | Example value |
| `enum` | array | No | Allowed values |
| `enum_ref` | string | No | Reference to taxonomy in manifest (e.g., `"manifest.taxonomy.brands"`) |
| `range` | array[2] | No | `[min, max]` for numeric values |
| `format` | string | No | Format hint: `uri`, `email`, `date`, `date-time`, `phone` |

### Semantic Annotations

The `semantic` field maps properties to well-known vocabularies:

```json
{
  "title": {
    "type": "string",
    "description": "Product display name",
    "semantic": "schema:name"
  },
  "price": {
    "type": "number",
    "description": "Current price in local currency",
    "semantic": "schema:price"
  },
  "availability": {
    "type": "string",
    "enum": ["in_stock", "out_of_stock", "pre_order"],
    "semantic": "schema:availability"
  }
}
```

This lets agents reason about data meaning across different sites. A `semantic: "schema:price"` field on site A is comparable to the same on site B, even if the field names differ.

---

## Search Hints

The `search_hints` object tells agents how to efficiently query this resource:

| Field | Type | Description |
|-------|------|-------------|
| `filterable` | array[string] | Fields that support filtering |
| `sortable` | array[string] | Fields that support sorting |
| `fulltext` | array[string] | Fields that support full-text search |
| `default_sort` | string | Default sort order (prefix `-` for descending) |

### Example

```json
{
  "search_hints": {
    "filterable": ["brand", "category", "price", "rating", "in_stock"],
    "sortable": ["price", "rating", "created_at", "popularity"],
    "fulltext": ["title", "description", "features"],
    "default_sort": "-popularity"
  }
}
```

An agent reading this immediately knows: "I can filter by brand, sort by price, and search titles by keyword." No guessing, no trial-and-error.

---

## Relationships

Define how resources connect to each other:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Relationship name |
| `target` | string | Target resource id |
| `type` | string | Relationship type: `recommendation`, `association`, `parent`, `child`, `dependency` |
| `description` | string | What this relationship represents |

### Example

```json
{
  "relationships": [
    {
      "name": "similar_products",
      "target": "product",
      "type": "recommendation",
      "description": "Similar products by category and price range"
    },
    {
      "name": "reviews",
      "target": "review",
      "type": "association",
      "description": "Customer reviews for this product"
    },
    {
      "name": "category",
      "target": "category",
      "type": "parent",
      "description": "The category this product belongs to"
    }
  ]
}
```

---

## Complete Schema Example

A full schema for a product resource:

```json
{
  "$ara_schema": "1.0",
  "resource": "product",
  "description": "A product available for purchase",
  "extends": "schema:Product",

  "properties": {
    "id": {
      "type": "string",
      "description": "Unique product identifier",
      "semantic": "identifier"
    },
    "title": {
      "type": "string",
      "description": "Product display name",
      "semantic": "schema:name",
      "example": "MacBook Air M3 15-inch"
    },
    "brand": {
      "type": "string",
      "description": "Manufacturer brand",
      "semantic": "schema:brand",
      "enum_ref": "manifest.taxonomy.brands"
    },
    "category": {
      "type": "string",
      "description": "Product category",
      "semantic": "schema:category"
    },
    "price": {
      "type": "object",
      "properties": {
        "amount": { "type": "number" },
        "currency": { "type": "string", "default": "USD" },
        "original": { "type": "number", "description": "Price before discount" }
      },
      "semantic": "schema:price"
    },
    "description": {
      "type": "string",
      "description": "Full product description",
      "semantic": "schema:description"
    },
    "images": {
      "type": "array",
      "items": { "type": "string", "format": "uri" },
      "semantic": "schema:image"
    },
    "rating": {
      "type": "object",
      "properties": {
        "average": { "type": "number", "range": [0, 5] },
        "count": { "type": "integer" }
      },
      "semantic": "schema:aggregateRating"
    },
    "availability": {
      "type": "string",
      "enum": ["in_stock", "out_of_stock", "pre_order", "discontinued"],
      "semantic": "schema:availability"
    },
    "specifications": {
      "type": "object",
      "description": "Technical specifications (varies by product type)",
      "semantic": "schema:additionalProperty"
    },
    "url": {
      "type": "string",
      "format": "uri",
      "description": "Human-facing product page URL",
      "semantic": "schema:url"
    }
  },

  "search_hints": {
    "filterable": ["brand", "category", "price.amount", "rating.average", "availability"],
    "sortable": ["price.amount", "rating.average", "title", "created_at"],
    "fulltext": ["title", "description", "specifications"],
    "default_sort": "-rating.average"
  },

  "relationships": [
    {
      "name": "similar_products",
      "target": "product",
      "type": "recommendation",
      "description": "Similar products by category and price"
    },
    {
      "name": "product_reviews",
      "target": "review",
      "type": "association",
      "description": "Customer reviews for this product"
    }
  ]
}
```

---

## Best Practices

1. **Always include `semantic` annotations** — they enable cross-site reasoning.
2. **Provide `example` values** — they help agents understand expected formats.
3. **Use `search_hints`** — they eliminate trial-and-error API exploration.
4. **Reference Schema.org types** via `extends` — this builds on existing web vocabulary.
5. **Keep schemas focused** — one schema per resource type, not one giant schema for everything.
