import { createOrReuseSession, csrfTokenFor } from "@/lib/auth/session";
import { createRequestId, jsonError, jsonOk } from "@/lib/http/responses";

export const dynamic = "force-dynamic";

export async function POST() {
  const requestId = createRequestId();
  try {
    const session = await createOrReuseSession(requestId);
    return jsonOk({
      session: { publicId: session.publicId, expiresAt: new Date(session.expiresAt).toISOString() },
      csrfToken: csrfTokenFor(session),
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
