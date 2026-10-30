"use client";

import { useActionState, useState } from "react";
import { saveTriageRulesAction, type FormState } from "@/app/(app)/actions";
import type { TriageRulesInput, VipEntry } from "@/lib/schemas";
import { Icon } from "./icons";

type ListKey = "keywords" | "muted" | "critical_triggers";
const LISTS: { key: ListKey; label: string; hint: string }[] = [
  { key: "keywords", label: "Keywords", hint: "Mail containing these is important" },
  { key: "critical_triggers", label: "Critical triggers", hint: "These raise a critical reminder" },
  { key: "muted", label: "Muted", hint: "Ignored senders or topics" },
];

function ListEditor({ label, hint, values, onChange, muted }: { label: string; hint: string; values: string[]; onChange: (v: string[]) => void; muted?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <fieldset className="stack" style={{ border: 0 }}>
      <legend className="rule-label" style={{ marginBottom: 6 }}>{label}</legend>
      <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>{hint}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {values.length === 0 && <span className="muted" style={{ fontSize: 13 }}>None</span>}
        {values.map((v) => (
          <span key={v} className={`chip${muted ? " muted-chip" : ""}`} style={{ gap: 4, paddingRight: 2 }}>
            {v}
            <button type="button" className="icon-btn" style={{ width: 24, height: 24 }} aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              <Icon name="x" />
            </button>
          </span>
        ))}
      </div>
      <div className="form-row">
        <input className="input grow" value={draft} maxLength={200} aria-label={`Add to ${label}`} placeholder="Add…"
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn secondary" onClick={add}><Icon name="plus" /> Add</button>
      </div>
    </fieldset>
  );
}

export function TriageEditor({ initial }: { initial: TriageRulesInput }) {
  const [rules, setRules] = useState<TriageRulesInput>(initial);
  const [state, action, pending] = useActionState<FormState, FormData>(saveTriageRulesAction, { ok: false });
  const [vip, setVip] = useState<VipEntry>({ name: "", email: "", note: "" });

  return (
    <form action={action} className="stack">
      <input type="hidden" name="rules" value={JSON.stringify(rules)} />
      <section className="card stack" aria-labelledby="vip-h">
        <h2 id="vip-h">VIP senders</h2>
        {rules.vip.length === 0 ? <p className="empty">No VIPs yet.</p> : (
          <ul className="rows">
            {rules.vip.map((v, i) => (
              <li key={`${v.email}-${i}`}>
                <span className="avatar">{(v.name || v.email || "?")[0]?.toUpperCase()}</span>
                <div className="row-stack">
                  <span className="row-title">{v.name || v.email}</span>
                  <span className="row-sub">{[v.email, v.note].filter(Boolean).join(" · ")}</span>
                </div>
                <button type="button" className="icon-btn" aria-label={`Remove ${v.name || v.email}`} onClick={() => setRules({ ...rules, vip: rules.vip.filter((_, j) => j !== i) })}>
                  <Icon name="trash" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="form-row">
          <label className="field grow"><span>Name</span><input className="input" value={vip.name} maxLength={200} onChange={(e) => setVip({ ...vip, name: e.target.value })} /></label>
          <label className="field grow"><span>Email</span><input className="input" type="email" value={vip.email} maxLength={320} onChange={(e) => setVip({ ...vip, email: e.target.value })} /></label>
          <label className="field grow"><span>Note</span><input className="input" value={vip.note} maxLength={500} onChange={(e) => setVip({ ...vip, note: e.target.value })} /></label>
          <button type="button" className="btn secondary" disabled={!vip.name.trim() && !vip.email.trim()}
            onClick={() => { setRules({ ...rules, vip: [...rules.vip, { name: vip.name.trim(), email: vip.email.trim(), note: vip.note.trim() }] }); setVip({ name: "", email: "", note: "" }); }}>
            <Icon name="plus" /> Add VIP
          </button>
        </div>
      </section>
      <section className="card stack" aria-label="Lists">
        {LISTS.map((l) => (
          <ListEditor key={l.key} label={l.label} hint={l.hint} values={rules[l.key]} muted={l.key === "muted"} onChange={(v) => setRules({ ...rules, [l.key]: v })} />
        ))}
      </section>
      {!state.ok && state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.ok && state.message && <p className="form-ok" role="status">{state.message}</p>}
      <div className="form-row" style={{ justifyContent: "flex-end" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save rules"}</button>
      </div>
    </form>
  );
}
