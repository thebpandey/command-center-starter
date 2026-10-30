import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnerId } from "@/lib/mcp/owner";
import type { Database } from "@/lib/supabase/database.types";

export const TEST_SOURCE = "vitest";

export async function ownerContext() {
  const admin = createAdminClient();
  const owner = await getOwnerId(admin);
  if (!owner.ok) throw new Error(`owner lookup failed: ${owner.error}`);
  return { admin, uid: owner.value };
}

export function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("public Supabase env missing");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}
