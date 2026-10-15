import type {
  RNPMetricRow,
  RNPProject,
  RNPProjectMetrics,
} from "@/types/rnp";
import { parseMetricNumber, resolveGoalTiers } from "@/lib/rnpGoals";
import {
  CANONICAL_METRIC_LABELS,
  canonicalMetricKey,
  normalizeMetricKey,
} from "@/lib/rnpMetrics";
import type { MonthMetricValue } from "@/lib/rnpMonthCompare";
import { resolveGroupDisplayStatus } from "@/lib/rnpStatus";
import type { RNPDataset, RNPMonthOption } from "@/types/rnp";

/** ID виртуальной вкладки «Main» для групповых проектов */
export const ALL_BRANCH_ID = "__all__";
export const MAIN_BRANCH_LABEL = "Main";

const OVERVIEW_ROW_COUNT = 5;

/** Метрики, которые суммируются между ветками */
const SUMMABLE_KEYS = new Set([
  "BUDGET",
  "CLICKS",
  "SUBS",
  "VISITORS",
  "PURCHASES",
  "REVENUE",
  "LEADS + CONTACTS",
  "IMPRESSIONS",
]);

/** Не включаем в All — недостаточно данных или по ТЗ */
const SKIP_KEYS = new Set(["CTR", "CR"]);

/** Не суммируем — пересчитываем из общих итогов */
const DERIVED_KEYS = new Set([
  "CPF",
  "CPL",
  "CPC",
  "CPM",
  "ROAS",
  "AVG.BILL",
  "CAC",
]);

/** Порядок строк как в таблице РНП (колонка A) */
const TEMPLATE_ORDER = [
  "Budget",
  "Subs",
  "Leads + Contacts",
  "Visitors",
  "Revenue",
  "Purchases",
  "CAC",
  "ROAS",
  "Avg.Bill",
  "Clicks",
  "CPC",
  "C2P",
  "CPA (add to cart)",
  "CPL",
  "CTR",
];

type ValueKind = "currency" | "percent" | "count" | "plain";

interface MetricBucket {
  key: string;
  label: string;
  templateLabel: string;
  fact: number;
  planB: number;
  planBPlus: number;
  planC: number;
  hasFact: boolean;
  hasPlanB: boolean;
  hasPlanBPlus: boolean;
  hasPlanC: boolean;
  kind: ValueKind;
  currency: string;
  sampleFact: string;
  isPrimaryGoal: boolean;
  fromDerived: boolean;
}

interface GroupTotals {
  budget: number;
  revenue: number;
  subs: number;
  visitors: number;
  purchases: number;
  clicks: number;
  leadsContacts: number;
  impressions: number;
}

function isEmptyCell(raw: string | undefined): boolean {
  const t = (raw ?? "").trim();
  return !t || t === "—" || t === "-" || t.startsWith("#");
}

function detectKind(sample: string): { kind: ValueKind; currency: string } {
  if (/%/.test(sample)) return { kind: "percent", currency: "" };
  const cur = sample.match(/[€$]|zł/i)?.[0] ?? "";
  if (cur) return { kind: "currency", currency: cur === "zł" || cur === "Z" ? "zł" : cur };
  return { kind: "count", currency: "" };
}

function mergeKind(a: ValueKind, b: ValueKind): ValueKind {
  if (a === "currency" || b === "currency") return "currency";
  if (a === "percent" || b === "percent") return "percent";
  return "count";
}

function formatNumber(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const [intPart, fracPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return fracPart ? `${grouped},${fracPart.replace(/0+$/, "") || "0"}` : grouped;
}

function formatAggregatedValue(
  value: number,
  kind: ValueKind,
  currency: string,
): string {
  if (!Number.isFinite(value)) return "—";

  if (kind === "percent") {
    return `${formatNumber(value, 2)}%`;
  }

  if (kind === "currency") {
    const formatted = formatNumber(value, 2);
    if (currency === "zł") return `${formatted} zł`;
    if (currency === "€") return `€${formatted}`;
    if (currency === "$") return `$${formatted}`;
    return `${formatted} ${currency}`.trim();
  }

  if (Number.isInteger(value)) return String(value);
  return formatNumber(value, 2);
}

function collectBuckets(
  members: RNPProject[],
  primaryGoalLabel: string,
): Map<string, MetricBucket> {
  const buckets = new Map<string, MetricBucket>();
  const primaryKey = canonicalMetricKey(primaryGoalLabel);

  for (const member of members) {
    const rows = [
      ...member.metrics.overviewMetrics,
      ...member.metrics.additionalMetrics,
    ];

    for (const row of rows) {
      const key =
        canonicalMetricKey(row.label) ||
        canonicalMetricKey(row.templateLabel);
      if (!key) continue;
      if (SKIP_KEYS.has(key) || DERIVED_KEYS.has(key)) continue;
      if (!SUMMABLE_KEYS.has(key)) continue;

      const factNum = isEmptyCell(row.fact) ? 0 : parseMetricNumber(row.fact);
      const planBNum = isEmptyCell(row.planB) ? 0 : parseMetricNumber(row.planB);
      const planBPlusNum = isEmptyCell(row.planBPlus)
        ? 0
        : parseMetricNumber(row.planBPlus);
      const planCNum = isEmptyCell(row.planC) ? 0 : parseMetricNumber(row.planC);

      const hasFact = !isEmptyCell(row.fact);
      const hasPlanB = !isEmptyCell(row.planB);
      const hasPlanBPlus = !isEmptyCell(row.planBPlus);
      const hasPlanC = !isEmptyCell(row.planC);

      if (!hasFact && !hasPlanB && !hasPlanBPlus && !hasPlanC) continue;

      const sample = row.fact !== "—" ? row.fact : row.planB;
      const { kind, currency } = detectKind(sample);
      const label = CANONICAL_METRIC_LABELS[key] ?? row.templateLabel ?? row.label;

      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, {
          key,
          label,
          templateLabel: CANONICAL_METRIC_LABELS[key] ?? row.templateLabel,
          fact: hasFact ? factNum : 0,
          planB: hasPlanB ? planBNum : 0,
          planBPlus: hasPlanBPlus ? planBPlusNum : 0,
          planC: hasPlanC ? planCNum : 0,
          hasFact,
          hasPlanB,
          hasPlanBPlus,
          hasPlanC,
          kind,
          currency,
          sampleFact: row.fact,
          isPrimaryGoal: key === primaryKey || canonicalMetricKey(primaryGoalLabel) === key,
          fromDerived: false,
        });
        continue;
      }

      if (hasFact) {
        existing.fact += factNum;
        existing.hasFact = true;
      }
      if (hasPlanB) {
        existing.planB += planBNum;
        existing.hasPlanB = true;
      }
      if (hasPlanBPlus) {
        existing.planBPlus += planBPlusNum;
        existing.hasPlanBPlus = true;
      }
      if (hasPlanC) {
        existing.planC += planCNum;
        existing.hasPlanC = true;
      }
      existing.kind = mergeKind(existing.kind, kind);
      if (!existing.currency && currency) existing.currency = currency;
    }
  }

  return buckets;
}

function readTotals(buckets: Map<string, MetricBucket>): GroupTotals {
  const get = (k: string) => buckets.get(k);
  return {
    budget: get("BUDGET")?.fact ?? 0,
    revenue: get("REVENUE")?.fact ?? 0,
    subs: get("SUBS")?.fact ?? 0,
    visitors: get("VISITORS")?.fact ?? 0,
    purchases: get("PURCHASES")?.fact ?? 0,
    clicks: get("CLICKS")?.fact ?? 0,
    leadsContacts: get("LEADS + CONTACTS")?.fact ?? 0,
    impressions: get("IMPRESSIONS")?.fact ?? 0,
  };
}

/** Пересчитываем производные метрики из суммарных базовых показателей */
function applyDerivedMetrics(
  buckets: Map<string, MetricBucket>,
  totals: GroupTotals,
  budgetBucket: MetricBucket | undefined,
): void {
  const budgetKind = budgetBucket?.kind ?? "currency";
  const budgetCurrency = budgetBucket?.currency ?? "zł";

  const setDerived = (
    key: string,
    label: string,
    templateLabel: string,
    value: number | null,
    kind: ValueKind,
    currency = budgetCurrency,
  ) => {
    if (value === null || !Number.isFinite(value) || value <= 0) {
      buckets.delete(key);
      return;
    }
    buckets.set(key, {
      key,
      label,
      templateLabel,
      fact: value,
      planB: 0,
      planBPlus: 0,
      planC: 0,
      hasFact: true,
      hasPlanB: false,
      hasPlanBPlus: false,
      hasPlanC: false,
      kind,
      currency,
      sampleFact: "",
      isPrimaryGoal: false,
      fromDerived: true,
    });
  };

  if (totals.subs > 0 && totals.budget > 0) {
    setDerived("CPF", "CPF", "CAC", totals.budget / totals.subs, budgetKind);
  } else {
    buckets.delete("CPF");
  }

  if (totals.leadsContacts > 0 && totals.budget > 0) {
    setDerived(
      "CPL",
      "CPL",
      "CPA (add to cart)",
      totals.budget / totals.leadsContacts,
      budgetKind,
    );
  }

  if (totals.budget > 0 && totals.revenue > 0) {
    setDerived(
      "ROAS",
      "ROAS",
      "ROAS",
      (totals.revenue / totals.budget) * 100,
      "percent",
    );
  } else {
    buckets.delete("ROAS");
  }

  if (totals.purchases > 0 && totals.revenue > 0) {
    setDerived(
      "AVG.BILL",
      "Avg.Bill",
      "Avg.Bill",
      totals.revenue / totals.purchases,
      budgetKind,
    );
  } else {
    buckets.delete("AVG.BILL");
  }

  if (totals.clicks > 0 && totals.budget > 0) {
    setDerived("CPC", "CPC", "CPC", totals.budget / totals.clicks, budgetKind);
  } else {
    buckets.delete("CPC");
  }

  if (totals.impressions > 0 && totals.budget > 0) {
    setDerived(
      "CPM",
      "CPM",
      "CPA (add to cart)",
      (totals.budget / totals.impressions) * 1000,
      budgetKind,
    );
  } else {
    buckets.delete("CPM");
  }

  // CAC в All: если есть Purchases > 0 — budget/purchases, иначе не показываем сумму веток
  if (totals.purchases > 0 && totals.budget > 0 && !buckets.get("CPF")?.hasFact) {
    setDerived("CAC", "CAC", "CAC", totals.budget / totals.purchases, budgetKind);
  } else if (buckets.has("CAC") && !buckets.get("CAC")?.fromDerived) {
    buckets.delete("CAC");
  }
}

function bucketToRow(bucket: MetricBucket): RNPMetricRow {
  const format = (n: number, has: boolean) =>
    has ? formatAggregatedValue(n, bucket.kind, bucket.currency) : "—";

  const hasPlans =
    (bucket.hasPlanB && bucket.planB > 0) ||
    (bucket.hasPlanBPlus && bucket.planBPlus > 0) ||
    (bucket.hasPlanC && bucket.planC > 0);

  const goalState =
    bucket.isPrimaryGoal || hasPlans
      ? resolveGoalTiers({
          factRaw: format(bucket.fact, bucket.hasFact),
          planBRaw: format(bucket.planB, bucket.hasPlanB),
          planBPlusRaw: format(bucket.planBPlus, bucket.hasPlanBPlus),
          planCRaw: format(bucket.planC, bucket.hasPlanC),
          progressRaw: "",
        })
      : null;

  return {
    label: bucket.label,
    templateLabel: bucket.templateLabel,
    fact: format(bucket.fact, bucket.hasFact),
    planB: format(bucket.planB, bucket.hasPlanB),
    planBPlus: format(bucket.planBPlus, bucket.hasPlanBPlus),
    planC: format(bucket.planC, bucket.hasPlanC),
    isPrimaryGoal: bucket.isPrimaryGoal,
    isKpi: !bucket.isPrimaryGoal && hasPlans,
    goals: goalState?.goals ?? [],
    activeGoal: goalState?.activeGoal ?? "B",
    progressPercentage: goalState?.progressPercentage ?? 0,
  };
}

function sortBuckets(buckets: Map<string, MetricBucket>): MetricBucket[] {
  const orderIndex = (template: string) => {
    const idx = TEMPLATE_ORDER.findIndex(
      (t) => normalizeMetricKey(t) === normalizeMetricKey(template),
    );
    return idx === -1 ? 100 + template.charCodeAt(0) : idx;
  };

  return [...buckets.values()].sort((a, b) => {
    const oa = orderIndex(a.templateLabel);
    const ob = orderIndex(b.templateLabel);
    if (oa !== ob) return oa - ob;
    return a.label.localeCompare(b.label);
  });
}

/** Агрегирует метрики всех веток группы в единый набор All */
export function aggregateGroupMetrics(
  members: RNPProject[],
  goalProject: RNPProject,
): RNPProjectMetrics {
  if (members.length === 0) {
    return emptyMetrics();
  }

  const primaryGoalLabel = goalProject.metrics.primaryGoalLabel;
  const buckets = collectBuckets(members, primaryGoalLabel);

  const budgetBucket = buckets.get("BUDGET");
  const totals = readTotals(buckets);
  applyDerivedMetrics(buckets, totals, budgetBucket);

  const sorted = sortBuckets(buckets);
  const rows = sorted.map(bucketToRow);
  const overviewMetrics = rows.slice(0, OVERVIEW_ROW_COUNT);
  const additionalMetrics = rows.slice(OVERVIEW_ROW_COUNT);

  const primaryKey = canonicalMetricKey(primaryGoalLabel);
  const primaryGoal =
    rows.find((m) => m.isPrimaryGoal) ??
    rows.find((m) => canonicalMetricKey(m.label) === primaryKey) ??
    rows.find((m) => canonicalMetricKey(m.templateLabel) === primaryKey) ??
    null;

  const progressPercentage = primaryGoal?.progressPercentage ?? 0;

  return {
    primaryGoalLabel: primaryGoal?.label ?? primaryGoalLabel,
    primaryGoalFact: primaryGoal?.fact ?? "—",
    primaryGoalPlan: primaryGoal
      ? primaryGoal.goals.find((g) => g.isActive)?.plan ?? primaryGoal.planB
      : "—",
    activeGoal: primaryGoal?.activeGoal ?? "B",
    goals: primaryGoal?.goals ?? [],
    progressPercentage,
    progressPercentageDisplay:
      progressPercentage > 0
        ? `${progressPercentage.toFixed(2).replace(/\.?0+$/, "")}%`
        : "—",
    overviewMetrics,
    kpiMetrics: rows.filter((m) => m.isKpi),
    additionalMetrics,
  };
}

/** Виртуальный проект Main для отображения в UI */
export function buildAllVirtualProject(
  members: RNPProject[],
  goalProject: RNPProject,
): RNPProject {
  return {
    id: ALL_BRANCH_ID,
    name: `${goalProject.groupName ?? goalProject.name} · ${MAIN_BRANCH_LABEL}`,
    status: resolveGroupDisplayStatus(members, goalProject.status),
    metrics: aggregateGroupMetrics(members, goalProject),
    groupId: goalProject.groupId,
    groupName: goalProject.groupName,
    variant: MAIN_BRANCH_LABEL,
    isPrimaryGoalHolder: true,
  };
}

export function isAllBranchId(id: string): boolean {
  return id === ALL_BRANCH_ID;
}

/** Значения метрики All по месяцам (для сравнения) */
export function getAllBranchMetricFactByMonths(
  dataset: RNPDataset,
  rangeMonths: RNPMonthOption[],
  groupId: string,
  metricLabel: string,
): MonthMetricValue[] {
  return rangeMonths.map((month) => {
    const members = (dataset.projectsByMonth[month.key] ?? []).filter(
      (p) => p.groupId === groupId,
    );
    const goalProject =
      members.find((m) => m.isPrimaryGoalHolder) ?? members[0];

    if (!goalProject || members.length === 0) {
      return {
        monthKey: month.key,
        monthLabel: month.label,
        value: "—",
      };
    }

    const aggregated = aggregateGroupMetrics(members, goalProject);
    const allRows = [
      ...aggregated.overviewMetrics,
      ...aggregated.additionalMetrics,
    ];
    const key = canonicalMetricKey(metricLabel);
    const row = allRows.find(
      (m) =>
        canonicalMetricKey(m.label) === key ||
        canonicalMetricKey(m.templateLabel) === key,
    );

    return {
      monthKey: month.key,
      monthLabel: month.label,
      value: row?.fact ?? "—",
    };
  });
}

function emptyMetrics(): RNPProjectMetrics {
  return {
    primaryGoalLabel: "—",
    primaryGoalFact: "—",
    primaryGoalPlan: "—",
    activeGoal: "B",
    goals: [],
    progressPercentage: 0,
    progressPercentageDisplay: "—",
    overviewMetrics: [],
    kpiMetrics: [],
    additionalMetrics: [],
  };
}
