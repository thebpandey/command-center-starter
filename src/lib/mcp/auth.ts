import "server-only";
import type { Db } from "../data/db";
import { hashToken } from "../tokens";
import { type Result, ok, err } from "../result";
import { tokenScope } from "../schemas";

export type TokenScope = "full" | "read";

export type BearerError = "MISSING_TOKEN" | "INVALID_TOKEN" | "AUTH_LOOKUP_FAILED";

export function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m ? m[1] : null;
}

// Valid = hash matches a non-revoked token that belongs to the owner.
export async function verifyBearer(
  admin: Db,
  authorization: string | null,
  ownerId: string,
): Promise<Result<{ tokenId: string; scope: TokenScope }, BearerError>> {
  const raw = extractBearer(authorization);
  if (!raw) return err("MISSING_TOKEN");
  if (raw.length > 200) return err("INVALID_TOKEN");
  const { data, error } = await admin
    .from("api_tokens")
    .select("id,user_id,scope")
    .eq("token_hash", hashToken(raw))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) return err("AUTH_LOOKUP_FAILED", error.message);
  if (!data || data.user_id !== ownerId) return err("INVALID_TOKEN");
  const upd = await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  if (upd.error) return err("AUTH_LOOKUP_FAILED", upd.error.message);
  // Unknown scope values fail closed to read-only.
  const scope = tokenScope.safeParse(data.scope);
  return ok({ tokenId: data.id, scope: scope.success ? scope.data : "read" });
}
