import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/data/tasks";
import { listReminders } from "@/lib/data/reminders";
import { listCalendarEvents, lastCalendarSync } from "@/lib/data/calendar";
import { listDocuments, countDocuments } from "@/lib/data/documents";
import { listMessages } from "@/lib/data/messages";
import { listActivity } from "@/lib/data/activity";
import { getTriageRules } from "@/lib/data/triage";
import { buildTimeline } from "@/lib/timeline";
import { type Range, rangeBounds, localDate, startOfLocalDay, addDays, fmtDueDate, fmtWhen, fmtTime, fmtHeaderDate, greeting } from "@/lib/time";
import { docKindLabel } from "@/lib/schemas";
import { Card, ErrorBox, Empty, PageHeader, RangeSwitch, SyncPill, Timeline, PanelSkeleton } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { AckButton } from "@/components/ack-button";
import { TaskCheck } from "@/components/task-check";
import type { Task } from "@/lib/supabase/types";

type SP = Promise<{ range?: string | string[] }>;
const parseRange = (v: string | string[] | undefined): Range => (v === "week" || v === "month" ? v : "today");
const PRI: Record<string, string> = { low: "Low", med: "Med", high: "High" };
const ACTOR: Record<string, string> = { assistant: "Assistant", "scheduled-task": "Scheduled", user: "You" };

export default function TodayPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today searchParams={searchParams} />
    </Suspense>
  );
}

function TodaySkeleton() {
  return (
    <div className="dash" aria-busy="true">
      <div className="header"><div className="skeleton" style={{ height: 34, width: 280 }} /></div>
      <div className="kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 112 }} />)}</div>
      <PanelSkeleton className="timeline" rows={6} />
      <PanelSkeleton className="tasks" rows={6} />
    </div>
  );
}

function Kpi({ label, value, delta, icon, bad }: { label: string; value: number | null; delta: string; icon: IconName; bad?: boolean }) {
  return (
    <div className={`kpi${bad && value ? " bad" : ""}`}>
      <div className="kpi-top"><span>{label}</span><span className="kpi-ico"><Icon name={icon} /></span></div>
      <div className="kpi-value">{value ?? "–"}</div>
      <div className="kpi-delta">{value === null ? "unavailable" : delta}</div>
    </div>
  );
}

function hours(ms: number): string {
  const h = ms / 3600_000;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

async function Today({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const range = parseRange((await searchParams).range);
  const db = await createClient();
  const uid = user.id;
  const now = new Date();
  const today = localDate(now);
  const bounds = rangeBounds(range, now);
  const dayStart = startOfLocalDay(today).toISOString();
  const dayEnd = startOfLocalDay(addDays(today, 1)).toISOString();

  const [tasksR, remindersR, rangeEventsR, todayEventsR, syncR, docsR, docCountR, msgsR, actR, rulesR] = await Promise.all([
    listTasks(db, uid, "all", 200),
    listReminders(db, uid, false),
    listCalendarEvents(db, uid, bounds.from.toISOString(), bounds.to.toISOString()),
    listCalendarEvents(db, uid, dayStart, dayEnd),
    lastCalendarSync(db, uid),
    listDocuments(db, uid, 5),
    countDocuments(db, uid),
    listMessages(db, uid, undefined, 20),
    listActivity(db, uid, 5),
    getTriageRules(db, uid),
  ]);

  const tasks: Task[] = tasksR.ok ? tasksR.value : [];
  const open = tasks.filter((t) => !t.done);
  const dueToday = open.filter((t) => t.due_date === today);
  const overdue = open.filter((t) => t.due_date !== null && t.due_date < today);
  const doneToday = tasks.filter((t) => t.done && t.done_at && t.done_at >= dayStart);
  const oldestOverdue = overdue.reduce<string | null>((m, t) => (m === null || (t.due_date ?? m) < m ? t.due_date : m), null);

  const reminders = remindersR.ok ? remindersR.value : [];
  const critical = reminders.filter((r) => r.critical);
  const mail = reminders.filter((r) => !r.critical && r.source === "email-triage");
  const oldestMail = mail.reduce<string | null>((m, r) => (m === null || r.created_at < m ? r.created_at : m), null);

  const meetings = todayEventsR.ok ? todayEventsR.value : [];
  const meetingMs = meetings.reduce((s, e) => s + (e.ends_at ? Date.parse(e.ends_at) - Date.parse(e.starts_at) : 0), 0);

  const timelineTasks = open.filter((t) => t.due_date !== null && t.due_date >= bounds.startDate && t.due_date < bounds.endDateExclusive);
  const timelineReminders = reminders.filter((r) => r.due_at && r.due_at >= bounds.from.toISOString() && r.due_at < bounds.to.toISOString());
  const timeline = buildTimeline({ events: rangeEventsR.ok ? rangeEventsR.value : [], tasks: timelineTasks, reminders: timelineReminders });

  // Tasks card: overdue first, then by due date; done-today at the bottom.
  const taskList = [...open].sort((a, b) => (a.due_date ?? "9999") .localeCompare(b.due_date ?? "9999")).slice(0, 8).concat(doneToday.slice(0, 3));
  const msgs = msgsR.ok ? msgsR.value : [];
  const drafts = msgs.filter((m) => m.status === "draft").length;
  const rangeLabel = range === "today" ? "Today" : range === "week" ? "Next 7 days" : "Next 30 days";

  return (
    <div className="dash">
      <PageHeader title={greeting(now)} sub={fmtHeaderDate(now)}>
        <RangeSwitch base="/" current={range} />
        {syncR.ok ? <SyncPill syncedAt={syncR.value} now={now} /> : <span className="pill sync">Calendar unavailable</span>}
      </PageHeader>

      {!remindersR.ok ? <section className="alerts"><ErrorBox what="reminders" /></section> : critical.length > 0 && (
        <section className="alerts" aria-label="Critical reminders">
          {critical.map((r) => (
            <div className="alert" key={r.id}>
              <Icon name="bell" />
              <div className="alert-body">
                <strong>{r.message}</strong>
                <span>{[r.due_at ? (localDate(new Date(r.due_at)) === today ? fmtTime(r.due_at) : fmtWhen(r.due_at)) : null, r.source].filter(Boolean).join(" · ")}</span>
              </div>
              <AckButton id={r.id} label={r.message} />
            </div>
          ))}
        </section>
      )}

      <section className="kpis" aria-label="Today at a glance">
        <Kpi label="Due today" value={tasksR.ok ? dueToday.length : null} delta={`${doneToday.length} done`} icon="check" />
        <Kpi label="Overdue" value={tasksR.ok ? overdue.length : null} delta={oldestOverdue ? `since ${fmtDueDate(oldestOverdue)}` : "none"} icon="alert" bad />
        <Kpi label="Important mail" value={remindersR.ok ? mail.length : null} delta={oldestMail ? `since ${fmtWhen(oldestMail)}` : "none"} icon="mail" />
        <Kpi label="Meetings" value={todayEventsR.ok ? meetings.length : null} delta={meetingMs ? hours(meetingMs) : "0 h"} icon="cal" />
      </section>

      <Card title={rangeLabel} className="timeline" labelledBy="h-timeline" aside={<span className="muted">{timeline.length} items</span>}>
        {!rangeEventsR.ok || !tasksR.ok ? <ErrorBox what="timeline" /> : timeline.length === 0 ? <Empty>Nothing scheduled.</Empty> : <Timeline items={timeline} grouped={range !== "today"} />}
      </Card>

      <Card title="Tasks" className="tasks" aside={<Link href="/tasks" className="muted">{open.length} open</Link>}>
        {!tasksR.ok ? <ErrorBox what="tasks" /> : taskList.length === 0 ? <Empty>No open tasks.</Empty> : (
          <ul className="task-list">
            {taskList.map((t) => {
              const isOver = !t.done && t.due_date !== null && t.due_date < today;
              return (
                <li key={t.id} className={`task${t.done ? " done" : ""}${isOver ? " overdue" : ""}`}>
                  <TaskCheck id={t.id} title={t.title} done={t.done} />
                  <span className="task-title">{t.title}</span>
                  <span className={`chip pri-${t.priority}`}>{PRI[t.priority]}</span>
                  <span className="task-due">{isOver ? "Overdue · " : ""}{t.due_date ? fmtDueDate(t.due_date) : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Documents" className="docs" aside={<Link href="/documents" className="muted">{docCountR.ok ? docCountR.value : ""}</Link>}>
        {!docsR.ok ? <ErrorBox what="documents" /> : docsR.value.length === 0 ? <Empty>No documents yet.</Empty> : (
          <ul className="rows">
            {docsR.value.map((d) => (
              <li key={d.id}>
                <Link href={`/documents/${d.id}`} className="row-link">
                  <Icon name="file" /><span className="row-title">{d.title}</span>
                </Link>
                <span className="chip">{docKindLabel(d.kind)}</span><span className="row-when">{fmtWhen(d.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Messages" className="msgs" aside={<Link href="/messages" className="muted">{drafts} drafts</Link>}>
        {!msgsR.ok ? <ErrorBox what="messages" /> : msgs.length === 0 ? <Empty>No messages yet.</Empty> : (
          <ul className="rows">
            {msgs.slice(0, 4).map((m) => (
              <li key={m.id}>
                <span className="avatar" aria-hidden="true">{(m.to_name || m.to_email || "?")[0]?.toUpperCase()}</span>
                <div className="row-stack"><span className="row-title">{m.subject || "(no subject)"}</span><span className="row-sub">{m.to_name || m.to_email || ""}</span></div>
                <span className={`chip ${m.status}`}>{m.status === "draft" ? "Draft" : m.status === "sent" ? "Sent" : "Failed"}</span>
                <span className="row-when">{m.status === "sent" && m.sent_at ? fmtWhen(m.sent_at) : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Activity" className="activity" aside={<Link href="/activity" className="muted">Agent log</Link>}>
        {!actR.ok ? <ErrorBox what="activity" /> : actR.value.length === 0 ? <Empty>No activity yet.</Empty> : (
          <ul className="rows">
            {actR.value.map((a) => (
              <li key={a.id}>
                <span className="row-when">{fmtWhen(a.created_at)}</span>
                <div className="row-stack"><span className="row-title">{a.action}</span><span className="row-sub">{a.detail ?? ""}</span></div>
                <span className="chip">{ACTOR[a.actor]}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Triage rules" className="rules" aside={<Link href="/rules" className="muted">Edit</Link>}>
        {!rulesR.ok ? <ErrorBox what="triage rules" /> : (
          rulesR.value.vip.length + rulesR.value.keywords.length + rulesR.value.muted.length === 0 ? <Empty>No rules yet.</Empty> : (
            <div className="rule-groups">
              <div><span className="rule-label">VIP</span>{rulesR.value.vip.map((v, i) => <span key={i} className="chip vip">{v.name || v.email}</span>)}</div>
              <div><span className="rule-label">Keywords</span>{rulesR.value.keywords.map((v) => <span key={v} className="chip">{v}</span>)}</div>
              <div><span className="rule-label">Muted</span>{rulesR.value.muted.map((v) => <span key={v} className="chip muted-chip">{v}</span>)}</div>
            </div>
          )
        )}
      </Card>
    </div>
  );
}
