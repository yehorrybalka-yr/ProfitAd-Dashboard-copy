"use client";

import { useMemo, useState, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { MonthYearPicker } from "@/components/rnp/MonthYearPicker";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { RNPProjectsTable } from "@/components/rnp/RNPProjectsTable";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageStack, PageToolbar } from "@/components/layout/PageToolbar";
import { useRNP } from "@/components/rnp/RNPProvider";
import { buildRNPSummaryKpis } from "@/lib/rnpKpi";
import { buildProjectFilterOptions } from "@/lib/rnpGroups";

export function DashboardOverview() {
  const { projects, selectedMonth, dataset, selectedMonthKey } = useRNP();
  const [selectedProjectId, setSelectedProjectId] = useState<string | "all">("all");

  useEffect(() => {
    setSelectedProjectId("all");
  }, [selectedMonthKey]);

  useEffect(() => {
    if (selectedProjectId === "all") return;
    const exists = projects.some(
      (p) => p.id === selectedProjectId || p.groupId === selectedProjectId,
    );
    if (!exists) setSelectedProjectId("all");
  }, [projects, selectedProjectId]);

  const filtered = useMemo(() => {
    if (selectedProjectId === "all") return projects;
    return projects.filter(
      (p) => p.id === selectedProjectId || p.groupId === selectedProjectId,
    );
  }, [projects, selectedProjectId]);

  const kpiCards = useMemo(
    () =>
      buildRNPSummaryKpis(
        filtered,
        selectedMonth?.label ?? "",
        selectedMonth?.year ?? new Date().getFullYear(),
        selectedMonth?.month ?? new Date().getMonth(),
      ),
    [filtered, selectedMonth],
  );

  const projectOptions = [
    { value: "all", label: "Все проекты" },
    ...buildProjectFilterOptions(projects),
  ];

  return (
    <PageStack>
      <PageToolbar>
        <div className="flex items-center gap-1.5 text-ink-soft">
          <SlidersHorizontal size={14} />
          <span className="text-xs font-medium">Фильтры</span>
        </div>
        <MonthYearPicker className="sm:mr-auto" />
        <Select
          className="w-full sm:w-64"
          options={projectOptions}
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        />
      </PageToolbar>

      {dataset.months.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-muted">
          Не удалось загрузить данные из таблицы РНП. Проверьте доступность Google Sheets.
        </Card>
      ) : (
        <>
          <KpiGrid items={kpiCards} />

          <Card>
            <CardHeader
              title="Проекты РНП"
              subtitle={
                selectedMonth
                  ? `PLAN / FACT — ${selectedMonth.label}`
                  : "Данные из Google Sheets"
              }
            />
            <CardBody className="pt-0">
              <RNPProjectsTable projects={filtered} />
            </CardBody>
          </Card>
        </>
      )}
    </PageStack>
  );
}
