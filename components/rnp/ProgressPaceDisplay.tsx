"use client";

import { cn } from "@/lib/utils";
import { formatPercentRu } from "@/lib/format";
import {
  getExpectedPacePercent,
  getPaceStatus,
  PACE_STATUS_CLASS,
  PACE_STATUS_BG,
} from "@/lib/rnpPace";

export function ProgressPaceCard({
  progress,
  year,
  month,
  className,
}: {
  progress: number;
  year: number;
  month: number;
  className?: string;
}) {
  const expectedPace = getExpectedPacePercent(year, month);
  const status = getPaceStatus(progress, expectedPace);
  const gap = progress - expectedPace;

  return (
    <div
      className={cn(
        "flex h-full min-h-[10rem] flex-col rounded-xl border p-4 shadow-card",
        PACE_STATUS_BG[status],
        className,
      )}
    >
      <div className="grid flex-1 grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
            % плана (факт)
          </p>
          <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", PACE_STATUS_CLASS[status])}>
            {progress > 0 ? formatPercentRu(progress) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
            % темпа (сегодня)
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink-muted">
            {formatPercentRu(expectedPace, expectedPace % 1 === 0 ? 0 : 1)}
          </p>
        </div>
      </div>
      <p className={cn("mt-4 text-xs font-medium", PACE_STATUS_CLASS[status])}>
        {gap >= 0
          ? gap === 0
            ? "В темпе с планом"
            : `Опережаем темп на ${Math.abs(gap).toFixed(1)} п.п.`
          : `Отстаём от темпа на ${Math.abs(gap).toFixed(1)} п.п.`}
      </p>
    </div>
  );
}

export function ProgressPaceInline({
  progress,
  year,
  month,
}: {
  progress: number;
  year: number;
  month: number;
}) {
  const expectedPace = getExpectedPacePercent(year, month);
  const status = getPaceStatus(progress, expectedPace);

  const progressText = progress > 0 ? formatPercentRu(progress) : "—";
  const paceText = formatPercentRu(expectedPace, expectedPace % 1 === 0 ? 0 : 1);

  return (
    <p
      className={cn(
        "text-right font-mono text-sm font-semibold tabular-nums",
        PACE_STATUS_CLASS[status],
      )}
    >
      {progressText} / {paceText}
    </p>
  );
}
