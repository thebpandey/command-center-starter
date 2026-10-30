"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveDocumentAction, type FormState } from "@/app/(app)/actions";

export type DocFormValues = { id?: string; title: string; kind: string; body_md: string; tags: string[] };

const KINDS = [["note", "Note"], ["research", "Research"], ["briefing", "Briefing"], ["pdf", "PDF"], ["contract", "Contract"], ["transcript", "Transcript"], ["report", "Report"], ["data", "Data"], ["other", "Other"]] as const;

export function DocumentEditor({ initial, onSaved }: { initial: DocFormValues; onSaved?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDocumentAction, { ok: false });
  const router = useRouter();
  useEffect(() => {
    if (!state.ok || !state.nonce) return;
    if (!initial.id && state.id) router.push(`/documents/${state.id}`);
    else onSaved?.();
  }, [state, initial.id, router, onSaved]);
  return (
    <form action={action} className="stack">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="form-row">
        <label className="field grow">
          <span>Title</span>
          <input className="input" name="title" required maxLength={500} defaultValue={initial.title} />
        </label>
        <label className="field">
          <span>Kind</span>
          <select className="input" name="kind" defaultValue={initial.kind}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Tags (comma separated)</span>
        <input className="input" name="tags" defaultValue={initial.tags.join(", ")} />
      </label>
      <label className="field">
        <span>Markdown</span>
        <textarea className="input tall" name="body_md" defaultValue={initial.body_md} />
      </label>
      {!state.ok && state.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="form-row" style={{ justifyContent: "flex-end" }}>
        {onSaved && <button type="button" className="btn secondary" onClick={onSaved}>Cancel</button>}
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
