/** Публичный CSV-экспорт общей РНП (legacy, отключено в ingest) */
export const RNP_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRwo_dLWw0SzYF4tH_YCr9hWqmIneV6eU0yCVGPnUxdhkwnn-dWVz7Du4y3iqmjfNghwexvfa04ouf_/pub?gid=1351585691&single=true&output=csv";

/** Общая wide-таблица РНП больше не подмешивается — только проектные листы */
export const RNP_SHARED_SHEET_ENABLED = false;

/** Тег кэша Next.js для on-demand revalidation */
export const RNP_CACHE_TAG = "rnp-data";

/** ISR на сервере: секунды между проверками CSV (Vercel) */
export const RNP_SERVER_REVALIDATE_SEC = 30;

/** Интервал опроса API в открытой вкладке браузера (мс) */
export const RNP_POLL_INTERVAL_MS = 30_000;

/**
 * После загрузки страницы не принимаем другой hash сразу.
 * Короткий grace: сервер уже sticky-стабилизирует CDN flap.
 */
export const RNP_POLL_GRACE_MS = 30_000;

/**
 * Google Sheets pub?output=csv отдаёт закэшированный ответ по URL.
 * Добавляем query-параметр, чтобы получать свежий экспорт.
 */
export function buildCsvFetchUrl(
  csvUrl: string = RNP_CSV_URL,
  mode: "live" | "isr" = "live",
): string {
  const bust =
    mode === "live"
      ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      : Math.floor(Date.now() / (RNP_SERVER_REVALIDATE_SEC * 1000));

  const separator = csvUrl.includes("?") ? "&" : "?";
  return `${csvUrl}${separator}_cb=${bust}`;
}
