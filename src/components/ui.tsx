import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import type { Range } from "@/lib/time";
import { fmtWhen } from "@/lib/time";
import type { TimelineItem } from "@/lib/timeline";
import { groupByDay } from "@/lib/timeline";

export function Card({ title, aside, className = "", children, labelledBy }: { title: string; aside?: ReactNode; className?: string; children: ReactNode; labelledBy?: string }) {
  const id = labelledBy ?? `h-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section className={`card ${className}`} aria-labelledby={id}>
      <div className="card-h">
        <h2 id={id}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ErrorBox({ what }: { what: string }) {
  return <div className="error-box" role="alert">Could not load {what}. Refresh to try again.</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className={`header${children ? "" : " simple"}`}>
      <div className="title">
        <h1>{title}</h1>
        {sub && <span className="date">{sub}</span>}
      </div>
      <div className="toolbar">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}

const RANGES: { v: Range; l: string }[] = [{ v: "today", l: "Today" }, { v: "week", l: "Week" }, { v: "month", l: "Month" }];

export function RangeSwitch({ base, current }: { base: string; current: Range }) {
  return (
    <nav className="seg" aria-label="Timeline range">
      {RANGES.map((r) => (
        <Link key={r.v} href={`${base}?range=${r.v}`} className={r.v === current ? "on" : undefined} aria-current={r.v === current ? "true" : undefined} scroll={false}>
          {r.l}
        </Link>
      ))}
    </nav>
  );
}

export function SyncPill({ syncedAt, now }: { syncedAt: string | null; now: Date }) {
  const stale = !syncedAt || now.getTime() - Date.parse(syncedAt) > 6 * 3600_000;
  return (
    <span className="pill sync" title={syncedAt ? `Calendar synced ${new Date(syncedAt).toISOString()}` : "Calendar never synced"}>
      <Icon name="sync" />
      <span className={`dot${stale ? " stale" : ""}`} />
      {syncedAt ? `Calendar synced ${fmtWhen(syncedAt)}` : "Calendar not synced"}
    </span>
  );
}

export function Timeline({ items, grouped }: { items: TimelineItem[]; grouped: boolean }) {
  const row = (x: TimelineItem) => (
    <li key={x.key} className={`tl-item k-${x.kind}${x.taskState === "done" ? " task-done" : ""}`}>
      <span className="tl-time">{x.time}</span>
      <span className="tl-mark" aria-hidden="true" />
      <div className="tl-body">
        {x.href ? <Link href={x.href} className="tl-title">{x.title}</Link> : <span className="tl-title">{x.title}</span>}
        <span className="tl-meta">
          {x.kind === "task" ? <span className="chip">Task</span> : x.taskState ? <span className="chip">{x.taskState === "done" ? "Task done" : "Task open"}</span> : <span className="sr-only">{x.kind === "event" ? "Event" : "Reminder"}: </span>}
          {(x.kind === "task" || x.taskState) && " "}{x.meta}
        </span>
      </div>
    </li>
  );
  if (!grouped) return <ol className="tl">{items.map(row)}</ol>;
  return (
    <ol className="tl">
      {groupByDay(items).map((g) => (
        <li key={g.day}>
          <div className="tl-day">{g.label}</div>
          <ol className="tl">{g.items.map(row)}</ol>
        </li>
      ))}
    </ol>
  );
}

export function PanelSkeleton({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`card ${className}`} aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 18, width: 120, marginBottom: 14 }} />
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height: 30, marginBottom: 10 }} />)}
    </div>
  );
}
