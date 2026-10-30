"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteTaskAction } from "@/app/(app)/actions";
import { TaskCheck } from "./task-check";
import { TaskForm } from "./task-form";
import { ConfirmButton } from "./confirm-button";
import { Icon } from "./icons";

export type TaskRowData = {
  id: string; title: string; notes: string | null; due_date: string | null; priority: string; done: boolean;
  dueLabel: string; overdue: boolean; onCalendar?: string;
};

const PRI: Record<string, string> = { low: "Low", med: "Med", high: "High" };

export function TaskRow({ t }: { t: TaskRowData }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="task" style={{ display: "block" }}>
        <TaskForm initial={t} submitLabel="Save" onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className={`task full${t.done ? " done" : ""}${t.overdue ? " overdue" : ""}`}>
      <TaskCheck id={t.id} title={t.title} done={t.done} />
      <span className="task-title">
        {t.title}
        {t.onCalendar && <Link href="/calendar" className="chip" style={{ marginLeft: 8 }}>On calendar · {t.onCalendar}</Link>}
        {t.notes && <span className="row-sub" style={{ display: "block" }}>{t.notes}</span>}
      </span>
      <span className={`chip pri-${t.priority}`}>{PRI[t.priority] ?? t.priority}</span>
      <span className="task-due">{t.overdue ? "Overdue · " : ""}{t.dueLabel}</span>
      <span className="task-actions">
        <button type="button" className="icon-btn" aria-label={`Edit ${t.title}`} onClick={() => setEditing(true)}>
          <Icon name="edit" />
        </button>
        <ConfirmButton label={`Delete ${t.title}`} title="Delete task?" body={t.title} action={() => deleteTaskAction(t.id)} />
      </span>
    </li>
  );
}
