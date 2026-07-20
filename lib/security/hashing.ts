import { createHash } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sourceFingerprint(provider: string, originalTransactionId: string): string {
  return sha256(`${provider}:${originalTransactionId}`);
}

export function safetyIdentifier(demoSessionPublicId: string): string {
  return sha256(`take-my-money:${demoSessionPublicId}`);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
