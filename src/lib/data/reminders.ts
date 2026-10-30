import type { z } from "zod";
import type { reminderCreate } from "../schemas";
import { type Db, fromPg } from "./db";

export async function listReminders(db: Db, uid: string, includeAcknowledged = false, limit = 100) {
  let q = db.from("reminders").select("*").eq("user_id", uid);
  if (!includeAcknowledged) q = q.is("acknowledged_at", null);
  return fromPg(await q.order("due_at", { ascending: true, nullsFirst: false }).limit(limit));
}

export async function createReminder(db: Db, uid: string, input: z.infer<typeof reminderCreate>) {
  return fromPg(await db.from("reminders").insert({ ...input, user_id: uid }).select("*").single());
}

export async function acknowledgeReminder(db: Db, uid: string, id: string) {
  return fromPg(
    await db
      .from("reminders")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("user_id", uid)
      .eq("id", id)
      .is("acknowledged_at", null)
      .select("*")
      .maybeSingle(),
  );
}
