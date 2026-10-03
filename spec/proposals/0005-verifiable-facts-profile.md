# 0005 — Verifiable Facts Profile

- **Status**: Draft
- **Target**: ARA 2.0, or an optional profile declared by sites that need it
- **Affects**: manifest (`integrity`), served data, a new change-feed resource

## Motivation

For some publishers (brands, public bodies, health, finance), "what the site says" carries legal weight. An agent quoting a price or a financing offer needs to know:
- who stands behind it;
- that it was not altered on the way;
- which version it holds;
- whether a newer one replaced it.

ARA 1.0 has no provenance or integrity mechanism (`meta.checksum` covers only the manifest, with no algorithm) and no way to publish a key. It has no notion of version or of a data item's approval status, and no incremental way to stay up to date.

## Specification

A site claiming the profile declares it:

```json
"profiles": ["verifiable-facts/1"]
```

### 1. Integrity declaration

```json
"integrity": {
  "issuer": "https://brand.example",
  "alg": "Ed25519",
  "jwks_uri": "https://brand.example/.well-known/ara/jwks.json",
  "canonicalization": "RFC8785",
  "signed_fields": ["id", "version", "type", "subject", "value", "market", "locale", "owner",
                    "valid_from", "valid_until", "status", "validated_at", "issuer"]
}
```

### 2. Signed items

Each item carries the `signed_fields` and a detached signature:

```json
"signature": { "alg": "Ed25519", "kid": "0rpR9J-wU0dm0MC7", "value": "<base64url>" }
```

Verification (normative):
1. fetch `jwks_uri` and take the key whose `kid` matches;
2. build an object with exactly the `signed_fields` of the item, an absent field being `null`;
3. serialise it with RFC 8785 (JCS) and encode it as UTF-8;
4. verify `signature.value` (base64url) with the key (Ed25519, RFC 8032).

Keys MUST stay published after rotation for as long as items they signed may circulate.

### 3. Versions and status

- `id` is stable across versions.
- `version` is an integer that increases with every change; past versions are never rewritten.
- `status` is `validated` for every served item. Drafts and rejected versions are never served.
- A version awaiting validation MUST NOT hide the validated version in force.
- An expired newer version MUST NOT make an older one reappear.

### 4. Change feed

A resource (type `content`, `freshness: "realtime"`) answering `GET …?since=<date-time>`:

```json
{
  "since": "2026-10-01T00:00:00Z",
  "until": "2026-10-02T09:20:00Z",
  "has_more": false,
  "events": [
    { "event": "published", "at": "…", "id": "…", "version": 2, "item": { "…": "signed item" } },
    { "event": "withdrawn", "at": "…", "id": "…", "version": 1, "reason": "expired" }
  ]
}
```

- The feed is the difference between what was served at `since` and at `until`.
- `withdrawn` events carry no content; their `reason` is `expired` or `withheld`.
- Clients page with `since = until` while `has_more` is true.

### 5. Market and language per item

`market` (ISO 3166-1 alpha-2) and `locale` (BCP 47) on each item, for sites whose data differs per market.

## Compatibility

Opt-in: only sites declaring the profile take on its obligations. Agents unaware of it see ordinary data with extra fields (proposal 0001).

## Validator

When the profile is declared:
- fetch `jwks_uri`;
- verify the signature of a sample of items;
- check that `signed_fields` covers at least `value`, `valid_from`, `valid_until` and `status`;
- call the change feed with a recent `since`.

## Reference implementation

Verso implements the profile under `x-verso` (`signing`, `serving_policy`, `changes_feed`, `markets`):
- an append-only fact store where every change is a new version, and every validation signs the version;
- a change feed computed as a served-state difference;
- a demo agent that verifies signatures with an implementation written only from this description, independent of Verso's code, and rejects a tampered price.

## Open questions

- JCS + detached Ed25519 or JWS (RFC 7515, detached payload, appendix F)? The former keeps items readable JSON and is what Verso ships; the latter has wider library support. The profile could allow both via `integrity.format`.
- Should `jwks_uri` live under `/.well-known/ara/` (as proposed here) or stay implementation-defined?
- Agent identity: should the profile recommend reading MCP `clientInfo`, then the `User-Agent` product token, then the domain of `From`, for logging only?
