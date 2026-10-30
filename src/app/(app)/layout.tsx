import { Suspense } from "react";
import { DesktopNav, DesktopNavView, PhoneTabBar, PhoneTabBarView } from "@/components/nav";

// Static shell (nav) prerenders; each page streams its authenticated content behind Suspense.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Suspense fallback={<DesktopNavView path="" />}>
        <DesktopNav />
      </Suspense>
      <main className="page" id="main">{children}</main>
      <Suspense fallback={<PhoneTabBarView path="" />}>
        <PhoneTabBar />
      </Suspense>
    </div>
  );
}
