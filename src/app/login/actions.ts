"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { requestMagicLink } from "@/lib/login";
import { ok, err } from "@/lib/result";

export type LoginState = { status: "idle" | "sent" | "invalid" | "error" };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const supabase = await createClient();
  const outcome = await requestMagicLink(formData.get("email"), {
    ownerEmail: serverEnv().ownerEmail,
    redirectTo: `${await origin()}/auth/callback`,
    sendOtp: async (email, redirectTo) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) {
        console.error("signInWithOtp failed", error.status, error.code);
        return err("SEND_FAILED");
      }
      return ok(null);
    },
  });
  if (outcome.ok) return { status: "sent" };
  return { status: outcome.error === "INVALID_EMAIL" ? "invalid" : "error" };
}
