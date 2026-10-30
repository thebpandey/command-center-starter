import type { z } from "zod";
import type { documentCreate, documentPatch } from "../schemas";
import { type Db, fromPg } from "./db";

const LIST_COLS = "id,title,kind,tags,attachment_path,source,created_at,updated_at";

export async function listDocuments(db: Db, uid: string, limit = 100) {
  return fromPg(
    await db.from("documents").select(LIST_COLS).eq("user_id", uid).order("updated_at", { ascending: false }).limit(limit),
  );
}

export async function countDocuments(db: Db, uid: string) {
  const r = await db.from("documents").select("id", { count: "exact", head: true }).eq("user_id", uid);
  return fromPg({ data: r.count, error: r.error });
}

export async function searchDocuments(db: Db, uid: string, query: string, limit = 10) {
  return fromPg(await db.rpc("search_documents", { p_user_id: uid, p_query: query, p_limit: limit }));
}

export async function getDocument(db: Db, uid: string, id: string) {
  return fromPg(await db.from("documents").select("*").eq("user_id", uid).eq("id", id).maybeSingle());
}

export async function createDocument(db: Db, uid: string, input: z.infer<typeof documentCreate>) {
  return fromPg(await db.from("documents").insert({ ...input, user_id: uid }).select(LIST_COLS).single());
}

export async function updateDocument(db: Db, uid: string, id: string, patch: z.infer<typeof documentPatch>) {
  return fromPg(await db.from("documents").update(patch).eq("user_id", uid).eq("id", id).select(LIST_COLS).maybeSingle());
}

export async function setDocumentAttachment(db: Db, uid: string, id: string, path: string | null) {
  return fromPg(
    await db.from("documents").update({ attachment_path: path }).eq("user_id", uid).eq("id", id).select(LIST_COLS).maybeSingle(),
  );
}

export async function deleteDocument(db: Db, uid: string, id: string) {
  return fromPg(
    await db.from("documents").delete().eq("user_id", uid).eq("id", id).select("id,attachment_path").maybeSingle(),
  );
}
