import { serveMcp } from "@/lib/mcp/endpoint";

async function handler(req: Request): Promise<Response> {
  return serveMcp(req, req.headers.get("authorization"));
}

export { handler as GET, handler as POST, handler as DELETE };
