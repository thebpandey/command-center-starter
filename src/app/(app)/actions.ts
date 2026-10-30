"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import * as s from "@/lib/schemas";
import { createTask, updateTask, deleteTask } from "@/lib/data/tasks";
import { listCalendarEventsByIds } from "@/lib/data/calendar";
import { acknowledgeReminder } from "@/lib/data/reminders";
import { createDocument, updateDocument, deleteDocument, setDocumentAttachment, getDocument } from "@/lib/data/documents";
import { setTriageRules } from "@/lib/data/triage";
import { logActivity } from "@/lib/data/activity";
import { generateRawToken, hashToken } from "@/lib/tokens";

export type FormState = { ok: boolean; error?: string; message?: string; id?: string; token?: string; nonce?: number };

const uuid = z.uuid();

// Every action re-checks the session (requireUser) and uses the user's own Supabase client,
// so Postgres RLS is a second, independent gate on top of the explicit user_id filter.
async function ctx() {
  const user = await requireUser();
  return { db: await createClient(), uid: user.id };
}

const fail = (error: string): FormState => ({ ok: false, error, nonce: Date.now() });
const okState = (extra: Partial<FormState> = {}): FormState => ({ ok: true, nonce: Date.now(), ...extra });

function str(fd: FormData, k: string): string | undefined {
  const v = fd.get(k);
  return typeof v === "string" ? v : undefined;
}
const emptyToNull = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : v);

// ---------- reminders ----------
export async function acknowledgeReminderAction(id: string): Promise<FormState> {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("Invalid reminder");
  const { db, uid } = await ctx();
  const r = await acknowledgeReminder(db, uid, p.data);
  if (!r.ok) return fail(r.error === "NOT_FOUND" ? "Already acknowledged" : "Could not acknowledge");
  await logActivity(db, uid, { actor: "user", action: "Acknowledged reminder", detail: r.value.message, ref_table: "reminders", ref_id: r.value.id });
  refresh();
  return okState();
}

// ---------- tasks ----------
export async function toggleTaskAction(id: string, done: boolean): Promise<FormState> {
  const p = z.object({ id: uuid, done: z.boolean() }).safeParse({ id, done });
  if (!p.success) return fail("Invalid task");
  const { db, uid } = await ctx();
  const r = await updateTask(db, uid, p.data.id, { done: p.data.done });
  if (!r.ok) return fail("Could not update task");
  if (p.data.done) {
    const ev = r.value.calendar_event_id ? await listCalendarEventsByIds(db, uid, [r.value.calendar_event_id]) : null;
    const evTitle = ev?.ok ? ev.value[0]?.title : undefined;
    await logActivity(db, uid, { actor: "user", action: "Completed task", detail: evTitle ? `${r.value.title} (calendar: ${evTitle})` : r.value.title, ref_table: "tasks", ref_id: r.value.id });
  }
  refresh();
  return okState();
}

export async function saveTaskAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = emptyToNull(str(fd, "id"));
  const raw = {
    title: str(fd, "title") ?? "",
    notes: emptyToNull(str(fd, "notes")),
    due_date: emptyToNull(str(fd, "due_date")),
    priority: str(fd, "priority") ?? "med",
  };
  const { db, uid } = await ctx();
  if (id) {
    const p = z.object({ id: uuid, patch: s.taskPatch }).safeParse({ id, patch: raw });
    if (!p.success) return fail(z.prettifyError(p.error));
    const r = await updateTask(db, uid, p.data.id, p.data.patch);
    if (!r.ok) return fail("Could not save task");
    refresh();
    return okState({ id: r.value.id });
  }
  const p = s.taskCreate.safeParse({ ...raw, source: "user" });
  if (!p.success) return fail(z.prettifyError(p.error));
  const r = await createTask(db, uid, p.data);
  if (!r.ok) return fail("Could not create task");
  await logActivity(db, uid, { actor: "user", action: "Created task", detail: r.value.title, ref_table: "tasks", ref_id: r.value.id });
  refresh();
  return okState({ id: r.value.id });
}

export async function deleteTaskAction(id: string): Promise<FormState> {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("Invalid task");
  const { db, uid } = await ctx();
  const r = await deleteTask(db, uid, p.data);
  if (!r.ok) return fail("Could not delete task");
  refresh();
  return okState();
}

// ---------- documents ----------
function parseTags(v: string | undefined): string[] {
  return (v ?? "").split(",").map((t) => t.trim()).filter((t) => t.length > 0);
}

export async function saveDocumentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = emptyToNull(str(fd, "id"));
  const raw = {
    title: str(fd, "title") ?? "",
    kind: str(fd, "kind") ?? "note",
    body_md: str(fd, "body_md") ?? "",
    tags: parseTags(str(fd, "tags")),
  };
  const { db, uid } = await ctx();
  if (id) {
    const p = z.object({ id: uuid, patch: s.documentPatch }).safeParse({ id, patch: raw });
    if (!p.success) return fail(z.prettifyError(p.error));
    const r = await updateDocument(db, uid, p.data.id, p.data.patch);
    if (!r.ok) return fail("Could not save document");
    await logActivity(db, uid, { actor: "user", action: "Updated document", detail: r.value.title, ref_table: "documents", ref_id: r.value.id });
    refresh();
    return okState({ id: r.value.id, message: "Saved" });
  }
  const p = s.documentCreate.safeParse({ ...raw, source: "user" });
  if (!p.success) return fail(z.prettifyError(p.error));
  const r = await createDocument(db, uid, p.data);
  if (!r.ok) return fail("Could not create document");
  await logActivity(db, uid, { actor: "user", action: "Saved document", detail: r.value.title, ref_table: "documents", ref_id: r.value.id });
  refresh();
  return okState({ id: r.value.id, message: "Created" });
}

export async function deleteDocumentAction(id: string): Promise<FormState> {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("Invalid document");
  const { db, uid } = await ctx();
  const r = await deleteDocument(db, uid, p.data);
  if (!r.ok) return fail("Could not delete document");
  if (r.value.attachment_path) {
    const rm = await db.storage.from("attachments").remove([r.value.attachment_path]);
    if (rm.error) console.error("attachment cleanup failed", rm.error.message);
  }
  await logActivity(db, uid, { actor: "user", action: "Deleted document", detail: null, ref_table: "documents", ref_id: p.data });
  refresh();
  return okState();
}

// Called after the browser uploaded the file straight to Storage (RLS restricts it to "<uid>/...").
export async function attachFileAction(docId: string, path: string): Promise<FormState> {
  const p = z.object({ docId: uuid, path: z.string().min(1).max(600) }).safeParse({ docId, path });
  if (!p.success) return fail("Invalid attachment");
  const { db, uid } = await ctx();
  if (!p.data.path.startsWith(`${uid}/${p.data.docId}/`) || p.data.path.includes("..")) return fail("Invalid attachment path");
  const doc = await getDocument(db, uid, p.data.docId);
  if (!doc.ok) return fail("Document not found");
  const old = doc.value.attachment_path;
  const r = await setDocumentAttachment(db, uid, p.data.docId, p.data.path);
  if (!r.ok) return fail("Could not save attachment");
  if (old && old !== p.data.path) {
    const rm = await db.storage.from("attachments").remove([old]);
    if (rm.error) console.error("old attachment cleanup failed", rm.error.message);
  }
  refresh();
  return okState();
}

export async function removeAttachmentAction(docId: string): Promise<FormState> {
  const p = uuid.safeParse(docId);
  if (!p.success) return fail("Invalid document");
  const { db, uid } = await ctx();
  const doc = await getDocument(db, uid, p.data);
  if (!doc.ok) return fail("Document not found");
  if (doc.value.attachment_path) {
    const rm = await db.storage.from("attachments").remove([doc.value.attachment_path]);
    if (rm.error) return fail("Could not delete file");
  }
  const r = await setDocumentAttachment(db, uid, p.data, null);
  if (!r.ok) return fail("Could not update document");
  refresh();
  return okState();
}

// ---------- triage rules ----------
export async function saveTriageRulesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const json = str(fd, "rules") ?? "";
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail("Malformed rules");
  }
  const p = s.triageRulesInput.safeParse(raw);
  if (!p.success) return fail(z.prettifyError(p.error));
  const { db, uid } = await ctx();
  const r = await setTriageRules(db, uid, p.data);
  if (!r.ok) return fail("Could not save rules");
  await logActivity(db, uid, { actor: "user", action: "Updated triage rules", detail: null, ref_table: "triage_rules" });
  refresh();
  return okState({ message: "Saved" });
}

// ---------- API tokens ----------
export async function createTokenAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const p = z.object({ name: z.string().trim().min(1).max(100), scope: s.tokenScope })
    .safeParse({ name: str(fd, "name") ?? "", scope: str(fd, "scope") ?? "full" });
  if (!p.success) return fail("Name is required (max 100 characters)");
  const { db, uid } = await ctx();
  const raw = generateRawToken();
  const { data, error } = await db
    .from("api_tokens")
    .insert({ user_id: uid, name: p.data.name, scope: p.data.scope, token_hash: hashToken(raw) })
    .select("id")
    .single();
  if (error || !data) return fail("Could not create token");
  await logActivity(db, uid, { actor: "user", action: "Created API token", detail: p.data.scope === "read" ? `${p.data.name} (read-only)` : p.data.name, ref_table: "api_tokens", ref_id: data.id });
  refresh();
  // The raw token is returned exactly once to the browser; only its hash is stored.
  return okState({ id: data.id, token: raw });
}

export async function revokeTokenAction(id: string): Promise<FormState> {
  const p = uuid.safeParse(id);
  if (!p.success) return fail("Invalid token");
  const { db, uid } = await ctx();
  const { data, error } = await db
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("id", p.data)
    .is("revoked_at", null)
    .select("id,name")
    .maybeSingle();
  if (error || !data) return fail("Could not revoke token");
  await logActivity(db, uid, { actor: "user", action: "Revoked API token", detail: data.name, ref_table: "api_tokens", ref_id: data.id });
  refresh();
  return okState();
}

