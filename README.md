# Take my money

> Upgrade now. Keep every paid day.

Take my money is a subscription-portability sandbox for the OpenAI Build Week Challenge. It demonstrates how unused value from an active mobile-billed subscription can become a controlled, one-time credit for a new direct plan.

The application uses only synthetic receipts, provider records, subscriptions, prices, and billing operations. It does not perform real payments, refunds, cancellations, transfers, or account changes.

## Status

Active implementation. See [`docs/EXECUTION_PLAN.md`](docs/EXECUTION_PLAN.md) for the live milestone checklist and [`SPEC.md`](SPEC.md) for complete product requirements.

## Local development

```bash
pnpm install
cp .env.example .env.local
docker compose up -d db
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Quality checks

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

## AI boundary

GPT-5.6 extracts unverified evidence from a built-in synthetic receipt and explains already verified deterministic facts. It never calculates money, decides eligibility, authorizes credits, changes state, or executes transactions. The complete demo remains usable without an OpenAI API key.

## License

[MIT](LICENSE)

## Disclaimer

Take my money is an independent sandbox prototype created for the OpenAI Build Week Challenge. It is not an official OpenAI, ChatGPT, Apple, App Store, or payment-provider product. It does not access real subscriptions, issue refunds, cancel renewals, charge payment methods, or modify real account plans. All receipts, transactions, prices, providers, and billing operations shown in the public demo are synthetic or illustrative.
