import { serveMcp } from "@/lib/mcp/endpoint";

// Fallback for MCP clients that can't attach an Authorization header (e.g. a "no sign-in" custom connector).
// The URL itself is the secret: treat it like a password and revoke the token if it leaks.
async function handler(req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  // The MCP handler serves the canonical /api/mcp path, so forward the request there unchanged otherwise.
  const forwarded = new Request(new URL("/api/mcp", req.url), {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
  });
  return serveMcp(forwarded, `Bearer ${token}`);
}

export { handler as GET, handler as POST, handler as DELETE };
