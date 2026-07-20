import { BillingDomainError } from "./errors";

export function assertNonNegativeMinorUnits(value: bigint, label: string): void {
  if (value < 0n) {
    throw new BillingDomainError("INVALID_MONEY", `${label} must be non-negative`);
  }
}

export function divideAndRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new BillingDomainError("INVALID_MONEY", "Invalid non-negative rounding input");
  }

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;

  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

export function formatMinorUnits(amountMinor: bigint, currency: string): string {
  assertNonNegativeMinorUnits(amountMinor, "amountMinor");
  const major = amountMinor / 100n;
  const minor = (amountMinor % 100n).toString().padStart(2, "0");
  return `${currency.toUpperCase()} ${major}.${minor}`;
}
