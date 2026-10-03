# 0001 — Extension Mechanism

- **Status**: Draft
- **Target**: ARA 1.1
- **Affects**: `manifest.json`, `schemas/*.json`, `actions.json`

## Motivation

ARA 1.0 defines no way to carry data the spec does not cover, and does not say what an agent or a validator must do with a field it does not know. Implementers who need more (signatures, validity, internal identifiers) either invent top-level fields that may collide with future versions, or give up. Validators currently ignore unknown fields, but nothing guarantees it.

## Specification

1. **Unknown fields.** Agents and validators MUST ignore any field they do not understand, at any level of any ARA file. A validator MUST NOT lower a score because of an unknown field.
2. **Extension keys.** A key starting with `x-` is an extension. Extensions MAY appear at any level. The spec will never define a field starting with `x-`.
3. **Naming.** An extension key SHOULD name its owner: `x-<vendor>` (e.g. `x-verso`) for one implementation, `x-<topic>` for a cross-vendor draft heading for the spec.
4. **Self-description.** A top-level extension object SHOULD carry `version` and `spec` (URL of its documentation).
5. **No redefinition.** An extension MUST NOT change the meaning of a field defined by the spec.

## Example

```json
{
  "$ara": "1.0",
  "identity": { "…": "…" },
  "x-verso": {
    "version": "0.1",
    "spec": "https://example.com/.well-known/verso/extension.md",
    "signing": { "alg": "Ed25519", "jwks_uri": "https://example.com/.well-known/verso/jwks.json" }
  }
}
```

## Compatibility

Fully compatible: it states what validators already do.

## Validator

`ara-validate` 1.1.1 already ignores unknown fields. Its test suite has a case for an `x-` key at manifest level. It could list the extensions it saw, in `info`.

## Reference implementation

Verso publishes all its additions under `x-verso` in the manifest, in `schemas/fact.json` and on each action. A test asserts that the manifest's top-level keys are exactly the 1.0 fields plus `x-verso`.
