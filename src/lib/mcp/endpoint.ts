import "server-only";
import { createMcpHandler } from "mcp-handler";
import { registerTools } from "./tools";
import { verifyBearer } from "./auth";
import { getOwnerId } from "./owner";
import { createAdminClient } from "@/lib/supabase/admin";

const serverInfo = { serverInfo: { name: "assistant-dashboard", version: "1.1.0" } };
const mcpFull = createMcpHandler((s) => registerTools(s, "full"), serverInfo);
// Read-scoped tokens get a server where write tools are never registered, so they can't be called.
const mcpRead = createMcpHandler((s) => registerTools(s, "read"), serverInfo);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// Shared by /api/mcp (Authorization header) and /api/mcp/t/<token> (token in the URL, for clients that can't send headers).
export async function serveMcp(req: Request, authorization: string | null): Promise<Response> {
  const admin = createAdminClient();
  const owner = await getOwnerId(admin);
  if (!owner.ok) return json(500, { ok: false, error: owner.error });
  const auth = await verifyBearer(admin, authorization, owner.value);
  if (!auth.ok) {
    if (auth.error === "AUTH_LOOKUP_FAILED") return json(500, { ok: false, error: auth.error });
    return new Response(JSON.stringify({ ok: false, error: auth.error }), {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="assistant-dashboard"' },
    });
  }
  return auth.value.scope === "read" ? mcpRead(req) : mcpFull(req);
}
