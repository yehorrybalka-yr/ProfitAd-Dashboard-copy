import Papa from "papaparse";
import { hashCsvContent } from "@/lib/rnpCsvCache";
import {
  assignPrimaryGoalHolders,
  toProjectId,
} from "@/lib/rnpGroups";
import { parseMetricNumber, resolveGoalTiers } from "@/lib/rnpGoals";
import {
  monthKey,
  resolveDefaultMonthKey,
  sortMonthsChronologically,
} from "@/lib/rnpMonths";
import type {
  RNPDataset,
  RNPMetricRow,
  RNPMonthOption,
  RNPProject,
  RNPProjectMetrics,
} from "@/types/rnp";
import type { RnpProjectSource } from "@/lib/rnpProjectSources";

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

/** Метрики из строки Total — по заголовкам дневного блока. */
const TOTAL_METRIC_LABELS: { match: string[]; label: string }[] = [
  { match: ["BUDGET"], label: "Budget" },
  { match: ["IMPRESSIONS"], label: "Impressions" },
  { match: ["CLICKS"], label: "Clicks" },
  { match: ["CTR"], label: "CTR" },
  { match: ["CPM"], label: "CPM" },
  { match: ["CPC"], label: "CPC" },
  { match: ["LEADS"], label: "Leads" },
  { match: ["SUBS"], label: "Subs" },
  { match: ["VISITORS"], label: "Visitors" },
  { match: ["CR"], label: "CR" },
  { match: ["CPL"], label: "CPL" },
  { match: ["CAF"], label: "CAF" },
];

interface SummaryColumns {
  project: number;
  branch: number | null;
  month: number;
  goal: number;
  fact: number;
  planB: number;
  planBPlus: number;
  planC: number;
  progress: number;
  kpiBudget: number | null;
}

interface IndicatorRow {
  monthKey: string;
  monthIndex: number;
  monthToken: string;
  branchRaw: string;
  variant: string | null;
  goalLabel: string;
  fact: string;
  planB: string;
  planBPlus: string;
  planC: string;
  progressRaw: string;
  kpiBudget: string;
}

export interface ProjectTabParseResult {
  branchVariant: string | null;
  year: number | null;
  indicatorRows: IndicatorRow[];
  totalMetricsByMonth: Map<string, { label: string; fact: string }[]>;
  warnings: string[];
  contentHash: string;
  csvByteLength: number;
}

interface ProjectLevelGoal {
  goalLabel: string;
  fact: string;
  planB: string;
  planBPlus: string;
  planC: string;
  progressRaw: string;
  kpiBudget: string;
}

/**
 * Парсит одну вкладку Google Sheet как отдельную ветку проекта.
 * GOAL/FACT/KPI из индикаторного блока участвуют в project-level merge позже.
 */
export function parseProjectSheetTab(
  csvText: string,
  source: RnpProjectSource,
  branchVariant: string,
): ProjectTabParseResult {
  const { data } = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  });

  const warnings: string[] = [];
  const branchLabel = branchVariant.trim() || null;

  if (data.length < 2) {
    return emptyTabResult(branchLabel, csvText, warnings);
  }

  const headerPos = findSummaryHeader(data);
  if (!headerPos) {
    warnings.push(`${source.name}${branchLabel ? ` · ${branchLabel}` : ""}: не найден блок PROJECT … MONTH … GOAL`);
    return emptyTabResult(branchLabel, csvText, warnings);
  }

  const columns = mapSummaryColumns(data[headerPos.row] ?? [], headerPos.col);
  if (columns.month < 0 || columns.goal < 0 || columns.fact < 0) {
    warnings.push(
      `${source.name}${branchLabel ? ` · ${branchLabel}` : ""}: в блоке индикаторов нет обязательных колонок MONTH/GOAL/FACT`,
    );
    return emptyTabResult(branchLabel, csvText, warnings);
  }

  const year = inferYear(data) ?? new Date().getFullYear();
  const dailyHeaderRow = findDailyHeaderRow(data, headerPos.row);
  const totalRow = data
    .slice(headerPos.row)
    .find((row) => normalize((row[0] ?? "").trim()) === "TOTAL");

  const indicatorRows: IndicatorRow[] = [];

  for (let rowIndex = headerPos.row + 1; rowIndex < data.length; rowIndex += 1) {
    const row = data[rowIndex] ?? [];
    const projectName = (row[columns.project] ?? "").trim();
    if (!projectName) continue;
    if (normalize(projectName) === "TOTAL") break;

    const monthToken = normalize((row[columns.month] ?? "").trim());
    const monthIndex = (MONTH_NAMES as readonly string[]).indexOf(monthToken);
    if (monthIndex < 0) {
      warnings.push(
        `${source.name}: неизвестный месяц «${row[columns.month]}» (${branchLabel ?? "tab"})`,
      );
      continue;
    }

    const branchRaw =
      columns.branch !== null ? (row[columns.branch] ?? "").trim() : branchVariant;

    indicatorRows.push({
      monthKey: monthKey(year, monthIndex),
      monthIndex,
      monthToken,
      branchRaw,
      variant: branchLabel ?? normalizeBranchVariant(branchRaw),
      goalLabel: (row[columns.goal] ?? "").trim(),
      fact: cell(row, columns.fact),
      planB: cell(row, columns.planB),
      planBPlus: cell(row, columns.planBPlus),
      planC: cell(row, columns.planC),
      progressRaw: cell(row, columns.progress),
      kpiBudget: columns.kpiBudget !== null ? cell(row, columns.kpiBudget) : "",
    });
  }

  const totalMetricsByMonth = new Map<string, { label: string; fact: string }[]>();
  for (const row of indicatorRows) {
    const metrics = resolveTotalMetrics(dailyHeaderRow, totalRow);
    if (metrics.length > 0) {
      totalMetricsByMonth.set(row.monthKey, metrics);
    }
  }

  if (indicatorRows.length > 0 && totalMetricsByMonth.size === 0 && totalRow) {
    const key = indicatorRows[0].monthKey;
    totalMetricsByMonth.set(key, resolveTotalMetrics(dailyHeaderRow, totalRow));
  }

  return {
    branchVariant: branchLabel,
    year,
    indicatorRows,
    totalMetricsByMonth,
    warnings,
    contentHash: hashCsvContent(`${source.id}:${branchLabel ?? "main"}:${csvText}`),
    csvByteLength: csvText.length,
  };
}

/** Склеивает вкладки одного проекта в RNPDataset с отдельными ветками. */
export function mergeProjectTabResults(
  source: RnpProjectSource,
  tabResults: ProjectTabParseResult[],
): RNPDataset {
  const warnings = tabResults.flatMap((tab) => tab.warnings);
  const hashParts = tabResults.map((tab) => tab.contentHash);
  const csvByteLength = tabResults.reduce((sum, tab) => sum + tab.csvByteLength, 0);

  const isMultiBranch =
    tabResults.length > 1 ||
    tabResults.some((tab) => Boolean(tab.branchVariant?.trim()));

  const monthMap = new Map<string, RNPMonthOption>();
  const projectsByMonth: Record<string, RNPProject[]> = {};

  const indicatorByMonth = new Map<string, IndicatorRow[]>();
  for (const tab of tabResults) {
    for (const row of tab.indicatorRows) {
      const list = indicatorByMonth.get(row.monthKey) ?? [];
      list.push(row);
      indicatorByMonth.set(row.monthKey, list);
    }
  }

  const monthKeys = new Set<string>();
  for (const tab of tabResults) {
    for (const row of tab.indicatorRows) monthKeys.add(row.monthKey);
    for (const key of tab.totalMetricsByMonth.keys()) monthKeys.add(key);
  }

  for (const key of monthKeys) {
    const indicatorRows = indicatorByMonth.get(key) ?? [];
    const sample =
      indicatorRows[0] ??
      tabResults.find((tab) => tab.totalMetricsByMonth.has(key))?.indicatorRows[0];

    const year =
      tabResults.find((tab) => tab.year)?.year ?? new Date().getFullYear();
    const monthIndex =
      sample?.monthIndex ??
      Number(key.split("-")[1] ?? "1") - 1;
    const monthToken = sample?.monthToken ?? MONTH_NAMES[monthIndex] ?? "JANUARY";

    monthMap.set(key, {
      key,
      year,
      month: monthIndex,
      sheetName: monthToken,
      label: `${MONTH_LABELS_RU[monthIndex] ?? monthToken} ${year}`,
    });

    const projectGoal = pickProjectLevelGoal(indicatorRows);
    const members: RNPProject[] = [];

    for (const tab of tabResults) {
      const variant = tab.branchVariant?.trim() || null;
      const totalMetrics = tab.totalMetricsByMonth.get(key) ?? [];

      if (!isMultiBranch && !variant) {
        members.push({
          id: source.id,
          name: source.name,
          status: source.defaultStatus ?? "On Track",
          metrics: buildMetrics({ ...projectGoal, totalMetrics }),
          groupId: null,
          groupName: null,
          variant: null,
          isPrimaryGoalHolder: true,
        });
        continue;
      }

      const branchVariant = variant ?? "Main";
      const name = `${source.name} - ${branchVariant}`;
      members.push({
        id: toProjectId(name),
        name,
        status: source.defaultStatus ?? "On Track",
        metrics: buildMetrics({ ...projectGoal, totalMetrics }),
        groupId: source.id,
        groupName: source.name,
        variant: branchVariant,
        isPrimaryGoalHolder: false,
      });
    }

    assignPrimaryGoalHolders(members);
    projectsByMonth[key] = members;
  }

  const months = sortMonthsChronologically([...monthMap.values()]);

  // #region agent log
  fetch("http://127.0.0.1:7911/ingest/fdc3da9c-6ab8-4412-8cbf-0bd39ffd13d8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "97ccd5",
    },
    body: JSON.stringify({
      sessionId: "97ccd5",
      runId: "branch-merge",
      hypothesisId: "H-multi-tab",
      location: "rnpProjectSheetParser.ts:mergeProjectTabResults",
      message: "merged project branches",
      data: {
        projectId: source.id,
        tabCount: tabResults.length,
        branchVariants: tabResults.map((t) => t.branchVariant),
        monthCount: months.length,
        defaultMonthMembers:
          projectsByMonth[resolveDefaultMonthKey(months)]?.map((p) => ({
            id: p.id,
            variant: p.variant,
            budget:
              p.metrics.additionalMetrics.find((m) => m.label === "Budget")
                ?.fact ??
              p.metrics.overviewMetrics.find((m) => m.label === "Budget")?.fact,
          })) ?? [],
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return {
    months,
    defaultMonthKey: resolveDefaultMonthKey(months),
    projectsByMonth,
    contentHash: hashCsvContent(hashParts.join("|")),
    csvByteLength,
    fetchedAt: new Date().toISOString(),
    health: {
      source: "live",
      warnings,
      qualityScore: csvByteLength,
      accepted: months.length > 0,
    },
  };
}

/** @deprecated Используйте parseProjectSheetTab + mergeProjectTabResults */
export function parseProjectSheetCsv(
  csvText: string,
  source: RnpProjectSource,
): RNPDataset {
  const branchVariant = source.branches[0]?.variant ?? "";
  const tab = parseProjectSheetTab(csvText, source, branchVariant);
  return mergeProjectTabResults(source, [tab]);
}

function emptyTabResult(
  branchVariant: string | null,
  csvText: string,
  warnings: string[],
): ProjectTabParseResult {
  return {
    branchVariant,
    year: null,
    indicatorRows: [],
    totalMetricsByMonth: new Map(),
    warnings,
    contentHash: hashCsvContent(csvText),
    csvByteLength: csvText.length,
  };
}

/** GOAL/FACT/планы/KPI/% — на весь проект: берём первую заполненную строку (или одинаковые). */
function pickProjectLevelGoal(rows: IndicatorRow[]): ProjectLevelGoal {
  const withPlans = rows.find(
    (row) =>
      parseMetricNumber(row.planB) > 0 ||
      parseMetricNumber(row.planBPlus) > 0 ||
      parseMetricNumber(row.planC) > 0 ||
      parseMetricNumber(row.fact) > 0 ||
      Boolean(row.goalLabel.trim()),
  );
  const withKpi = rows.find((row) => Boolean(row.kpiBudget.trim()));
  const withProgress = rows.find(
    (row) =>
      Boolean(row.progressRaw.trim()) &&
      normalize(row.progressRaw) !== "0%" &&
      normalize(row.progressRaw) !== "0,00%",
  );
  const donor = withPlans ?? withKpi ?? withProgress ?? rows[0];

  if (!donor) {
    return {
      goalLabel: "Goal",
      fact: "",
      planB: "",
      planBPlus: "",
      planC: "",
      progressRaw: "",
      kpiBudget: "",
    };
  }

  return {
    goalLabel: (withPlans?.goalLabel || donor.goalLabel || "Goal").trim() || "Goal",
    fact: withPlans?.fact || donor.fact,
    planB: withPlans?.planB || donor.planB,
    planBPlus: withPlans?.planBPlus || donor.planBPlus,
    planC: withPlans?.planC || donor.planC,
    progressRaw: withProgress?.progressRaw || withPlans?.progressRaw || donor.progressRaw,
    kpiBudget: withKpi?.kpiBudget || donor.kpiBudget,
  };
}

function normalizeBranchVariant(branchRaw: string): string | null {
  const trimmed = branchRaw.trim();
  return trimmed || null;
}

function buildMetrics(input: {
  goalLabel: string;
  fact: string;
  planB: string;
  planBPlus: string;
  planC: string;
  progressRaw: string;
  kpiBudget: string;
  totalMetrics: { label: string; fact: string }[];
}): RNPProjectMetrics {
  const goalState = resolveGoalTiers({
    factRaw: input.fact,
    planBRaw: input.planB,
    planBPlusRaw: input.planBPlus,
    planCRaw: input.planC,
    progressRaw: input.progressRaw,
  });

  const primaryGoal: RNPMetricRow = {
    label: input.goalLabel || "Goal",
    templateLabel: input.goalLabel || "Goal",
    fact: formatRaw(input.fact),
    planB: formatRaw(input.planB),
    planBPlus: formatRaw(input.planBPlus),
    planC: formatRaw(input.planC),
    isPrimaryGoal: true,
    isKpi: false,
    goals: goalState.goals,
    activeGoal: goalState.activeGoal,
    progressPercentage: goalState.progressPercentage,
  };

  const overviewMetrics: RNPMetricRow[] = [primaryGoal];

  if (input.kpiBudget) {
    overviewMetrics.push({
      label: "Budget plan",
      templateLabel: "Budget plan",
      fact: formatRaw(input.kpiBudget),
      planB: "—",
      planBPlus: "—",
      planC: "—",
      isPrimaryGoal: false,
      isKpi: false,
      goals: [],
      activeGoal: "B",
      progressPercentage: 0,
    });
  }

  const additionalMetrics: RNPMetricRow[] = [];
  for (const metric of input.totalMetrics) {
    if (
      overviewMetrics.some(
        (row) =>
          normalize(row.label) === normalize(metric.label) &&
          row.fact === metric.fact,
      )
    ) {
      continue;
    }
    additionalMetrics.push({
      label: metric.label,
      templateLabel: metric.label,
      fact: metric.fact,
      planB: "—",
      planBPlus: "—",
      planC: "—",
      isPrimaryGoal: false,
      isKpi: false,
      goals: [],
      activeGoal: "B",
      progressPercentage: 0,
    });
  }

  while (overviewMetrics.length < 5 && additionalMetrics.length > 0) {
    overviewMetrics.push(additionalMetrics.shift()!);
  }

  return {
    primaryGoalLabel: primaryGoal.label,
    primaryGoalFact: primaryGoal.fact,
    primaryGoalPlan:
      primaryGoal.goals.find((goal) => goal.isActive)?.plan ?? primaryGoal.planB,
    activeGoal: primaryGoal.activeGoal,
    goals: primaryGoal.goals,
    progressPercentage: primaryGoal.progressPercentage,
    progressPercentageDisplay:
      primaryGoal.progressPercentage > 0
        ? `${primaryGoal.progressPercentage.toFixed(2).replace(/\.?0+$/, "")}%`
        : input.progressRaw
          ? formatRaw(input.progressRaw)
          : "—",
    overviewMetrics,
    kpiMetrics: [],
    additionalMetrics,
  };
}

function findSummaryHeader(
  data: string[][],
): { row: number; col: number } | null {
  for (let row = 0; row < data.length; row += 1) {
    const cells = data[row] ?? [];
    for (let col = 0; col < cells.length; col += 1) {
      if (normalize(cells[col] ?? "") !== "PROJECT") continue;
      for (let next = col + 1; next < cells.length; next += 1) {
        if (normalize(cells[next] ?? "") === "MONTH") {
          return { row, col };
        }
      }
    }
  }
  return null;
}

function mapSummaryColumns(row: string[], startCol: number): SummaryColumns {
  const indexOf = (...labels: string[]): number => {
    const wanted = labels.map(normalize);
    for (let col = startCol; col < row.length; col += 1) {
      if (wanted.includes(normalize(row[col] ?? ""))) return col;
    }
    return -1;
  };

  const project = indexOf("PROJECT");
  const branch = indexOf("BRANCH");
  const month = indexOf("MONTH");
  const goal = indexOf("GOAL");
  const fact = indexOf("FACT");
  const planB = indexOf("POINT B", "POINTB");
  const planBPlus = indexOf("POINT B+", "POINT B +", "POINTB+");
  const planC = indexOf("POINT C", "POINTC");
  const progress = indexOf("% FOR NOW", "%FOR NOW", "FOR NOW");
  const kpiBudget = indexOf("KPI - BUDGET", "KPI-BUDGET", "KPI BUDGET");

  return {
    project: project >= 0 ? project : startCol,
    branch: branch >= 0 ? branch : null,
    month,
    goal,
    fact,
    planB,
    planBPlus,
    planC,
    progress,
    kpiBudget: kpiBudget >= 0 ? kpiBudget : null,
  };
}

function findDailyHeaderRow(
  data: string[][],
  summaryHeaderRow: number,
): string[] {
  let dateRow = -1;
  for (let row = 0; row <= summaryHeaderRow; row += 1) {
    if (normalize((data[row] ?? [])[0] ?? "") === "DATE") {
      dateRow = row;
      break;
    }
  }

  if (dateRow < 0) return data[0] ?? [];

  const primary = data[dateRow] ?? [];
  const secondary = dateRow > 0 ? data[dateRow - 1] ?? [] : [];
  const width = Math.max(primary.length, secondary.length);
  const merged: string[] = [];

  for (let col = 0; col < width; col += 1) {
    const top = (secondary[col] ?? "").trim();
    const bottom = (primary[col] ?? "").trim();
    merged.push(bottom || top);
  }

  return merged;
}

function resolveTotalMetrics(
  headerRow: string[],
  totalRow: string[] | undefined,
): { label: string; fact: string }[] {
  if (!totalRow) return [];

  const metrics: { label: string; fact: string }[] = [];
  for (const spec of TOTAL_METRIC_LABELS) {
    const index = findHeaderIndex(headerRow, spec.match, {
      preferLast:
        spec.match.includes("LEADS") ||
        spec.match.includes("SUBS") ||
        spec.match.includes("CR") ||
        spec.match.includes("CPL"),
    });
    if (index < 0) continue;
    const value = formatRaw(totalRow[index] ?? "");
    if (!value || value === "—") continue;
    metrics.push({ label: spec.label, fact: value });
  }
  return metrics;
}

function findHeaderIndex(
  headerRow: string[],
  labels: string[],
  options?: { preferLast?: boolean },
): number {
  const wanted = labels.map(normalize);
  let found = -1;
  for (let col = 0; col < headerRow.length; col += 1) {
    if (!wanted.includes(normalize(headerRow[col] ?? ""))) continue;
    found = col;
    if (!options?.preferLast) return col;
  }
  return found;
}

function inferYear(data: string[][]): number | null {
  for (const row of data) {
    const date = (row[0] ?? "").trim();
    const match = date.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) return Number(match[3]);
  }
  return null;
}

function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return (row[index] ?? "").trim();
}

function formatRaw(value: string): string {
  const trimmed = value.trim();
  return trimmed || "—";
}

function normalize(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}
