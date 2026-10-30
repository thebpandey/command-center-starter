import type { z } from "zod";
import type { messageUpsert, messageStatus } from "../schemas";
import { type Db, fromPg } from "./db";

export async function listMessages(db: Db, uid: string, status?: z.infer<typeof messageStatus>, limit = 100) {
  let q = db.from("messages").select("*").eq("user_id", uid);
  if (status) q = q.eq("status", status);
  return fromPg(await q.order("updated_at", { ascending: false }).limit(limit));
}

export async function upsertMessage(db: Db, uid: string, input: z.infer<typeof messageUpsert>) {
  const { id, ...fields } = input;
  const row = {
    ...fields,
    sent_at: fields.status === "sent" ? (fields.sent_at ?? new Date().toISOString()) : (fields.sent_at ?? null),
  };
  if (id) {
    return fromPg(await db.from("messages").update(row).eq("user_id", uid).eq("id", id).select("*").maybeSingle());
  }
  return fromPg(await db.from("messages").insert({ ...row, user_id: uid }).select("*").single());
}
