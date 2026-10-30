import type { CalendarEvent, Reminder, Task } from "./supabase/types";
import { fmtTime24, localDate, fmtDayShort, startOfLocalDay } from "./time";

export type TimelineItem = {
  key: string;
  kind: "event" | "task" | "reminder";
  day: string;
  sortAt: number;
  time: string;
  title: string;
  meta: string;
  href?: string;
  taskState?: "open" | "done";
};

const PRI: Record<string, string> = { low: "Low", med: "Med", high: "High" };

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname;
    return h.includes("meet.google") ? "Meet" : h.includes("zoom") ? "Zoom" : h.includes("teams") ? "Teams" : "Link";
  } catch {
    return null;
  }
}

export function buildTimeline(input: { events: CalendarEvent[]; tasks: Task[]; reminders: Reminder[]; eventTasks?: Pick<Task, "calendar_event_id" | "done">[] }): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const e of input.events) {
    const linked = input.eventTasks?.find((t) => t.calendar_event_id === e.id);
    const span = e.ends_at ? `${fmtTime24(e.starts_at)}–${fmtTime24(e.ends_at)}` : fmtTime24(e.starts_at);
    const meta = [span, hostOf(e.meet_url) ?? e.location ?? "Calendar"].join(" · ");
    items.push({ key: `e-${e.id}`, kind: "event", day: localDate(new Date(e.starts_at)), sortAt: Date.parse(e.starts_at), time: fmtTime24(e.starts_at), title: e.title || "(no title)", meta, taskState: linked ? (linked.done ? "done" : "open") : undefined, href: linked ? "/tasks" : undefined });
  }
  for (const t of input.tasks) {
    if (!t.due_date || t.done) continue;
    // Date-only tasks sort to the start of their day.
    items.push({ key: `t-${t.id}`, kind: "task", day: t.due_date, sortAt: startOfLocalDay(t.due_date).getTime() - 1, time: "Due", title: t.title, meta: PRI[t.priority] ?? t.priority, href: "/tasks" });
  }
  for (const r of input.reminders) {
    if (!r.due_at || r.acknowledged_at) continue;
    items.push({ key: `r-${r.id}`, kind: "reminder", day: localDate(new Date(r.due_at)), sortAt: Date.parse(r.due_at), time: fmtTime24(r.due_at), title: r.message, meta: r.critical ? "Critical" : "Reminder" });
  }
  return items.sort((a, b) => a.sortAt - b.sortAt);
}

export function groupByDay(items: TimelineItem[]): { day: string; label: string; items: TimelineItem[] }[] {
  const groups = new Map<string, TimelineItem[]>();
  for (const i of items) groups.set(i.day, [...(groups.get(i.day) ?? []), i]);
  return [...groups.entries()].map(([day, list]) => ({ day, label: fmtDayShort(`${day}T12:00:00Z`), items: list }));
}
