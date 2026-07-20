# AGENTS.md

## Mission
Build and maintain Take my money, a contest-ready subscription-portability sandbox. The complete product requirements are in SPEC.md. P0 requirements are mandatory.

## Non-negotiable domain rules
- Never use an LLM for money arithmetic, eligibility, state transitions, or credit authorization.
- Represent money as bigint minor units in the domain layer and decimal strings in JSON.
- Use UTC epoch-duration arithmetic for proration.
- Never trust prices, amounts, statuses, or timestamps from the client.
- A receipt is evidence, not provider verification.
- Never issue a migration credit twice for the same source fingerprint.
- Keep ledger and audit records append-only.
- Preserve idempotency and concurrency guarantees.
- Public demo data must be synthetic.
- Never claim to perform a real refund, cancellation, payment, or ChatGPT plan change.

## Architecture
- Domain packages must not import Next.js, React, database, provider SDK, or OpenAI SDK code.
- Validate all API boundaries with Zod.
- Keep external integrations behind interfaces.
- Server components by default; client components only when interaction requires them.
- No secret may use a `NEXT_PUBLIC_` environment variable.

## Quality gate
After material changes run:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

Before marking a milestone complete run:
- `pnpm test:e2e`
- `pnpm build`

Do not continue while a required check fails.

## Product quality
- No placeholder buttons, fake actions, dead routes, TODO user flows, or misleading success states.
- Every async action needs loading, success, error, and retry behavior.
- Preserve accessibility and responsive behavior.
- Keep consumer UI polished; put technical detail in the system view.

## Documentation
- Update README and relevant docs when behavior changes.
- Record significant decisions and Codex contributions in `docs/CODEX_BUILD_LOG.md`.
- Keep `docs/EXECUTION_PLAN.md` current.
