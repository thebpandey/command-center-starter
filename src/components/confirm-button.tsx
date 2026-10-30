"use client";

import { useRef, useState, useTransition } from "react";
import type { FormState } from "@/app/(app)/actions";
import { Icon } from "./icons";

// Destructive actions go through a native <dialog> so they are keyboard and screen-reader friendly.
export function ConfirmButton({
  label, title, body, confirmLabel = "Delete", action, onDone, variant = "icon",
}: {
  label: string; title: string; body: string; confirmLabel?: string;
  action: () => Promise<FormState>; onDone?: () => void; variant?: "icon" | "button";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {variant === "icon" ? (
        <button type="button" className="icon-btn" aria-label={label} onClick={() => ref.current?.showModal()}>
          <Icon name="trash" />
        </button>
      ) : (
        <button type="button" className="btn ghost" onClick={() => ref.current?.showModal()}>
          {label}
        </button>
      )}
      <dialog ref={ref} className="confirm" aria-labelledby={undefined}>
        <div className="stack">
          <h2>{title}</h2>
          <p className="muted">{body}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn secondary" onClick={() => ref.current?.close()}>Cancel</button>
            <button
              type="button"
              className="btn danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await action();
                  if (r.ok) {
                    ref.current?.close();
                    onDone?.();
                  } else setError(r.error ?? "Failed");
                })
              }
            >
              {pending ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
