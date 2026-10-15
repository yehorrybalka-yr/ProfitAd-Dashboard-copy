import { AggregatedMetrics, Project } from "@/types";
import { KpiCardData } from "@/components/dashboard/KpiCard";
import { percentDelta } from "./metrics";
import { formatCurrency, formatNumber, formatPercent, formatRatioAsPercent } from "./format";

function statusVsTarget(value: number, target: number, higherIsBetter: boolean): KpiCardData["status"] {
  if (!target) return undefined;
  const ratio = higherIsBetter ? value / target : target / value;
  if (ratio >= 1) return "good";
  if (ratio >= 0.8) return "warning";
  return "critical";
}

export function buildKpiCards(
  current: AggregatedMetrics,
  previous: AggregatedMetrics | null,
  currency: string,
  project?: Project | null
): KpiCardData[] {
  const delta = (curr: number, prev: number | undefined) =>
    previous && prev !== undefined ? percentDelta(curr, prev) : null;

  return [
    {
      key: "spend",
      label: "Расход",
      value: formatCurrency(current.spend, currency),
      delta: delta(current.spend, previous?.spend),
      deltaInverse: false,
    },
    {
      key: "leads",
      label: "Лиды",
      value: formatNumber(current.leads),
      delta: delta(current.leads, previous?.leads),
      deltaInverse: false,
    },
    {
      key: "cpl",
      label: "CPL",
      value: formatCurrency(current.cpl, currency),
      delta: delta(current.cpl, previous?.cpl),
      deltaInverse: true,
      targetLabel: project ? `цель ${formatCurrency(project.target_cpl, currency)}` : undefined,
      status: project ? statusVsTarget(current.cpl, project.target_cpl, false) : undefined,
    },
    {
      key: "sales",
      label: "Продажи",
      value: formatNumber(current.sales),
      delta: delta(current.sales, previous?.sales),
      deltaInverse: false,
    },
    {
      key: "cpa",
      label: "CPA",
      value: formatCurrency(current.cpa, currency),
      delta: delta(current.cpa, previous?.cpa),
      deltaInverse: true,
      targetLabel: project ? `цель ${formatCurrency(project.target_cpa, currency)}` : undefined,
      status: project ? statusVsTarget(current.cpa, project.target_cpa, false) : undefined,
    },
    {
      key: "revenue",
      label: "Выручка",
      value: formatCurrency(current.revenue, currency),
      delta: delta(current.revenue, previous?.revenue),
      deltaInverse: false,
    },
    {
      key: "roas",
      label: "ROAS",
      value: formatRatioAsPercent(current.roas),
      delta: delta(current.roas, previous?.roas),
      deltaInverse: false,
      targetLabel: project ? `цель ${formatRatioAsPercent(project.target_roas)}` : undefined,
      status: project ? statusVsTarget(current.roas, project.target_roas, true) : undefined,
    },
    {
      key: "ctr",
      label: "CTR",
      value: formatPercent(current.ctr),
      delta: delta(current.ctr, previous?.ctr),
      deltaInverse: false,
    },
    {
      key: "cpm",
      label: "CPM",
      value: formatCurrency(current.cpm, currency),
      delta: delta(current.cpm, previous?.cpm),
      deltaInverse: true,
    },
  ];
}
