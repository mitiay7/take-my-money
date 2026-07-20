# Dependencies

Selected on 2026-07-20 from current npm releases. The lockfile is authoritative for transitive versions.

## Runtime

| Package          |   Version | Purpose                                          |
| ---------------- | --------: | ------------------------------------------------ |
| `next`           | `16.2.10` | App Router web application and API routes        |
| `react`          |  `19.2.7` | UI runtime                                       |
| `react-dom`      |  `19.2.7` | Web renderer                                     |
| `zod`            |   `4.4.3` | API and Structured Output validation             |
| `openai`         |  `6.48.0` | Official Responses API JavaScript SDK            |
| `drizzle-orm`    |  `0.45.2` | Typed PostgreSQL access                          |
| `postgres`       |   `3.4.9` | PostgreSQL driver for local and hosted databases |
| `lucide-react`   |  `1.25.0` | Accessible interface icons                       |
| `clsx`           |   `2.1.1` | Conditional class composition                    |
| `tailwind-merge` |   `3.6.0` | Tailwind class conflict resolution               |

## Development

| Package                     |   Version | Purpose                                                       |
| --------------------------- | --------: | ------------------------------------------------------------- |
| `typescript`                |   `6.0.3` | Latest release supported by the selected Next.js lint stack   |
| `tailwindcss`               |   `4.3.3` | Design system styling                                         |
| `eslint`                    |  `9.39.5` | Latest release supported by `eslint-config-next` dependencies |
| `eslint-config-next`        | `16.2.10` | Next.js lint rules                                            |
| `prettier`                  |   `3.9.5` | Formatting                                                    |
| `vitest`                    |  `4.1.10` | Unit and integration tests                                    |
| `@vitejs/plugin-react`      |   `6.0.3` | React test transformation                                     |
| `jsdom`                     |  `29.1.1` | DOM test runtime                                              |
| `@testing-library/react`    |  `16.3.2` | Component tests                                               |
| `@testing-library/jest-dom` |   `6.9.1` | Accessible DOM assertions                                     |
| `@playwright/test`          |  `1.61.1` | Browser E2E and accessibility checks                          |
| `@axe-core/playwright`      |  `4.12.1` | Automated WCAG checks in browser tests                        |
| `@tailwindcss/postcss`      |   `4.3.3` | Tailwind PostCSS integration                                  |
| `drizzle-kit`               | `0.31.10` | Schema migration tooling                                      |
| `@types/node`               |  `26.1.1` | Node.js type definitions                                      |
| `@types/react`              | `19.2.17` | React type definitions                                        |
| `@types/react-dom`          |  `19.2.3` | React DOM type definitions                                    |
| `tsx`                       |  `4.23.1` | TypeScript database scripts                                   |
| `dotenv`                    |  `17.4.2` | Local database command environment loading                    |
| `pnpm`                      | `11.15.1` | Package manager                                               |

## Version notes

- `gpt-5.6` is the required runtime model alias and currently routes to GPT-5.6 Sol.
- TypeScript 7 and ESLint 10 were evaluated but rejected because selected Next.js lint dependencies do not yet declare compatible peer ranges.
- Exact versions are pinned in `package.json`; `pnpm-lock.yaml` locks the full graph.
- Significant additions require an entry here and a documented reason.
