"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, ListTodo, Settings } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useRNPOptional } from "@/components/rnp/RNPProvider";
import {
  buildProjectCardItems,
  resolveActiveCardId,
} from "@/lib/rnpGroups";

const NAV_ITEMS = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/projects", label: "Проекты", icon: FolderKanban },
  { href: "/tasks", label: "Task Manager", icon: ListTodo },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const rnp = useRNPOptional();

  const projectRouteId = pathname.match(/^\/projects\/([^/]+)$/)?.[1];
  const showProjectList = Boolean(projectRouteId);

  const projectItems = useMemo(
    () => (rnp ? buildProjectCardItems(rnp.projects) : []),
    [rnp],
  );

  const activeCardId = useMemo(() => {
    if (!projectRouteId || !rnp) return null;
    return resolveActiveCardId(rnp.projects, projectRouteId);
  }, [projectRouteId, rnp]);

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-white/90 lg:flex">
      <div className="flex items-center gap-3 px-5 py-6">
        <Image
          src="/profitad_logo.webp"
          alt="ProfitAd"
          width={36}
          height={36}
          className="rounded-lg"
        />
        <div>
          <p className="font-display text-sm font-semibold leading-tight text-white">
            ProfitAd
          </p>
          <p className="text-[11px] leading-tight text-white/40">РНП Дашборд</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/projects"
                ? pathname === "/projects" || pathname.startsWith("/projects/")
                : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-brand/15 font-medium text-white"
                  : "text-white/55 hover:bg-sidebar-hover hover:text-white/85",
              )}
            >
              <Icon size={16} className={active ? "text-brand" : ""} />
              {item.label}
            </Link>
          );
        })}

        {showProjectList && projectItems.length > 0 && (
          <div className="mt-5 border-t border-sidebar-border pt-4">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Проекты
            </p>
            <div className="flex flex-col gap-0.5">
              {projectItems.map((item) => {
                const isActive = item.id === activeCardId;
                return (
                  <Link
                    key={item.id}
                    href={`/projects/${item.id}`}
                    className={cn(
                      "block truncate rounded-lg px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "font-bold text-white"
                        : "font-normal text-white/50 hover:bg-sidebar-hover hover:text-white/80",
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
