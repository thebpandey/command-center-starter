import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { isOwnerEmail } from "@/lib/owner-email";

const OTP_TYPES: readonly EmailOtpType[] = ["magiclink", "email", "signup", "invite", "recovery", "email_change"];
const isOtpType = (v: string | null): v is EmailOtpType => v !== null && (OTP_TYPES as readonly string[]).includes(v);

// Handles both PKCE (?code=) and token-hash (?token_hash=&type=) magic links.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createClient();

  let email: string | null = null;
  if (code) {
    const r = await supabase.auth.exchangeCodeForSession(code);
    email = r.error ? null : (r.data.user?.email ?? null);
  } else if (tokenHash && isOtpType(type)) {
    const r = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    email = r.error ? null : (r.data.user?.email ?? null);
  }

  if (email && isOwnerEmail(email, serverEnv().ownerEmail)) {
    return NextResponse.redirect(new URL("/", url.origin));
  }
  if (email) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
