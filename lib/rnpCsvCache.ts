import { createHash } from "crypto";
import { buildCsvFetchUrl, RNP_CSV_URL } from "@/lib/rnpConfig";

const LIVE_FETCH_ATTEMPTS = 9;

/** Маркеры «сырого» экспорта: формулы ещё не посчитались */
const UNRESOLVED_CELL_PATTERN =
  /#REF!|#N\/A|#ERROR!|Завантаження\.\.\.|Завантаження…|Loading\.\.\.|Loading…|Laden\.\.\.|Laden…/gi;

export function unresolvedCellCount(csvText: string): number {
  return csvText.match(UNRESOLVED_CELL_PATTERN)?.length ?? 0;
}

type StickySnapshot = {
  text: string;
  hash: string;
  length: number;
  quality: number;
  pendingHash: string | null;
  /** Когда snapshot был принят (не обновляется при каждом same-poll) */
  acceptedAt: number;
};

const GLOBAL_KEY = "__profitad_rnp_csv_sticky__";

type StickyGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: StickySnapshot | null;
};

function getSticky(): StickySnapshot | null {
  return (globalThis as StickyGlobal)[GLOBAL_KEY] ?? null;
}

function setSticky(next: StickySnapshot | null) {
  (globalThis as StickyGlobal)[GLOBAL_KEY] = next;
}

export function hashCsvContent(csvText: string): string {
  return createHash("sha256").update(csvText).digest("hex").slice(0, 16);
}

/** Чем выше — тем «готовее» снимок (меньше #REF! / Loading). */
export function csvSnapshotQuality(csvText: string): number {
  const unresolved = unresolvedCellCount(csvText);
  return csvText.length - unresolved * 50_000;
}

export function getStickySnapshotMeta() {
  const sticky = getSticky();
  if (!sticky) return null;
  return {
    hash: sticky.hash,
    length: sticky.length,
    quality: sticky.quality,
    pendingHash: sticky.pendingHash,
    acceptedAt: sticky.acceptedAt,
    ageMs: Date.now() - sticky.acceptedAt,
  };
}

/** Сброс sticky (тесты / ручной refresh) */
export function clearStickyCsvCache() {
  setSticky(null);
}

/**
 * Принудительная загрузка CSV: сбрасывает sticky и тянет новый снимок из Google Sheets.
 * Используется при ручном обновлении дашборда.
 */
export async function fetchFreshCsvText(
  csvUrl: string = RNP_CSV_URL,
  fromHash: string | null = null,
): Promise<string> {
  const previousHash = fromHash ?? getSticky()?.hash ?? null;
  clearStickyCsvCache();
  const candidate = await fetchCsvTextFresh(
    csvUrl,
    LIVE_FETCH_ATTEMPTS,
    previousHash,
  );
  if (!candidate) return "";

  const hash = hashCsvContent(candidate);
  setSticky({
    text: candidate,
    hash,
    length: candidate.length,
    quality: csvSnapshotQuality(candidate),
    pendingHash: null,
    acceptedAt: Date.now(),
  });
  return candidate;
}

/**
 * Стабильный CSV для SSR + API.
 * Google pub CDN отдаёт то посчитанные значения, то #REF!/«Завантаження...» —
 * предпочитаем качественный снимок и не даём плохому вытеснить хороший.
 */
export async function fetchStickyCsvText(
  csvUrl: string = RNP_CSV_URL,
): Promise<string> {
  const candidate = await fetchCsvText(csvUrl, LIVE_FETCH_ATTEMPTS);
  if (!candidate) return getSticky()?.text ?? "";

  const hash = hashCsvContent(candidate);
  const length = candidate.length;
  const quality = csvSnapshotQuality(candidate);
  const now = Date.now();
  const sticky = getSticky();

  if (!sticky) {
    setSticky({
      text: candidate,
      hash,
      length,
      quality,
      pendingHash: null,
      acceptedAt: now,
    });
    return candidate;
  }

  if (hash === sticky.hash) {
    sticky.pendingHash = null;
    sticky.quality = quality;
    setSticky(sticky);
    return sticky.text;
  }

  // Худший снимок (#REF! / Loading) никогда не затирает лучший
  if (quality < sticky.quality) {
    sticky.pendingHash = null;
    setSticky(sticky);
    return sticky.text;
  }

  // Явно лучший снимок — принимаем сразу (формулы досчитались)
  if (quality > sticky.quality) {
    setSticky({
      text: candidate,
      hash,
      length,
      quality,
      pendingHash: null,
      acceptedAt: now,
    });
    return candidate;
  }

  // Та же «чистота», другой hash (шум формул) — double-confirm
  if (sticky.pendingHash === hash) {
    setSticky({
      text: candidate,
      hash,
      length,
      quality,
      pendingHash: null,
      acceptedAt: now,
    });
    return candidate;
  }

  sticky.pendingHash = hash;
  setSticky(sticky);
  return sticky.text;
}

/**
 * Force-refresh: несколько раундов, в каждом — majority среди самых чистых снимков ТОЛЬКО этого раунда.
 * Предпочитаем hash ≠ previousHash, если он набрал majority в раунде (не любой «другой» шум CDN).
 */
async function fetchCsvTextFresh(
  csvUrl: string,
  attempts: number,
  previousHash: string | null,
): Promise<string> {
  const fetchOnce = () =>
    fetch(buildCsvFetchUrl(csvUrl, "live"), {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });

  let lastPick = "";
  const maxRounds = 5;

  for (let round = 0; round < maxRounds; round++) {
    const results = await Promise.all(
      Array.from({ length: attempts }, async () => {
        try {
          const response = await fetchOnce();
          if (!response.ok) return null;
          return response.text();
        } catch {
          return null;
        }
      }),
    );

    const roundTexts = results.filter((t): t is string => Boolean(t));
    if (roundTexts.length === 0) continue;

    const pick = pickRoundMajority(roundTexts);
    if (!pick) continue;
    lastPick = pick;

    const winnerHash = hashCsvContent(pick);
    const winnerDiffers = previousHash != null && winnerHash !== previousHash;

    if (!previousHash || winnerDiffers) {
      return pick;
    }
  }

  if (lastPick) return lastPick;

  try {
    const fallback = await fetchOnce();
    if (fallback.ok) return fallback.text();
  } catch {
    /* ignore */
  }
  return "";
}

async function fetchCsvText(csvUrl: string, attempts: number): Promise<string> {
  const fetchOnce = () =>
    fetch(buildCsvFetchUrl(csvUrl, "live"), {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });

  const collected: string[] = [];

  // Два раунда: published CSV часто сначала отдаёт «Завантаження...» / #REF!
  for (let round = 0; round < 2; round++) {
    const results = await Promise.all(
      Array.from({ length: attempts }, async () => {
        try {
          const response = await fetchOnce();
          if (!response.ok) return null;
          return response.text();
        } catch {
          return null;
        }
      }),
    );

    for (const text of results) {
      if (text) collected.push(text);
    }

    const clean = collected.filter((t) => unresolvedCellCount(t) === 0);
    if (clean.length > 0) {
      return pickConsensusCsv(clean);
    }
  }

  const winner = pickConsensusCsv(collected);
  if (winner) return winner;

  try {
    const fallback = await fetchOnce();
    if (fallback.ok) return fallback.text();
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * Предпочитаем полностью «чистые» снимки (без #REF!/Loading);
 * иначе — максимальная чистота, затем мажоритарный hash, затем длина.
 */
function pickConsensusCsv(texts: string[]): string {
  if (texts.length === 0) return "";

  const clean = texts.filter((t) => unresolvedCellCount(t) === 0);
  const pool = clean.length > 0 ? clean : texts;

  const byHash = new Map<
    string,
    { count: number; text: string; len: number; quality: number }
  >();
  for (const text of pool) {
    const hash = hashCsvContent(text);
    const quality = csvSnapshotQuality(text);
    const prev = byHash.get(hash);
    if (!prev || text.length > prev.len) {
      byHash.set(hash, {
        count: (prev?.count ?? 0) + 1,
        text,
        len: text.length,
        quality,
      });
    } else {
      prev.count += 1;
    }
  }

  let winner = "";
  let bestQuality = Number.NEGATIVE_INFINITY;
  let bestCount = -1;
  let bestLen = -1;

  for (const entry of byHash.values()) {
    const betterQuality = entry.quality > bestQuality;
    const sameQuality = entry.quality === bestQuality;
    const betterCount = sameQuality && entry.count > bestCount;
    const betterLen =
      sameQuality && entry.count === bestCount && entry.len > bestLen;

    if (betterQuality || betterCount || betterLen) {
      winner = entry.text;
      bestQuality = entry.quality;
      bestCount = entry.count;
      bestLen = entry.len;
    }
  }

  return winner;
}

/**
 * Majority среди снимков с минимальным числом #REF!/Loading в одном раунде.
 * Не предпочитаем длину и не берём «любой другой» hash — только консенсус раунда.
 */
function pickRoundMajority(texts: string[]): string {
  if (texts.length === 0) return "";

  let bestUnresolved = Number.POSITIVE_INFINITY;
  for (const text of texts) {
    bestUnresolved = Math.min(bestUnresolved, unresolvedCellCount(text));
  }

  const best = texts.filter((t) => unresolvedCellCount(t) === bestUnresolved);
  const byHash = new Map<string, { text: string; count: number }>();

  for (const text of best) {
    const hash = hashCsvContent(text);
    const prev = byHash.get(hash);
    if (!prev) byHash.set(hash, { text, count: 1 });
    else prev.count += 1;
  }

  let winner: { text: string; count: number } | null = null;
  for (const entry of byHash.values()) {
    if (!winner || entry.count > winner.count) winner = entry;
  }

  return winner?.text ?? "";
}
