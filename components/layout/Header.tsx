"use client";

import { usePathname } from "next/navigation";
import { DatabaseZap, RotateCcw } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useRNPOptional } from "@/components/rnp/RNPProvider";
import { resolveProjectScope } from "@/lib/rnpGroups";
import { cn } from "@/lib/utils";
import { MobileProjectNav } from "./MobileProjectNav";

function pageTitle(pathname: string, projectName?: string): string {
  if (pathname === "/") return "Обзор РНП";
  if (pathname === "/projects") return "Проекты";
  if (pathname === "/tasks") return "Task Manager";
  if (pathname === "/settings") return "Настройки";
  const match = pathname.match(/^\/projects\/(.+)$/);
  if (match) return projectName ?? "Проект";
  return "ProfitAd";
}

export function Header() {
  const pathname = usePathname();
  const rnp = useRNPOptional();
  const [, setClock] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setClock((c) => c + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const projectId = pathname.match(/^\/projects\/(.+)$/)?.[1];
  const projectName = useMemo(() => {
    if (!projectId || !rnp) return undefined;
    const scope = resolveProjectScope(rnp.projects, projectId);
    if (scope.goalProject) {
      return scope.isGroup ? scope.goalProject.groupName! : scope.goalProject.name;
    }
    return rnp.getProjectById(projectId)?.name;
  }, [projectId, rnp]);
  const title = pageTitle(pathname, projectName);

  const syncLabel = (() => {
    if (!rnp) return "Google Sheets · live sync";
    if (rnp.syncStatus === "syncing") return "Синхронизация…";
    if (rnp.syncStatus === "updated") return "Данные обновлены";
    if (rnp.syncStatus === "error") return "Ошибка синхронизации";
    if (rnp.lastSyncedAt) {
      const ago = Math.round((Date.now() - new Date(rnp.lastSyncedAt).getTime()) / 1000);
      if (ago < 60) return `Обновлено ${ago} сек назад`;
      return `Обновлено ${Math.round(ago / 60)} мин назад`;
    }
    return "Google Sheets · live sync";
  })();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
        <h1 className="min-w-0 truncate font-display text-base font-semibold text-ink sm:text-lg">
          {title}
        </h1>

        <div
          className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink-muted sm:px-3"
          title={syncLabel}
        >
          <button
            type="button"
            onClick={() => void rnp?.refreshNow()}
            disabled={!rnp || rnp.syncStatus === "syncing"}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            title="Обновить данные из Google Sheets"
            aria-label="Обновить данные"
          >
            <RotateCcw
              size={14}
              className={cn(rnp?.syncStatus === "syncing" && "animate-spin")}
            />
          </button>
          <DatabaseZap
            size={13}
            className={
              rnp?.syncStatus === "updated" ? "text-positive" : "text-brand"
            }
          />
          <span className="hidden whitespace-nowrap sm:inline">{syncLabel}</span>
          {rnp?.dataset.health?.source === "neon" && (
            <span className="hidden text-[10px] uppercase tracking-wide text-ink-soft sm:inline">
              Neon
            </span>
          )}
        </div>
      </div>
      {projectId && (
        <div className="border-t border-border/60 px-4 py-2 sm:px-6 lg:hidden">
          <MobileProjectNav />
        </div>
      )}
    </header>
  );
}
