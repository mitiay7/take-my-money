# Production integration

This repository proves orchestration and boundaries; it is not a shortcut around provider, finance, tax, or legal obligations.

## Required capabilities

1. **Customer identity binding** — authenticate the customer, bind source and target accounts, step up authentication for sensitive changes, and prevent cross-tenant access.
2. **Authoritative source APIs** — verify signed store/provider transactions, history, refund/revocation, grace/billing-retry state, expiry, ownership, and current entitlement.
3. **Entitlement service** — decide the service access attached to source and target products independently of receipts.
4. **Billing catalog** — source of truth for product IDs, prices, currencies, regions, tax inclusion, billing intervals, and availability.
5. **Finance-approved credit policy** — versioned rules for gross/net value, caps, floors, non-portable components, currency conversion, breakage, and liability.
6. **Target checkout/billing** — PCI-scoped provider integration, payment authentication, invoice creation, externally idempotent subscription creation, and webhook confirmation.
7. **Tax and accounting** — jurisdictional tax treatment, credit-note/invoice requirements, deferred revenue, ledger posting, reconciliation, and audit evidence.
8. **Fraud controls** — device/account velocity, replay and receipt abuse, refund loops, chargeback exposure, sanctions, and manual review queues.
9. **Legal terms and consent** — clear portability terms, privacy notice, authorization, refund/cancellation limitations, retention, and evidence of consent.
10. **Cancellation coordination** — provider-supported cancellation where lawful, or explicit customer instructions and later status verification; never silently claim cancellation.
11. **Support tooling** — operation search, sanitized audit, reason codes, safe retry/reconcile, manual review, customer messaging, and escalation.
12. **Reconciliation/accounting** — scheduled lookup of unknown results, webhook replay, provider settlement matching, ledger export, anomaly detection, and close procedures.

## Adapter replacement

- Implement `SourceSubscriptionProvider` against the real provider and map its signed data into the normalized domain contract.
- Implement `TargetBillingProvider` with a durable external idempotency key and authoritative lookup endpoint.
- Keep `billing-core` unchanged unless a finance-approved versioned policy explicitly changes.
- Store provider secrets in managed secret storage; use pooled database connections and TLS.

## Operational rollout

1. Shadow-read real source state without issuing value.
2. Compare deterministic quotes with finance calculations.
3. Exercise definite failure, timeout, duplicate webhook, and reconciliation drills.
4. Launch to internal accounts with manual review.
5. Add bounded cohorts, monitoring, and rollback switches.
6. Expand only after ledger/provider/accounting totals reconcile.

Production SLOs should cover quote latency, provider error class, reconciliation age, duplicate-prevention violations, ledger imbalance, AI fallback rate, and anonymous/identity abuse. AI degradation must never block deterministic billing or change a financial result.
