import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiCardData {
  key: string;
  label: string;
  value: string;
  delta?: number | null;
  /** true when an increase in this metric is a bad sign (e.g. CPL, CPA, CPM) */
  deltaInverse?: boolean;
  targetLabel?: string;
  status?: "good" | "warning" | "critical";
}

const statusBorder: Record<NonNullable<KpiCardData["status"]>, string> = {
  good: "before:bg-positive",
  warning: "before:bg-warning",
  critical: "before:bg-danger",
};

export function KpiCard({ data }: { data: KpiCardData }) {
  const { label, value, delta, deltaInverse, targetLabel, status } = data;

  const deltaIsGood = delta === null || delta === undefined ? null : deltaInverse ? delta < 0 : delta > 0;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[7.5rem] flex-col overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-card before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        status ? statusBorder[status] : "before:bg-transparent",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-ink sm:text-2xl">{value}</p>

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3">
        {(delta !== null && delta !== undefined) || targetLabel ? (
          <>
            {delta !== null && delta !== undefined ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium",
                  deltaIsGood ? "text-positive" : "text-danger",
                )}
              >
                {delta === 0 ? (
                  <Minus size={12} />
                ) : delta > 0 ? (
                  <ArrowUpRight size={12} />
                ) : (
                  <ArrowDownRight size={12} />
                )}
                {Math.abs(delta).toFixed(1)}%
              </span>
            ) : null}
            {targetLabel ? (
              <span className="text-xs text-ink-soft">· {targetLabel}</span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
