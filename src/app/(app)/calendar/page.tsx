import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listOpenTasksDueBetween } from "@/lib/data/tasks";
import { listCalendarEvents, lastCalendarSync, listTasksForEvents } from "@/lib/data/calendar";
import { buildTimeline } from "@/lib/timeline";
import { type Range, rangeBounds } from "@/lib/time";
import { Card, ErrorBox, Empty, PageHeader, PanelSkeleton, RangeSwitch, SyncPill, Timeline } from "@/components/ui";

export const metadata = { title: "Calendar · Assistant" };
type SP = Promise<{ range?: string | string[] }>;

export default function CalendarPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<><PageHeader title="Calendar" /><PanelSkeleton rows={8} /></>}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

async function Calendar({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const v = (await searchParams).range;
  const range: Range = v === "today" || v === "month" ? v : "week";
  const db = await createClient();
  const b = rangeBounds(range);
  const [ev, sync, tasks] = await Promise.all([
    listCalendarEvents(db, user.id, b.from.toISOString(), b.to.toISOString()),
    lastCalendarSync(db, user.id),
    listOpenTasksDueBetween(db, user.id, b.startDate, b.endDateExclusive),
  ]);
  const linked = ev.ok ? await listTasksForEvents(db, user.id, ev.value.map((e) => e.id)) : null;
  const items = ev.ok ? buildTimeline({ events: ev.value, tasks: tasks.ok ? tasks.value : [], reminders: [], eventTasks: linked?.ok ? linked.value : [] }) : [];
  return (
    <>
      <PageHeader title="Calendar">
        <RangeSwitch base="/calendar" current={range} />
        {sync.ok && <SyncPill syncedAt={sync.value} now={new Date()} />}
      </PageHeader>
      <Card title="Events and tasks" labelledBy="h-events" aside={<span className="muted">{items.length} items</span>}>
        {!ev.ok ? <ErrorBox what="calendar events" /> : items.length === 0 ? <Empty>No events or due tasks in this range. The assistant syncs your calendar here.</Empty> : <Timeline items={items} grouped />}
      </Card>
      {ev.ok && !tasks.ok && <ErrorBox what="due tasks" />}
    </>
  );
}
