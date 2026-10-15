"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { RNPProject } from "@/types/rnp";
import { RNPStatusSelect } from "./RNPStatusSelect";
import { ProgressPaceInline } from "./ProgressPaceDisplay";
import { DashboardGoalCell } from "./GoalTiersDisplay";
import { useRNP } from "./RNPProvider";
import { buildTableEntries } from "@/lib/rnpGroups";
import { cn } from "@/lib/utils";

export function RNPProjectsTable({
  projects,
  variant = "default",
}: {
  projects: RNPProject[];
  variant?: "default" | "archive";
}) {
  const { selectedMonth, updateProjectStatus } = useRNP();
  const year = selectedMonth?.year ?? new Date().getFullYear();
  const month = selectedMonth?.month ?? new Date().getMonth();
  const entries = buildTableEntries(projects);

  if (entries.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-ink-muted">
        Нет проектов с данными за выбранный месяц
      </div>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-soft">
            <th className="py-3 pr-4 font-medium">Проект</th>
            <th className="whitespace-nowrap px-4 py-3 font-medium">Статус</th>
            <th className="px-4 py-3 text-right font-medium">Главная метрика</th>
            <th className="px-4 py-3 text-right font-medium">Цель B</th>
            <th className="px-4 py-3 text-right font-medium">% плана / темп</th>
            <th className="py-3 pl-4" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            if (entry.kind === "group-header") {
              const { goalProject, groupId, groupName, status } = entry;
              return (
                <tr
                  key={`group-${groupId}`}
                  className={cn(
                    "border-b border-border/70 last:border-0 hover:bg-surface-muted/60",
                    variant === "archive" && "opacity-75",
                  )}
                >
                  <td className="py-3.5 pr-4">
                    <p className="font-medium text-ink">{groupName}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                    <RNPStatusSelect
                      value={status}
                      onChange={(next) => void updateProjectStatus(groupId, next)}
                      aria-label={`Статус ${groupName}`}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    <p className="text-xs text-ink-muted">
                      {goalProject.metrics.primaryGoalLabel}
                    </p>
                    <p className="font-mono tabular-nums font-medium text-ink">
                      {goalProject.metrics.primaryGoalFact}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <DashboardGoalCell project={goalProject} />
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <ProgressPaceInline
                      progress={goalProject.metrics.progressPercentage}
                      year={year}
                      month={month}
                    />
                  </td>
                  <td className="py-3.5 pl-4 text-right align-middle">
                    <Link
                      href={`/projects/${groupId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark"
                    >
                      Открыть <ChevronRight size={13} />
                    </Link>
                  </td>
                </tr>
              );
            }

            const { project } = entry;
            return (
              <tr
                key={project.id}
                className={cn(
                  "border-b border-border/70 last:border-0 hover:bg-surface-muted/60",
                  variant === "archive" && "opacity-75",
                )}
              >
                <td className="py-3.5 pr-4">
                  <p className="font-medium text-ink">{project.name}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                  <RNPStatusSelect
                    value={project.status}
                    onChange={(next) => void updateProjectStatus(project.id, next)}
                    aria-label={`Статус ${project.name}`}
                  />
                </td>
                <td className="px-4 py-3.5 text-right align-middle">
                  <p className="text-xs text-ink-muted">
                    {project.metrics.primaryGoalLabel}
                  </p>
                  <p className="font-mono tabular-nums font-medium text-ink">
                    {project.metrics.primaryGoalFact}
                  </p>
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <DashboardGoalCell project={project} />
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <ProgressPaceInline
                    progress={project.metrics.progressPercentage}
                    year={year}
                    month={month}
                  />
                </td>
                <td className="py-3.5 pl-4 text-right align-middle">
                  <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark"
                  >
                    Открыть <ChevronRight size={13} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
