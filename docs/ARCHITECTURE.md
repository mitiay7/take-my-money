# Architecture

## System context

```mermaid
flowchart LR
  Judge["Contest judge"] -->|HTTPS| App["Take my money"]
  App -->|Structured vision + text| OpenAI["OpenAI Responses API"]
  App -->|SQL/TLS| Postgres[("Managed PostgreSQL")]
  App -->|Provider contract| Source["Synthetic source provider"]
  App -->|Idempotent contract| Target["Synthetic target billing"]
```

Source and target providers are in-process sandbox adapters in the public prototype. Their interfaces mark the boundary where authoritative production systems would connect.

## Component view

```mermaid
flowchart TB
  UI["App Router consumer UI"] --> API["CSRF-protected route handlers"]
  API --> Session["Signed anonymous session"]
  API --> Rebase["RebaseService"]
  API --> AIRuntime["OpenAI runtime"]
  AIRuntime --> Schema["Zod Structured Outputs"]
  Schema --> Ground["Reference + numeric grounding"]
  Rebase --> Core["@take-my-money/billing-core"]
  Rebase --> SourcePort["SourceSubscriptionProvider"]
  Rebase --> TargetPort["TargetBillingProvider"]
  Rebase --> Repos["Drizzle repositories"]
  AIRuntime --> AIRepo["AI interaction repository"]
  Repos --> DB[("PostgreSQL")]
  AIRepo --> DB
```

`billing-core` has no React, Next.js, database, provider, or OpenAI dependency. It owns money, UTC duration, eligibility, policy, rounding, and legal state transitions.

## Data flow

1. A signed anonymous session selects one of nine fixed scenarios.
2. The server maps a trusted receipt asset ID to a version-controlled PNG.
3. GPT-5.6 returns schema-validated but explicitly unverified evidence; fallback returns the same contract.
4. The source adapter returns an authoritative normalized subscription snapshot.
5. The domain core evaluates eligibility and computes a bigint quote from immutable inputs.
6. The customer accepts three explicit sandbox consents.
7. The saga reserves credit, consumes the source exactly once, makes an externally idempotent target call, then commits or releases ledger value.
8. Consumer and technical read models expose only session-owned, sanitized data.

## Provider boundaries

`SourceSubscriptionProvider` verifies and refreshes source state. `TargetBillingProvider` creates or looks up a target result using a stable external idempotency key. Provider-specific identifiers never enter the consumer response in full. Sandbox transaction identity is namespaced per demo session so judges can run concurrently; production adapters would use true provider transaction identity.

## AI boundary

```mermaid
flowchart LR
  PNG["Trusted synthetic PNG"] --> Vision["GPT-5.6 vision"]
  Vision --> ReceiptSchema["Receipt Zod schema"]
  ReceiptSchema --> Unverified["Unverified display only"]
  Verified["Server-verified quote facts"] --> Explain["GPT-5.6 explanation"]
  Explain --> ExplanationSchema["Explanation Zod schema"]
  ExplanationSchema --> NumericGuard["Numeric grounding guard"]
  NumericGuard --> Display["Customer explanation"]
  Core["Eligibility + money + state"] -. never delegated .-> AIBlocked["No LLM control"]
```

## Migration saga

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Next.js API
  participant D as Domain core
  participant P as PostgreSQL
  participant T as Target adapter

  B->>A: Confirm quote + consent + Idempotency-Key
  A->>P: advisory lock(operation)
  A->>P: validate quote fingerprint and expiry
  A->>P: append CREDIT_RESERVED
  A->>P: consume source if unconsumed
  A->>T: createTarget(idempotency key)
  alt success
    T-->>A: target subscription
    A->>P: append CREDIT_ISSUED + CREDIT_APPLIED
    A->>P: state COMPLETED + store replay response
  else definite failure
    T-->>A: failed
    A->>P: append CREDIT_RELEASED
    A->>P: state TARGET_CREATION_FAILED
  else unknown result
    T--xA: timeout / unknown
    A->>P: state RECONCILIATION_REQUIRED
    A->>T: later lookup by same idempotency key
    T-->>A: authoritative result
    A->>P: finish once
  end
```

## Deployment

```mermaid
flowchart LR
  Browser["Browser"] --> Edge["Vercel HTTPS / CDN"]
  Edge --> Next["Next.js server functions"]
  Next --> Neon[("Managed PostgreSQL / pooled URL")]
  Next --> OpenAI["OpenAI Responses API"]
  GitHub["GitHub main"] --> CI["GitHub Actions"]
  GitHub --> Vercel["Vercel build"]
  CI --> Tests["Format · types · lint · Vitest · build · Playwright"]
```

Migrations and seed run as an explicit release step against managed PostgreSQL, not during concurrent serverless builds.
