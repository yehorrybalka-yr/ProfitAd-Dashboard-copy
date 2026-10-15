"use client";

import { useMemo } from "react";
import { Archive } from "lucide-react";
import { MonthYearPicker } from "@/components/rnp/MonthYearPicker";
import {
  MonthCompareToggle,
  useMonthCompare,
} from "@/components/rnp/MonthCompare";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageStack, PageToolbar } from "@/components/layout/PageToolbar";
import { useRNP } from "@/components/rnp/RNPProvider";
import { buildProjectCardItems } from "@/lib/rnpGroups";
import {
  buildCompareCardItems,
  getPrimaryGoalByMonths,
  resolvePrimaryGoalLabelAcrossMonths,
} from "@/lib/rnpMonthCompare";

export function ProjectsPicker() {
  const { projects, archivedProjects, selectedMonth, dataset } = useRNP();
  const compare = useMonthCompare();

  const compareActive = compare.enabled && compare.rangeMonths.length > 0;

  const cardItems = useMemo(
    () =>
      compareActive
        ? buildCompareCardItems(dataset, compare.rangeMonths, false)
        : buildProjectCardItems(projects),
    [compareActive, dataset, compare.rangeMonths, projects],
  );
  const archiveItems = useMemo(
    () =>
      compareActive
        ? buildCompareCardItems(dataset, compare.rangeMonths, true)
        : buildProjectCardItems(archivedProjects),
    [compareActive, dataset, compare.rangeMonths, archivedProjects],
  );

  const year = selectedMonth?.year ?? new Date().getFullYear();
  const month = selectedMonth?.month ?? new Date().getMonth();

  return (
    <PageStack>
      <PageToolbar>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {!compareActive && <MonthYearPicker />}
          <MonthCompareToggle
            enabled={compare.enabled}
            fromKey={compare.fromKey}
            toKey={compare.toKey}
            onEnabledChange={compare.setEnabled}
            onFromChange={compare.setFromKey}
            onToChange={compare.setToKey}
          />
        </div>
        <p className="shrink-0 text-xs text-ink-muted">
          {compareActive
            ? `Сравнение · ${compare.rangeMonths[0]?.label} — ${compare.rangeMonths[compare.rangeMonths.length - 1]?.label}`
            : selectedMonth
              ? `Выберите проект · ${selectedMonth.label}`
              : "Выберите проект"}
        </p>
      </PageToolbar>

      {dataset.months.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-muted">
          Нет данных из таблицы РНП
        </Card>
      ) : cardItems.length === 0 && !compareActive ? (
        <Card className="p-8 text-center text-sm text-ink-muted">
          Нет активных проектов за выбранный месяц
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
          {cardItems.map((item) => {
            const groupId =
              item.goalProject.groupId ??
              (item.memberCount > 1 ? item.id : null);
            const monthValues = compareActive
              ? getPrimaryGoalByMonths(
                  dataset,
                  compare.rangeMonths,
                  item.goalProject.id,
                  groupId,
                )
              : undefined;
            const primaryLabel = compareActive
              ? resolvePrimaryGoalLabelAcrossMonths(
                  dataset,
                  compare.rangeMonths,
                  item.goalProject.id,
                  groupId,
                  item.goalProject.metrics.primaryGoalLabel,
                )
              : undefined;

            return (
              <ProjectCard
                key={item.id}
                item={item}
                year={year}
                month={month}
                compareMode={compareActive}
                primaryLabel={primaryLabel}
                monthValues={monthValues}
              />
            );
          })}
        </div>
      )}

      {archiveItems.length > 0 && (
        <Card className="border-dashed opacity-90">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Archive size={16} className="text-ink-soft" />
                Архив проектов
              </span>
            }
            subtitle="Неактуальные проекты"
          />
          <CardBody className="pt-0">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
              {archiveItems.map((item) => {
                const groupId =
                  item.goalProject.groupId ??
                  (item.memberCount > 1 ? item.id : null);
                const monthValues = compareActive
                  ? getPrimaryGoalByMonths(
                      dataset,
                      compare.rangeMonths,
                      item.goalProject.id,
                      groupId,
                    )
                  : undefined;

                return (
                  <ProjectCard
                    key={item.id}
                    item={item}
                    year={year}
                    month={month}
                    compareMode={compareActive}
                    primaryLabel={
                      compareActive
                        ? resolvePrimaryGoalLabelAcrossMonths(
                            dataset,
                            compare.rangeMonths,
                            item.goalProject.id,
                            groupId,
                            item.goalProject.metrics.primaryGoalLabel,
                          )
                        : undefined
                    }
                    monthValues={monthValues}
                  />
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </PageStack>
  );
}
