import type { RNPDataset, RNPMonthOption, RNPProject } from "@/types/rnp";
import { sortMonthsChronologically } from "@/lib/rnpMonths";
import {
  findMetricByTemplateLabel,
  getAllProjectMetrics,
} from "@/lib/rnpMetrics";
import {
  buildProjectCardItems,
  type RNPProjectCardItem,
} from "@/lib/rnpGroups";
import { isArchivedStatus } from "@/lib/rnpStatus";

export interface MonthCompareRange {
  fromKey: string;
  toKey: string;
}

export interface MonthMetricValue {
  monthKey: string;
  monthLabel: string;
  value: string;
}

/** Месяцы включительно между from и to (хронологически) */
export function getMonthsInRange(
  months: RNPMonthOption[],
  fromKey: string,
  toKey: string,
): RNPMonthOption[] {
  const sorted = sortMonthsChronologically(months);
  if (sorted.length === 0 || !fromKey || !toKey) return [];

  const fromIdx = sorted.findIndex((m) => m.key === fromKey);
  const toIdx = sorted.findIndex((m) => m.key === toKey);
  if (fromIdx === -1 || toIdx === -1) return [];

  const start = Math.min(fromIdx, toIdx);
  const end = Math.max(fromIdx, toIdx);
  return sorted.slice(start, end + 1);
}

/** Диапазон по умолчанию: предыдущий доступный месяц → текущий */
export function defaultCompareRange(
  months: RNPMonthOption[],
  selectedKey: string,
): MonthCompareRange {
  const sorted = sortMonthsChronologically(months);
  if (sorted.length === 0) return { fromKey: "", toKey: "" };

  const selectedIdx = Math.max(
    0,
    sorted.findIndex((m) => m.key === selectedKey),
  );
  const to = sorted[selectedIdx] ?? sorted[sorted.length - 1];
  const from = sorted[Math.max(0, selectedIdx - 1)] ?? to;

  return { fromKey: from.key, toKey: to.key };
}

/** Короткая подпись: «Июнь 2026» */
export function formatMonthChip(month: RNPMonthOption): string {
  return month.label;
}

/** Найти проект в месяце по id или groupId */
export function findProjectInMonth(
  dataset: RNPDataset,
  monthKey: string,
  projectId: string,
  groupId: string | null,
): RNPProject | undefined {
  const list = dataset.projectsByMonth[monthKey] ?? [];
  const byId = list.find((p) => p.id === projectId);
  if (byId) return byId;
  if (groupId) {
    return (
      list.find((p) => p.groupId === groupId && p.isPrimaryGoalHolder) ??
      list.find((p) => p.groupId === groupId)
    );
  }
  return undefined;
}

/** Главная метрика проекта по месяцам диапазона */
export function getPrimaryGoalByMonths(
  dataset: RNPDataset,
  rangeMonths: RNPMonthOption[],
  projectId: string,
  groupId: string | null,
): MonthMetricValue[] {
  return rangeMonths.map((month) => {
    const project = findProjectInMonth(dataset, month.key, projectId, groupId);
    return {
      monthKey: month.key,
      monthLabel: formatMonthChip(month),
      value: project?.metrics.primaryGoalFact ?? "—",
    };
  });
}

/** Значения одной метрики по строке таблицы (колонка A) across месяцев */
export function getMetricFactByMonths(
  dataset: RNPDataset,
  rangeMonths: RNPMonthOption[],
  projectId: string,
  templateLabel: string,
  groupId: string | null = null,
): MonthMetricValue[] {
  return rangeMonths.map((month) => {
    const project = findProjectInMonth(
      dataset,
      month.key,
      projectId,
      groupId,
    );
    const metrics = project ? getAllProjectMetrics(project) : [];
    const row = findMetricByTemplateLabel(metrics, templateLabel);
    return {
      monthKey: month.key,
      monthLabel: formatMonthChip(month),
      value: row?.fact ?? "—",
    };
  });
}

/** Подпись главной метрики (берём из первого доступного месяца) */
export function resolvePrimaryGoalLabelAcrossMonths(
  dataset: RNPDataset,
  rangeMonths: RNPMonthOption[],
  projectId: string,
  groupId: string | null,
  fallback: string,
): string {
  for (const month of rangeMonths) {
    const project = findProjectInMonth(dataset, month.key, projectId, groupId);
    const label = project?.metrics.primaryGoalLabel;
    if (label && label !== "—") return label;
  }
  return fallback;
}

export function clampCompareRange(
  months: RNPMonthOption[],
  fromKey: string,
  toKey: string,
): MonthCompareRange {
  const sorted = sortMonthsChronologically(months);
  if (sorted.length === 0) return { fromKey: "", toKey: "" };

  let from = sorted.find((m) => m.key === fromKey) ?? sorted[0];
  let to = sorted.find((m) => m.key === toKey) ?? sorted[sorted.length - 1];

  if (from.year * 12 + from.month > to.year * 12 + to.month) {
    [from, to] = [to, from];
  }

  return { fromKey: from.key, toKey: to.key };
}

/**
 * Карточки проектов для сравнения: объединение по диапазону,
 * приоритет у более нового месяца при выборе goalProject/status.
 */
export function buildCompareCardItems(
  dataset: RNPDataset,
  rangeMonths: RNPMonthOption[],
  archived: boolean,
): RNPProjectCardItem[] {
  const chronSorted = sortMonthsChronologically(rangeMonths);
  const newestFirst = [...chronSorted].reverse();
  const merged: RNPProject[] = [];
  const seenCardIds = new Set<string>();

  for (const month of newestFirst) {
    const list = dataset.projectsByMonth[month.key] ?? [];
    for (const project of list) {
      const isArchived = isArchivedStatus(project.status);
      if (archived !== isArchived) continue;

      const cardId = project.groupId ?? project.id;
      if (seenCardIds.has(cardId)) continue;
      seenCardIds.add(cardId);
      merged.push(project);
    }
  }

  return buildProjectCardItems(merged);
}
