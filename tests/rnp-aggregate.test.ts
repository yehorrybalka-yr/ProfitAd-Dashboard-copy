import assert from "node:assert/strict";
import { aggregateGroupMetrics } from "../lib/rnpAggregate";
import type { RNPMetricRow, RNPProject, RNPProjectMetrics } from "../types/rnp";

function metric(
  label: string,
  fact: string,
  extra: Partial<RNPMetricRow> = {},
): RNPMetricRow {
  return {
    label,
    templateLabel: extra.templateLabel ?? label,
    fact,
    planB: extra.planB ?? "—",
    planBPlus: extra.planBPlus ?? "—",
    planC: extra.planC ?? "—",
    isPrimaryGoal: extra.isPrimaryGoal ?? false,
    isKpi: extra.isKpi ?? false,
    goals: extra.goals ?? [],
    activeGoal: extra.activeGoal ?? "B",
    progressPercentage: extra.progressPercentage ?? 0,
  };
}

function emptyMetrics(overrides: Partial<RNPProjectMetrics> = {}): RNPProjectMetrics {
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
    ...overrides,
  };
}

function project(
  name: string,
  variant: string,
  overview: RNPMetricRow[],
  extra: Partial<RNPProject> = {},
): RNPProject {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    status: "In Progress",
    metrics: emptyMetrics({
      primaryGoalLabel: overview.find((row) => row.isPrimaryGoal)?.label ?? overview[0]?.label ?? "—",
      primaryGoalFact: overview.find((row) => row.isPrimaryGoal)?.fact ?? "—",
      overviewMetrics: overview,
    }),
    groupId: "credyt-is",
    groupName: "Credyt Is",
    variant,
    isPrimaryGoalHolder: extra.isPrimaryGoalHolder ?? false,
  };
}

const subs = project("Credyt Is - Subs", "Subs", [
  metric("Budget", "583,19 zł", { templateLabel: "Budget" }),
  metric("Subs", "218", { templateLabel: "Subs", isPrimaryGoal: true }),
  metric("Visitors", "1161", { templateLabel: "Visitors" }),
  metric("CPF", "2,68 zł", { templateLabel: "CPF" }),
]);

const leads = project(
  "Credyt Is - Leads",
  "Leads",
  [
    metric("Budget (Leads)", "396,65 zł", { templateLabel: "Budget" }),
    metric("Leads + Contacts", "12", {
      templateLabel: "Leads + Contacts",
      isPrimaryGoal: true,
    }),
  ],
  { isPrimaryGoalHolder: true },
);

const aggregated = aggregateGroupMetrics([subs, leads], leads);
const byLabel = Object.fromEntries(
  [...aggregated.overviewMetrics, ...aggregated.additionalMetrics].map((row) => [
    row.label,
    row.fact,
  ]),
);

assert.equal(byLabel.Budget, "979,84 zł", "All must sum Budget + Budget (Leads)");
assert.equal(byLabel.Subs, "218");
assert.equal(byLabel["Leads + Contacts"], "12");
assert.equal(byLabel.Visitors, "1161");
assert.equal(aggregated.primaryGoalLabel, "Leads + Contacts");

const leadsOnSubsRow = project(
  "Credyt Is - Leads",
  "Leads",
  [
    metric("Budget (Leads)", "396,65 zł", { templateLabel: "Budget" }),
    metric("Leads + Contacts", "12", {
      templateLabel: "Subs",
      isPrimaryGoal: true,
    }),
  ],
  { isPrimaryGoalHolder: true },
);

const aggregatedFromSheetLayout = aggregateGroupMetrics(
  [subs, leadsOnSubsRow],
  leadsOnSubsRow,
);
const sheetByLabel = Object.fromEntries(
  [
    ...aggregatedFromSheetLayout.overviewMetrics,
    ...aggregatedFromSheetLayout.additionalMetrics,
  ].map((row) => [row.label, row.fact]),
);

assert.equal(sheetByLabel.Budget, "979,84 zł");
assert.equal(sheetByLabel.Subs, "218", "Subs row must not swallow Leads + Contacts");
assert.equal(
  sheetByLabel["Leads + Contacts"],
  "12",
  "custom label Leads + Contacts on a Subs template row must stay a separate summed metric",
);

console.log("rnp aggregate All-branch tests passed");
