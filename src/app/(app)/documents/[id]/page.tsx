import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDocument } from "@/lib/data/documents";
import { fmtWhen } from "@/lib/time";
import { docKindLabel } from "@/lib/schemas";
import { Card, ErrorBox, PanelSkeleton } from "@/components/ui";
import { DocumentView } from "@/components/document-view";
import { Attachment } from "@/components/attachment";
import { Markdown } from "@/components/markdown";

export const metadata = { title: "Document · Assistant" };
type P = Promise<{ id: string }>;

export default function DocumentPage({ params }: { params: P }) {
  return (
    <Suspense fallback={<PanelSkeleton rows={10} />}>
      <Doc params={params} />
    </Suspense>
  );
}

async function Doc({ params }: { params: P }) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const r = await getDocument(await createClient(), user.id, id.data);
  if (!r.ok && r.error === "NOT_FOUND") notFound();
  if (!r.ok) return <ErrorBox what="this document" />;
  const d = r.value;
  return (
    <div className="two-col">
      <Card title={d.title} labelledBy="h-doc-title" aside={<span className="chip">{docKindLabel(d.kind)}</span>}>
        <DocumentView doc={{ id: d.id, title: d.title, kind: d.kind, body_md: d.body_md, tags: d.tags }} rendered={<Markdown source={d.body_md} />} />
      </Card>
      <div className="stack">
        <Card title="Details" labelledBy="h-doc-details">
          <dl className="stack" style={{ gap: 6, fontSize: 14 }}>
            <div><dt className="rule-label">Updated</dt><dd>{fmtWhen(d.updated_at)}</dd></div>
            <div><dt className="rule-label">Source</dt><dd>{d.source ?? "–"}</dd></div>
            <div><dt className="rule-label">Tags</dt><dd style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{d.tags.length ? d.tags.map((t) => <span key={t} className="chip">{t}</span>) : "–"}</dd></div>
          </dl>
        </Card>
        <Card title="Attachment" labelledBy="h-doc-att">
          <Attachment docId={d.id} userId={user.id} path={d.attachment_path} />
        </Card>
      </div>
    </div>
  );
}
