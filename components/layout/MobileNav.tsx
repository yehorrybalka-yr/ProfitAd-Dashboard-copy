"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, ListTodo, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { href: "/projects", label: "Проекты", icon: FolderKanban, exact: false },
  { href: "/tasks", label: "Задачи", icon: ListTodo, exact: true },
  { href: "/settings", label: "Настройки", icon: Settings, exact: true },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around px-2">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 text-[10px] font-medium transition-colors",
                active ? "text-brand" : "text-ink-muted",
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.25 : 2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
