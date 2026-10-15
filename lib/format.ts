const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GEL: "ka-GE",
  RUB: "ru-RU",
};

export function formatCurrency(value: number, currency: string = "USD"): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** Процент с запятой: 9,6% */
export function formatPercentRu(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const text = value
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(".", ",");
  return `${text}%`;
}

export function formatRatioAsPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(d);
}

export function formatDateFull(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}
