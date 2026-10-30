import type { z } from "zod";
import type { calendarEvent } from "../schemas";
import { type Db, fromPg, fromPgMaybe } from "./db";

export async function upsertCalendarEvents(db: Db, uid: string, events: z.infer<typeof calendarEvent>[]) {
  const syncedAt = new Date().toISOString();
  const rows = events.map((e) => ({ ...e, user_id: uid, synced_at: syncedAt }));
  return fromPg(
    await db.from("calendar_events").upsert(rows, { onConflict: "user_id,external_id" }).select("id,external_id"),
  );
}

export async function listCalendarEvents(db: Db, uid: string, from: string, to: string, limit = 500) {
  return fromPg(
    await db
      .from("calendar_events")
      .select("*")
      .eq("user_id", uid)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at", { ascending: true })
      .limit(limit),
  );
}

export async function lastCalendarSync(db: Db, uid: string) {
  const r = await db
    .from("calendar_events")
    .select("synced_at")
    .eq("user_id", uid)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const res = fromPgMaybe(r);
  if (!res.ok) return res;
  return { ok: true as const, value: res.value?.synced_at ?? null };
}
