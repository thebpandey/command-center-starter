"use client";

import { useState, useTransition } from "react";
import { acknowledgeReminderAction } from "@/app/(app)/actions";

export function AckButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="ack"
        disabled={pending}
        aria-label={`Acknowledge: ${label}`}
        onClick={() =>
          start(async () => {
            const r = await acknowledgeReminderAction(id);
            setError(r.ok ? null : (r.error ?? "Failed"));
          })
        }
      >
        {pending ? "…" : "Acknowledge"}
      </button>
      {error && <span role="alert" className="sr-only">{error}</span>}
    </>
  );
}
