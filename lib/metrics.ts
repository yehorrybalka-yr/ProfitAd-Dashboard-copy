import { AggregatedMetrics, CampaignSummary, DailyMetric, Platform, TrendPoint } from "@/types";
import { safeDiv } from "./utils";

/**
 * Aggregates a list of DailyMetric rows into summary KPIs.
 * All derived metrics (CTR, CPC, CPM, CPL, CPA, ROAS) are recomputed
 * from the aggregated totals, never averaged directly — this keeps
 * the math correct regardless of how many rows/days are combined.
 */
export function aggregateMetrics(rows: DailyMetric[]): AggregatedMetrics {
  const totals = rows.reduce(
    (acc, row) => {
      acc.spend += row.spend;
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.leads += row.leads;
      acc.sales += row.sales;
      acc.revenue += row.revenue;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, leads: 0, sales: 0, revenue: 0 }
  );

  return {
    ...totals,
    ctr: safeDiv(totals.clicks, totals.impressions) * 100,
    cpc: safeDiv(totals.spend, totals.clicks),
    cpm: safeDiv(totals.spend, totals.impressions) * 1000,
    cpl: safeDiv(totals.spend, totals.leads),
    cpa: safeDiv(totals.spend, totals.sales),
    roas: safeDiv(totals.revenue, totals.spend),
  };
}

/** Groups rows by campaign_name + platform and aggregates each group. */
export function summarizeByCampaign(rows: DailyMetric[]): CampaignSummary[] {
  const groups = new Map<string, DailyMetric[]>();

  for (const row of rows) {
    const key = `${row.campaign_name}__${row.platform}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  return Array.from(groups.entries())
    .map(([key, groupRows]) => {
      const [campaign_name, platform] = key.split("__");
      return {
        campaign_name,
        platform: platform as Platform,
        ...aggregateMetrics(groupRows),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

/** Groups rows by date, aggregates, and returns a chart-friendly series. */
export function buildTrend(rows: DailyMetric[]): TrendPoint[] {
  const groups = new Map<string, DailyMetric[]>();

  for (const row of rows) {
    if (!groups.has(row.date)) groups.set(row.date, []);
    groups.get(row.date)!.push(row);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, groupRows]) => {
      const agg = aggregateMetrics(groupRows);
      return {
        date,
        spend: Math.round(agg.spend),
        leads: agg.leads,
        cpl: Math.round(agg.cpl * 100) / 100,
        cpm: Math.round(agg.cpm * 100) / 100,
        ctr: Math.round(agg.ctr * 100) / 100,
      };
    });
}

/** Splits the currently selected date range in half to compare current vs previous period. */
export function splitForComparison(
  rows: DailyMetric[],
  from: string,
  to: string
): { current: DailyMetric[]; previous: DailyMetric[] } {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  const spanMs = toTime - fromTime;
  const prevTo = new Date(fromTime - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);

  const current = rows.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= fromTime && t <= toTime;
  });
  const previous = rows.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= prevFrom.getTime() && t <= prevTo.getTime();
  });

  return { current, previous };
}

/** Percentage delta between two values, used for KPI card trend badges. */
export function percentDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}
