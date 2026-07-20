import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { ApplicationError } from "@/lib/application/errors";
import { SessionRequiredError } from "@/lib/auth/session";

export function createRequestId(): string {
  return `req_${randomUUID()}`;
}

export function jsonOk(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function jsonError(error: unknown, requestId: string): Response {
  if (error instanceof ApplicationError) {
    return errorResponse(error.code, error.message, error.httpStatus, error.retryable, requestId);
  }
  if (error instanceof SessionRequiredError) {
    return errorResponse("SESSION_REQUIRED", error.message, 401, true, requestId);
  }
  if (error instanceof ZodError) {
    return errorResponse("INVALID_REQUEST", "Request validation failed", 400, false, requestId, {
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  console.error(
    JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      service: "take-my-money",
      event: "UNHANDLED_API_ERROR",
      requestId,
      errorCode: error instanceof Error ? error.name : "UNKNOWN",
    }),
  );
  return errorResponse(
    "INTERNAL_ERROR",
    "The demo could not complete this request.",
    500,
    true,
    requestId,
  );
}

export function csrfError(requestId: string): Response {
  return errorResponse(
    "CSRF_TOKEN_INVALID",
    "Refresh the demo and try again.",
    403,
    true,
    requestId,
  );
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  retryable: boolean,
  requestId: string,
  details: Record<string, unknown> = {},
): Response {
  return jsonOk(
    {
      error: {
        code,
        message,
        userMessage: message,
        retryable,
        requestId,
        details,
      },
    },
    status,
  );
}
