import type { z } from "zod";
import type { taskCreate, taskPatch, taskFilter } from "../schemas";
import { localDate } from "../time";
import { type Db, fromPg } from "./db";
import type { Database } from "../supabase/database.types";

export async function listTasks(db: Db, uid: string, filter: z.infer<typeof taskFilter>, limit = 200) {
  const today = localDate();
  let q = db.from("tasks").select("*").eq("user_id", uid);
  if (filter === "open") q = q.eq("done", false);
  if (filter === "today") q = q.eq("done", false).eq("due_date", today);
  if (filter === "overdue") q = q.eq("done", false).lt("due_date", today);
  return fromPg(
    await q
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit),
  );
}

export async function createTask(db: Db, uid: string, input: z.infer<typeof taskCreate>) {
  return fromPg(await db.from("tasks").insert({ ...input, user_id: uid }).select("*").single());
}

export async function updateTask(db: Db, uid: string, id: string, patch: z.infer<typeof taskPatch>) {
  const row: Database["public"]["Tables"]["tasks"]["Update"] = { ...patch };
  if (patch.done !== undefined) row.done_at = patch.done ? new Date().toISOString() : null;
  return fromPg(await db.from("tasks").update(row).eq("user_id", uid).eq("id", id).select("*").maybeSingle());
}

export async function deleteTask(db: Db, uid: string, id: string) {
  return fromPg(await db.from("tasks").delete().eq("user_id", uid).eq("id", id).select("id").maybeSingle());
}
