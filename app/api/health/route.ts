import { sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { createRequestId, jsonError, jsonOk } from "@/lib/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();
  try {
    await getDatabase().execute(sql`select 1 as healthy`);
    return jsonOk({
      status: "ok",
      database: "reachable",
      aiConfigured: Boolean(process.env.OPENAI_API_KEY && process.env.ENABLE_AI !== "false"),
      model: process.env.OPENAI_MODEL ?? "gpt-5.6",
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
