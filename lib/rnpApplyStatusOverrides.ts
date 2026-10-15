import type { RNPDataset, RNPProject } from "@/types/rnp";

/**
 * Накладывает ручные статусы из Neon на dataset из Sheets.
 * Ключ: project.id или groupId (для группы — на всех участников).
 */
export function applyStatusOverrides(
  dataset: RNPDataset,
  overrides: Record<string, string>,
): RNPDataset {
  const keys = Object.keys(overrides);
  if (keys.length === 0) return dataset;

  const projectsByMonth: RNPDataset["projectsByMonth"] = {};

  for (const [monthKey, projects] of Object.entries(dataset.projectsByMonth)) {
    projectsByMonth[monthKey] = projects.map((project) =>
      applyProjectStatus(project, overrides),
    );
  }

  return {
    ...dataset,
    projectsByMonth,
  };
}

function applyProjectStatus(
  project: RNPProject,
  overrides: Record<string, string>,
): RNPProject {
  const byId = overrides[project.id];
  if (byId) return { ...project, status: byId };

  if (project.groupId) {
    const byGroup = overrides[project.groupId];
    if (byGroup) return { ...project, status: byGroup };
  }

  return project;
}

/** Локальный optimistic update без перезагрузки снимка. */
export function patchDatasetProjectStatus(
  dataset: RNPDataset,
  projectKey: string,
  status: string,
): RNPDataset {
  return applyStatusOverrides(dataset, { [projectKey]: status });
}
