"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/browser";
import { attachFileAction, removeAttachmentAction } from "@/app/(app)/actions";
import { ConfirmButton } from "./confirm-button";
import { Icon } from "./icons";

const MAX_BYTES = 50 * 1024 * 1024;
const safeName = (n: string) => n.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-120) || "file";

// Upload goes browser -> Supabase Storage directly (avoids the serverless body limit).
// Storage RLS only allows writes under "<own user id>/", and the server re-validates the path.
export function Attachment({ docId, userId, path }: { docId: string; userId: string; path: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileName = path ? path.split("/").pop() : null;

  function upload(file: File) {
    if (file.size > MAX_BYTES) return setError("File is larger than 50 MB");
    setError(null);
    start(async () => {
      const objectPath = `${userId}/${docId}/${Date.now()}-${safeName(file.name)}`;
      const up = await createClient().storage.from("attachments").upload(objectPath, file, { contentType: file.type || undefined });
      if (up.error) return setError("Upload failed");
      const r = await attachFileAction(docId, objectPath);
      if (!r.ok) setError(r.error ?? "Could not save attachment");
    });
  }

  return (
    <div className="stack">
      {fileName ? (
        <div className="form-row" style={{ alignItems: "center" }}>
          <Icon name="paperclip" />
          <span className="row-title" style={{ flex: 1 }}>{fileName.replace(/^\d+-/, "")}</span>
          <a className="btn secondary" href={`/api/documents/${docId}/download`}><Icon name="download" /> Download</a>
          <ConfirmButton label="Remove attachment" title="Remove attachment?" body="The file will be permanently deleted." confirmLabel="Remove" action={() => removeAttachmentAction(docId)} />
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>No attachment.</p>
      )}
      <div>
        <input ref={input} type="file" className="sr-only" id={`file-${docId}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <label htmlFor={`file-${docId}`} className="btn ghost" style={{ cursor: "pointer" }} aria-disabled={pending}>
          <Icon name="paperclip" /> {pending ? "Uploading…" : fileName ? "Replace file" : "Upload file"}
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
