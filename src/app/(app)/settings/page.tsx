import { Suspense } from "react";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtWhen } from "@/lib/time";
import { Card, ErrorBox, PageHeader, PanelSkeleton } from "@/components/ui";
import { TokenManager } from "@/components/token-manager";
import { CopyButton } from "@/components/copy-button";

export const metadata = { title: "Settings · Assistant" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Suspense fallback={<PanelSkeleton rows={6} />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const user = await requireUser();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/mcp`;
  const { data, error } = await (await createClient())
    .from("api_tokens")
    .select("id,name,scope,created_at,last_used_at,revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (
    <>
      <Card title="MCP endpoint" labelledBy="h-mcp">
        <div className="stack">
          <div className="token-box"><code>{endpoint}</code><CopyButton value={endpoint} /></div>
          <p className="muted" style={{ fontSize: 13 }}>Streamable HTTP. Send <code>Authorization: Bearer &lt;token&gt;</code>.</p>
        </div>
      </Card>
      <Card title="API tokens" labelledBy="h-tokens">
        {error ? <ErrorBox what="tokens" /> : (
          <TokenManager tokens={(data ?? []).map((t) => ({
            id: t.id, name: t.name, scope: t.scope, created: fmtWhen(t.created_at), lastUsed: t.last_used_at ? fmtWhen(t.last_used_at) : null, revoked: t.revoked_at !== null,
          }))} />
        )}
      </Card>
      <Card title="Account" labelledBy="h-account">
        <div className="form-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <span className="muted">{user.email}</span>
          <form action="/auth/signout" method="post"><button className="btn ghost" type="submit">Sign out</button></form>
        </div>
      </Card>
    </>
  );
}
