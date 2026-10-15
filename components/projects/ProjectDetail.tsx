"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRNP } from "@/components/rnp/RNPProvider";
import { MonthYearPicker } from "@/components/rnp/MonthYearPicker";
import {
  MonthCompareToggle,
  useMonthCompare,
} from "@/components/rnp/MonthCompare";
import { RNPStatusSelect } from "@/components/rnp/RNPStatusSelect";
import { ProgressPaceCard } from "@/components/rnp/ProgressPaceDisplay";
import { GoalTiersDisplay } from "@/components/rnp/GoalTiersDisplay";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageStack, PageToolbar } from "@/components/layout/PageToolbar";
import {
  AdditionalMetricCard,
  PrimaryMetricCard,
} from "@/components/projects/ProjectMetricCards";
import { KpiMetricCard } from "@/components/projects/KpiMetricCard";
import { getAllProjectMetrics, findMetricByLabel } from "@/lib/rnpMetrics";
import { getMetricFactByMonths } from "@/lib/rnpMonthCompare";
import {
  ALL_BRANCH_ID,
  buildAllVirtualProject,
  getAllBranchMetricFactByMonths,
  isAllBranchId,
} from "@/lib/rnpAggregate";
import { getExpectedPacePercent, getPaceStatus, PACE_STATUS_CLASS } from "@/lib/rnpPace";
import {
  getPreferredDefaultMemberId,
  resolveProjectScope,
} from "@/lib/rnpGroups";
import { cn } from "@/lib/utils";
import type { RNPMetricRow } from "@/types/rnp";
import { RunningCampaignsPanel } from "@/components/campaigns/RunningCampaignsPanel";
import { TaskManagerPanel } from "@/components/tasks/TaskManagerPanel";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { dataset, projects, selectedMonth, getPreviousMonthKey, updateProjectStatus } = useRNP();
  const compare = useMonthCompare();
  const compareActive = compare.enabled && compare.rangeMonths.length > 0;

  const scopeSource = useMemo(() => {
    if (!compareActive) return projects;

    const byId = new Map<string, (typeof projects)[number]>();
    for (const month of [...compare.rangeMonths].reverse()) {
      for (const project of dataset.projectsByMonth[month.key] ?? []) {
        if (!byId.has(project.id)) byId.set(project.id, project);
      }
    }
    return Array.from(byId.values());
  }, [compareActive, compare.rangeMonths, dataset.projectsByMonth, projects]);

  const scope = useMemo(
    () => resolveProjectScope(scopeSource, projectId),
    [scopeSource, projectId],
  );

  const initialTab = useMemo(() => {
    if (scope.isGroup && scope.members.length > 1) {
      const preferredMemberId = getPreferredDefaultMemberId(
        scope.members,
        scope.goalProject,
      );
      if (preferredMemberId) return preferredMemberId;
      return ALL_BRANCH_ID;
    }
    if (scope.members.some((m) => m.id === projectId)) return projectId;
    return scope.members[0]?.id ?? projectId;
  }, [scope, projectId]);

  const [activeSubId, setActiveSubId] = useState(initialTab);
  const lastProjectIdRef = useRef(projectId);

  useEffect(() => {
    if (lastProjectIdRef.current === projectId) return;
    lastProjectIdRef.current = projectId;
    setActiveSubId(initialTab);
  }, [projectId, initialTab]);

  const isAllBranch = scope.isGroup && isAllBranchId(activeSubId);

  const activeProject = useMemo(() => {
    if (scope.members.length === 0) return null;
    if (scope.isGroup && isAllBranchId(activeSubId) && scope.goalProject) {
      return buildAllVirtualProject(scope.members, scope.goalProject);
    }
    if (scope.isGroup) {
      return scope.members.find((m) => m.id === activeSubId) ?? scope.members[0];
    }
    return scope.members[0];
  }, [scope, activeSubId]);

  const goalProject = useMemo(() => {
    if (!scope.goalProject) return null;
    if (scope.isGroup && isAllBranchId(activeSubId)) {
      return buildAllVirtualProject(scope.members, scope.goalProject);
    }
    return scope.goalProject;
  }, [scope, activeSubId]);

  const prevMonthKey = getPreviousMonthKey();
  const prevProject = useMemo(() => {
    if (!prevMonthKey || !activeProject) return undefined;
    if (isAllBranch && scope.isGroup && scope.goalProject) {
      const prevMembers = (dataset.projectsByMonth[prevMonthKey] ?? []).filter(
        (p) => p.groupId === scope.goalProject!.groupId,
      );
      if (prevMembers.length === 0) return undefined;
      return buildAllVirtualProject(prevMembers, scope.goalProject);
    }
    return dataset.projectsByMonth[prevMonthKey]?.find(
      (p) => p.id === activeProject.id,
    );
  }, [
    prevMonthKey,
    activeProject,
    isAllBranch,
    scope.isGroup,
    scope.goalProject,
    dataset.projectsByMonth,
  ]);

  const year = selectedMonth?.year ?? new Date().getFullYear();
  const month = selectedMonth?.month ?? new Date().getMonth();

  const allMetrics = useMemo(
    () => (activeProject ? getAllProjectMetrics(activeProject) : []),
    [activeProject],
  );

  const displayMetrics = useMemo((): {
    overview: RNPMetricRow[];
    additional: RNPMetricRow[];
  } => {
    if (!activeProject) {
      return { overview: [], additional: [] };
    }
    if (!compareActive) {
      return {
        overview: activeProject.metrics.overviewMetrics,
        additional: activeProject.metrics.additionalMetrics,
      };
    }

    if (isAllBranch && scope.isGroup && scope.goalProject) {
      for (const monthOpt of [...compare.rangeMonths].reverse()) {
        const members = (dataset.projectsByMonth[monthOpt.key] ?? []).filter(
          (p) => p.groupId === scope.goalProject!.groupId,
        );
        if (members.length === 0) continue;
        const aggregated = buildAllVirtualProject(members, scope.goalProject);
        return {
          overview: aggregated.metrics.overviewMetrics,
          additional: aggregated.metrics.additionalMetrics,
        };
      }
    }

    // Берём структуру метрик из самого нового месяца диапазона, где есть проект
    for (const monthOpt of [...compare.rangeMonths].reverse()) {
      const found = dataset.projectsByMonth[monthOpt.key]?.find(
        (p) => p.id === activeProject.id,
      );
      if (found) {
        return {
          overview: found.metrics.overviewMetrics,
          additional: found.metrics.additionalMetrics,
        };
      }
    }

    return {
      overview: activeProject.metrics.overviewMetrics,
      additional: activeProject.metrics.additionalMetrics,
    };
  }, [
    activeProject,
    compareActive,
    compare.rangeMonths,
    dataset.projectsByMonth,
    isAllBranch,
    scope.isGroup,
    scope.goalProject,
  ]);

  const taskScope = useMemo(() => {
    if (!activeProject || !scope.goalProject) {
      return {
        projectId: projectId,
        projectName: projectId,
      };
    }

    const cardProjectId = scope.isGroup
      ? scope.goalProject.groupId!
      : activeProject.id;
    const cardProjectName = scope.isGroup
      ? scope.goalProject.groupName!
      : activeProject.name;

    return {
      projectId: cardProjectId,
      projectName: cardProjectName,
    };
  }, [activeProject, projectId, scope.goalProject, scope.isGroup]);

  const taskProjectOptions = useMemo(
    () => [{ value: taskScope.projectId, label: taskScope.projectName }],
    [taskScope.projectId, taskScope.projectName],
  );

  if (!activeProject || !goalProject) {
    const existsInOtherMonth = Object.values(dataset.projectsByMonth).some((list) =>
      list.some((p) => p.id === projectId || p.groupId === projectId),
    );

    return (
      <Card className="p-8 text-center text-sm text-ink-muted">
        {existsInOtherMonth
          ? "Проект не найден за выбранный месяц. Переключите период в фильтре выше."
          : "Проект не найден в таблице РНП."}
      </Card>
    );
  }

  const expectedPace = getExpectedPacePercent(year, month);
  const paceStatus = getPaceStatus(goalProject.metrics.progressPercentage, expectedPace);
  const displayTitle = scope.isGroup
    ? goalProject.groupName!
    : activeProject.name;

  const progressValue = activeProject.metrics.progressPercentage;

  const resolveMonthValues = (metric: RNPMetricRow) => {
    if (!compareActive) return undefined;
    if (isAllBranch && scope.goalProject?.groupId) {
      return getAllBranchMetricFactByMonths(
        dataset,
        compare.rangeMonths,
        scope.goalProject.groupId,
        metric.label,
      );
    }
    return getMetricFactByMonths(
      dataset,
      compare.rangeMonths,
      activeProject.id,
      metric.templateLabel,
      activeProject.groupId,
    );
  };

  return (
    <PageStack>
      <PageToolbar>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <RNPStatusSelect
              value={activeProject.status}
              onChange={(next) => {
                const key =
                  scope.isGroup && isAllBranch && scope.goalProject?.groupId
                    ? scope.goalProject.groupId
                    : activeProject.id;
                void updateProjectStatus(key, next);
              }}
              aria-label={`Статус ${displayTitle}`}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{displayTitle}</p>
              {scope.isGroup && (
                <p className="text-xs text-ink-muted">
                  {isAllBranch
                    ? "Ветка: Main · объединённые показатели"
                    : `Подпроект: ${activeProject.variant ?? activeProject.name}`}
                </p>
              )}
            </div>
          </div>
          <MonthCompareToggle
            enabled={compare.enabled}
            fromKey={compare.fromKey}
            toKey={compare.toKey}
            onEnabledChange={compare.setEnabled}
            onFromChange={compare.setFromKey}
            onToChange={compare.setToKey}
          />
        </div>
        {!compareActive && <MonthYearPicker />}
        {compareActive && (
          <p className="shrink-0 text-xs text-ink-muted">
            {compare.rangeMonths[0]?.label} —{" "}
            {compare.rangeMonths[compare.rangeMonths.length - 1]?.label}
          </p>
        )}
      </PageToolbar>

      {scope.isGroup && scope.members.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSubId(ALL_BRANCH_ID)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              isAllBranch
                ? "border-brand bg-brand-soft font-medium text-brand"
                : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
            )}
          >
            Main
          </button>
          {scope.members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setActiveSubId(member.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                activeSubId === member.id
                  ? "border-brand bg-brand-soft font-medium text-brand"
                  : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
              )}
            >
              {member.variant ?? member.name}
              {member.isPrimaryGoalHolder && (
                <span className="ml-1.5 text-xs text-brand">· цель</span>
              )}
            </button>
          ))}
        </div>
      )}

      {!compareActive && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          {scope.isGroup ? (
            <Card className="lg:col-span-2">
              <CardHeader
                title="Главная цель проекта"
                subtitle={
                  isAllBranch
                    ? `${goalProject.metrics.primaryGoalLabel} · Main`
                    : `${goalProject.metrics.primaryGoalLabel} · ${scope.goalProject?.variant ?? ""}`
                }
              />
              <CardBody className="pt-0">
                <div className="grid gap-6 md:grid-cols-2 md:items-start">
                  <dl className="space-y-3 text-sm">
                    <DetailRow
                      label={`${goalProject.metrics.primaryGoalLabel} (Fact)`}
                      value={goalProject.metrics.primaryGoalFact}
                    />
                    <DetailRow
                      label={`План (цель ${goalProject.metrics.activeGoal})`}
                      value={goalProject.metrics.primaryGoalPlan}
                      highlight
                    />
                    <DetailRow
                      label="% плана"
                      value={goalProject.metrics.progressPercentageDisplay}
                      valueClassName={PACE_STATUS_CLASS[paceStatus]}
                    />
                  </dl>
                  <div className="flex justify-end">
                    <GoalTiersDisplay goals={goalProject.metrics.goals} />
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card className="lg:col-span-2">
              <CardHeader title="Цели B → B+ → C" subtitle="Главная метрика проекта" />
              <CardBody className="pt-0">
                <div className="flex justify-end">
                  <GoalTiersDisplay goals={activeProject.metrics.goals} />
                </div>
              </CardBody>
            </Card>
          )}

          <ProgressPaceCard
            progress={progressValue}
            year={year}
            month={month}
            className="h-full"
          />
        </div>
      )}

      {displayMetrics.overview.length > 0 && (
        <section>
          <SectionHeading
            title="Основные метрики"
            subtitle={
              compareActive
                ? "Значения по выбранным месяцам"
                : "Первые 5 показателей из таблицы РНП"
            }
          />
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {displayMetrics.overview.map((metric) => {
              const monthValues = resolveMonthValues(metric);

              if (metric.isKpi) {
                return (
                  <KpiMetricCard
                    key={`${metric.templateLabel}::${metric.label}`}
                    metric={metric}
                    compareMode={compareActive}
                    monthValues={monthValues}
                  />
                );
              }

              return (
                <PrimaryMetricCard
                  key={`${metric.templateLabel}::${metric.label}`}
                  metric={metric}
                  compareMode={compareActive}
                  monthValues={monthValues}
                />
              );
            })}
          </div>
        </section>
      )}

      {displayMetrics.additional.length > 0 && (
        <section>
          <SectionHeading
            title="Дополнительные метрики"
            subtitle={
              compareActive
                ? "Значения по выбранным месяцам"
                : "Расширенные показатели проекта"
            }
          />
          <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {displayMetrics.additional.map((metric) => {
              const monthValues = resolveMonthValues(metric);

              if (metric.isKpi) {
                return (
                  <KpiMetricCard
                    key={`${metric.templateLabel}::${metric.label}`}
                    metric={metric}
                    variant="additional"
                    compareMode={compareActive}
                    monthValues={monthValues}
                  />
                );
              }

              return (
                <AdditionalMetricCard
                  key={`${metric.templateLabel}::${metric.label}`}
                  metric={metric}
                  compareMode={compareActive}
                  monthValues={monthValues}
                />
              );
            })}
          </div>
        </section>
      )}

      {prevProject && allMetrics.length > 0 && (
        <Card>
          <CardHeader
            title="Сравнение с прошлым месяцем"
            subtitle={
              scope.isGroup
                ? isAllBranch
                  ? "Ветка: Main"
                  : `Подпроект: ${activeProject.variant ?? activeProject.name}`
                : undefined
            }
          />
          <CardBody className="overflow-x-auto pt-0">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-3 pr-4 font-medium">Метрика</th>
                  <th className="px-4 py-3 text-right font-medium">Прошлый месяц</th>
                  <th className="py-3 pl-4 text-right font-medium">Текущий</th>
                </tr>
              </thead>
              <tbody>
                {allMetrics.map((metric) => {
                  const prevMetrics = getAllProjectMetrics(prevProject);
                  const prevMetric = findMetricByLabel(
                    prevMetrics,
                    metric.templateLabel,
                  );
                  return (
                    <CompareRow
                      key={`${metric.templateLabel}::${metric.label}`}
                      label={metric.label}
                      prev={prevMetric?.fact ?? "—"}
                      curr={metric.fact}
                    />
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Task Manager"
          subtitle="Задачи проекта в целом"
        />
        <CardBody className="pt-0">
          <TaskManagerPanel
            embedded
            scope={taskScope}
            projectOptions={taskProjectOptions}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Запущенные кампании"
          subtitle="Google Ads и Meta Ads — заполняется вручную"
        />
        <CardBody className="pt-0">
          <RunningCampaignsPanel embedded projectId={taskScope.projectId} />
        </CardBody>
      </Card>
    </PageStack>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  valueClassName,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "font-mono tabular-nums",
          valueClassName,
          highlight ? "font-semibold text-brand" : "font-medium text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CompareRow({
  label,
  prev,
  curr,
}: {
  label: string;
  prev: string;
  curr: string;
}) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="py-3 pr-4 text-ink-muted">{label}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-soft">{prev}</td>
      <td className="py-3 pl-4 text-right font-mono tabular-nums font-medium text-ink">{curr}</td>
    </tr>
  );
}
