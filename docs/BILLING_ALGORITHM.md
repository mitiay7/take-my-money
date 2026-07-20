# Billing algorithm

## Rule

All money is integer minor units (`bigint`). All time is exact UTC milliseconds. Floating point never enters a financial calculation.

```text
periodMs    = periodEndUtc - periodStartUtc
remainingMs = clamp(periodEndUtc - evaluationTimeUtc, 0, periodMs)

creditMinor = roundHalfUp(sourceValueMinor × remainingMs / periodMs)
creditMinor = apply policy floor and cap
appliedMinor = min(creditMinor, targetPriceMinor)
amountDueMinor = targetPriceMinor - appliedMinor
carryForwardMinor = creditMinor - appliedMinor
```

HALF_UP for a non-negative fraction `numerator / denominator` is implemented as:

```text
(2 × numerator + denominator) / (2 × denominator)
```

using integer division.

## Default fixture

```text
source value:       2499 EUR minor units
paid period:        31 exact days
remaining period:   19 exact days
unrounded credit:   2499 × 19 / 31 = 1531.645...
HALF_UP credit:     1532 = EUR 15.32
target price:       22900 = EUR 229.00
amount due:         22900 - 1532 = 21368 = EUR 213.68
```

The persisted reduced ratio is `19/31`. A fixed evaluation instant (`2026-07-19T00:00:00.000Z`) keeps screenshots and tests stable.

## Policy

The demo policy is `demo-gross-portability@1.0.0`:

- gross paid value is portable in the sandbox;
- source must be verified, active, inside its paid period, and unconsumed;
- refunded, expired, revoked, or already-consumed value is blocked;
- billing retry requires manual review;
- credit cannot become negative;
- credit above target price becomes explicit carry-forward rather than disappearing.

The policy and algorithm versions are persisted with the full calculation snapshot and quote fingerprint.

## Invariants

- `0 ≤ remainingMs ≤ periodMs`
- `0 ≤ migrationCreditMinor`
- `creditAppliedMinor ≤ targetPriceMinor`
- `amountDueMinor + creditAppliedMinor = targetPriceMinor`
- `creditAppliedMinor + carryForwardMinor = migrationCreditMinor`
- one immutable quote per operation
- one committed credit per operation and ledger type
- one source can reach a consumed/committed/completed state once
- replaying an idempotency key returns the stored response

Database checks and unique/partial indexes reinforce domain checks. PostgreSQL advisory locks serialize competing confirmations; provider idempotency handles retries outside the database transaction.
