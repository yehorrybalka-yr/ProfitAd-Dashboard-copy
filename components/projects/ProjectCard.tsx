import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { RNPProjectCardItem } from "@/lib/rnpGroups";
import type { MonthMetricValue } from "@/lib/rnpMonthCompare";
import { RNPStatusBadge } from "@/components/rnp/RNPStatusBadge";
import { ProgressPaceInline } from "@/components/rnp/ProgressPaceDisplay";
import { MonthValueStack } from "@/components/rnp/MonthCompare";
import { cn } from "@/lib/utils";

export function ProjectCard({
  item,
  year,
  month,
  compareMode = false,
  primaryLabel,
  monthValues,
}: {
  item: RNPProjectCardItem;
  year: number;
  month: number;
  compareMode?: boolean;
  primaryLabel?: string;
  monthValues?: MonthMetricValue[];
}) {
  const { goalProject } = item;
  const label = primaryLabel ?? goalProject.metrics.primaryGoalLabel;

  return (
    <Link
      href={`/projects/${item.id}`}
      className={cn(
        "group flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-card transition-all hover:border-border-strong hover:shadow-panel",
        compareMode ? "min-h-[13rem]" : "min-h-[11rem]",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold text-ink group-hover:text-brand">
            {item.name}
          </h3>
          {item.memberCount > 1 && (
            <p className="mt-1 text-xs text-ink-muted">
              {item.memberCount} подпроекта
            </p>
          )}
        </div>
        <RNPStatusBadge status={item.status} />
      </div>

      <div className="mb-4 flex-1">
        {compareMode && monthValues && monthValues.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
              {label}
            </p>
            <MonthValueStack items={monthValues} size="md" />
          </div>
        ) : (
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="shrink-0 text-ink-muted">{label}</dt>
              <dd className="truncate font-mono tabular-nums font-medium text-ink">
                {goalProject.metrics.primaryGoalFact}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="shrink-0 text-ink-muted">% плана</dt>
              <dd className="shrink-0">
                <ProgressPaceInline
                  progress={goalProject.metrics.progressPercentage}
                  year={year}
                  month={month}
                />
              </dd>
            </div>
          </dl>
        )}
      </div>

      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-brand">
        Открыть проект <ChevronRight size={13} />
      </span>
    </Link>
  );
}
