export type PaceStatus = "good" | "warning" | "critical";

/** Сколько % плана должно быть выполнено к сегодняшнему дню месяца */
export function getExpectedPacePercent(
  year: number,
  month: number,
  referenceDate: Date = new Date(),
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const refOrdinal = referenceDate.getFullYear() * 12 + referenceDate.getMonth();
  const monthOrdinal = year * 12 + month;

  if (monthOrdinal < refOrdinal) return 100;
  if (monthOrdinal > refOrdinal) return 0;

  return Math.round((referenceDate.getDate() / daysInMonth) * 1000) / 10;
}

/**
 * Цветовой статус относительно темпа:
 * - зелёный: выполнение >= темпа (впереди или вровень)
 * - жёлтый: отставание до 10 п.п.
 * - красный: отставание более 10 п.п.
 */
export function getPaceStatus(progress: number, expectedPace: number): PaceStatus {
  if (!Number.isFinite(progress) || !Number.isFinite(expectedPace)) return "warning";
  const gap = progress - expectedPace;
  if (gap >= 0) return "good";
  if (gap >= -10) return "warning";
  return "critical";
}

export const PACE_STATUS_CLASS: Record<PaceStatus, string> = {
  good: "text-positive",
  warning: "text-warning",
  critical: "text-danger",
};

export const PACE_STATUS_BG: Record<PaceStatus, string> = {
  good: "bg-positive-soft border-positive/20",
  warning: "bg-warning-soft border-warning/20",
  critical: "bg-danger-soft border-danger/20",
};
