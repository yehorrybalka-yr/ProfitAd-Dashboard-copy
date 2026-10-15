import { Check } from "lucide-react";
import type { RNPGoalTier, RNPMetricRow, RNPProject } from "@/types/rnp";
import { cn } from "@/lib/utils";

export function GoalTiersDisplay({ goals }: { goals: RNPGoalTier[] }) {
  return (
    <div className="flex flex-col gap-1">
      {goals.map((goal) => (
        <div
          key={goal.key}
          className={cn(
            "flex items-center justify-end gap-1.5 text-xs",
            goal.achieved && "opacity-45",
            goal.isActive && "font-semibold text-ink",
            !goal.achieved && !goal.isActive && "text-ink-soft",
          )}
        >
          {goal.achieved && (
            <Check size={12} className="shrink-0 text-positive" aria-label="Достигнуто" />
          )}
          <span className={cn(goal.isActive && "text-brand")}>
            {goal.key}
            {goal.isActive && " · активна"}
          </span>
          <span className="font-mono tabular-nums">{goal.plan}</span>
        </div>
      ))}
    </div>
  );
}

/** Ячейка «Цель B» в таблице дашборда: название метрики + план */
function DashboardMetricPlan({ label, plan }: { label: string; plan: string }) {
  if (!plan || plan === "—") return null;

  return (
    <div className="text-right">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="font-mono tabular-nums font-medium text-brand">{plan}</p>
    </div>
  );
}

/** KPI-метрика проекта в колонке «Цель B» */
function DashboardKpiPlan({ metric }: { metric: RNPMetricRow }) {
  const active = metric.goals.find((g) => g.isActive);
  if (!active) return null;

  return <DashboardMetricPlan label={metric.label} plan={active.plan} />;
}

/** Колонка «Цель B» — главная цель или KPI конкретного подпроекта */
export function DashboardGoalCell({ project }: { project: RNPProject }) {
  const kpis = project.metrics.kpiMetrics;

  if (!project.isPrimaryGoalHolder) {
    if (kpis.length === 0) return <span className="text-ink-soft">—</span>;

    return (
      <div className="space-y-2">
        {kpis.map((metric) => (
          <DashboardKpiPlan key={metric.label} metric={metric} />
        ))}
      </div>
    );
  }

  const active = project.metrics.goals.find((g) => g.isActive);
  if (!active) return <span className="text-ink-soft">—</span>;

  return (
    <DashboardMetricPlan
      label={project.metrics.primaryGoalLabel}
      plan={active.plan}
    />
  );
}
