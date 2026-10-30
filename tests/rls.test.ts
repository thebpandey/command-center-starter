import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ownerContext, anonClient, TEST_SOURCE } from "./helpers";
import { hashToken, generateRawToken } from "@/lib/tokens";

const TABLES = ["tasks", "reminders", "documents", "messages", "activity", "calendar_events", "triage_rules", "api_tokens"] as const;
let ctx: Awaited<ReturnType<typeof ownerContext>>;
const created: { table: (typeof TABLES)[number]; id: string }[] = [];
let createdRules = false;

beforeAll(async () => {
  ctx = await ownerContext();
  const uid = ctx.uid;
  const ins = async (table: (typeof TABLES)[number], q: PromiseLike<{ data: { id: string } | null; error: unknown }>) => {
    const { data, error } = await q;
    if (error || !data) throw new Error(`seed ${table} failed`);
    created.push({ table, id: data.id });
  };
  await ins("tasks", ctx.admin.from("tasks").insert({ user_id: uid, title: "rls seed", source: TEST_SOURCE }).select("id").single());
  await ins("reminders", ctx.admin.from("reminders").insert({ user_id: uid, message: "rls seed", source: TEST_SOURCE }).select("id").single());
  await ins("documents", ctx.admin.from("documents").insert({ user_id: uid, title: "rls seed", source: TEST_SOURCE }).select("id").single());
  await ins("messages", ctx.admin.from("messages").insert({ user_id: uid, subject: "rls seed", source: TEST_SOURCE }).select("id").single());
  await ins("activity", ctx.admin.from("activity").insert({ user_id: uid, actor: "user", action: "rls seed", detail: TEST_SOURCE }).select("id").single());
  await ins("calendar_events", ctx.admin.from("calendar_events").insert({ user_id: uid, external_id: `vitest-${Date.now()}`, title: "rls seed", starts_at: new Date().toISOString() }).select("id").single());
  await ins("api_tokens", ctx.admin.from("api_tokens").insert({ user_id: uid, name: "rls seed", token_hash: hashToken(generateRawToken()), revoked_at: new Date().toISOString() }).select("id").single());
  const existing = await ctx.admin.from("triage_rules").select("id").eq("user_id", uid).maybeSingle();
  if (!existing.data) {
    await ins("triage_rules", ctx.admin.from("triage_rules").insert({ user_id: uid }).select("id").single());
    createdRules = true;
  }
});

afterAll(async () => {
  for (const c of created) {
    if (c.table === "triage_rules" && !createdRules) continue;
    await ctx.admin.from(c.table).delete().eq("id", c.id);
  }
});

describe("RLS: the public (anon) key exposes nothing", () => {
  for (const table of TABLES) {
    it(`${table}: anon sees zero rows even though rows exist`, async () => {
      const seeded = await ctx.admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", ctx.uid);
      expect(seeded.count ?? 0).toBeGreaterThan(0);
      const { data, error } = await anonClient().from(table).select("*").limit(5);
      // Either permission denied (anon has no grants) or an empty result (RLS) is acceptable; data is not.
      if (error) expect(error.code).toBe("42501");
      else expect(data).toEqual([]);
    });
  }

  it("anon cannot insert rows", async () => {
    const { error } = await anonClient().from("tasks").insert({ user_id: ctx.uid, title: "anon write" });
    expect(error).not.toBeNull();
  });

  it("anon cannot call the search RPC", async () => {
    const { data, error } = await anonClient().rpc("search_documents", { p_user_id: ctx.uid, p_query: "seed", p_limit: 5 });
    expect(error !== null || (Array.isArray(data) && data.length === 0)).toBe(true);
  });
});
