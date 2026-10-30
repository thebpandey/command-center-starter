import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { serverEnv } from "../env";

// Service-role client: bypasses RLS. Every query made with it MUST filter by the owner's user_id.
export function createAdminClient() {
  const env = serverEnv();
  return createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
