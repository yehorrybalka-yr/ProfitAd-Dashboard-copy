import Papa from "papaparse";
import type { RNPDataset, RNPMetricRow, RNPMonthOption, RNPProject } from "@/types/rnp";
import { RNP_CSV_URL } from "@/lib/rnpConfig";
import {
  fetchFreshCsvText,
  fetchStickyCsvText,
  hashCsvContent,
} from "@/lib/rnpCsvCache";
import {
  assignPrimaryGoalHolders,
  parseProjectGrouping,
  toProjectId,
} from "@/lib/rnpGroups";
import { resolveGoalTiers, parseMetricNumber } from "@/lib/rnpGoals";
import {
  monthKey,
  resolveDefaultMonthKey,
  sortMonthsChronologically,
} from "@/lib/rnpMonths";

export { hashCsvContent } from "@/lib/rnpCsvCache";

/** Названия месяцев в таблице РНП (английские, как в Google Sheets) */
const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

const MONTH_LABELS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

/** Fallback, если в подзаголовках нет явных POINT B / B+ / C */
const DEFAULT_BLOCK_SPAN = 4;

/** Количество приоритетных строк метрик в начале месячного блока */
const OVERVIEW_ROW_COUNT = 5;

/** Индекс строки главной цели по умолчанию (вторая строка = 1), если нет % FOR NOW */
const PRIMARY_GOAL_ROW_INDEX = 1;

/** Колонки одного проекта: роли читаются из строки RESULT/FACT/POINT * */
interface ProjectBlockLayout {
  fact: number;
  planB: number;
  planBPlus: number;
  planC: number;
  /** Колонка слева от FACT — кастомные подписи метрик */
  labelCol: number;
  /** Конец блока (исключая): следующий FACT или конец строки */
  end: number;
}

/** Служебные значения в строке названий проектов — не являются именами */
const SKIP_NAMES = new Set(["", "PROJECTS", "ТАБЛИЦА", "Таблица", "RESULT", "STATUS"]);

/**
 * Загружает CSV для SSR и API через sticky-кэш процесса.
 * Для продакшена предпочтителен loadRnpDataset() (Neon snapshot).
 */
export async function parseRNPWithCache(
  csvUrl: string = RNP_CSV_URL,
): Promise<RNPDataset> {
  return parseRNPLive(csvUrl);
}

/**
 * Загружает CSV без Next.js-кэша.
 * Sticky-кэш внутри процесса стабилизирует Google CDN flaps.
 */
export async function parseRNPLive(
  csvUrl: string = RNP_CSV_URL,
  options?: { force?: boolean; fromHash?: string | null },
): Promise<RNPDataset> {
  try {
    const csvText = options?.force
      ? await fetchFreshCsvText(csvUrl, options.fromHash ?? null)
      : await fetchStickyCsvText(csvUrl);
    if (!csvText) return emptyDataset();
    const dataset = parseRNPCsv(csvText);
    dataset.health = {
      source: "live",
      warnings: dataset.health?.warnings ?? [],
      qualityScore: csvText.length,
      accepted: dataset.months.length > 0,
    };
    return dataset;
  } catch (error) {
    console.error("[rnpParser] Ошибка загрузки или парсинга CSV:", error);
    return emptyDataset();
  }
}

/**
 * Парсит сырой текст CSV без сетевого запроса.
 * Возвращает все доступные месяцы и проекты по каждому из них.
 */
export function parseRNPCsv(csvText: string): RNPDataset {
  const { data } = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  });

  if (data.length < 4) {
    return emptyDataset();
  }

  const headerRow = data[0] ?? [];
  const statusRow = data[1] ?? [];
  const subheaderRow = data[2] ?? [];
  const projectBlocks = resolveProjectBlocks(subheaderRow);

  if (projectBlocks.length === 0) {
    return emptyDataset();
  }

  const year = new Date().getFullYear();
  const warnings: string[] = [];
  const monthSections = findAllMonthSections(data, warnings);
  const months: RNPMonthOption[] = [];
  const projectsByMonth: Record<string, RNPProject[]> = {};

  for (const section of monthSections) {
    const monthIndex = MONTH_NAMES.indexOf(section.name as (typeof MONTH_NAMES)[number]);
    if (monthIndex === -1) continue;

    const key = monthKey(year, monthIndex);
    const projects = parseProjectsForMonth(
      data,
      section.range,
      projectBlocks,
      headerRow,
      statusRow,
      section.index,
      section.name,
    );

    if (projects.length === 0) continue;

    months.push({
      key,
      year,
      month: monthIndex,
      sheetName: section.name,
      label: `${MONTH_LABELS_RU[monthIndex]} ${year}`,
    });
    projectsByMonth[key] = projects;
  }

  const defaultMonthKey = resolveDefaultMonthKey(months);
  const sortedMonths = sortMonthsChronologically(months);

  return {
    months: sortedMonths,
    defaultMonthKey,
    projectsByMonth,
    contentHash: hashCsvContent(csvText),
    csvByteLength: csvText.length,
    fetchedAt: new Date().toISOString(),
    health: {
      source: "live",
      warnings,
      qualityScore: csvText.length,
      accepted: sortedMonths.length > 0,
    },
  };
}

/** Парсит проекты для одной месячной секции таблицы */
function parseProjectsForMonth(
  data: string[][],
  monthRange: { start: number; end: number },
  projectBlocks: ProjectBlockLayout[],
  headerRow: string[],
  statusRow: string[],
  monthHeaderIndex: number,
  monthName: string,
): RNPProject[] {
  const { primary: primaryRows, additional: additionalRows } =
    collectMonthMetricRows(data, monthRange);
  const progressRow = findProgressRow(data, monthRange);

  const projects: RNPProject[] = [];
  let lastKnownName = "";

  for (const block of projectBlocks) {
    const name = resolveProjectName(headerRow, block, lastKnownName);
    if (!isValidProjectName(name)) continue;
    lastKnownName = name;

    if (
      !blockParticipatesInMonth(
        data,
        monthHeaderIndex,
        monthRange,
        block,
        monthName,
      )
    ) {
      continue;
    }

    const status = resolveStatus(statusRow, block);
    const grouping = parseProjectGrouping(name);
    const progressRaw = progressRow
      ? extractProgressRaw(progressRow, block)
      : "";
    const progressGoalHint = progressRow
      ? extractProgressGoalHint(progressRow, block)
      : "";

    if (!status && !hasBlockData(data, monthRange, block)) {
      continue;
    }

    const parsedMetrics = parseBlockMetrics(
      primaryRows,
      additionalRows,
      block,
      progressRaw,
      progressGoalHint,
    );

    projects.push({
      id: toProjectId(name),
      name,
      status,
      metrics: parsedMetrics,
      groupId: grouping.groupId,
      groupName: grouping.groupName,
      variant: grouping.variant,
      isPrimaryGoalHolder: false,
    });
  }

  assignPrimaryGoalHolders(projects);
  return projects;
}

/** Первые 5 строк + остальные метрики месяца (до служебных строк / следующего месяца) */
function collectMonthMetricRows(
  data: string[][],
  range: { start: number; end: number },
): { primary: string[][]; additional: string[][] } {
  const all: string[][] = [];

  for (let i = range.start; i < range.end; i++) {
    const row = data[i] ?? [];
    if (findMonthNameInColA(row)) break;
    if (rowIsServiceRow(row)) break;
    if (!rowHasAnyContent(row)) continue;

    all.push(row);
  }

  return {
    primary: all.slice(0, OVERVIEW_ROW_COUNT),
    additional: all.slice(OVERVIEW_ROW_COUNT),
  };
}

function isServiceRow(normalized: string): boolean {
  return (
    normalized === "% FOR NOW" ||
    normalized === "%FORNOW" ||
    normalized === "PACE" ||
    normalized.startsWith("% OF SEASON")
  );
}

function rowIsServiceRow(row: string[]): boolean {
  for (const cell of row) {
    if (isServiceRow(normalizeLabel(cell ?? ""))) return true;
  }
  return false;
}

function rowHasAnyContent(row: string[]): boolean {
  return row.some((cell) => (cell ?? "").trim() !== "");
}

/** Контракт таблицы: имя месяца только в колонке A */
function findMonthNameInColA(row: string[]): string | null {
  const cell = (row[0] ?? "").trim();
  const firstToken = normalizeLabel(cell.split(/\s+/)[0] ?? "");
  if ((MONTH_NAMES as readonly string[]).includes(firstToken)) {
    return firstToken;
  }
  return null;
}

function findStrayMonthName(row: string[]): string | null {
  for (let col = 1; col < row.length; col++) {
    const normalized = normalizeLabel(row[col] ?? "");
    if ((MONTH_NAMES as readonly string[]).includes(normalized)) {
      return normalized;
    }
  }
  return null;
}

/** Участвует ли блок в месяце: месяц в col A — все проекты; иначе fallback */
function blockParticipatesInMonth(
  data: string[][],
  monthHeaderIndex: number,
  monthRange: { start: number; end: number },
  block: ProjectBlockLayout,
  monthName: string,
): boolean {
  const header = data[monthHeaderIndex] ?? [];
  const colA = findMonthNameInColA(header);
  if (colA === monthName) return true;

  const inLabel = normalizeLabel(header[block.labelCol] ?? "");
  if (inLabel === monthName) return true;

  return hasBlockData(data, monthRange, block);
}

function parseBlockMetrics(
  primaryRows: string[][],
  additionalRows: string[][],
  block: ProjectBlockLayout,
  progressRaw: string,
  progressGoalHint: string,
) {
  const goalHintLabel = extractGoalMetricName(progressGoalHint);
  const primaryGoalRowIndex = resolvePrimaryGoalRowIndex(
    primaryRows,
    block,
    goalHintLabel,
  );

  const overviewMetrics = parseMetricRows(primaryRows, block, {
    primaryGoalRowIndex,
    progressRaw,
  });

  const additionalMetrics = parseMetricRows(additionalRows, block, {
    primaryGoalRowIndex: -1,
    progressRaw: "",
  });

  const primaryGoal =
    overviewMetrics.find((m) => m.isPrimaryGoal) ??
    overviewMetrics[Math.max(0, primaryGoalRowIndex)] ??
    null;

  const primaryGoalLabel = primaryGoal
    ? resolvePrimaryGoalLabel(progressGoalHint, primaryGoal.label)
    : "—";

  if (primaryGoal && primaryGoalLabel !== primaryGoal.label) {
    primaryGoal.label = primaryGoalLabel;
  }

  const kpiMetrics = [
    ...overviewMetrics.filter((m) => m.isKpi),
    ...additionalMetrics.filter((m) => m.isKpi),
  ];

  const progressPercentage = primaryGoal?.progressPercentage ?? 0;

  return {
    primaryGoalLabel,
    primaryGoalFact: primaryGoal?.fact ?? "—",
    primaryGoalPlan: primaryGoal
      ? primaryGoal.goals.find((g) => g.isActive)?.plan ?? primaryGoal.planB
      : "—",
    activeGoal: primaryGoal?.activeGoal ?? "B",
    goals: primaryGoal?.goals ?? [],
    progressPercentage,
    progressPercentageDisplay:
      progressPercentage > 0
        ? `${progressPercentage.toFixed(2).replace(/\.?0+$/, "")}%`
        : progressRaw
          ? formatCellRaw(progressRaw)
          : "—",
    overviewMetrics,
    kpiMetrics,
    additionalMetrics,
  };
}

function parseMetricRows(
  rows: string[][],
  block: ProjectBlockLayout,
  options: { primaryGoalRowIndex: number; progressRaw: string },
): RNPMetricRow[] {
  const metrics: RNPMetricRow[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const cells = parseBlockCells(row, block);
    if (!rowHasData(cells)) continue;

    const fromA = (row[0] ?? "").trim();
    const fromCustom = (row[block.labelCol] ?? "").trim();
    const templateLabel =
      fromA ||
      (isValidMetricLabel(fromCustom) ? fromCustom : "");
    if (!templateLabel) continue;

    const label = resolveMetricLabel(row, block, templateLabel);
    const isPrimaryGoal = rowIndex === options.primaryGoalRowIndex;
    const hasPlans = hasPlanValues(cells);
    const isKpi = !isPrimaryGoal && hasPlans;

    const goalState = isPrimaryGoal || isKpi
      ? resolveGoalTiers({
          factRaw: cells.fact,
          planBRaw: cells.planB,
          planBPlusRaw: cells.planBPlus,
          planCRaw: cells.planC,
          progressRaw: isPrimaryGoal ? options.progressRaw : "",
        })
      : null;

    metrics.push({
      label,
      templateLabel,
      fact: formatMetricDisplayValue(label, cells.fact),
      planB: formatCellRaw(cells.planB),
      planBPlus: formatCellRaw(cells.planBPlus),
      planC: formatCellRaw(cells.planC),
      isPrimaryGoal,
      isKpi,
      goals: goalState?.goals ?? [],
      activeGoal: goalState?.activeGoal ?? "B",
      progressPercentage: goalState?.progressPercentage ?? 0,
    });
  }

  return metrics;
}

function parseBlockCells(row: string[], block: ProjectBlockLayout) {
  return {
    fact: row[block.fact],
    planB: row[block.planB],
    planBPlus: row[block.planBPlus],
    planC: row[block.planC],
  };
}

function rowHasData(cells: ReturnType<typeof parseBlockCells>): boolean {
  return [cells.fact, cells.planB, cells.planBPlus, cells.planC].some(
    (raw) => formatCellRaw(raw) !== "—",
  );
}

function hasPlanValues(cells: ReturnType<typeof parseBlockCells>): boolean {
  return [cells.planB, cells.planBPlus, cells.planC].some(
    (raw) => parseMetricNumber(raw) > 0,
  );
}

/** Название главной цели: приоритет у % FOR NOW, иначе — подпись из колонки проекта. */
function resolvePrimaryGoalLabel(
  progressGoalHint: string,
  rowLabel: string,
): string {
  const fromHint = extractGoalMetricName(progressGoalHint);
  if (!fromHint) return rowLabel;

  // В некоторых проектах (например Slovakia) в % FOR NOW может быть
  // "PLANNED LEADS", но фактическая строка главной цели (custom label
  // из колонки слева от FACT) соответствует другой метрике (например Purchases).
  // Тогда не переименовываем метрику главной цели — оставляем rowLabel.
  const hintKey = canonicalMetricKey(fromHint);
  const rowKey = canonicalMetricKey(rowLabel);

  if (hintKey && rowKey) {
    if (hintKey === rowKey) return fromHint;
    // Несовпадение — используем rowLabel
    return rowLabel;
  }

  return fromHint || rowLabel;
}

function extractGoalMetricName(progressGoalHint: string): string {
  const match = progressGoalHint.match(/OF\s+PLANNED\s+([^:(%]+)/i);
  if (!match) return "";
  return match[1].replace(/\s*\(B\)\s*$/i, "").trim();
}

function canonicalMetricKey(label: string): string | null {
  const normalized = normalizeLabel(label);
  if (!normalized) return null;

  // Common English
  if (normalized.includes("LEAD")) return "LEADS";
  if (normalized.includes("PURCHASE")) return "PURCHASES";
  if (normalized.includes("SUB")) return "SUBS";
  if (normalized.includes("VISITOR")) return "VISITORS";
  if (normalized.includes("REVENUE")) return "REVENUE";
  if (normalized.includes("BUDGET")) return "BUDGET";

  // Russian-ish (covers what shows up in sheets)
  if (normalized.includes("ЛИД")) return "LEADS";
  if (normalized.includes("ПОКУП")) return "PURCHASES";
  if (normalized.includes("ПОДПИС")) return "SUBS";
  if (normalized.includes("ПОСЕТ")) return "VISITORS";
  if (normalized.includes("ВЫРУЧ")) return "REVENUE";
  if (normalized.includes("БЮДЖ")) return "BUDGET";

  if (normalized.includes("CAC")) return "CAC";
  if (normalized.includes("ROAS")) return "ROAS";
  if (normalized.includes("CTR")) return "CTR";
  if (normalized.includes("CPC")) return "CPC";
  if (normalized.includes("CPL")) return "CPL";

  return normalized;
}

/** Индекс главной цели: совпадение с % FOR NOW, иначе вторая строка */
function resolvePrimaryGoalRowIndex(
  rows: string[][],
  block: ProjectBlockLayout,
  goalHintLabel: string,
): number {
  if (goalHintLabel) {
    const hintKey = normalizeLabel(goalHintLabel);
    const byHint = rows.findIndex((row) => {
      const template = normalizeLabel((row[0] ?? "").trim());
      const custom = normalizeLabel(
        resolveMetricLabel(row, block, (row[0] ?? "").trim()),
      );
      return (
        template === hintKey ||
        custom === hintKey ||
        template.includes(hintKey) ||
        hintKey.includes(template)
      );
    });
    if (byHint >= 0) return byHint;
  }
  return Math.min(PRIMARY_GOAL_ROW_INDEX, Math.max(0, rows.length - 1));
}

/** Подпись метрики: колонка слева от FACT (per-project), иначе колонка A */
function resolveMetricLabel(
  row: string[],
  block: ProjectBlockLayout,
  templateLabel: string,
): string {
  const custom = (row[block.labelCol] ?? "").trim();
  if (custom && isValidMetricLabel(custom)) return custom;
  return templateLabel;
}

function isValidMetricLabel(label: string): boolean {
  const normalized = normalizeLabel(label);
  return (
    normalized !== "" &&
    !looksLikeMetricValue(label) &&
    !SKIP_NAMES.has(label) &&
    !SKIP_NAMES.has(normalized) &&
    normalized !== "FACT" &&
    normalized !== "POINT B" &&
    normalized !== "POINT B+" &&
    normalized !== "POINT C"
  );
}

/** Значения планов/KPI в колонке подписи — не название метрики */
function looksLikeMetricValue(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;

  if (/[€$zł]/i.test(trimmed)) return true;
  if (/%/.test(trimmed)) return true;

  const numericOnly = trimmed.replace(/[\s\u00A0.,]/g, "");
  return /^\d+$/.test(numericOnly);
}

/** Числовые метрики без валюты — убираем ошибочное форматирование $0,00 → 0 */
const COUNT_METRIC_PATTERN =
  /^(subs|leads|visitors|purchases|clicks|contacts|impressions|sessions)(\s|\+|$)/i;

function formatMetricDisplayValue(label: string, raw: string | undefined): string {
  const formatted = formatCellRaw(raw);
  if (formatted === "—") return formatted;

  const normalizedLabel = label.trim();
  if (!COUNT_METRIC_PATTERN.test(normalizedLabel) && !/^leads\s*\+\s*contacts$/i.test(normalizedLabel)) {
    return formatted;
  }

  if (!/[€$zł]/i.test(formatted)) return formatted;

  const num = parseMetricNumber(formatted);
  if (!Number.isFinite(num)) return formatted;

  if (Number.isInteger(num)) return String(num);
  return String(num).replace(/\.?0+$/, "");
}

function emptyDataset(): RNPDataset {
  return {
    months: [],
    defaultMonthKey: "",
    projectsByMonth: {},
    contentHash: "",
    csvByteLength: 0,
    fetchedAt: new Date().toISOString(),
    health: {
      source: "live",
      warnings: ["CSV пустой или не распознан"],
      qualityScore: 0,
      accepted: false,
    },
  };
}

function findAllMonthSections(
  rows: string[][],
  warnings: string[],
): { name: string; index: number; range: { start: number; end: number } }[] {
  const monthIndices: { name: string; index: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const name = findMonthNameInColA(row);
    if (name) {
      monthIndices.push({ name, index: i });
      continue;
    }
    const stray = findStrayMonthName(row);
    if (stray) {
      warnings.push(
        `Месяц ${stray} найден не в колонке A (строка ${i + 1}). По контракту месяц должен быть только в столбце A.`,
      );
    }
  }

  return monthIndices.map((entry, idx) => {
    const next = monthIndices[idx + 1];
    return {
      name: entry.name,
      index: entry.index,
      range: {
        start: entry.index + 1,
        end: next ? next.index : rows.length,
      },
    };
  });
}

/**
 * Находит блоки проектов по подзаголовкам.
 * Колонки FACT / POINT B / POINT B+ / POINT C читаются по именам внутри
 * отрезка [FACT … следующий FACT), поэтому сдвиг или доп. колонки
 * между блоками не ломают разбор.
 */
function resolveProjectBlocks(subheaderRow: string[]): ProjectBlockLayout[] {
  const factCols: number[] = [];
  for (let col = 1; col < subheaderRow.length; col++) {
    if (normalizeLabel(subheaderRow[col]) === "FACT") {
      factCols.push(col);
    }
  }

  return factCols.map((fact, idx) => {
    const nextFact = factCols[idx + 1];
    const end = nextFact ?? subheaderRow.length;
    return buildBlockLayout(subheaderRow, fact, end);
  });
}

function buildBlockLayout(
  subheaderRow: string[],
  fact: number,
  end: number,
): ProjectBlockLayout {
  let planB = -1;
  let planBPlus = -1;
  let planC = -1;

  for (let col = fact + 1; col < end; col++) {
    const role = normalizeLabel(subheaderRow[col] ?? "");
    if (!role) continue;
    if (role === "POINT B" || role === "B") planB = col;
    else if (role === "POINT B+" || role === "B+") planBPlus = col;
    else if (role === "POINT C" || role === "C") planC = col;
  }

  // Fallback: классическая схема FACT | B | B+ | C сразу после FACT
  if (planB < 0) planB = Math.min(fact + 1, end - 1);
  if (planBPlus < 0) planBPlus = Math.min(fact + 2, end - 1);
  if (planC < 0) planC = Math.min(fact + 3, end - 1);

  // Если блок короче ожидаемого — держим индексы в пределах
  const fallbackEnd = Math.min(fact + DEFAULT_BLOCK_SPAN, end);
  if (planB >= end) planB = Math.min(fact + 1, fallbackEnd - 1);
  if (planBPlus >= end) planBPlus = Math.min(fact + 2, fallbackEnd - 1);
  if (planC >= end) planC = Math.min(fact + 3, fallbackEnd - 1);

  return {
    fact,
    planB: Math.max(planB, fact),
    planBPlus: Math.max(planBPlus, fact),
    planC: Math.max(planC, fact),
    labelCol: Math.max(0, fact - 1),
    end,
  };
}

function resolveProjectName(
  headerRow: string[],
  block: ProjectBlockLayout,
  lastKnownName: string,
): string {
  const atFact = (headerRow[block.fact] ?? "").trim();
  if (isValidProjectName(atFact)) return atFact;

  for (let col = block.fact; col < block.end; col++) {
    const candidate = (headerRow[col] ?? "").trim();
    if (isValidProjectName(candidate)) return candidate;
  }

  return lastKnownName;
}

function resolveStatus(
  statusRow: string[],
  block: ProjectBlockLayout,
): string {
  const cols = new Set<number>();
  if (block.labelCol >= 0) cols.add(block.labelCol);
  for (let col = block.fact; col < block.end; col++) cols.add(col);

  for (const col of cols) {
    const cell = (statusRow[col] ?? "").trim();
    if (cell && cell.toUpperCase() !== "STATUS") return cell;
  }
  return "";
}

function isValidProjectName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return !SKIP_NAMES.has(trimmed) && !SKIP_NAMES.has(trimmed.toUpperCase());
}

function findProgressRow(
  rows: string[][],
  range: { start: number; end: number },
): string[] | null {
  for (let i = range.start; i < range.end; i++) {
    const row = rows[i];
    if (!row) continue;
    for (const cell of row) {
      const label = normalizeLabel(cell ?? "");
      if (label === "% FOR NOW" || label === "%FORNOW") return row;
    }
  }
  return null;
}

/** Возвращает сырое значение процента выполнения (с символом %) */
function extractProgressRaw(
  row: string[],
  block: ProjectBlockLayout,
): string {
  for (let col = block.fact; col < block.end; col++) {
    const raw = row[col] ?? "";
    if (raw.includes("PLANNED") || raw.includes("OF ")) continue;
    const trimmed = raw.trim();
    if (
      trimmed &&
      trimmed !== "#DIV/0!" &&
      trimmed !== "#REF!" &&
      trimmed !== "#N/A"
    ) {
      return trimmed;
    }
  }
  return "";
}

/** Текст подсказки о метрике цели из % FOR NOW (напр. «% OF PLANNED SUBS:») */
function extractProgressGoalHint(
  row: string[],
  block: ProjectBlockLayout,
): string {
  for (let col = block.fact; col < block.end; col++) {
    const raw = row[col] ?? "";
    if (raw.includes("PLANNED")) return raw.trim();
  }
  return "";
}

/** Сохраняет ячейку как в таблице; пустые и ошибки → «—» */
function formatCellRaw(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (
    !trimmed ||
    trimmed === "#DIV/0!" ||
    trimmed === "#REF!" ||
    trimmed === "#N/A" ||
    trimmed === "#ERROR!" ||
    trimmed === "-" ||
    /^завантаження/i.test(trimmed) ||
    /^loading/i.test(trimmed) ||
    /^laden/i.test(trimmed)
  ) {
    return "—";
  }
  return trimmed;
}

function normalizeLabel(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function hasBlockData(
  data: string[][],
  monthRange: { start: number; end: number },
  block: ProjectBlockLayout,
): boolean {
  for (let i = monthRange.start; i < monthRange.end; i++) {
    for (let col of [block.fact, block.planB, block.planBPlus, block.planC]) {
      const raw = (data[i]?.[col] ?? "").trim();
      if (!raw || raw === "-") continue;
      if (raw.startsWith("#")) return true;
      if (raw.includes("PLANNED") && !raw.includes("%")) continue;
      if (parseMetricNumber(raw) !== 0) return true;
      if (/[€$zł%]/.test(raw)) return true;
    }
  }
  return false;
}
