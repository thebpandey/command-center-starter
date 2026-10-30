import type { z } from "zod";
import type { taskCreate, taskPatch, taskFilter } from "../schemas";
import { localDate } from "../time";
import { type Db, type DbResult, fromPg } from "./db";
import { ok, err } from "../result";
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

export async function listOpenTasksDueBetween(db: Db, uid: string, startDate: string, endDateExclusive: string) {
  return fromPg(
    await db.from("tasks").select("*").eq("user_id", uid).eq("done", false).gte("due_date", startDate).lt("due_date", endDateExclusive).order("due_date", { ascending: true }).limit(500),
  );
}

// Service-role callers bypass RLS, so a linked event must be proven to belong to the same owner.
async function ownsEvent(db: Db, uid: string, eventId: string | null | undefined): Promise<DbResult<null>> {
  if (!eventId) return ok(null);
  const r = await db.from("calendar_events").select("id").eq("user_id", uid).eq("id", eventId).maybeSingle();
  if (r.error) return err("DB_ERROR", r.error.message);
  return r.data ? ok(null) : err("EVENT_NOT_FOUND");
}

export async function createTask(db: Db, uid: string, input: z.infer<typeof taskCreate>) {
  const owns = await ownsEvent(db, uid, input.calendar_event_id);
  if (!owns.ok) return owns;
  return fromPg(await db.from("tasks").insert({ ...input, user_id: uid }).select("*").single());
}

export async function updateTask(db: Db, uid: string, id: string, patch: z.infer<typeof taskPatch>) {
  const owns = await ownsEvent(db, uid, patch.calendar_event_id);
  if (!owns.ok) return owns;
  const row: Database["public"]["Tables"]["tasks"]["Update"] = { ...patch };
  if (patch.done !== undefined) row.done_at = patch.done ? new Date().toISOString() : null;
  return fromPg(await db.from("tasks").update(row).eq("user_id", uid).eq("id", id).select("*").maybeSingle());
}

export async function deleteTask(db: Db, uid: string, id: string) {
  return fromPg(await db.from("tasks").delete().eq("user_id", uid).eq("id", id).select("id").maybeSingle());
}
