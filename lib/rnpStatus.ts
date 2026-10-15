/** Нормализует статус для сравнения */
export function normalizeRNPStatus(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, " ");
}

export const RNP_STATUS_OPTIONS = [
  "On Track",
  "In Progress",
  "Requires Support",
  "Waiting Input",
  "Off Track",
  "Not relevant",
  "Archive",
] as const;

export type RnpStatusOption = (typeof RNP_STATUS_OPTIONS)[number];

export function isKnownRnpStatus(value: string): value is RnpStatusOption {
  return (RNP_STATUS_OPTIONS as readonly string[]).includes(value);
}

/** Проект в архиве — не показываем в основном дашборде */
export function isArchivedStatus(status: string): boolean {
  const s = normalizeRNPStatus(status);
  return s === "archive" || s === "archived" || s === "архив";
}

/**
 * Ветка без активного трафика, но метрики всё ещё входят в All / общий результат.
 * В основном дашборде остаётся видимой (не архив).
 */
export function isNotRelevantStatus(status: string): boolean {
  const s = normalizeRNPStatus(status);
  return (
    s === "not relevant" ||
    s === "notrelevant" ||
    s.includes("not relevant") ||
    s === "не актуально" ||
    s === "неактуально"
  );
}

/**
 * Статус группы / All: «Not relevant» — только у ветки,
 * для карточки проекта берём статус активной ветки.
 */
export function resolveGroupDisplayStatus(
  members: { status: string }[],
  fallbackStatus: string,
): string {
  if (fallbackStatus && !isNotRelevantStatus(fallbackStatus)) {
    return fallbackStatus;
  }
  const active = members.find(
    (m) =>
      m.status &&
      !isNotRelevantStatus(m.status) &&
      !isArchivedStatus(m.status),
  );
  return active?.status || fallbackStatus;
}

/** Стили бейджа по статусу РНП */
export function getRNPStatusClass(status: string): string {
  const s = normalizeRNPStatus(status);

  if (s.includes("on track")) {
    return "bg-emerald-500 text-white shadow-sm";
  }
  if (s.includes("in progress")) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300";
  }
  if (s.includes("requires support") || s.includes("require support")) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300";
  }
  if (s.includes("waiting input") || s.includes("waiting")) {
    return "bg-blue-500 text-white shadow-sm";
  }
  if (s.includes("off track")) {
    return "bg-red-600 text-white shadow-sm";
  }
  if (isNotRelevantStatus(status)) {
    return "bg-amber-900 text-amber-50 shadow-sm dark:bg-amber-950 dark:text-amber-100";
  }
  if (isArchivedStatus(status)) {
    return "bg-surface-muted text-ink-soft";
  }

  return "bg-surface-muted text-ink-muted";
}
