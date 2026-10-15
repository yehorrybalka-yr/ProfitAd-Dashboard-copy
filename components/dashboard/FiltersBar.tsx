"use client";

import { Project, PeriodPreset } from "@/types";
import { Select } from "@/components/ui/Select";
import { SlidersHorizontal } from "lucide-react";

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "7d", label: "7 дней" },
  { value: "14d", label: "14 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "all", label: "Весь период" },
];

export function FiltersBar({
  projects,
  selectedProjectId,
  onProjectChange,
  period,
  onPeriodChange,
}: {
  projects: Project[];
  selectedProjectId: string | "all";
  onProjectChange: (id: string | "all") => void;
  period: PeriodPreset;
  onPeriodChange: (p: PeriodPreset) => void;
}) {
  const projectOptions = [
    { value: "all", label: "Все проекты" },
    ...projects.map((p) => ({ value: p.project_id, label: `${p.client_name} — ${p.project_name}` })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 pl-1 pr-2 text-ink-soft">
        <SlidersHorizontal size={14} />
        <span className="text-xs font-medium">Фильтры</span>
      </div>
      <Select
        className="w-full sm:w-72"
        options={projectOptions}
        value={selectedProjectId}
        onChange={(e) => onProjectChange(e.target.value)}
      />
      <Select
        className="w-full sm:w-40"
        options={PERIOD_OPTIONS}
        value={period}
        onChange={(e) => onPeriodChange(e.target.value as PeriodPreset)}
      />
    </div>
  );
}
