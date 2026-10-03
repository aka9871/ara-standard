# 0002 — Validity Period of Data

- **Status**: Draft
- **Target**: ARA 1.1
- **Affects**: data served by resources and actions; `schemas/*.json`; `content_map.resources[]`

## Motivation

`freshness` says how often a resource is updated, not how long a given piece of data is true. A financing offer valid until 30 November, a price that changes on 1 January, opening hours for the summer: none can be expressed. Nothing prevents an agent from repeating an expired offer it cached last month. For brands, that is the most common way agents get facts wrong.

## Specification

1. **Fields.** Any item served by an ARA site MAY carry:

   | Field | Type | Meaning |
   |-------|------|---------|
   | `valid_from` | string, ISO 8601 date-time with offset | start of validity, **inclusive** |
   | `valid_until` | string, ISO 8601 date-time with offset, or `null` | end of validity, **exclusive**; `null` = no announced end |

2. **Sites.** A site MUST NOT serve an item outside `[valid_from, valid_until)` at the time of the response.
3. **Agents.** An agent MUST NOT present an item as current after its `valid_until`, including from a cache. It SHOULD say when an item it relies on ends.
4. **Caching.** A site SHOULD NOT allow HTTP caching beyond the earliest `valid_until` among the items of a response (`Cache-Control: max-age`).
5. **Comparison.** Instants are compared as instants, never as strings. `2026-10-01T11:59:00+02:00` is before `2026-10-01T10:00:00Z`.
6. **Schemas.** In `schemas/*.json`, the two properties SHOULD use `"semantic": "schema:validFrom"` and `"semantic": "schema:validThrough"`.
7. **Declaration.** A resource whose items carry validity SHOULD say so in its schema. A site applying rule 2 everywhere MAY declare it in the manifest's `policies`:

   ```json
   "policies": { "serving_policy": "current_only" }
   ```

## Example

```json
{
  "id": "offer-aurore-loa-autumn",
  "monthly_amount": 249,
  "valid_from": "2026-09-30T08:00:00Z",
  "valid_until": "2026-12-01T08:00:00Z"
}
```

## Compatibility

Additive. Items without the fields keep their 1.0 meaning.

## Validator

- When a schema declares `valid_from`/`valid_until`, check their type and `format: "date-time"`.
- In URL mode, sample-check that an endpoint serves no item already expired.

## Reference implementation

Verso serves only facts whose validity period contains the request instant. It enforces this twice: in the SQL selection, and in a guard on every output. Its `Cache-Control` is capped at the first expiry among the facts served. Its accuracy bench re-checks every received fact with real instant comparison.

## Open questions

- Should the manifest itself carry a `valid_until` (e.g. for a campaign site)?
- Does a recurring validity (opening hours) belong here, or in Schema.org `openingHoursSpecification`?
