import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRNPCsv } from "../lib/rnpParser";
import { assessRnpQuality } from "../lib/rnpQuality";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/rnp-contract.csv"),
  "utf8",
);

const dataset = parseRNPCsv(fixture);
const monthIndexes = dataset.months.map((month) => month.month);

assert.deepEqual(monthIndexes, [6, 7], "JULY and AUGUST in column A must both parse");
assert.equal(dataset.health?.warnings.length, 0, "contract CSV should not warn");

const julyKey = dataset.months.find((month) => month.month === 6)?.key;
const augustKey = dataset.months.find((month) => month.month === 7)?.key;
assert.ok(julyKey && augustKey);

const july = dataset.projectsByMonth[julyKey];
const august = dataset.projectsByMonth[augustKey];

assert.equal(july.length, 5);
assert.equal(august.length, 5);

const names = july.map((project) => project.name).sort();
assert.deepEqual(names, [
  "Credyt Is - Leads",
  "Credyt Is - Subs",
  "LexDixit - Leads",
  "LexDixit - Subs",
  "Slovakia",
]);

const lexSubs = august.find((project) => project.name === "LexDixit - Subs");
assert.equal(lexSubs?.status, "Not relevant");
assert.ok(
  lexSubs?.metrics.overviewMetrics.some((metric) => metric.templateLabel === "Subs"),
);

const slovakia = august.find((project) => project.name === "Slovakia");
assert.equal(slovakia?.metrics.primaryGoalLabel.toLowerCase().includes("purchase"), true);
assert.ok(
  slovakia?.metrics.overviewMetrics.some((metric) =>
    /purchase/i.test(metric.templateLabel),
  ),
);

const credytLeads = august.find((project) => project.name === "Credyt Is - Leads");
assert.ok(credytLeads);
assert.ok(credytLeads.metrics.overviewMetrics.length >= 4);
assert.equal(credytLeads.isPrimaryGoalHolder, true);

const credytSubs = august.find((project) => project.name === "Credyt Is - Subs");
assert.equal(credytSubs?.isPrimaryGoalHolder, false);

const quality = assessRnpQuality(fixture, dataset);
assert.equal(quality.accepted, true);
assert.equal(quality.projectCount, 5);

const strayCsv = fixture.replace(
  "Visitors,,1161,200,300,400",
  "Visitors,AUGUST,1161,200,300,400",
);
const stray = parseRNPCsv(strayCsv);
assert.deepEqual(
  stray.months.map((month) => month.month),
  [6, 7],
  "month name in a label column must not create extra sections",
);
assert.ok(
  stray.health?.warnings.some((warning) => warning.includes("не в колонке A")),
);

const broken = parseRNPCsv("not,a,sheet\n");
const brokenQuality = assessRnpQuality("not,a,sheet\n#REF!", broken);
assert.equal(brokenQuality.accepted, false);

console.log("rnp parser snapshot tests passed");
