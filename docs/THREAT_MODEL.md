# Threat model

## Assets

- migration credit integrity and exactly-once source consumption;
- session ownership and operation confidentiality;
- provider/idempotency identifiers;
- OpenAI and database credentials;
- audit/ledger correctness;
- public demo availability and cost controls.

## Actors

- normal contest judge;
- curious or malicious anonymous visitor;
- concurrent/retrying browser;
- compromised or unavailable AI output;
- failing/ambiguous provider;
- operator with deployment access.

## Trust boundaries

Browser input crosses into Next.js route handlers. Route handlers cross into PostgreSQL, OpenAI, and provider ports. Receipt image content is untrusted even though the file path is server-selected. Provider output becomes authoritative only after normalization and policy checks. Consumer and system read models cross back to the browser only after ownership and redaction.

## Abuse cases and controls

| Threat                             | Primary controls                                                                                | Residual risk                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Forge or steal session             | HMAC-signed HTTP-only SameSite cookie, expiry, per-row ownership                                | Host compromise can sign sessions                       |
| Cross-site mutation                | CSRF token bound to session, strict content contracts                                           | Browser/platform bugs                                   |
| Upload malicious/PII receipt       | No public upload; allowlisted local assets only                                                 | Maintainer could commit unsafe fixture                  |
| Prompt injection in image/text     | Data-only prompts, schema validation, reference constraint, AI has no mutation authority        | Misleading unverified display before provider check     |
| Hallucinated financial explanation | Server facts only, numerical grounding, deterministic fallback                                  | Non-numeric wording may still be imperfect              |
| Duplicate credit from retry/race   | Advisory locks, state versions, partial unique indexes, source consume CAS, idempotency records | Production needs cross-system reconciliation            |
| Provider timeout after success     | `RECONCILIATION_REQUIRED`; lookup by original external idempotency key                          | Provider without idempotent lookup is unsuitable        |
| Quote tampering or staleness       | Server-owned quote, fingerprint, expiry, ownership/state revalidation                           | Clock/database outage blocks operation                  |
| Secret leakage                     | Server-only env, no `NEXT_PUBLIC_*`, redacted logs and read models, no AI content persistence   | Deployment operator access                              |
| AI cost abuse                      | Synthetic assets, PostgreSQL hourly/concurrency limits, timeout, bounded retry                  | Distributed attacker can create many anonymous sessions |
| SQL/injection attacks              | Zod input, Drizzle parameters, no user-built SQL                                                | ORM/runtime vulnerability                               |
| Audit/ledger modification          | No update/delete repository APIs, append-only behavior, ordered sequence constraint             | DB administrator can alter rows                         |
| Demo data accumulation             | Reset cascade and session expiry metadata                                                       | Scheduled retention job not implemented                 |

## Residual production risks

A real system must add authenticated identity, signed provider payload verification, fraud scoring, per-account/global cost limits, key rotation, WAF controls, retention deletion, tamper-evident audit export, operational reconciliation, finance/accounting controls, incident response, and legal/privacy review.
