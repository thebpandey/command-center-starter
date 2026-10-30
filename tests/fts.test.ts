import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { searchDocuments } from "@/lib/data/documents";
import { ownerContext, TEST_SOURCE } from "./helpers";

const WORD = `zephyrquill${Date.now().toString(36)}`;
let ctx: Awaited<ReturnType<typeof ownerContext>>;
let docId: string;

beforeAll(async () => {
  ctx = await ownerContext();
  const { data, error } = await ctx.admin
    .from("documents")
    .insert({ user_id: ctx.uid, title: "FTS test document", kind: "note", body_md: `The lender wants the ${WORD} disclosure signed by Friday.`, source: TEST_SOURCE })
    .select("id")
    .single();
  if (error || !data) throw new Error("seed failed");
  docId = data.id;
});

afterAll(async () => {
  await ctx.admin.from("documents").delete().eq("id", docId);
});

describe("document full-text search", () => {
  it("finds the seeded document for a matching query, with a snippet", async () => {
    const r = await searchDocuments(ctx.admin, ctx.uid, `${WORD} disclosure`, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const hit = r.value.find((d) => d.id === docId);
    expect(hit).toBeDefined();
    expect(hit?.snippet.toLowerCase()).toContain(WORD);
  });

  it("does not return it for a non-matching query", async () => {
    const r = await searchDocuments(ctx.admin, ctx.uid, `${WORD}nomatch`, 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.find((d) => d.id === docId)).toBeUndefined();
  });

  it("is scoped to the given user id (service-role callers cannot read across users)", async () => {
    const r = await searchDocuments(ctx.admin, "00000000-0000-0000-0000-000000000000", WORD, 10);
    expect(r.ok && r.value.length).toBe(0);
  });
});
