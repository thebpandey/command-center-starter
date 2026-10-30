import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listDocuments, searchDocuments } from "@/lib/data/documents";
import { fmtWhen } from "@/lib/time";
import { docKindLabel } from "@/lib/schemas";
import { Card, ErrorBox, Empty, PageHeader, PanelSkeleton } from "@/components/ui";
import { Icon } from "@/components/icons";

export const metadata = { title: "Documents · Assistant" };
type SP = Promise<{ q?: string | string[] }>;

export default function DocumentsPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader title="Documents">
        <Link href="/documents/new" className="btn"><Icon name="plus" /> New</Link>
      </PageHeader>
      <Suspense fallback={<PanelSkeleton rows={8} />}>
        <Docs searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Docs({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 200);
  const db = await createClient();
  return (
    <Card title={q ? `Results for “${q}”` : "All documents"} className="docs" labelledBy="h-docs">
      <form role="search" className="form-row" style={{ marginBottom: 12 }}>
        <label className="field grow">
          <span className="sr-only">Search documents</span>
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Search titles and content" maxLength={200} />
        </label>
        <button className="btn secondary" type="submit"><Icon name="search" /> Search</button>
        {q && <Link className="btn ghost" href="/documents">Clear</Link>}
      </form>
      {q ? <SearchResults db={db} uid={user.id} q={q} /> : <AllDocs db={db} uid={user.id} />}
    </Card>
  );
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function SearchResults({ db, uid, q }: { db: Db; uid: string; q: string }) {
  const r = await searchDocuments(db, uid, q, 50);
  if (!r.ok) return <ErrorBox what="search results" />;
  if (r.value.length === 0) return <Empty>No documents match.</Empty>;
  return (
    <ul className="rows">
      {r.value.map((d) => (
        <li key={d.id}>
          <Link href={`/documents/${d.id}`} className="row-link">
            <Icon name="file" />
            <div className="row-stack"><span className="row-title">{d.title}</span><span className="row-sub">{d.snippet}</span></div>
          </Link>
          <span className="chip">{docKindLabel(d.kind)}</span>
        </li>
      ))}
    </ul>
  );
}

async function AllDocs({ db, uid }: { db: Db; uid: string }) {
  const r = await listDocuments(db, uid, 200);
  if (!r.ok) return <ErrorBox what="documents" />;
  if (r.value.length === 0) return <Empty>No documents yet. Create one, or let the assistant save briefings here.</Empty>;
  return (
    <ul className="rows">
      {r.value.map((d) => (
        <li key={d.id}>
          <Link href={`/documents/${d.id}`} className="row-link">
            <Icon name={d.attachment_path ? "paperclip" : "file"} /><span className="row-title">{d.title}</span>
          </Link>
          <span className="chip">{docKindLabel(d.kind)}</span><span className="row-when">{fmtWhen(d.updated_at)}</span>
        </li>
      ))}
    </ul>
  );
}
