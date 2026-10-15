/** Реестр отдельных проектных Google Sheets (каждая вкладка = ветка). */

export interface RnpProjectBranchSource {
  /** Имя ветки в дашборде: FB - Leads, FB - Subs, Google, … */
  variant: string;
  /** Публичный CSV URL вкладки (gid=…&single=true&output=csv) */
  csvUrl: string;
}

export interface RnpProjectSource {
  /** Стабильный id в дашборде / groupId для веток */
  id: string;
  /** Отображаемое имя */
  name: string;
  /** Вкладки Google Sheet — каждая со своими дневными Total */
  branches: RnpProjectBranchSource[];
  /** STATUS, если в таблице его нет */
  defaultStatus?: string;
}

const CREDYT_PUBLISH =
  "2PACX-1vT2EaH5JXbYfwreYDuMsbxXqlN-m93MFNM0QVFsYkoUrrDpG2uBfzWZZN4aenhIHmuIyInMfafUGHuE";
const LEXDIXIT_PUBLISH =
  "2PACX-1vSt-3xpBf0p8HYpZqI5tNdKn3HlG4zSH3MONQINubHeqWhaljMYPH__4wLFaod63c10wC9ADP5RmtYF";

export function projectSheetBranchCsvUrl(
  publishId: string,
  gid: number,
): string {
  return `https://docs.google.com/spreadsheets/d/e/${publishId}/pub?gid=${gid}&single=true&output=csv`;
}

export const RNP_PROJECT_SOURCES: RnpProjectSource[] = [
  {
    id: "boostcore",
    name: "BoostCore",
    branches: [
      {
        variant: "",
        csvUrl:
          "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-h35C8j6qNkeIshI6_tJkF2jVz-8IuQXEpMi4V6aqMXGBIcdQGw0LQF8RFVgRCTg6UN5Bo4HwtH4y/pub?output=csv",
      },
    ],
    defaultStatus: "On Track",
  },
  {
    id: "lexdixit",
    name: "LexDixit",
    branches: [
      {
        variant: "FB - Subs",
        csvUrl: projectSheetBranchCsvUrl(LEXDIXIT_PUBLISH, 1559570582),
      },
      {
        variant: "FB - Leads",
        csvUrl: projectSheetBranchCsvUrl(LEXDIXIT_PUBLISH, 626606016),
      },
      {
        variant: "Google",
        csvUrl: projectSheetBranchCsvUrl(LEXDIXIT_PUBLISH, 835549377),
      },
    ],
    defaultStatus: "On Track",
  },
  {
    id: "credyt-is",
    name: "Credyt Is",
    branches: [
      {
        variant: "FB - Subs",
        csvUrl: projectSheetBranchCsvUrl(CREDYT_PUBLISH, 1559570582),
      },
      {
        variant: "FB - Leads",
        csvUrl: projectSheetBranchCsvUrl(CREDYT_PUBLISH, 1902617839),
      },
      {
        variant: "Google",
        csvUrl: projectSheetBranchCsvUrl(CREDYT_PUBLISH, 835549377),
      },
    ],
    defaultStatus: "On Track",
  },
];
