"use client";

import { useActionState } from "react";
import { createTokenAction, revokeTokenAction, type FormState } from "@/app/(app)/actions";
import { CopyButton } from "./copy-button";
import { ConfirmButton } from "./confirm-button";

export type TokenRow = { id: string; name: string; scope: string; created: string; lastUsed: string | null; revoked: boolean };

export function TokenManager({ tokens }: { tokens: TokenRow[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTokenAction, { ok: false });
  return (
    <div className="stack">
      <form action={action} className="form-row">
        <label className="field grow">
          <span>New token name</span>
          <input className="input" name="name" required maxLength={100} placeholder="e.g. Claude Code on server" />
        </label>
        <label className="field">
          <span>Access</span>
          <select className="input" name="scope" defaultValue="full">
            <option value="full">Full (read + write)</option>
            <option value="read">Read-only</option>
          </select>
        </label>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Creating…" : "Create token"}</button>
      </form>
      {!state.ok && state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.ok && state.token && (
        <div className="stack" role="status">
          <p className="form-ok">Copy this token now. It will not be shown again.</p>
          <div className="token-box"><code>{state.token}</code><CopyButton value={state.token} /></div>
        </div>
      )}
      {tokens.length === 0 ? <p className="empty">No tokens yet.</p> : (
        <ul className="rows">
          {tokens.map((t) => (
            <li key={t.id}>
              <div className="row-stack">
                <span className="row-title" style={t.revoked ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>{t.name}</span>
                <span className="row-sub">{t.scope === "read" ? "Read-only · " : ""}Created {t.created} · {t.lastUsed ? `Last used ${t.lastUsed}` : "Never used"}</span>
              </div>
              {t.revoked ? <span className="chip">Revoked</span> : (
                <ConfirmButton variant="button" label="Revoke" title="Revoke token?" body={`Agents using "${t.name}" will lose access immediately.`} confirmLabel="Revoke" action={() => revokeTokenAction(t.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
