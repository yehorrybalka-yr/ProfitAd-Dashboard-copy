import type { RNPMonthOption } from "@/types/rnp";

/** Ключ месяца для переключателя: "2026-06" */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Разбирает ключ месяца обратно в год и индекс месяца */
export function parseMonthKey(key: string): { year: number; month: number } {
  const [yearStr, monthStr] = key.split("-");
  return {
    year: Number(yearStr),
    month: Number(monthStr) - 1,
  };
}

/** Уникальные годы из списка месяцев (для переключателя года) */
export function getAvailableYears(months: RNPMonthOption[]): number[] {
  return [...new Set(months.map((m) => m.year))].sort((a, b) => b - a);
}

/** Сортирует месяцы по календарю (апрель → май → …) */
export function sortMonthsChronologically(
  months: RNPMonthOption[],
): RNPMonthOption[] {
  return [...months].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
  );
}

/**
 * Определяет месяц по умолчанию:
 * 1) текущий календарный месяц, если он есть в таблице;
 * 2) иначе — последний месяц в таблице, не позже сегодняшнего;
 * 3) иначе — самый последний месяц в таблице.
 */
export function resolveDefaultMonthKey(months: RNPMonthOption[]): string {
  if (months.length === 0) return "";

  const sorted = sortMonthsChronologically(months);
  const now = new Date();
  const currentKey = monthKey(now.getFullYear(), now.getMonth());

  if (sorted.some((m) => m.key === currentKey)) {
    return currentKey;
  }

  const currentOrdinal = now.getFullYear() * 12 + now.getMonth();
  const notFuture = sorted.filter(
    (m) => m.year * 12 + m.month <= currentOrdinal,
  );
  if (notFuture.length > 0) {
    return notFuture[notFuture.length - 1].key;
  }

  return sorted[sorted.length - 1].key;
}
