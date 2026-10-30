"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { deleteDocumentAction } from "@/app/(app)/actions";
import { DocumentEditor, type DocFormValues } from "./document-editor";
import { ConfirmButton } from "./confirm-button";
import { Icon } from "./icons";

export function DocumentView({ doc, rendered }: { doc: DocFormValues & { id: string }; rendered: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  if (editing) return <DocumentEditor initial={doc} onSaved={() => setEditing(false)} />;
  return (
    <div className="stack">
      <div className="form-row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn secondary" onClick={() => setEditing(true)}>
          <Icon name="edit" /> Edit
        </button>
        <ConfirmButton
          variant="button"
          label="Delete"
          title="Delete document?"
          body={`"${doc.title}" and its attachment will be permanently deleted.`}
          action={() => deleteDocumentAction(doc.id)}
          onDone={() => router.push("/documents")}
        />
      </div>
      {doc.body_md.trim() ? rendered : <p className="empty">No content yet.</p>}
    </div>
  );
}
