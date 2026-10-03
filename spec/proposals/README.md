# ARA Proposals

Drafts for the next versions of the specification. **Not normative** until merged into `spec/vX.Y/`.

| # | Proposal | Target | Status |
|---|----------|--------|--------|
| [0001](0001-extension-mechanism.md) | Extension mechanism (`x-` keys, unknown fields ignored) | 1.1 | Draft |
| [0002](0002-temporal-validity.md) | Validity period of data (`valid_from` / `valid_until`) | 1.1 | Draft |
| [0003](0003-response-conventions.md) | Response conventions: `status`, "no answer", verifiable confirmation | 1.1 | Draft |
| [0004](0004-http-discovery.md) | HTTP discovery: `rel="ara-manifest"`, `Accept` negotiation, no User-Agent routing | 1.1 | Draft |
| [0005](0005-verifiable-facts-profile.md) | Verifiable facts profile: signatures, versions, change feed | 2.0 or optional profile | Draft |

Each proposal states its motivation, the normative text it would add, an example, its compatibility impact, what the validator would check, and where it is already implemented.

The 1.1 proposals are additive: every valid 1.0 site stays valid. Proposal 0005 adds new obligations for sites that claim the profile, so it is either a 2.0 feature or an opt-in profile declared in the manifest.

**Reference implementation**: Verso (not yet public) implements all five for a fictitious car brand, under the `x-verso` extension key. Its test suite exercises them, and both `ara-validate` 1.0.0 (90/100) and 1.1.1 (100/100) accept its files without issue or warning.

## Lifecycle

`Draft` → `Review` (spec-change PR, review period per CONTRIBUTING.md) → `Accepted` (merged into the next `spec/vX.Y/`) or `Withdrawn`.
