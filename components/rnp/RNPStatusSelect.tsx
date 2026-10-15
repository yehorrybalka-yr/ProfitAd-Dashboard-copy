"use client";

import { cn } from "@/lib/utils";
import { getRNPStatusClass } from "@/lib/rnpStatus";
import { RNP_STATUS_OPTIONS } from "@/lib/rnpStatus";

interface RNPStatusSelectProps {
  value: string;
  onChange: (status: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function RNPStatusSelect({
  value,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel = "Статус проекта",
}: RNPStatusSelectProps) {
  const options = RNP_STATUS_OPTIONS.includes(
    value as (typeof RNP_STATUS_OPTIONS)[number],
  )
    ? RNP_STATUS_OPTIONS
    : value
      ? [value, ...RNP_STATUS_OPTIONS]
      : RNP_STATUS_OPTIONS;

  return (
    <select
      value={value || "On Track"}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-7 max-w-[11.5rem] cursor-pointer appearance-none rounded-md border-0 px-2 py-0.5 text-xs font-medium leading-none outline-none ring-offset-bg transition-opacity focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60",
        getRNPStatusClass(value || "On Track"),
        className,
      )}
    >
      {options.map((status) => (
        <option key={status} value={status} className="bg-surface text-ink">
          {status}
        </option>
      ))}
    </select>
  );
}
