"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

type Item = { href: string; label: string; icon: IconName };

const DESKTOP: Item[] = [
  { href: "/", label: "Today", icon: "home" },
  { href: "/tasks", label: "Tasks", icon: "check" },
  { href: "/calendar", label: "Calendar", icon: "cal" },
  { href: "/documents", label: "Documents", icon: "file" },
  { href: "/messages", label: "Messages", icon: "mail" },
  { href: "/activity", label: "Activity", icon: "pulse" },
  { href: "/rules", label: "Triage rules", icon: "shield" },
  { href: "/settings", label: "Settings", icon: "gear" },
];

const PHONE: Item[] = [
  { href: "/", label: "Today", icon: "home" },
  { href: "/tasks", label: "Tasks", icon: "check" },
  { href: "/calendar", label: "Calendar", icon: "cal" },
  { href: "/documents", label: "Documents", icon: "file" },
  { href: "/more", label: "More", icon: "more" },
];

const MORE_PATHS = ["/more", "/messages", "/activity", "/rules", "/settings"];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/more") return MORE_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  return path === href || path.startsWith(href + "/");
}

export function DesktopNav() {
  return <DesktopNavView path={usePathname()} />;
}

// Rendered without an active item while the pathname streams in (dynamic routes).
export function DesktopNavView({ path }: { path: string }) {
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/" className="brand">
        <span className="brand-mark">A</span>
        <span className="brand-name">Assistant</span>
      </Link>
      <ul>
        {DESKTOP.map((i) => {
          const on = isActive(path, i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} className={on ? "active" : undefined} aria-current={on ? "page" : undefined}>
                <Icon name={i.icon} />
                <span>{i.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="nav-end">
        <form action="/auth/signout" method="post">
          <button type="submit" aria-label="Sign out">
            <Icon name="logout" />
          </button>
        </form>
      </div>
    </nav>
  );
}

export function PhoneTabBar() {
  return <PhoneTabBarView path={usePathname()} />;
}

export function PhoneTabBarView({ path }: { path: string }) {
  return (
    <nav className="tabbar" aria-label="Main">
      <ul>
        {PHONE.map((i) => {
          const on = isActive(path, i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} className={on ? "active" : undefined} aria-current={on ? "page" : undefined}>
                <Icon name={i.icon} />
                <span>{i.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
