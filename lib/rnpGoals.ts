import type { RNPGoalTier, RNPGoalKey } from "@/types/rnp";

/** Парсит число из ячейки таблицы (для сравнения целей) */
export function parseMetricNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "#DIV/0!" || trimmed === "#REF!" || trimmed === "#N/A" || trimmed === "-") {
    return 0;
  }

  let cleaned = trimmed
    .replace(/[€$zł%]/gi, "")
    .replace(/[\s\u00A0]/g, "");

  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/** Парсит % из строки прогресса */
export function parseProgressNumber(raw: string): number {
  if (!raw || raw === "—") return 0;
  return parseMetricNumber(raw);
}

interface GoalInput {
  factRaw: string | undefined;
  planBRaw: string | undefined;
  planBPlusRaw: string | undefined;
  planCRaw: string | undefined;
  progressRaw: string;
}

/**
 * Определяет активную цель и статус B / B+ / C.
 * Когда факт >= план B → B достигнута, активна B+.
 * Когда факт >= план B+ → активна C.
 */
export function resolveGoalTiers(input: GoalInput): {
  goals: RNPGoalTier[];
  activeGoal: RNPGoalKey;
  activePlan: string;
  progressPercentage: number;
} {
  const fact = parseMetricNumber(input.factRaw);
  const planB = parseMetricNumber(input.planBRaw);
  const planBPlus = parseMetricNumber(input.planBPlusRaw);
  const planC = parseMetricNumber(input.planCRaw);

  const sheetProgress = parseProgressNumber(input.progressRaw);

  let activeGoal: RNPGoalKey = "B";
  let bAchieved = false;
  let bPlusAchieved = false;

  if (planB > 0 && fact >= planB) {
    bAchieved = true;
    activeGoal = "B+";
  }
  if (planBPlus > 0 && fact >= planBPlus) {
    bPlusAchieved = true;
    activeGoal = "C";
  }

  const activePlanNumeric =
    activeGoal === "C" ? planC : activeGoal === "B+" ? planBPlus : planB;

  const activePlanRaw =
    activeGoal === "C"
      ? formatPlan(input.planCRaw)
      : activeGoal === "B+"
        ? formatPlan(input.planBPlusRaw)
        : formatPlan(input.planBRaw);

  // Для достигнутой B пересчитываем прогресс относительно новой активной цели
  const progressPercentage =
    activeGoal !== "B" && activePlanNumeric > 0
      ? Math.round((fact / activePlanNumeric) * 1000) / 10
      : sheetProgress > 0
        ? sheetProgress
        : planB > 0
          ? Math.round((fact / planB) * 1000) / 10
          : 0;

  const goals: RNPGoalTier[] = [
    {
      key: "B",
      label: "Цель B",
      plan: formatPlan(input.planBRaw),
      achieved: bAchieved,
      isActive: activeGoal === "B",
    },
    {
      key: "B+",
      label: "Цель B+",
      plan: formatPlan(input.planBPlusRaw),
      achieved: bPlusAchieved,
      isActive: activeGoal === "B+",
    },
    {
      key: "C",
      label: "Цель C",
      plan: formatPlan(input.planCRaw),
      achieved: planC > 0 && fact >= planC,
      isActive: activeGoal === "C",
    },
  ];

  return {
    goals,
    activeGoal,
    activePlan: activePlanRaw,
    progressPercentage,
  };
}

function formatPlan(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "#DIV/0!" || trimmed === "#REF!" || trimmed === "#N/A") {
    return "—";
  }
  return trimmed;
}
