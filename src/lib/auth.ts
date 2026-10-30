import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { serverEnv } from "./env";
import { isOwnerEmail } from "./owner-email";

export type SessionUser = { id: string; email: string };

// Data Access Layer: every page, action and route handler calls this. Authorization is decided here,
// server-side: a valid Supabase session AND the owner's email. Anything else is sent to /login.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const sub = data.claims.sub;
  const email = data.claims.email;
  if (typeof sub !== "string" || typeof email !== "string") return null;
  if (!isOwnerEmail(email, serverEnv().ownerEmail)) return null;
  return { id: sub, email };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
