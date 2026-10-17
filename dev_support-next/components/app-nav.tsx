"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  match: (path: string) => boolean;
  adminOnly?: boolean;
}

const ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview", match: (path) => path === "/" },
  {
    href: "/tickets",
    label: "Tickets",
    match: (path) =>
      path === "/tickets" || (path.startsWith("/tickets/") && path !== "/tickets/new"),
  },
  {
    href: "/tickets/new",
    label: "New ticket",
    match: (path) => path === "/tickets/new",
  },
  {
    href: "/admin/users",
    label: "Users",
    match: (path) => path.startsWith("/admin/users"),
    adminOnly: true,
  },
];

export function AppNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label="Primary" className="flex items-center gap-0.5">
      {ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-surface-muted text-foreground"
                : "text-muted hover:bg-surface-muted hover:text-foreground",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
