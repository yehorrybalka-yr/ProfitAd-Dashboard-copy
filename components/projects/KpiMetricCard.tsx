import type { RNPMetricRow } from "@/types/rnp";
import type { MonthMetricValue } from "@/lib/rnpMonthCompare";
import { MonthValueStack } from "@/components/rnp/MonthCompare";
import { cn } from "@/lib/utils";

/** Карточка KPI-метрики на странице проекта — отдельно от главной цели */
export function KpiMetricCard({
  metric,
  variant = "primary",
  compareMode = false,
  monthValues,
}: {
  metric: RNPMetricRow;
  variant?: "primary" | "additional";
  compareMode?: boolean;
  monthValues?: MonthMetricValue[];
}) {
  const activeGoal = metric.goals.find((g) => g.isActive);
  const empty = metric.fact === "—";
  const isPrimary = variant === "primary";
  const showCompare = compareMode && monthValues && monthValues.length > 0;

  return (
    <div
      className={cn(
        "flex h-full flex-col border border-border bg-surface shadow-card",
        isPrimary
          ? cn("rounded-xl p-5", showCompare ? "min-h-[11rem]" : "min-h-[9.5rem]")
          : cn("rounded-lg p-3.5", showCompare && "min-h-[8.5rem]"),
      )}
    >
      <p
        className={cn(
          "font-medium uppercase tracking-wide text-ink-soft",
          isPrimary ? "text-xs" : "truncate text-[10px]",
        )}
      >
        {metric.label}
      </p>

      {showCompare ? (
        <div className={cn("flex-1", isPrimary ? "mt-3" : "mt-2")}>
          <MonthValueStack
            items={monthValues}
            size={isPrimary ? "lg" : "sm"}
          />
        </div>
      ) : (
        <>
          <p
            className={cn(
              "font-mono font-semibold tabular-nums leading-none text-ink",
              isPrimary
                ? cn("mt-3 text-3xl sm:text-4xl", empty && "text-ink-muted")
                : cn(
                    "mt-1.5 text-lg leading-tight sm:text-xl",
                    empty && "text-ink-muted",
                  ),
            )}
          >
            {metric.fact}
          </p>

          {activeGoal && (
            <p
              className={cn(
                "mt-auto font-mono tabular-nums font-medium text-brand",
                isPrimary ? "pt-4 text-sm" : "pt-2 text-[10px]",
              )}
            >
              KPI · {activeGoal.plan}
            </p>
          )}
        </>
      )}
    </div>
  );
}
