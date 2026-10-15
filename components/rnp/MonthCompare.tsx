"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";
import { useRNP } from "@/components/rnp/RNPProvider";
import {
  clampCompareRange,
  defaultCompareRange,
  getMonthsInRange,
  type MonthCompareRange,
} from "@/lib/rnpMonthCompare";
import type { RNPMonthOption } from "@/types/rnp";
import { cn } from "@/lib/utils";

export interface MonthCompareState {
  enabled: boolean;
  fromKey: string;
  toKey: string;
  rangeMonths: RNPMonthOption[];
}

export function useMonthCompare(): MonthCompareState & {
  setEnabled: (v: boolean) => void;
  setFromKey: (key: string) => void;
  setToKey: (key: string) => void;
} {
  const { dataset, selectedMonthKey } = useRNP();
  const [enabled, setEnabled] = useState(false);
  const [range, setRange] = useState<MonthCompareRange>(() =>
    defaultCompareRange(dataset.months, selectedMonthKey),
  );

  useEffect(() => {
    if (!enabled) return;
    setRange((prev) => {
      const next = clampCompareRange(dataset.months, prev.fromKey, prev.toKey);
      if (!prev.fromKey || !prev.toKey) {
        return defaultCompareRange(dataset.months, selectedMonthKey);
      }
      return next;
    });
  }, [dataset.months, enabled, selectedMonthKey]);

  useEffect(() => {
    if (enabled) return;
    setRange(defaultCompareRange(dataset.months, selectedMonthKey));
  }, [selectedMonthKey, dataset.months, enabled]);

  const rangeMonths = useMemo(
    () =>
      enabled
        ? getMonthsInRange(dataset.months, range.fromKey, range.toKey)
        : [],
    [enabled, dataset.months, range.fromKey, range.toKey],
  );

  return {
    enabled,
    fromKey: range.fromKey,
    toKey: range.toKey,
    rangeMonths,
    setEnabled: (v: boolean) => {
      if (v) {
        setRange(defaultCompareRange(dataset.months, selectedMonthKey));
      }
      setEnabled(v);
    },
    setFromKey: (key: string) => {
      setRange((prev) => clampCompareRange(dataset.months, key, prev.toKey));
    },
    setToKey: (key: string) => {
      setRange((prev) => clampCompareRange(dataset.months, prev.fromKey, key));
    },
  };
}

export function MonthCompareToggle({
  enabled,
  fromKey,
  toKey,
  onEnabledChange,
  onFromChange,
  onToChange,
  className,
}: {
  enabled: boolean;
  fromKey: string;
  toKey: string;
  onEnabledChange: (v: boolean) => void;
  onFromChange: (key: string) => void;
  onToChange: (key: string) => void;
  className?: string;
}) {
  const { dataset } = useRNP();
  const options = useMemo(
    () =>
      dataset.months.map((m) => ({
        value: m.key,
        label: m.label,
      })),
    [dataset.months],
  );

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      <div className="inline-flex items-center gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Сравнение по месяцам"
          onClick={() => onEnabledChange(!enabled)}
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            enabled ? "bg-brand" : "bg-border-strong",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
              enabled && "translate-x-4",
            )}
          />
        </button>
        <span className="text-sm font-medium text-ink">Сравнение по месяцам</span>
      </div>

      {enabled && options.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
          <span className="text-xs text-ink-muted">от</span>
          <Select
            className="w-[10.5rem]"
            options={options}
            value={fromKey}
            onChange={(e) => onFromChange(e.target.value)}
            aria-label="Период от"
          />
          <span className="text-xs text-ink-muted">до</span>
          <Select
            className="w-[10.5rem]"
            options={options}
            value={toKey}
            onChange={(e) => onToChange(e.target.value)}
            aria-label="Период до"
          />
        </div>
      )}
    </div>
  );
}

/** Значения метрики по месяцам — общий UI-блок */
export function MonthValueStack({
  items,
  size = "md",
  emphasizeValue = false,
}: {
  items: { monthLabel: string; value: string }[];
  size?: "sm" | "md" | "lg";
  emphasizeValue?: boolean;
}) {
  return (
    <ul className={cn("flex flex-col", size === "sm" ? "gap-1.5" : "gap-2")}>
      {items.map((item, index) => {
        const empty = item.value === "—";
        return (
          <li
            key={`${item.monthLabel}-${index}`}
            className={cn(
              "flex min-h-[1.75rem] items-center justify-between gap-3",
              index > 0 && "border-t border-border/60 pt-2",
            )}
          >
            <span
              className={cn(
                "shrink-0 rounded-md bg-surface-muted px-2 py-0.5 font-medium tabular-nums text-ink-muted",
                size === "sm" ? "text-[10px]" : "text-[11px]",
              )}
            >
              {item.monthLabel}
            </span>
            <span
              className={cn(
                "min-w-0 truncate text-right font-mono tabular-nums",
                empty ? "text-ink-muted" : "text-ink",
                size === "lg" && "text-base font-semibold sm:text-lg",
                size === "md" && "text-sm font-semibold",
                size === "sm" && "text-xs font-medium",
                emphasizeValue && !empty && "text-brand",
              )}
            >
              {item.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
