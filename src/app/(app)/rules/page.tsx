import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTriageRules } from "@/lib/data/triage";
import { ErrorBox, PageHeader, PanelSkeleton } from "@/components/ui";
import { TriageEditor } from "@/components/triage-editor";

export const metadata = { title: "Triage rules · Assistant" };

export default function RulesPage() {
  return (
    <>
      <PageHeader title="Triage rules" sub="Used by hourly email triage" />
      <Suspense fallback={<PanelSkeleton rows={6} />}>
        <Rules />
      </Suspense>
    </>
  );
}

async function Rules() {
  const user = await requireUser();
  const r = await getTriageRules(await createClient(), user.id);
  if (!r.ok) return <ErrorBox what="triage rules" />;
  const { vip, keywords, muted, critical_triggers } = r.value;
  return <TriageEditor initial={{ vip, keywords, muted, critical_triggers }} />;
}
