import type { RNPDataset } from "@/types/rnp";
import { unresolvedCellCount } from "@/lib/rnpCsvCache";

export interface RnpQualityResult {
  accepted: boolean;
  qualityScore: number;
  warnings: string[];
  projectCount: number;
}

export interface PreviousSnapshotStats {
  projectCount: number;
  csvByteLength: number;
}

export function countDefaultMonthProjects(dataset: RNPDataset): number {
  if (!dataset.defaultMonthKey) return 0;
  return dataset.projectsByMonth[dataset.defaultMonthKey]?.length ?? 0;
}

/** Отсекает битые CSV и резкие просадки числа проектов */
export function assessRnpQuality(
  csvText: string,
  dataset: RNPDataset,
  previous?: PreviousSnapshotStats | null,
): RnpQualityResult {
  const warnings = [...(dataset.health?.warnings ?? [])];
  const unresolved = unresolvedCellCount(csvText);
  const projectCount = countDefaultMonthProjects(dataset);

  if (unresolved > 0) {
    warnings.push(
      `CSV содержит ${unresolved} неразрешённых ячеек (#REF! / Loading)`,
    );
  }
  if (dataset.months.length === 0) {
    warnings.push("Не найдено ни одного месяца в колонке A");
  }
  if (projectCount === 0) {
    warnings.push("Нет проектов в текущем месяце");
  }
  if (previous) {
    if (previous.projectCount >= 2 && projectCount < previous.projectCount * 0.5) {
      warnings.push(
        `Число проектов упало с ${previous.projectCount} до ${projectCount}`,
      );
    }
    if (
      previous.csvByteLength > 2000 &&
      dataset.csvByteLength < previous.csvByteLength * 0.5
    ) {
      warnings.push("CSV сильно короче предыдущего принятого снимка");
    }
  }

  // Одна-две #REF! в общей таблице не должны блокировать весь дашборд
  // и подключение отдельных проектных листов.
  const unresolvedBlocking = unresolved >= 5;

  const failed =
    unresolvedBlocking ||
    dataset.months.length === 0 ||
    projectCount === 0 ||
    warnings.some(
      (warning) => warning.includes("упало") || warning.includes("короче"),
    );

  const qualityScore =
    dataset.csvByteLength -
    unresolved * 50_000 +
    dataset.months.length * 100 +
    projectCount * 10;

  return {
    accepted: !failed,
    qualityScore,
    warnings,
    projectCount,
  };
}
