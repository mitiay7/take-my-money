# Submission checklist

## Product

- [x] Landing explains the problem and solution without sign-in.
- [x] Synthetic evidence is explicit; arbitrary upload is disabled.
- [x] Default 19/31 scenario yields EUR 15.32 credit and EUR 213.68 due.
- [x] Eligible, blocked, manual-review, AI-outage, excess-credit, and unknown-result scenarios exist.
- [x] Consent, result, reset, share/copy, JSON export, and system audit controls work.
- [x] No real payment, refund, cancellation, or account change is claimed.

## Engineering

- [x] Bigint money, exact UTC duration, HALF_UP rounding, immutable quote.
- [x] Source verification, exactly-once consumption, idempotent target call, saga, reconciliation.
- [x] Append-only ledger and ordered audit.
- [x] Signed session, CSRF, ownership checks, redaction, security headers.
- [x] GPT-5.6 Responses API, image input, Structured Outputs, safety identifier, grounding.
- [x] Honest fallback, timeout/retry, database rate and concurrency limits.
- [x] Unit, real-PostgreSQL integration, concurrency, desktop/mobile E2E, and Axe tests.
- [x] Production build passes.

## Documentation and assets

- [x] README, architecture, billing, AI, threat, production, testing docs.
- [x] Short/long descriptions and demo-video script.
- [x] Codex build log and final `/feedback` placeholder.
- [x] Final desktop and mobile screenshots committed.
- [x] Public demo URL added to README and submission copy.
- [ ] Demo video recorded and uploaded.

## Release

- [x] Public GitHub repository on `main`.
- [x] Managed PostgreSQL provisioned; migrations and seed applied.
- [x] Vercel production variables configured; no secret exposed.
- [ ] Live GPT-5.6 path verified with a project API key.
- [x] Public deployment tested from clean desktop and mobile sessions.
- [x] GitHub Actions green at release commit.
- [ ] Contest form submitted and `/feedback` Session ID recorded.
