import { z } from "zod";

const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime({ offset: true });
const shortText = (max: number) => z.string().trim().max(max);

export const priority = z.enum(["low", "med", "high"]);
export const docKind = z.enum(["note", "research", "briefing", "pdf", "other", "contract", "transcript", "report", "data"]);
export const tokenScope = z.enum(["full", "read"]);
export const messageStatus = z.enum(["draft", "sent", "failed"]);
export const agentActor = z.enum(["assistant", "scheduled-task"]);
export const taskFilter = z.enum(["open", "today", "overdue", "all"]);

export const taskCreate = z.object({
  title: shortText(500).min(1),
  notes: shortText(10_000).nullish(),
  due_date: isoDate.nullish(),
  priority: priority.default("med"),
  source: shortText(100).nullish(),
});
export const taskPatch = z.object({
  title: shortText(500).min(1).optional(),
  notes: shortText(10_000).nullable().optional(),
  due_date: isoDate.nullable().optional(),
  priority: priority.optional(),
  done: z.boolean().optional(),
});

export const reminderCreate = z.object({
  message: shortText(1000).min(1),
  due_at: isoDateTime.nullish(),
  critical: z.boolean().default(false),
  source: shortText(100).nullish(),
});

const tag = shortText(50).min(1);
export const documentCreate = z.object({
  title: shortText(500).min(1),
  kind: docKind.default("note"),
  body_md: z.string().max(500_000).default(""),
  tags: z.array(tag).max(30).default([]),
  source: shortText(100).nullish(),
});
export const documentPatch = z.object({
  title: shortText(500).min(1).optional(),
  kind: docKind.optional(),
  body_md: z.string().max(500_000).optional(),
  tags: z.array(tag).max(30).optional(),
});

export const messageUpsert = z.object({
  id: z.uuid().optional(),
  to_name: shortText(200).nullish(),
  to_email: z.email().max(320).nullish(),
  subject: shortText(500).default(""),
  body_md: z.string().max(200_000).default(""),
  status: messageStatus.default("draft"),
  sent_at: isoDateTime.nullish(),
  thread_ref: shortText(500).nullish(),
  source: shortText(100).nullish(),
});

export const calendarEvent = z.object({
  external_id: shortText(500).min(1),
  title: shortText(500).default(""),
  starts_at: isoDateTime,
  ends_at: isoDateTime.nullish(),
  location: shortText(500).nullish(),
  meet_url: z.url().max(2000).nullish(),
});

export const vipEntry = z.object({
  name: shortText(200).default(""),
  email: z.union([z.email().max(320), z.literal("")]).default(""),
  note: shortText(500).default(""),
});
const ruleList = z.array(shortText(200).min(1)).max(200);
export const triageRulesInput = z.object({
  vip: z.array(vipEntry).max(200),
  keywords: ruleList,
  muted: ruleList,
  critical_triggers: ruleList,
});
export type TriageRulesInput = z.infer<typeof triageRulesInput>;
export type VipEntry = z.infer<typeof vipEntry>;
