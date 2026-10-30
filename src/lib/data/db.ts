import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { type Result, ok, err } from "../result";

export type Db = SupabaseClient<Database>;
export type DbError = "DB_ERROR" | "NOT_FOUND" | "EVENT_NOT_FOUND";
export type DbResult<T> = Result<T, DbError>;

type PgResp = { data: unknown; error: { message: string } | null };

export function fromPg<R extends PgResp>(r: R): DbResult<NonNullable<R["data"]>> {
  if (r.error) return err("DB_ERROR", r.error.message);
  if (r.data === null || r.data === undefined) return err("NOT_FOUND");
  return ok(r.data as NonNullable<R["data"]>);
}

export function fromPgMaybe<R extends PgResp>(r: R): DbResult<R["data"] | null> {
  if (r.error) return err("DB_ERROR", r.error.message);
  return ok(r.data ?? null);
}
