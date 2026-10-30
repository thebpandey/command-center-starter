import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDocument } from "@/lib/data/documents";

// Session-checked redirect to a 60-second signed URL for the private attachment.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  const db = await createClient();
  const doc = await getDocument(db, user.id, id.data);
  if (!doc.ok || !doc.value.attachment_path) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  const name = doc.value.attachment_path.split("/").pop()?.replace(/^\d+-/, "") ?? "download";
  const signed = await db.storage.from("attachments").createSignedUrl(doc.value.attachment_path, 60, { download: name });
  if (signed.error || !signed.data) return NextResponse.json({ ok: false, error: "SIGN_FAILED" }, { status: 500 });
  return NextResponse.redirect(signed.data.signedUrl, { headers: { "cache-control": "no-store" } });
}
