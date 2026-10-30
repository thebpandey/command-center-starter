import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader, PanelSkeleton } from "@/components/ui";
import { DocumentEditor } from "@/components/document-editor";

export const metadata = { title: "New document · Assistant" };

export default function NewDocumentPage() {
  return (
    <>
      <PageHeader title="New document" />
      <Suspense fallback={<PanelSkeleton rows={6} />}>
        <NewDoc />
      </Suspense>
    </>
  );
}

async function NewDoc() {
  await requireUser();
  return (
    <Card title="Document" labelledBy="h-doc">
      <DocumentEditor initial={{ title: "", kind: "note", body_md: "", tags: [] }} />
    </Card>
  );
}
