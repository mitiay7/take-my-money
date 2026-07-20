# Codex build log

## Session

- Started: 2026-07-20 (Europe/Riga)
- Primary implementation: Codex with GPT-5.6
- Final `/feedback` Session ID: pending contest submission

## Initial decisions

- Accepted the complete P0 scope from `SPEC.md` without reducing the product to a static calculator.
- Kept all monetary calculations, eligibility, state transitions, and authorization outside the LLM boundary.
- Selected Next.js, strict TypeScript, Drizzle/PostgreSQL, Vitest, Playwright, and Vercel.
- Selected the OpenAI Responses API with Zod Structured Outputs and local deterministic fallbacks.

## Documentation research

- Confirmed `gpt-5.6` aliases GPT-5.6 Sol and supports image input and Structured Outputs.
- Confirmed current JavaScript SDK patterns: `responses.parse`, `zodTextFormat`, base64 `input_image`, and `reasoning.effort`.
- Confirmed safety guidance: trusted constrained inputs, prompt-injection testing, explicit limitations, and stable privacy-preserving safety identifiers.

## Milestone log

- Milestone 0 completed: repository rules, live plan, exact dependencies, official documentation review, responsive application shell, CI, local PostgreSQL, and security headers.
- Rejected TypeScript 7 and ESLint 10 after peer checks showed incompatibility with the current Next.js lint stack; pinned the latest supported releases.
- Milestone 0 checks passed: formatting, strict typecheck, ESLint with zero warnings, Vitest, and the Next.js production build.
- Milestone 1 completed: isolated bigint billing core, UTC rational proration, HALF_UP rounding, policy controls, eligibility engine, state machine, bigint serialization, and 35 domain tests.
- Playwright accessibility smoke test found and fixed an invalid ARIA label on the example timeline.
- Milestone 2 completed: 10-table PostgreSQL schema, committed Drizzle migration, idempotent target-plan seed, session/source/operation/quote/ledger/audit/idempotency repositories, and real-PostgreSQL integration tests.
- Database migration and seed were applied twice successfully; repository suite verifies ownership isolation, optimistic state versions, immutable quotes, append-only ledger uniqueness, ordered audits, and idempotency replay storage.
- Milestone 3 completed: source and target provider contracts, nine required synthetic scenarios, stable privacy-preserving fingerprints, saga reservations, external idempotency, definite-failure compensation, retry, unknown-result reconciliation, and source-consumption locking.
- Integration suite now proves same-key replay, mismatched-payload conflict, exactly-one concurrent confirmation, same-key retry after definite failure, reconciliation completion, quote expiry, quote fingerprint protection, and deterministic blocked/manual-review states.
- PostgreSQL timestamp strings exposed a format boundary mismatch; fixed by normalizing `timestamptz` values to ISO UTC before calling the strict domain core.
- Milestone 4 completed: signed anonymous sessions, CSRF-protected JSON API, receipt-to-result consumer flow, blocked/manual decisions, consent, result sharing, and sanitized technical audit.
- Parallel desktop/mobile E2E exposed an invalid global unique constraint on deterministic quote fingerprints; fingerprints are now indexed but may repeat across independent operations.
- Axe found invalid description-list markup in the technical view; corrected the semantic containers and verified the complete flow at desktop and mobile widths.
- Milestone 5 completed: GPT-5.6 Responses API vision extraction, Zod Structured Outputs, grounded quote explanations, hashed safety identifiers, no-store requests, bounded retry/timeout, database-enforced usage limits, and honest deterministic fallback states.
- Mocked Responses tests verify base64 image input, structured-output configuration, usage capture, and rejection of invented financial values. Pure grounding tests reject unsupported amounts, durations, percentages, and lookup references.
- Milestone 6 completed: consumer/system documentation set, architecture and saga diagrams, billing proof, AI boundary, threat model, production integration plan, testing guide, submission copy, video plan, and final screenshot assets.
- Browser visual QA found an AI-status badge mounted in the previous step and mobile summary ordered before the task content; both were corrected. Desktop, 390 px mobile, result, and system-audit views were inspected with no browser console errors.
- Milestone 7 completed: Neon PostgreSQL provisioned in Frankfurt, migrations and seed applied, Vercel functions deployed in `fra1`, production health confirmed, and the public flow verified on desktop and mobile.
- The production release passed all 57 Vitest checks, all 8 desktop/mobile Playwright checks, Axe scans, a clean visual browser pass, and GitHub Actions.
- Public demo: https://take-my-money-psi.vercel.app
- Live GPT-5.6 activation remains a deployer-owned release step because no `OPENAI_API_KEY` was available; production exposes the explicit deterministic fallback until that server-side secret is configured.
