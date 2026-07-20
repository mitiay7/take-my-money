# Testing

## Test layers

- `packages/billing-core/tests`: bigint money, HALF_UP boundaries, UTC durations, policy caps/floors, eligibility, and legal state transitions.
- `tests/unit`: AI schemas/runtime contract, image request construction, usage capture, reference constraint, and numerical grounding.
- `tests/integration`: real PostgreSQL repositories, ownership, immutable quotes, append-only ledger, idempotency, locks, concurrency, saga compensation/retry, reconciliation, and AI usage limits.
- `tests/e2e`: consumer completion and blocked paths on desktop and mobile Chromium; Axe scans landing and system audit.

## Local commands

```bash
docker compose up -d db
pnpm db:migrate
pnpm db:seed
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

Vitest loads `.env.local`; integration tests truncate only the configured test/demo database. Do not point tests at production.

## Determinism

Billing fixtures use fixed UTC evaluation times. OpenAI unit tests inject a mocked Responses client; default E2E sets `ENABLE_AI=false`, so CI never needs an API key or variable model output. Live AI is verified separately against a non-production project key before release.

## CI

GitHub Actions starts PostgreSQL 17, installs the frozen pnpm lockfile, runs formatting, lint, strict TypeScript, migrations, seed, Vitest, production build, installs Chromium, and executes desktop E2E. Local release verification additionally runs the mobile project.
