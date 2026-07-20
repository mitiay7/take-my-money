# Dependencies

Selected on 2026-07-20 from current npm releases. The lockfile is authoritative for transitive versions.

## Runtime

| Package | Version | Purpose |
| --- | ---: | --- |
| `next` | `16.2.10` | App Router web application and API routes |
| `react` | `19.2.7` | UI runtime |
| `react-dom` | `19.2.7` | Web renderer |
| `zod` | `4.4.3` | API and Structured Output validation |
| `openai` | `6.48.0` | Official Responses API JavaScript SDK |
| `drizzle-orm` | `0.45.2` | Typed PostgreSQL access |
| `postgres` | `3.4.9` | PostgreSQL driver for local and hosted databases |
| `lucide-react` | `1.25.0` | Accessible interface icons |
| `clsx` | `2.1.1` | Conditional class composition |
| `tailwind-merge` | `3.6.0` | Tailwind class conflict resolution |

## Development

| Package | Version | Purpose |
| --- | ---: | --- |
| `typescript` | `7.0.2` | Strict static typing |
| `tailwindcss` | `4.3.3` | Design system styling |
| `eslint` | `10.7.0` | Static analysis |
| `eslint-config-next` | `16.2.10` | Next.js lint rules |
| `prettier` | `3.9.5` | Formatting |
| `vitest` | `4.1.10` | Unit and integration tests |
| `@vitejs/plugin-react` | `6.0.3` | React test transformation |
| `jsdom` | `29.1.1` | DOM test runtime |
| `@testing-library/react` | `16.3.2` | Component tests |
| `@playwright/test` | `1.61.1` | Browser E2E and accessibility checks |
| `drizzle-kit` | `0.31.10` | Schema migration tooling |
| `@types/node` | `26.1.1` | Node.js type definitions |
| `@types/react` | `19.2.17` | React type definitions |
| `@types/react-dom` | `19.2.3` | React DOM type definitions |
| `pnpm` | `11.15.1` | Package manager |

## Version notes

- `gpt-5.6` is the required runtime model alias and currently routes to GPT-5.6 Sol.
- Exact versions are pinned in `package.json`; `pnpm-lock.yaml` locks the full graph.
- Significant additions require an entry here and a documented reason.
