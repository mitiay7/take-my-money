import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { DemoSessionRow } from "@/db/schema";
import { getDatabase } from "@/lib/db/client";
import { AuditRepository } from "@/lib/repositories/audit-repository";
import { SessionRepository } from "@/lib/repositories/session-repository";

const COOKIE_NAME = "tmm_session";

function signingSecret(): string {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SIGNING_SECRET must contain at least 32 characters");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function encodeSession(publicId: string): string {
  return `${publicId}.${sign(`session:${publicId}`)}`;
}

function decodeSession(value: string | undefined): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const publicId = value.slice(0, separator);
  const provided = Buffer.from(value.slice(separator + 1));
  const expected = Buffer.from(sign(`session:${publicId}`));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  return publicId;
}

export function csrfTokenFor(session: DemoSessionRow): string {
  return sign(`csrf:${session.publicId}`);
}

export async function readSession(): Promise<DemoSessionRow | null> {
  const cookieStore = await cookies();
  const publicId = decodeSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!publicId) return null;
  const session = await new SessionRepository(getDatabase()).findByPublicId(publicId);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  return session;
}

export async function requireSession(): Promise<DemoSessionRow> {
  const session = await readSession();
  if (!session) throw new SessionRequiredError();
  return session;
}

export async function createOrReuseSession(requestId: string): Promise<DemoSessionRow> {
  const existing = await readSession();
  if (existing) {
    await new SessionRepository(getDatabase()).touch(existing.id);
    return existing;
  }

  const session = await new SessionRepository(getDatabase()).create();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encodeSession(session.publicId), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  await new AuditRepository(getDatabase()).append({
    operationId: null,
    demoSessionId: session.id,
    eventType: "SESSION_CREATED",
    actorType: "SYSTEM",
    requestId,
    metadata: {},
  });
  return session;
}

export function verifyCsrf(request: Request, session: DemoSessionRow): boolean {
  const provided = request.headers.get("x-csrf-token");
  if (!provided) return false;
  const expected = csrfTokenFor(session);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export class SessionRequiredError extends Error {
  constructor() {
    super("A valid demo session is required");
    this.name = "SessionRequiredError";
  }
}
