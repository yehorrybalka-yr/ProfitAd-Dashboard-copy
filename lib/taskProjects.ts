import { buildProjectFilterOptions } from "@/lib/rnpGroups";
import type { RNPProject } from "@/types/rnp";

/** Категории задач вне РНП-проектов */
export const TASK_CATEGORY_PROJECTS = [
  { value: "leadgen", label: "LeadGen" },
  { value: "operational", label: "Operational" },
] as const;

export function buildTaskProjectOptions(
  projects: RNPProject[],
): { value: string; label: string }[] {
  return [...TASK_CATEGORY_PROJECTS, ...buildProjectFilterOptions(projects)];
}

export function resolveTaskProjectName(
  projectId: string,
  options: { value: string; label: string }[],
): string {
  return options.find((option) => option.value === projectId)?.label ?? projectId;
}
