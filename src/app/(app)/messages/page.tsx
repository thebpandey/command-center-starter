import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listMessages } from "@/lib/data/messages";
import { fmtWhen } from "@/lib/time";
import { Card, ErrorBox, Empty, PageHeader, PanelSkeleton } from "@/components/ui";

export const metadata = { title: "Messages · Assistant" };
type SP = Promise<{ status?: string | string[] }>;
const TABS = [["", "All"], ["draft", "Drafts"], ["sent", "Sent"], ["failed", "Failed"]] as const;

export default function MessagesPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<><PageHeader title="Messages" /><PanelSkeleton rows={8} /></>}>
      <Messages searchParams={searchParams} />
    </Suspense>
  );
}

async function Messages({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const v = (await searchParams).status;
  const status = v === "draft" || v === "sent" || v === "failed" ? v : undefined;
  const r = await listMessages(await createClient(), user.id, status, 200);
  return (
    <>
      <PageHeader title="Messages">
        <nav className="seg" aria-label="Filter">
          {TABS.map(([k, l]) => (
            <Link key={k} href={k ? `/messages?status=${k}` : "/messages"} className={(status ?? "") === k ? "on" : undefined} aria-current={(status ?? "") === k ? "true" : undefined}>{l}</Link>
          ))}
        </nav>
      </PageHeader>
      <Card title="Messages" className="msgs" labelledBy="h-msgs">
        {!r.ok ? <ErrorBox what="messages" /> : r.value.length === 0 ? <Empty>No messages. Drafts the assistant writes appear here.</Empty> : (
          <ul className="rows">
            {r.value.map((m) => (
              <li key={m.id}>
                <span className="avatar" aria-hidden="true">{(m.to_name || m.to_email || "?")[0]?.toUpperCase()}</span>
                <details className="row-stack">
                  <summary style={{ cursor: "pointer", listStyle: "none" }}>
                    <span className="row-title" style={{ display: "block" }}>{m.subject || "(no subject)"}</span>
                    <span className="row-sub" style={{ display: "block" }}>{[m.to_name, m.to_email].filter(Boolean).join(" · ")}</span>
                  </summary>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: 14, marginTop: 8 }}>{m.body_md}</p>
                </details>
                <span className={`chip ${m.status}`}>{m.status === "draft" ? "Draft" : m.status === "sent" ? "Sent" : "Failed"}</span>
                <span className="row-when">{fmtWhen(m.sent_at ?? m.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
