# AI boundaries

## Allowed roles

### Receipt extraction

The server resolves a validated fixture ID to a local PNG, sends it as a base64 `input_image`, and requests `ReceiptExtractionSchema` with `responses.parse` and `zodTextFormat`. Image text is treated as untrusted data. Output is labeled unverified and never becomes credit authority.

### Migration explanation

The model receives only a compact JSON object derived from an already verified, immutable quote: plan names, exact day counts, formatted amounts, policy/version, rounding mode, auto-renew flag, and sandbox flag. `MigrationExplanationSchema` constrains the response. A second guard rejects unsupported monetary values, day counts, or percentages.

## Forbidden roles

GPT-5.6 does not:

- calculate proration or round money;
- determine source eligibility or refund status;
- verify provider transactions;
- choose or modify state transitions;
- consume source value or commit ledger entries;
- create a target subscription directly;
- authorize payment, cancellation, refund, or credit;
- receive cookies, API keys, full transaction IDs, or arbitrary uploads.

## Resilience and safety

- model defaults to `gpt-5.6`;
- strict Zod Structured Outputs;
- `store: false`;
- hashed, stable, privacy-preserving `safety_identifier`;
- 15-second abort signal and one retry only for timeout/429/5xx classes;
- maximum three in-flight calls per demo session;
- 10 receipt and 20 explanation attempts per hour/session;
- stale in-flight rows expire after one minute;
- input/output content is never stored; only hashes, model, purpose, status, latency, token counts, schema version, and error code are retained;
- every error, missing key, seeded outage, rate limit, empty output, schema error, and grounding failure falls back to deterministic copy.

## Prompt-injection posture

Only version-controlled images are accepted. Both prompts state that supplied text is data, not instruction. Extracted references must exactly match the selected fixture or they are discarded. Even a fully compromised model response cannot reach the provider or financial state machine because verification uses server-owned scenario data and all mutations re-check session ownership, state, and invariants.

## Testing

Mocked Responses tests assert the model, no-store flag, hashed identifier, JSON schema, base64 image, usage capture, and grounding rejection. Pure tests cover unsupported amounts, durations, percentages, and references. The `ai-unavailable` E2E scenario proves the deterministic flow remains complete.
