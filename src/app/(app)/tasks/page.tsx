import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/data/tasks";
import { listCalendarEventsByIds } from "@/lib/data/calendar";
import { localDate, fmtDueDate, fmtDayShort, fmtTime24 } from "@/lib/time";
import { Card, ErrorBox, Empty, PageHeader, PanelSkeleton } from "@/components/ui";
import { TaskForm } from "@/components/task-form";
import { TaskRow } from "@/components/task-row";

export const metadata = { title: "Tasks · Assistant" };
type SP = Promise<{ show?: string | string[] }>;

export default function TasksPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader title="Tasks" />
      <Suspense fallback={<PanelSkeleton rows={8} />}>
        <Tasks searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Tasks({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const showDone = (await searchParams).show === "all";
  const db = await createClient();
  const r = await listTasks(db, user.id, showDone ? "all" : "open", 500);
  const today = localDate();
  const evIds = r.ok ? r.value.flatMap((t) => (t.calendar_event_id ? [t.calendar_event_id] : [])) : [];
  const evs = await listCalendarEventsByIds(db, user.id, evIds);
  const evLabel = new Map((evs.ok ? evs.value : []).map((e) => [e.id, `${fmtDayShort(e.starts_at)} ${fmtTime24(e.starts_at)}`]));
  return (
    <>
      <Card title="New task" labelledBy="h-new-task"><TaskForm /></Card>
      <Card title={showDone ? "All tasks" : "Open tasks"} labelledBy="h-task-list"
        aside={<Link href={showDone ? "/tasks" : "/tasks?show=all"} className="muted">{showDone ? "Hide done" : "Show done"}</Link>}>
        {!r.ok ? <ErrorBox what="tasks" /> : r.value.length === 0 ? <Empty>{showDone ? "No tasks yet." : "No open tasks. Add one above."}</Empty> : (
          <ul className="task-list">
            {r.value.map((t) => (
              <TaskRow key={t.id} t={{
                id: t.id, title: t.title, notes: t.notes, due_date: t.due_date, priority: t.priority, done: t.done,
                dueLabel: t.due_date ? fmtDueDate(t.due_date) : "No date",
                onCalendar: t.calendar_event_id ? evLabel.get(t.calendar_event_id) : undefined,
                overdue: !t.done && t.due_date !== null && t.due_date < today,
              }} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
