import { type Db, fromPg } from "./db";

export type ActivityActor = "assistant" | "scheduled-task" | "user";

export async function listActivity(db: Db, uid: string, limit = 50) {
  return fromPg(
    await db.from("activity").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(limit),
  );
}

export async function logActivity(
  db: Db,
  uid: string,
  entry: { actor: ActivityActor; action: string; detail?: string | null; ref_table?: string | null; ref_id?: string | null },
) {
  return fromPg(
    await db
      .from("activity")
      .insert({
        user_id: uid,
        actor: entry.actor,
        action: entry.action.slice(0, 200),
        detail: entry.detail?.slice(0, 1000) ?? null,
        ref_table: entry.ref_table ?? null,
        ref_id: entry.ref_id ?? null,
      })
      .select("id")
      .single(),
  );
}
