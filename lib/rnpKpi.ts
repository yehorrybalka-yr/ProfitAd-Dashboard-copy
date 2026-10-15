import type { KpiCardData } from "@/components/dashboard/KpiCard";
import type { RNPProject } from "@/types/rnp";
import { getExpectedPacePercent, getPaceStatus } from "@/lib/rnpPace";

/** Для сводки берём один проект на группу (держатель главной цели) */
function getSummaryProjects(projects: RNPProject[]): RNPProject[] {
  const seenGroups = new Set<string>();
  const result: RNPProject[] = [];

  for (const project of projects) {
    if (project.groupId) {
      if (seenGroups.has(project.groupId)) continue;
      seenGroups.add(project.groupId);
      const holder =
        projects.find(
          (p) => p.groupId === project.groupId && p.isPrimaryGoalHolder,
        ) ?? project;
      result.push(holder);
      continue;
    }
    result.push(project);
  }

  return result;
}

function avgProgress(projects: RNPProject[]): number | null {
  const values = projects
    .map((p) => p.metrics.progressPercentage)
    .filter((v) => v > 0);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function paceStatusToKpi(status: ReturnType<typeof getPaceStatus>): KpiCardData["status"] {
  if (status === "good") return "good";
  if (status === "warning") return "warning";
  return "critical";
}

export function buildRNPSummaryKpis(
  projects: RNPProject[],
  monthLabel: string,
  year: number,
  month: number,
): KpiCardData[] {
  const summaryProjects = getSummaryProjects(projects);

  const onTrack = summaryProjects.filter((p) =>
    p.status.toLowerCase().includes("on track"),
  ).length;
  const needsSupport = summaryProjects.filter((p) =>
    p.status.toLowerCase().includes("support"),
  ).length;
  const offTrack = summaryProjects.filter((p) =>
    p.status.toLowerCase().includes("off track"),
  ).length;
  const progress = avgProgress(summaryProjects);
  const expectedPace = getExpectedPacePercent(year, month);
  const paceStatus = progress !== null ? getPaceStatus(progress, expectedPace) : null;

  return [
    {
      key: "projects",
      label: `Проектов · ${monthLabel}`,
      value: String(summaryProjects.length),
    },
    {
      key: "on-track",
      label: "On Track",
      value: String(onTrack),
      status: onTrack > 0 ? "good" : undefined,
    },
    {
      key: "support",
      label: "Requires Support",
      value: String(needsSupport),
      status: needsSupport > 0 ? "warning" : undefined,
    },
    {
      key: "off-track",
      label: "Off Track",
      value: String(offTrack),
      status: offTrack > 0 ? "critical" : undefined,
    },
    {
      key: "progress",
      label: "Средний % плана",
      value: progress !== null ? `${progress.toFixed(1)}%` : "—",
      targetLabel: `темп ${expectedPace}%`,
      status: paceStatus ? paceStatusToKpi(paceStatus) : undefined,
    },
    {
      key: "pace",
      label: "% темпа (сегодня)",
      value: `${expectedPace}%`,
    },
  ];
}

export function buildProjectKpis(
  project: RNPProject,
  year: number,
  month: number,
  prevProject?: RNPProject,
): KpiCardData[] {
  const progress = project.metrics.progressPercentage;
  const expectedPace = getExpectedPacePercent(year, month);
  const paceStatus = getPaceStatus(progress, expectedPace);

  const prevProgress = prevProject?.metrics.progressPercentage ?? null;
  const delta =
    prevProgress !== null && prevProgress > 0
      ? ((progress - prevProgress) / prevProgress) * 100
      : null;

  const activeGoal = project.metrics.goals.find((g) => g.isActive);
  const otherOverview = project.metrics.overviewMetrics.filter(
    (m) => !m.isPrimaryGoal && !m.isKpi,
  );

  const cards: KpiCardData[] = [
    {
      key: "primary-goal",
      label: `${project.metrics.primaryGoalLabel} (Fact)`,
      value: project.metrics.primaryGoalFact,
      targetLabel: activeGoal ? `цель ${activeGoal.key}: ${activeGoal.plan}` : undefined,
    },
  ];

  for (const metric of otherOverview.slice(0, 3)) {
    cards.push({
      key: `overview-${metric.label}`,
      label: metric.label,
      value: metric.fact,
    });
  }

  cards.push(
    {
      key: "progress",
      label: `% плана (${project.metrics.activeGoal})`,
      value: progress > 0 ? `${progress}%` : "—",
      delta,
      targetLabel: `темп ${expectedPace}%`,
      status: paceStatusToKpi(paceStatus),
    },
    {
      key: "pace",
      label: "% темпа (сегодня)",
      value: `${expectedPace}%`,
    },
  );

  return cards;
}
