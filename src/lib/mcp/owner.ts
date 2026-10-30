import "server-only";
import type { Db } from "../data/db";
import { serverEnv } from "../env";
import { isOwnerEmail } from "../owner-email";
import { type Result, ok, err } from "../result";

let cachedOwnerId: string | null = null;

// The owner is the single auth user whose email equals OWNER_EMAIL. If they have never logged in,
// the user is created (email confirmed) so agents can write before the first web login.
export async function getOwnerId(admin: Db): Promise<Result<string, "OWNER_LOOKUP_FAILED">> {
  if (cachedOwnerId) return ok(cachedOwnerId);
  const ownerEmail = serverEnv().ownerEmail;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return err("OWNER_LOOKUP_FAILED", error.message);
    const match = data.users.find((u) => u.email && isOwnerEmail(u.email, ownerEmail));
    if (match) {
      cachedOwnerId = match.id;
      return ok(match.id);
    }
    if (data.users.length < 100) break;
  }
  const created = await admin.auth.admin.createUser({ email: ownerEmail, email_confirm: true });
  if (created.error || !created.data.user) return err("OWNER_LOOKUP_FAILED", created.error?.message);
  cachedOwnerId = created.data.user.id;
  return ok(created.data.user.id);
}
