"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveTaskAction, type FormState } from "@/app/(app)/actions";

export type TaskFormValues = { id?: string; title?: string; notes?: string | null; due_date?: string | null; priority?: string };

export function TaskForm({ initial, onDone, submitLabel = "Add task" }: { initial?: TaskFormValues; onDone?: () => void; submitLabel?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTaskAction, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && state.nonce) {
      if (!initial?.id) formRef.current?.reset();
      onDone?.();
    }
  }, [state, initial?.id, onDone]);
  return (
    <form ref={formRef} action={action} className="stack">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="form-row">
        <label className="field grow">
          <span>Title</span>
          <input className="input" name="title" required maxLength={500} defaultValue={initial?.title ?? ""} />
        </label>
        <label className="field">
          <span>Due</span>
          <input className="input" type="date" name="due_date" defaultValue={initial?.due_date ?? ""} />
        </label>
        <label className="field">
          <span>Priority</span>
          <select className="input" name="priority" defaultValue={initial?.priority ?? "med"}>
            <option value="low">Low</option>
            <option value="med">Med</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea className="input" name="notes" maxLength={10000} rows={2} style={{ minHeight: 64 }} defaultValue={initial?.notes ?? ""} />
      </label>
      {!state.ok && state.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="form-row" style={{ justifyContent: "flex-end" }}>
        {onDone && initial?.id && <button type="button" className="btn secondary" onClick={onDone}>Cancel</button>}
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
