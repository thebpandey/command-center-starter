"use client";

import { useOptimistic, useTransition } from "react";
import { toggleTaskAction } from "@/app/(app)/actions";

export function TaskCheck({ id, title, done }: { id: string; title: string; done: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <input
      type="checkbox"
      checked={optimistic}
      aria-label={`${optimistic ? "Mark not done" : "Mark done"}: ${title}`}
      onChange={(e) => {
        const next = e.target.checked;
        start(async () => {
          setOptimistic(next);
          await toggleTaskAction(id, next);
        });
      }}
    />
  );
}
