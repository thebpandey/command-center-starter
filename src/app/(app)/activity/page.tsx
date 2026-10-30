import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listActivity } from "@/lib/data/activity";
import { fmtWhen } from "@/lib/time";
import { Card, ErrorBox, Empty, PageHeader, PanelSkeleton } from "@/components/ui";

export const metadata = { title: "Activity · Assistant" };
const ACTOR: Record<string, string> = { assistant: "Assistant", "scheduled-task": "Scheduled", user: "You" };

export default function ActivityPage() {
  return (
    <>
      <PageHeader title="Activity" />
      <Suspense fallback={<PanelSkeleton rows={10} />}>
        <ActivityList />
      </Suspense>
    </>
  );
}

async function ActivityList() {
  const user = await requireUser();
  const r = await listActivity(await createClient(), user.id, 200);
  return (
    <Card title="Agent log" className="activity" labelledBy="h-act" aside={<span className="muted">Read-only</span>}>
      {!r.ok ? <ErrorBox what="activity" /> : r.value.length === 0 ? <Empty>No activity yet.</Empty> : (
        <ul className="rows">
          {r.value.map((a) => (
            <li key={a.id}>
              <span className="row-when">{fmtWhen(a.created_at)}</span>
              <div className="row-stack"><span className="row-title">{a.action}</span><span className="row-sub">{a.detail ?? ""}</span></div>
              <span className="chip">{ACTOR[a.actor]}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
