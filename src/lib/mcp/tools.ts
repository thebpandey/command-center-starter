import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Db, DbResult } from "../data/db";
import { createAdminClient } from "../supabase/admin";
import { getOwnerId } from "./owner";
import type { TokenScope } from "./auth";
import * as schemas from "../schemas";
import { listTasks, createTask, updateTask } from "../data/tasks";
import { listReminders, createReminder, acknowledgeReminder } from "../data/reminders";
import { searchDocuments, getDocument, createDocument, updateDocument } from "../data/documents";
import { listMessages, upsertMessage } from "../data/messages";
import { listActivity, logActivity } from "../data/activity";
import { upsertCalendarEvents, listCalendarEvents } from "../data/calendar";
import { getTriageRules, setTriageRules } from "../data/triage";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const text = (v: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(v) }] });
const fail = (error: string, message?: string): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(message ? { ok: false, error, message } : { ok: false, error }) }],
  isError: true,
});

const actorArg = { actor: schemas.agentActor.default("assistant").describe("Who is writing: assistant or scheduled-task") };
const idArg = z.uuid();

type Ctx = { db: Db; uid: string };

async function context(): Promise<{ ok: true; value: Ctx } | { ok: false; result: ToolResult }> {
  const db = createAdminClient();
  const owner = await getOwnerId(db);
  if (!owner.ok) return { ok: false, result: fail(owner.error) };
  return { ok: true, value: { db, uid: owner.value } };
}

function unwrap<T>(r: DbResult<T>, onOk: (v: T) => unknown): ToolResult {
  if (!r.ok) return fail(r.error, r.error === "DB_ERROR" ? "Database operation failed" : undefined);
  return text(onOk(r.value));
}

// Write tools run the mutation, then append an activity row. If the activity insert fails the tool
// reports it instead of hiding it, since the log is the owner's audit trail.
async function withActivity<T extends { id: string }>(
  ctx: Ctx,
  r: DbResult<T>,
  actor: "assistant" | "scheduled-task",
  action: string,
  detail: string | null,
  refTable: string,
  shape: (v: T) => unknown,
): Promise<ToolResult> {
  if (!r.ok) return unwrap(r, shape);
  const log = await logActivity(ctx.db, ctx.uid, { actor, action, detail, ref_table: refTable, ref_id: r.value.id });
  if (!log.ok) return fail("ACTIVITY_LOG_FAILED", "Write succeeded but activity log failed");
  return text(shape(r.value));
}

const taskShape = (t: { id: string; title: string; due_date: string | null; priority: string; done: boolean }) => ({
  id: t.id, title: t.title, due_date: t.due_date, priority: t.priority, done: t.done,
});

export const TOOL_NAMES = [
  "tasks_list", "task_create", "task_update", "task_complete",
  "reminders_list", "reminder_create", "reminder_acknowledge",
  "documents_search", "document_get", "document_create", "document_update",
  "messages_list", "message_log", "activity_list",
  "calendar_events_upsert", "calendar_events_list",
  "triage_rules_get", "triage_rules_set",
] as const;

export const READ_TOOL_NAMES: readonly (typeof TOOL_NAMES)[number][] = [
  "tasks_list", "reminders_list", "documents_search", "document_get",
  "messages_list", "activity_list", "calendar_events_list", "triage_rules_get",
];

export function registerTools(server: McpServer, scope: TokenScope = "full"): void {
  const tool = <S extends z.ZodObject>(
    name: (typeof TOOL_NAMES)[number],
    description: string,
    inputSchema: S,
    run: (args: z.infer<S>, ctx: Ctx) => Promise<ToolResult>,
  ) => {
    if (scope === "read" && !READ_TOOL_NAMES.includes(name)) return;
    const sdkSchema: z.ZodObject = inputSchema;
    server.registerTool(name, { description, inputSchema: sdkSchema }, async (args) => {
      // The SDK already validated args; re-parsing narrows the generic type without a cast.
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return fail("INVALID_INPUT", z.prettifyError(parsed.error));
      const c = await context();
      if (!c.ok) return c.result;
      return run(parsed.data, c.value);
    });
  };

  tool("tasks_list", "List tasks. filter: open (default), today, overdue, all.",
    z.object({ filter: schemas.taskFilter.default("open"), limit: z.number().int().min(1).max(200).default(50) }),
    async (a, c) => unwrap(await listTasks(c.db, c.uid, a.filter, a.limit), (rows) => rows.map(taskShape)));

  tool("task_create", "Create a task.", schemas.taskCreate.extend(actorArg),
    async ({ actor, ...input }, c) =>
      withActivity(c, await createTask(c.db, c.uid, { ...input, source: input.source ?? actor }), actor, "Created task", input.title, "tasks", taskShape));

  tool("task_update", "Update a task's fields.", schemas.taskPatch.extend({ id: idArg, ...actorArg }),
    async ({ id, actor, ...patch }, c) =>
      withActivity(c, await updateTask(c.db, c.uid, id, patch), actor, "Updated task", patch.title ?? null, "tasks", taskShape));

  tool("task_complete", "Mark a task done.", z.object({ id: idArg, ...actorArg }),
    async ({ id, actor }, c) => {
      const r = await updateTask(c.db, c.uid, id, { done: true });
      return withActivity(c, r, actor, "Completed task", r.ok ? r.value.title : null, "tasks", taskShape);
    });

  const reminderShape = (r: { id: string; message: string; due_at: string | null; critical: boolean; acknowledged_at: string | null; source: string | null }) => ({
    id: r.id, message: r.message, due_at: r.due_at, critical: r.critical, acknowledged_at: r.acknowledged_at, source: r.source,
  });

  tool("reminders_list", "List reminders; unacknowledged only unless include_acknowledged.",
    z.object({ include_acknowledged: z.boolean().default(false) }),
    async (a, c) => unwrap(await listReminders(c.db, c.uid, a.include_acknowledged), (rows) => rows.map(reminderShape)));

  tool("reminder_create", "Create a reminder. critical=true shows it in the orange bar. Use source 'email-triage' for important mail.",
    schemas.reminderCreate.extend(actorArg),
    async ({ actor, ...input }, c) =>
      withActivity(c, await createReminder(c.db, c.uid, { ...input, source: input.source ?? actor }), actor,
        input.critical ? "Created critical reminder" : "Created reminder", input.message, "reminders", reminderShape));

  tool("reminder_acknowledge", "Acknowledge a reminder.", z.object({ id: idArg, ...actorArg }),
    async ({ id, actor }, c) => {
      const r = await acknowledgeReminder(c.db, c.uid, id);
      return withActivity(c, r, actor, "Acknowledged reminder", r.ok ? r.value.message : null, "reminders", reminderShape);
    });

  tool("documents_search", "Full-text search documents. Returns id, title, kind, snippet.",
    z.object({ query: z.string().trim().min(1).max(500), limit: z.number().int().min(1).max(10).default(5) }),
    async (a, c) => unwrap(await searchDocuments(c.db, c.uid, a.query, a.limit),
      (rows) => rows.map((d) => ({ id: d.id, title: d.title, kind: d.kind, snippet: d.snippet }))));

  tool("document_get", "Get one document including markdown body.", z.object({ id: idArg }),
    async (a, c) => unwrap(await getDocument(c.db, c.uid, a.id), (d) => ({
      id: d.id, title: d.title, kind: d.kind, tags: d.tags, body_md: d.body_md, has_attachment: d.attachment_path !== null,
      source: d.source, updated_at: d.updated_at,
    })));

  const docShape = (d: { id: string; title: string; kind: string }) => ({ id: d.id, title: d.title, kind: d.kind });

  tool("document_create", "Create a markdown document. Library kinds (contract, transcript, report, data, research) store text word for word; also note, briefing, pdf, other.", schemas.documentCreate.extend(actorArg),
    async ({ actor, ...input }, c) =>
      withActivity(c, await createDocument(c.db, c.uid, { ...input, source: input.source ?? actor }), actor, "Saved document", input.title, "documents", docShape));

  tool("document_update", "Update a document's title, kind, body_md or tags.", schemas.documentPatch.extend({ id: idArg, ...actorArg }),
    async ({ id, actor, ...patch }, c) => {
      const r = await updateDocument(c.db, c.uid, id, patch);
      return withActivity(c, r, actor, "Updated document", r.ok ? r.value.title : null, "documents", docShape);
    });

  const msgShape = (m: { id: string; to_name: string | null; to_email: string | null; subject: string; status: string; sent_at: string | null; thread_ref: string | null }) => ({
    id: m.id, to_name: m.to_name, to_email: m.to_email, subject: m.subject, status: m.status, sent_at: m.sent_at, thread_ref: m.thread_ref,
  });

  tool("messages_list", "List message records (drafts/sent/failed).",
    z.object({ status: schemas.messageStatus.optional(), limit: z.number().int().min(1).max(100).default(30) }),
    async (a, c) => unwrap(await listMessages(c.db, c.uid, a.status, a.limit), (rows) => rows.map(msgShape)));

  tool("message_log", "Create (no id) or update (with id) a draft or sent message record. Does not send email.",
    schemas.messageUpsert.extend(actorArg),
    async ({ actor, ...input }, c) => {
      const action = input.status === "sent" ? "Sent email" : input.status === "failed" ? "Email failed" : "Drafted email";
      return withActivity(c, await upsertMessage(c.db, c.uid, { ...input, source: input.source ?? actor }), actor, action, input.subject, "messages", msgShape);
    });

  tool("activity_list", "Recent activity log entries.", z.object({ limit: z.number().int().min(1).max(100).default(20) }),
    async (a, c) => unwrap(await listActivity(c.db, c.uid, a.limit), (rows) => rows.map((x) => ({
      at: x.created_at, actor: x.actor, action: x.action, detail: x.detail, ref_table: x.ref_table, ref_id: x.ref_id,
    }))));

  tool("calendar_events_upsert", "Upsert calendar events by external_id; sets synced_at to now.",
    z.object({ events: z.array(schemas.calendarEvent).min(1).max(500), ...actorArg }),
    async ({ events, actor }, c) => {
      const r = await upsertCalendarEvents(c.db, c.uid, events);
      if (!r.ok) return unwrap(r, () => null);
      const log = await logActivity(c.db, c.uid, { actor, action: "Synced calendar", detail: `${r.value.length} events`, ref_table: "calendar_events" });
      if (!log.ok) return fail("ACTIVITY_LOG_FAILED", "Write succeeded but activity log failed");
      return text({ upserted: r.value.length });
    });

  tool("calendar_events_list", "List calendar events starting in [from, to). ISO datetimes with offset.",
    z.object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) }),
    async (a, c) => unwrap(await listCalendarEvents(c.db, c.uid, a.from, a.to), (rows) => rows.map((e) => ({
      id: e.id, external_id: e.external_id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, location: e.location, meet_url: e.meet_url,
    }))));

  tool("triage_rules_get", "Get email triage rules: vip [{name,email,note}], keywords, muted, critical_triggers.", z.object({}),
    async (_a, c) => unwrap(await getTriageRules(c.db, c.uid), (r) => r));

  tool("triage_rules_set", "Replace all triage rules (send the full lists).", schemas.triageRulesInput.extend(actorArg),
    async ({ actor, ...rules }, c) => {
      const r = await setTriageRules(c.db, c.uid, rules);
      if (!r.ok) return unwrap(r, () => null);
      const log = await logActivity(c.db, c.uid, { actor, action: "Updated triage rules", detail: null, ref_table: "triage_rules" });
      if (!log.ok) return fail("ACTIVITY_LOG_FAILED", "Write succeeded but activity log failed");
      return text({ ok: true });
    });
}
