import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Icon, type IconName } from "@/components/icons";
import { PageHeader, PanelSkeleton } from "@/components/ui";

export const metadata = { title: "More · Assistant" };

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/messages", label: "Messages", icon: "mail" },
  { href: "/activity", label: "Activity", icon: "pulse" },
  { href: "/rules", label: "Triage rules", icon: "shield" },
  { href: "/settings", label: "Settings", icon: "gear" },
];

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <Suspense fallback={<PanelSkeleton rows={4} />}>
        <Menu />
      </Suspense>
    </>
  );
}

async function Menu() {
  await requireUser();
  return (
      <nav className="card" aria-label="More">
        <ul className="more-list" style={{ listStyle: "none" }}>
          {ITEMS.map((i) => (
            <li key={i.href}><Link href={i.href}><Icon name={i.icon} />{i.label}</Link></li>
          ))}
          <li>
            <form action="/auth/signout" method="post">
              <button type="submit" className="more-list-btn" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, width: "100%", padding: "8px 4px", fontWeight: 600, borderTop: "1px solid var(--divider)" }}>
                <Icon name="logout" />Sign out
              </button>
            </form>
          </li>
        </ul>
      </nav>
  );
}
