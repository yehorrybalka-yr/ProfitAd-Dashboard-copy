import { hashCsvContent } from "@/lib/rnpCsvCache";
import {
  resolveDefaultMonthKey,
  sortMonthsChronologically,
} from "@/lib/rnpMonths";
import type { RnpProjectSource } from "@/lib/rnpProjectSources";
import { toProjectId } from "@/lib/rnpGroups";
import type { RNPDataset, RNPMonthOption, RNPProject } from "@/types/rnp";

/**
 * Склеивает общую РНП и проектные таблицы.
 * Записи из общей таблицы, пересекающиеся с registered sources, заменяются.
 */
export function mergeRnpDatasets(
  base: RNPDataset,
  extras: RNPDataset[],
  sources: RnpProjectSource[] = [],
): RNPDataset {
  const monthMap = new Map<string, RNPMonthOption>();
  for (const month of base.months) monthMap.set(month.key, month);

  const projectsByMonth: Record<string, RNPProject[]> = {};
  for (const [key, projects] of Object.entries(base.projectsByMonth)) {
    projectsByMonth[key] = projects.filter(
      (project) => !isReplacedByProjectSheet(project, sources),
    );
  }

  const warnings = [...(base.health?.warnings ?? [])];
  let csvByteLength = base.csvByteLength;
  const hashParts = [base.contentHash];

  for (const extra of extras) {
    hashParts.push(extra.contentHash);
    csvByteLength += extra.csvByteLength;
    warnings.push(...(extra.health?.warnings ?? []));

    for (const month of extra.months) {
      if (!monthMap.has(month.key)) monthMap.set(month.key, month);
      if (!projectsByMonth[month.key]) projectsByMonth[month.key] = [];
    }

    for (const [key, projects] of Object.entries(extra.projectsByMonth)) {
      const bucket = projectsByMonth[key] ?? [];
      const existingIds = new Set(bucket.map((project) => project.id));
      for (const project of projects) {
        if (existingIds.has(project.id)) {
          const index = bucket.findIndex((item) => item.id === project.id);
          if (index >= 0) bucket[index] = project;
          continue;
        }
        bucket.push(project);
        existingIds.add(project.id);
      }
      projectsByMonth[key] = bucket;
    }
  }

  // Drop empty months that lost all projects after replacement and gained none
  for (const [key, projects] of Object.entries(projectsByMonth)) {
    if (projects.length === 0 && !extras.some((extra) => extra.projectsByMonth[key]?.length)) {
      delete projectsByMonth[key];
      monthMap.delete(key);
    }
  }

  const months = sortMonthsChronologically(
    [...monthMap.values()].filter((month) => (projectsByMonth[month.key] ?? []).length > 0),
  );

  return {
    months,
    defaultMonthKey: resolveDefaultMonthKey(months),
    projectsByMonth,
    contentHash: hashCsvContent(hashParts.join("|")),
    csvByteLength,
    fetchedAt: new Date().toISOString(),
    health: {
      source: base.health?.source ?? "live",
      warnings,
      qualityScore: (base.health?.qualityScore ?? 0) + extras.length,
      accepted: months.length > 0,
    },
  };
}

export function isReplacedByProjectSheet(
  project: RNPProject,
  sources: RnpProjectSource[],
): boolean {
  return sources.some((source) => {
    if (project.id === source.id || project.groupId === source.id) return true;
    if (project.groupName && toProjectId(project.groupName) === source.id) {
      return true;
    }
    if (toProjectId(project.name) === source.id) return true;
    const prefix = `${source.name} - `.toLowerCase();
    if (project.name.toLowerCase().startsWith(prefix)) return true;
    if (project.name.toLowerCase() === source.name.toLowerCase()) return true;
    return false;
  });
}
