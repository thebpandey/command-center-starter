import { triageRulesInput, vipEntry, type TriageRulesInput, type VipEntry } from "../schemas";
import { type Db, fromPg, fromPgMaybe } from "./db";
import { ok } from "../result";

export const EMPTY_RULES: TriageRulesInput = { vip: [], keywords: [], muted: [], critical_triggers: [] };

function parseVip(raw: unknown): VipEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v) => {
    const p = vipEntry.safeParse(v);
    return p.success ? [p.data] : [];
  });
}

export async function getTriageRules(db: Db, uid: string) {
  const r = fromPgMaybe(
    await db.from("triage_rules").select("vip,keywords,muted,critical_triggers,updated_at").eq("user_id", uid).maybeSingle(),
  );
  if (!r.ok) return r;
  if (!r.value) return ok({ ...EMPTY_RULES, updated_at: null as string | null });
  return ok({
    vip: parseVip(r.value.vip),
    keywords: r.value.keywords,
    muted: r.value.muted,
    critical_triggers: r.value.critical_triggers,
    updated_at: r.value.updated_at as string | null,
  });
}

export async function setTriageRules(db: Db, uid: string, input: TriageRulesInput) {
  const rules = triageRulesInput.parse(input);
  return fromPg(
    await db
      .from("triage_rules")
      .upsert({ user_id: uid, ...rules }, { onConflict: "user_id" })
      .select("vip,keywords,muted,critical_triggers,updated_at")
      .single(),
  );
}
