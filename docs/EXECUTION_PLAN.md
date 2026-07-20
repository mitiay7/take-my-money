# Execution plan

Last updated: 2026-07-20

## Decisions

- Next.js App Router with strict TypeScript and Tailwind CSS.
- Framework-independent `packages/billing-core` with bigint-only monetary arithmetic.
- PostgreSQL through Drizzle repositories; sandbox adapters behind provider contracts.
- OpenAI Responses API with GPT-5.6 and Zod Structured Outputs; deterministic fallback always available.
- Anonymous signed demo session; only synthetic receipt assets in public mode.
- Vercel production deployment; managed PostgreSQL selected during deployment.

## Risks

- Hosted PostgreSQL provisioning may require an interactive Vercel Marketplace step.
- Live GPT-5.6 calls require a valid `OPENAI_API_KEY`; all contest flows must still work without it.
- Serverless concurrency semantics must be backed by database constraints and locks, not process memory.
- E2E tests must remain deterministic despite quote expiry and fixture clocks.

## Milestones

- [x] Milestone 0 - repository, planning, scaffold, CI, environment
- [ ] Milestone 1 - deterministic billing core, eligibility, state machine, tests
- [ ] Milestone 2 - PostgreSQL schema, migrations, seed, repositories, integration tests
- [ ] Milestone 3 - sandbox providers, saga, idempotency, concurrency, reconciliation
- [ ] Milestone 4 - complete responsive consumer flow
- [ ] Milestone 5 - GPT-5.6 receipt extraction, explanation, grounding, fallback
- [ ] Milestone 6 - system view and complete documentation
- [ ] Milestone 7 - E2E, accessibility, polish, deployment, external verification

## Live quality gate

- [x] `pnpm format:check`
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [ ] `pnpm test:e2e`
- [x] `pnpm build`
- [ ] Desktop visual QA
- [ ] 390 px mobile visual QA
- [ ] Public URL checked from a clean session
