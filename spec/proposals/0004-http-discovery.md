# 0004 — HTTP Discovery

- **Status**: Draft
- **Target**: ARA 1.1
- **Affects**: HTTP behaviour of ARA sites; "enforcement" layers of 1.1.0

## Motivation

Agents find the manifest because they know `/.well-known/ara/`. Three gaps remain:
- `rel="ara-manifest"` is used but not registered.
- Content negotiation by `Accept` is not specified.
- The only negotiation documented, enforcement layer 4 of 1.1.0, redirects known AI user agents to `digest.md`.

That redirect has costs:
- It depends on a list of bot names that is always out of date.
- Two clients asking the same URL see different content, which is hard to debug and to trust.
- It rewards user-agent spoofing.
- It sends the digest where the agent asked for a page.

## Specification

1. **Link relation.** Register `ara-manifest` as a link relation type (RFC 8288, IANA "Link Relations" registry). A site SHOULD send on every HTTP response:

   ```http
   Link: </.well-known/ara/manifest.json>; rel="ara-manifest"; type="application/json"
   ```

   HTML pages SHOULD also carry `<link rel="ara-manifest" href="/.well-known/ara/manifest.json">`.
2. **Content negotiation.** A site MAY serve machine representations of a page according to `Accept`, with a direct `200` response (no redirect) and `Vary: Accept`:

   | `Accept` | Representation |
   |----------|----------------|
   | `application/json` on `/` | the manifest |
   | `text/markdown` | the digest (on `/`) or a Markdown version of the page |
   | `application/ld+json` | the page's JSON-LD |

3. **No User-Agent routing.** A site SHOULD NOT vary its content according to the `User-Agent`. User-agent-based redirects (enforcement layer 4 of 1.1.0) are deprecated. `X-ARA-Manifest` and `X-ARA-Version` remain optional signals.

## Compatibility

Additive, except the deprecation of layer 4. Sites using it keep working, and the deprecation becomes a removal only in 2.0.

## Validator

- URL mode already checks the `Link` header (keep).
- Request `/` with `Accept: application/json` and report whether the manifest comes back.
- Request `/` with two different `User-Agent` values and warn when the responses differ.

## Reference implementation

Verso sends `Link`, `X-ARA-Manifest` and `X-ARA-Version` on every response. It negotiates `/` and its model pages by `Accept`, always with `200` and `Vary: Accept`. A test checks that a browser, GPTBot, ClaudeBot, PerplexityBot and an empty user agent receive byte-identical responses.
