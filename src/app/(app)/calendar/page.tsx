import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listCalendarEvents, lastCalendarSync } from "@/lib/data/calendar";
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
  const [ev, sync] = await Promise.all([listCalendarEvents(db, user.id, b.from.toISOString(), b.to.toISOString()), lastCalendarSync(db, user.id)]);
  const items = ev.ok ? buildTimeline({ events: ev.value, tasks: [], reminders: [] }) : [];
  return (
    <>
      <PageHeader title="Calendar">
        <RangeSwitch base="/calendar" current={range} />
        {sync.ok && <SyncPill syncedAt={sync.value} now={new Date()} />}
      </PageHeader>
      <Card title="Events" labelledBy="h-events" aside={<span className="muted">{items.length} events</span>}>
        {!ev.ok ? <ErrorBox what="calendar events" /> : items.length === 0 ? <Empty>No events in this range. The assistant syncs your calendar here.</Empty> : <Timeline items={items} grouped />}
      </Card>
    </>
  );
}
