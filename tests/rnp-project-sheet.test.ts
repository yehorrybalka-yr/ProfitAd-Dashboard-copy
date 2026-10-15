import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeRnpDatasets } from "../lib/rnpMerge";
import {
  mergeProjectTabResults,
  parseProjectSheetCsv,
  parseProjectSheetTab,
} from "../lib/rnpProjectSheetParser";
import { RNP_PROJECT_SOURCES } from "../lib/rnpProjectSources";
import type { RNPDataset, RNPProject } from "../types/rnp";

const here = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(here, "fixtures/boostcore-sheet.csv"), "utf8");

const boostcoreSource = {
  id: "boostcore",
  name: "BoostCore",
  branches: [{ variant: "", csvUrl: "https://example.test/boostcore.csv" }],
  defaultStatus: "On Track",
};

const dataset = parseProjectSheetCsv(csv, boostcoreSource);

assert.equal(dataset.months.length, 1);
assert.equal(dataset.months[0]?.sheetName, "AUGUST");
const projects = dataset.projectsByMonth[dataset.months[0].key] ?? [];
assert.equal(projects.length, 1);
assert.equal(projects[0]?.id, "boostcore");
assert.equal(projects[0]?.name, "BoostCore");
assert.equal(projects[0]?.metrics.primaryGoalLabel, "LEADS");
assert.equal(projects[0]?.metrics.primaryGoalFact, "9");
assert.ok(projects[0]?.metrics.progressPercentage > 0);
assert.ok(
  projects[0]?.metrics.overviewMetrics.some((row) => row.label === "Budget plan"),
);
assert.ok(
  projects[0]?.metrics.additionalMetrics.some((row) => row.label === "Impressions") ||
    projects[0]?.metrics.overviewMetrics.some((row) => row.label === "Impressions"),
);

console.log("boostcore sheet parser ok");

const subsCsv = [
  "DATE,BUDGET,IMPRESSIONS",
  ",,",
  ",,,PROJECT,BRANCH,MONTH,GOAL,FACT,POINT B,POINT B+,POINT C,% FOR NOW,KPI - BUDGET",
  "01.08.2026,10,100,LexDixit,FB - Subs,AUGUST,,,,,0%,",
  "Total,10,100",
].join("\n");

const leadsCsv = [
  "DATE,BUDGET,IMPRESSIONS",
  ",,",
  ",,,PROJECT,BRANCH,MONTH,GOAL,FACT,POINT B,POINT B+,POINT C,% FOR NOW,KPI - BUDGET",
  "01.08.2026,5,50,LexDixit,FB - Leads,AUGUST,LEADS,12,20,25,30,60%,$500",
  "Total,5,50",
].join("\n");

const lexdixitSource = {
  id: "lexdixit",
  name: "LexDixit",
  branches: [
    { variant: "FB - Subs", csvUrl: "https://example.test/subs.csv" },
    { variant: "FB - Leads", csvUrl: "https://example.test/leads.csv" },
  ],
};

const multi = mergeProjectTabResults(lexdixitSource, [
  parseProjectSheetTab(subsCsv, lexdixitSource, "FB - Subs"),
  parseProjectSheetTab(leadsCsv, lexdixitSource, "FB - Leads"),
]);

const multiProjects = multi.projectsByMonth[multi.defaultMonthKey] ?? [];
assert.equal(multiProjects.length, 2);
assert.ok(multiProjects.every((p) => p.groupId === "lexdixit"));
assert.ok(
  multiProjects.some((p) => p.variant === "FB - Subs"),
  "FB - Subs branch present",
);
assert.ok(
  multiProjects.some((p) => p.variant === "FB - Leads"),
  "FB - Leads branch present",
);
assert.ok(multiProjects.every((p) => p.metrics.primaryGoalLabel === "LEADS"));
assert.ok(multiProjects.every((p) => p.metrics.primaryGoalFact === "12"));
assert.ok(
  multiProjects.every((p) =>
    p.metrics.overviewMetrics.some(
      (row) => row.label === "Budget plan" && row.fact.includes("500"),
    ),
  ),
);

const subsBranch = multiProjects.find((p) => p.variant === "FB - Subs");
const leadsBranch = multiProjects.find((p) => p.variant === "FB - Leads");
assert.ok(
  subsBranch?.metrics.additionalMetrics.some(
    (row) => row.label === "Budget" && row.fact === "10",
  ) ||
    subsBranch?.metrics.overviewMetrics.some(
      (row) => row.label === "Budget" && row.fact === "10",
    ),
);
assert.ok(
  leadsBranch?.metrics.additionalMetrics.some(
    (row) => row.label === "Budget" && row.fact === "5",
  ) ||
    leadsBranch?.metrics.overviewMetrics.some(
      (row) => row.label === "Budget" && row.fact === "5",
    ),
);

const holders = multiProjects.filter((p) => p.isPrimaryGoalHolder);
assert.equal(holders.length, 1);
assert.ok(
  (holders[0]?.variant ?? "").toLowerCase().includes("leads"),
  "primary holder prefers Leads branch",
);

console.log("multi-tab project-level goals ok");

assert.equal(RNP_PROJECT_SOURCES.length, 3);
assert.equal(RNP_PROJECT_SOURCES.find((s) => s.id === "credyt-is")?.branches.length, 3);
assert.equal(RNP_PROJECT_SOURCES.find((s) => s.id === "lexdixit")?.branches.length, 3);

function fakeProject(partial: Partial<RNPProject> & Pick<RNPProject, "id" | "name">): RNPProject {
  return {
    status: "On Track",
    metrics: {
      primaryGoalLabel: "X",
      primaryGoalFact: "1",
      primaryGoalPlan: "2",
      activeGoal: "B",
      goals: [],
      progressPercentage: 0,
      progressPercentageDisplay: "—",
      overviewMetrics: [],
      kpiMetrics: [],
      additionalMetrics: [],
    },
    groupId: null,
    groupName: null,
    variant: null,
    isPrimaryGoalHolder: true,
    ...partial,
  };
}

const shared: RNPDataset = {
  months: [{ key: "2026-08", year: 2026, month: 7, sheetName: "AUGUST", label: "Август 2026" }],
  defaultMonthKey: "2026-08",
  projectsByMonth: {
    "2026-08": [
      fakeProject({
        id: "lexdixit-fb-subs",
        name: "LexDixit - FB - Subs",
        groupId: "lexdixit",
        groupName: "LexDixit",
        variant: "FB - Subs",
      }),
      fakeProject({ id: "other", name: "Other" }),
    ],
  },
  contentHash: "shared",
  csvByteLength: 10,
  fetchedAt: new Date().toISOString(),
};

const merged = mergeRnpDatasets(shared, [multi], RNP_PROJECT_SOURCES);
const mergedList = merged.projectsByMonth["2026-08"] ?? [];
assert.ok(mergedList.some((p) => p.id === "other"), "unrelated kept");
const sheetSubs = mergedList.find((p) => p.variant === "FB - Subs");
assert.ok(sheetSubs, "sheet LexDixit Subs present");
assert.equal(sheetSubs?.metrics.primaryGoalFact, "12", "shared LexDixit replaced by sheet");
assert.ok(mergedList.some((p) => p.variant === "FB - Leads"), "sheet Leads added");
assert.equal(
  mergedList.filter((p) => p.groupId === "lexdixit").length,
  2,
);

console.log("merge replace shared projects ok");
