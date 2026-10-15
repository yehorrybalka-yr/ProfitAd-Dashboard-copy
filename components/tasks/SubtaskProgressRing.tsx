"use client";

import { cn } from "@/lib/utils";

interface SubtaskProgressRingProps {
  done: number;
  total: number;
  className?: string;
}

/** Circular progress for completed / total subtasks (fills clockwise from 12). */
export function SubtaskProgressRing({
  done,
  total,
  className,
}: SubtaskProgressRingProps) {
  if (total <= 0) return null;

  const size = 18;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, done / total));
  const offset = circumference * (1 - progress);
  const complete = done >= total;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={`Подзадачи: ${done} из ${total}`}
      aria-label={`Подзадачи: ${done} из ${total}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={complete ? "text-positive" : "text-brand"}
        />
      </svg>
      <span className="text-[11px] tabular-nums text-ink-soft">
        {done}/{total}
      </span>
    </span>
  );
}
