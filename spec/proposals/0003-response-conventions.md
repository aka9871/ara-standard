# 0003 — Response Conventions: Status, "No Answer", Verifiable Confirmation

- **Status**: Draft
- **Target**: ARA 1.1
- **Affects**: `actions.json` (`output`, `input`), action responses

## Motivation

`actions.json` describes each action's output, but there is no common way to say:
- "here is the data";
- "this site does not publish that";
- "your request is invalid";
- "the action failed for this reason".

Faced with an empty or ambiguous answer, LLM agents fill the gap by extrapolating, which is exactly what a brand wants to avoid. Sites also have no convention for learning what agents asked and did not find.

Separately, `confirmation_required: true` is advice to the agent that the server cannot check.

## Specification

### Status

1. Every action response SHOULD carry a top-level `status`.
   - For `query` actions, its value is one of `answered`, `no_answer`, `invalid_input`, `error`.
   - For `mutation` actions, its value is a success value of the action's choosing (e.g. `confirmed`) or one of `failed`, `invalid_input`, `error`.
2. `no_answer` means "the site does not publish this". The response SHOULD include a human-readable `message`. An agent receiving `no_answer` MUST NOT extrapolate an answer and SHOULD tell its user the information is not published.
3. `failed` responses SHOULD carry `error.code`, one of the codes declared in the action's `errors`, and the HTTP mapping (REST) SHOULD use that error's `http_status`.
4. **No leak.** A `no_answer` MUST NOT reveal the existence of unpublished data (drafts, rejected items, unreleased products): an unreleased product and a non-existent one get the same answer.
5. **Learning from gaps.** Sites SHOULD log `no_answer` responses: they are the list of data agents want and the site lacks.

### Verifiable confirmation

6. An action with `confirmation_required: true` SHOULD declare a required input `user_confirmed` with `"const": true`, and the server MUST reject the call without it. This is not proof of consent. It makes the agent assert the confirmation explicitly, so the server can log it and a call cannot skip it by accident.

## Example

```json
{ "status": "no_answer", "message": "This brand does not publish a towing capacity for this model." }
```

```json
"input": {
  "type": "object",
  "required": ["slot_id", "user_confirmed"],
  "properties": {
    "slot_id": { "type": "string" },
    "user_confirmed": { "const": true, "description": "The user explicitly confirmed the booking" }
  }
}
```

## Compatibility

Additive conventions on `output` and `input`.

## Validator

- Warn when a `mutation` with `confirmation_required: true` has no `user_confirmed` input.
- Warn when an action's output schema has no `status` property.

## Reference implementation

In Verso:
- all four actions return a `status` and map failures to the declared `errors`;
- `book_test_drive` requires `user_confirmed: true`;
- the Radar groups `no_answer` responses into a backlog of missing facts;
- a test shows an unreleased model is indistinguishable from an unknown one.
