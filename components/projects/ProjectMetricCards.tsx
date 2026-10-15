import type { RNPMetricRow } from "@/types/rnp";
import type { MonthMetricValue } from "@/lib/rnpMonthCompare";
import { GoalTiersDisplay } from "@/components/rnp/GoalTiersDisplay";
import { MonthValueStack } from "@/components/rnp/MonthCompare";
import { cn } from "@/lib/utils";

export function PrimaryMetricCard({
  metric,
  compareMode = false,
  monthValues,
}: {
  metric: RNPMetricRow;
  compareMode?: boolean;
  monthValues?: MonthMetricValue[];
}) {
  const activeGoal = metric.goals.find((g) => g.isActive);
  const empty = metric.fact === "—";
  const showCompare = compareMode && monthValues && monthValues.length > 0;

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border bg-surface p-5 shadow-card",
        showCompare ? "min-h-[11rem]" : "min-h-[9.5rem]",
        metric.isPrimaryGoal
          ? "border-brand/40 bg-brand-soft/20"
          : "border-border",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {metric.label}
        {metric.isPrimaryGoal && (
          <span className="ml-1.5 normal-case text-brand">· цель</span>
        )}
      </p>

      {showCompare ? (
        <div className="mt-3 flex-1">
          <MonthValueStack
            items={monthValues}
            size="lg"
            emphasizeValue={metric.isPrimaryGoal}
          />
        </div>
      ) : (
        <>
          <p
            className={cn(
              "mt-3 font-mono text-3xl font-semibold tabular-nums leading-none sm:text-4xl",
              empty ? "text-ink-muted" : "text-ink",
              metric.isPrimaryGoal && !empty && "text-brand",
            )}
          >
            {metric.fact}
          </p>

          {activeGoal && !metric.isPrimaryGoal && (
            <p className="mt-3 text-xs text-ink-muted">
              План {activeGoal.key}: {activeGoal.plan}
            </p>
          )}

          {metric.isPrimaryGoal && metric.goals.length > 0 && (
            <div className="mt-auto flex justify-end pt-4">
              <GoalTiersDisplay goals={metric.goals} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AdditionalMetricCard({
  metric,
  compareMode = false,
  monthValues,
}: {
  metric: RNPMetricRow;
  compareMode?: boolean;
  monthValues?: MonthMetricValue[];
}) {
  const empty = metric.fact === "—";
  const showCompare = compareMode && monthValues && monthValues.length > 0;

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border border-border bg-surface p-3.5 shadow-card",
        showCompare && "min-h-[8.5rem]",
      )}
    >
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-ink-soft">
        {metric.label}
      </p>
      {showCompare ? (
        <div className="mt-2 flex-1">
          <MonthValueStack items={monthValues} size="sm" />
        </div>
      ) : (
        <p
          className={cn(
            "mt-1.5 font-mono text-lg font-semibold tabular-nums leading-tight sm:text-xl",
            empty ? "text-ink-muted" : "text-ink",
          )}
        >
          {metric.fact}
        </p>
      )}
    </div>
  );
}
