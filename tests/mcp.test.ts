import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ownerContext, TEST_SOURCE } from "./helpers";
import { generateRawToken, hashToken } from "@/lib/tokens";
import { TOOL_NAMES, READ_TOOL_NAMES } from "@/lib/mcp/tools";
import { POST } from "@/app/api/mcp/route";
import { POST as POST_PATH } from "@/app/api/mcp/t/[token]/route";

let ctx: Awaited<ReturnType<typeof ownerContext>>;
const valid = generateRawToken();
const revoked = generateRawToken();
const readOnly = generateRawToken();
const tokenIds: string[] = [];
const createdTaskIds: string[] = [];

function rpc(method: string, params: Record<string, unknown>, token?: string, id = 1): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2025-06-18",
  };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/mcp", { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
}

// Responses may be plain JSON or a single SSE "data:" frame depending on negotiation.
async function body(res: Response): Promise<{ result?: { tools?: { name: string }[]; content?: { text: string }[]; isError?: boolean }; error?: unknown }> {
  const text = await res.text();
  const json = text.trimStart().startsWith("{") ? text : text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5)).join("");
  return JSON.parse(json);
}

beforeAll(async () => {
  ctx = await ownerContext();
  const rows = [
    { user_id: ctx.uid, name: "vitest valid", scope: "full", token_hash: hashToken(valid) },
    { user_id: ctx.uid, name: "vitest revoked", scope: "full", token_hash: hashToken(revoked), revoked_at: new Date().toISOString() },
    { user_id: ctx.uid, name: "vitest read-only", token_hash: hashToken(readOnly), scope: "read" },
  ];
  const { data, error } = await ctx.admin.from("api_tokens").insert(rows).select("id");
  if (error || !data) throw new Error(`token seed failed: ${error?.message ?? "no data"}`);
  tokenIds.push(...data.map((d) => d.id));
});

afterAll(async () => {
  if (createdTaskIds.length) {
    await ctx.admin.from("tasks").delete().in("id", createdTaskIds);
    await ctx.admin.from("activity").delete().in("ref_id", createdTaskIds);
  }
  await ctx.admin.from("api_tokens").delete().in("id", tokenIds);
});

describe("MCP endpoint auth", () => {
  it("rejects a request with no token", async () => {
    const res = await POST(rpc("tools/list", {}));
    expect(res.status).toBe(401);
  });

  it("rejects an unknown token", async () => {
    const res = await POST(rpc("tools/list", {}, generateRawToken()));
    expect(res.status).toBe(401);
  });

  it("rejects a revoked token", async () => {
    const res = await POST(rpc("tools/list", {}, revoked));
    expect(res.status).toBe(401);
  });

  it("rejects a non-Bearer scheme", async () => {
    const req = new Request("http://localhost/api/mcp", { method: "POST", headers: { authorization: `Basic ${valid}` }, body: "{}" });
    expect((await POST(req)).status).toBe(401);
  });

  it("accepts a valid token, lists every tool, and records last_used_at", async () => {
    const res = await POST(rpc("tools/list", {}, valid));
    expect(res.status).toBe(200);
    const names = ((await body(res)).result?.tools ?? []).map((t) => t.name).sort();
    expect(names).toEqual([...TOOL_NAMES].sort());
    const tok = await ctx.admin.from("api_tokens").select("last_used_at").eq("id", tokenIds[0]).single();
    expect(tok.data?.last_used_at).not.toBeNull();
  });

  it("task_create then tasks_list round-trips and logs activity", async () => {
    const title = `vitest task ${Date.now()}`;
    const created = await body(await POST(rpc("tools/call", { name: "task_create", arguments: { title, priority: "high", source: TEST_SOURCE } }, valid, 2)));
    expect(created.result?.isError).not.toBe(true);
    const task = JSON.parse(created.result?.content?.[0]?.text ?? "{}") as { id?: string };
    expect(task.id).toBeTruthy();
    if (task.id) createdTaskIds.push(task.id);

    const listed = await body(await POST(rpc("tools/call", { name: "tasks_list", arguments: { filter: "open" } }, valid, 3)));
    const rows = JSON.parse(listed.result?.content?.[0]?.text ?? "[]") as { id: string; title: string }[];
    expect(rows.some((r) => r.id === task.id && r.title === title)).toBe(true);

    const act = await ctx.admin.from("activity").select("actor,action").eq("ref_id", task.id ?? "").single();
    expect(act.data).toEqual({ actor: "assistant", action: "Created task" });
  });

  it("returns a typed error (not a stack trace) for invalid input", async () => {
    const r = await body(await POST(rpc("tools/call", { name: "task_complete", arguments: { id: "not-a-uuid" } }, valid, 4)));
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/at .*\.ts:\d+/);
    expect(r.result?.isError === true || r.error !== undefined).toBe(true);
  });
});

describe("MCP token-in-URL fallback", () => {
  const call = (token: string) =>
    POST_PATH(rpc("tools/list", {}), { params: Promise.resolve({ token }) });

  it("rejects an unknown token in the URL", async () => {
    expect((await call(generateRawToken())).status).toBe(401);
  });

  it("rejects a revoked token in the URL", async () => {
    expect((await call(revoked)).status).toBe(401);
  });

  it("accepts a valid token in the URL and lists every tool", async () => {
    const res = await call(valid);
    expect(res.status).toBe(200);
    const names = ((await body(res)).result?.tools ?? []).map((t) => t.name).sort();
    expect(names).toEqual([...TOOL_NAMES].sort());
  });
});

// Specialists (Due Diligence) get read-only tokens: the Library must stay writable only by the Assistant,
// so write tools must be absent from the server, not merely discouraged in a prompt.
describe("MCP read-only token scope", () => {
  it("lists only read tools", async () => {
    const res = await POST(rpc("tools/list", {}, readOnly));
    expect(res.status).toBe(200);
    const names = ((await body(res)).result?.tools ?? []).map((t) => t.name).sort();
    expect(names).toEqual([...READ_TOOL_NAMES].sort());
    expect(names).not.toContain("document_create");
  });

  it("cannot call a write tool and creates nothing", async () => {
    const title = `vitest readonly ${Date.now()}`;
    const r = await body(await POST(rpc("tools/call", { name: "document_create", arguments: { title, kind: "contract", body_md: "x" } }, readOnly, 5)));
    expect(r.result?.isError === true || r.error !== undefined).toBe(true);
    const found = await ctx.admin.from("documents").select("id").eq("title", title);
    expect(found.data ?? []).toHaveLength(0);
  });

  it("can still read documents", async () => {
    const r = await body(await POST(rpc("tools/call", { name: "documents_search", arguments: { query: "anything" } }, readOnly, 6)));
    expect(r.result?.isError).not.toBe(true);
  });

  it("works through the token-in-URL route too", async () => {
    const res = await POST_PATH(rpc("tools/list", {}), { params: Promise.resolve({ token: readOnly }) });
    const names = ((await body(res)).result?.tools ?? []).map((t) => t.name);
    expect(names).not.toContain("task_create");
  });
});

describe("Library document kinds", () => {
  it("stores a contract word for word", async () => {
    const text = "Section 4.2: This lease renews automatically for 12 months unless either party gives 60 days' written notice.";
    const created = await body(await POST(rpc("tools/call", { name: "document_create", arguments: { title: `vitest contract ${Date.now()}`, kind: "contract", body_md: text, source: TEST_SOURCE } }, valid, 7)));
    expect(created.result?.isError).not.toBe(true);
    const doc = JSON.parse(created.result?.content?.[0]?.text ?? "{}") as { id?: string };
    expect(doc.id).toBeTruthy();
    const got = await ctx.admin.from("documents").select("body_md,kind").eq("id", doc.id ?? "").single();
    await ctx.admin.from("activity").delete().eq("ref_id", doc.id ?? "");
    await ctx.admin.from("documents").delete().eq("id", doc.id ?? "");
    expect(got.data).toEqual({ body_md: text, kind: "contract" });
  });
});

describe("task <-> calendar event link", () => {
  const call = async (name: string, args: Record<string, unknown>, token: string, id: number) => {
    const r = await body(await POST(rpc("tools/call", { name, arguments: args }, token, id)));
    const isError = r.result?.isError === true || r.error !== undefined;
    const text: string = r.result?.content?.[0]?.text ?? "null";
    // Error results are plain text (e.g. "Input validation error ..."), not JSON.
    return { isError, data: (isError ? text : JSON.parse(text)) as unknown };
  };
  const eventIds: string[] = [];
  let eventId = "";
  let taskId = "";
  const startsAt = "2031-01-15T15:00:00.000Z";

  beforeAll(async () => {
    const ev = await ctx.admin.from("calendar_events").insert({ user_id: ctx.uid, external_id: `vitest-${Date.now()}`, title: "vitest link event", starts_at: startsAt }).select("id").single();
    if (ev.error || !ev.data) throw new Error("event seed failed");
    eventId = ev.data.id;
    eventIds.push(eventId);
    const t = await call("task_create", { title: `vitest linked ${Date.now()}`, source: TEST_SOURCE }, valid, 20);
    taskId = (t.data as { id: string }).id;
    createdTaskIds.push(taskId);
  });
  afterAll(async () => {
    await ctx.admin.from("tasks").delete().eq("id", taskId);
    await ctx.admin.from("calendar_events").delete().in("id", eventIds);
  });

  it("task_update links a task and tasks_list returns the link", async () => {
    const u = await call("task_update", { id: taskId, calendar_event_id: eventId }, valid, 21);
    expect(u.isError).toBe(false);
    const l = await call("tasks_list", { filter: "open" }, valid, 22);
    expect((l.data as { id: string; calendar_event_id: string | null }[]).find((t) => t.id === taskId)?.calendar_event_id).toBe(eventId);
  });

  it("rejects linking an event that is not the owner's (unknown id; no second owner exists in the harness)", async () => {
    const u = await call("task_update", { id: taskId, calendar_event_id: crypto.randomUUID() }, valid, 23);
    expect(u.isError).toBe(true);
    expect(JSON.stringify(u.data)).toContain("EVENT_NOT_FOUND");
  });

  it("rejects a non-uuid calendar_event_id", async () => {
    expect((await call("task_update", { id: taskId, calendar_event_id: "nope" }, valid, 24)).isError).toBe(true);
  });

  it("a read-only token cannot set calendar_event_id", async () => {
    const u = await call("task_update", { id: taskId, calendar_event_id: null }, readOnly, 25);
    expect(u.isError).toBe(true);
    const row = await ctx.admin.from("tasks").select("calendar_event_id").eq("id", taskId).single();
    expect(row.data?.calendar_event_id).toBe(eventId);
  });

  it("calendar_events_list shows the linked task state and task_complete flips it, with a Google hint", async () => {
    const range = { from: "2031-01-15T00:00:00Z", to: "2031-01-16T00:00:00Z" };
    const before = await call("calendar_events_list", range, readOnly, 26);
    expect((before.data as { id: string; task: { status: string } | null }[]).find((e) => e.id === eventId)?.task?.status).toBe("open");
    const done = await call("task_complete", { id: taskId }, valid, 27);
    expect(JSON.stringify(done.data)).toContain("Google Calendar");
    const after = await call("calendar_events_list", range, readOnly, 28);
    const t = (after.data as { id: string; task: { status: string; done: boolean } | null }[]).find((e) => e.id === eventId)?.task;
    expect(t).toMatchObject({ status: "done", done: true });
    const act = await ctx.admin.from("activity").select("detail").eq("ref_id", taskId).eq("action", "Completed task").single();
    expect(act.data?.detail).toContain("vitest link event");
  });
});
