import { DailyMetric, DateRange, PeriodPreset } from "@/types";
import { addDays, isoDate } from "./utils";

export function presetToRange(preset: PeriodPreset, latestDate: string): DateRange {
  if (preset === "all") {
    return { from: "1970-01-01", to: latestDate };
  }
  const days = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 }[preset];
  return { from: addDays(latestDate, -(days - 1)), to: latestDate };
}

export function filterByProject(rows: DailyMetric[], projectId: string | "all"): DailyMetric[] {
  if (projectId === "all") return rows;
  return rows.filter((r) => r.project_id === projectId);
}

export function filterByRange(rows: DailyMetric[], range: DateRange): DailyMetric[] {
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  return rows.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= from && t <= to;
  });
}

export function getLatestDate(rows: DailyMetric[]): string {
  return rows.reduce((latest, r) => (r.date > latest ? r.date : latest), "1970-01-01");
}

export function getEarliestDate(rows: DailyMetric[]): string {
  return rows.reduce((earliest, r) => (r.date < earliest ? r.date : earliest), isoDate(new Date()));
}
