import { z } from "zod";
import { isOwnerEmail } from "./owner-email";
import { type Result, ok, err } from "./result";

export const loginSchema = z.object({ email: z.string().trim().max(320).pipe(z.email()) });

export type SendOtp = (email: string, redirectTo: string) => Promise<Result<null, "SEND_FAILED">>;

export type MagicLinkOutcome = Result<"CHECK_EMAIL", "INVALID_EMAIL" | "SEND_FAILED">;

// Non-owner emails get the same "check your email" outcome as the owner, but no OTP is sent.
// This prevents account enumeration and stops strangers from creating accounts.
export async function requestMagicLink(
  rawEmail: unknown,
  deps: { ownerEmail: string; redirectTo: string; sendOtp: SendOtp },
): Promise<MagicLinkOutcome> {
  const parsed = loginSchema.safeParse({ email: rawEmail });
  if (!parsed.success) return err("INVALID_EMAIL");
  if (!isOwnerEmail(parsed.data.email, deps.ownerEmail)) return ok("CHECK_EMAIL");
  const sent = await deps.sendOtp(parsed.data.email.trim().toLowerCase(), deps.redirectTo);
  if (!sent.ok) return err("SEND_FAILED");
  return ok("CHECK_EMAIL");
}
