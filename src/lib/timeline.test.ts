import { describe, expect, it } from "vitest";
import { buildTimeline } from "./timeline";
import type { CalendarEvent, Task } from "./supabase/types";

const task = (o: Partial<Task>): Task => ({ id: "1", title: "T", due_date: "2026-11-02", done: false, priority: "high", ...o }) as Task;

describe("buildTimeline tasks", () => {
  it("places open dated tasks on their due day, linked to /tasks, and drops done or undated ones", () => {
    const items = buildTimeline({
      events: [],
      reminders: [],
      tasks: [task({ id: "a" }), task({ id: "b", done: true }), task({ id: "c", due_date: null }), task({ id: "d", due_date: "2026-11-03", priority: "low" })],
    });
    expect(items.map((i) => [i.key, i.day, i.meta, i.href])).toEqual([
      ["t-a", "2026-11-02", "High", "/tasks"],
      ["t-d", "2026-11-03", "Low", "/tasks"],
    ]);
  });
});

describe("buildTimeline linked events", () => {
  const ev = { id: "e1", title: "Call", starts_at: "2026-11-02T15:00:00Z", ends_at: null, meet_url: null, location: null } as CalendarEvent;
  it("marks an event with its linked task's state so completing the task is visible", () => {
    const state = (done: boolean) => buildTimeline({ events: [ev], tasks: [], reminders: [], eventTasks: [{ calendar_event_id: "e1", done }] })[0]?.taskState;
    expect(state(false)).toBe("open");
    expect(state(true)).toBe("done");
    expect(buildTimeline({ events: [ev], tasks: [], reminders: [], eventTasks: [{ calendar_event_id: "other", done: true }] })[0]?.taskState).toBeUndefined();
  });
});

describe("buildTimeline linked task dedupe", () => {
  const ev = { id: "e1", title: "Call", starts_at: "2026-11-02T15:00:00Z", ends_at: null, meet_url: null, location: null } as CalendarEvent;
  const run = (t: Task, events: CalendarEvent[]) => buildTimeline({ events, tasks: [t], reminders: [], eventTasks: [{ calendar_event_id: "e1", done: false }] }).map((i) => i.key);
  it("shows a linked task once, as its event", () => {
    expect(run(task({ id: "a", calendar_event_id: "e1" }), [ev])).toEqual(["e-e1"]);
  });
  it("keeps the Due row when the linked event is outside the shown range, so the task never vanishes", () => {
    expect(run(task({ id: "a", calendar_event_id: "e1" }), [])).toEqual(["t-a"]);
  });
  it("keeps the Due row for an unlinked task", () => {
    expect(run(task({ id: "a", calendar_event_id: null }), [ev]).sort()).toEqual(["e-e1", "t-a"]);
  });
});
