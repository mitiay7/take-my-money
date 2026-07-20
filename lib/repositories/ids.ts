import { randomBytes, randomUUID } from "node:crypto";

export function createUuid(): string {
  return randomUUID();
}

export function createPublicId(prefix: "dms" | "op" | "qt"): string {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}
