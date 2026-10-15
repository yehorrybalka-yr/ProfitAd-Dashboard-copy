import type { RNPMetricRow, RNPProject } from "@/types/rnp";

/** Все метрики проекта: основные + дополнительные */
export function getAllProjectMetrics(project: RNPProject): RNPMetricRow[] {
  return [
    ...project.metrics.overviewMetrics,
    ...project.metrics.additionalMetrics,
  ];
}

export function normalizeMetricKey(label: string): string {
  return label.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Стабильный ключ метрики для All / сравнений:
 * «Budget (Leads)» и «Budget» → BUDGET.
 */
export function canonicalMetricKey(label: string): string {
  const stripped = normalizeMetricKey(label).replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return "";

  if (stripped.includes("LEAD")) return "LEADS + CONTACTS";
  if (stripped.includes("PURCHASE")) return "PURCHASES";
  if (stripped.includes("SUB")) return "SUBS";
  if (stripped.includes("VISITOR")) return "VISITORS";
  if (stripped.includes("REVENUE")) return "REVENUE";
  if (stripped.includes("BUDGET")) return "BUDGET";
  if (stripped.includes("CLICK")) return "CLICKS";
  if (stripped.includes("IMPRESSION")) return "IMPRESSIONS";
  if (stripped.includes("AVG") && stripped.includes("BILL")) return "AVG.BILL";
  if (stripped === "CAC" || stripped.includes("CAC")) return "CAC";
  if (stripped.includes("ROAS")) return "ROAS";
  if (stripped.includes("CTR")) return "CTR";
  if (stripped === "CPC" || stripped.startsWith("CPC ")) return "CPC";
  if (stripped === "CPL" || stripped.startsWith("CPL ")) return "CPL";
  if (stripped === "CPF" || stripped.startsWith("CPF ")) return "CPF";
  if (stripped === "CPM" || stripped.startsWith("CPM ")) return "CPM";

  return stripped;
}

export const CANONICAL_METRIC_LABELS: Record<string, string> = {
  BUDGET: "Budget",
  REVENUE: "Revenue",
  PURCHASES: "Purchases",
  SUBS: "Subs",
  VISITORS: "Visitors",
  CLICKS: "Clicks",
  IMPRESSIONS: "Impressions",
  "LEADS + CONTACTS": "Leads + Contacts",
  CAC: "CAC",
  ROAS: "ROAS",
  "AVG.BILL": "Avg.Bill",
  CPC: "CPC",
  CPL: "CPL",
  CPF: "CPF",
  CPM: "CPM",
};

export function findMetricByLabel(
  metrics: RNPMetricRow[],
  label: string,
): RNPMetricRow | undefined {
  const key = normalizeMetricKey(label);
  return metrics.find(
    (m) =>
      m.label === label ||
      normalizeMetricKey(m.templateLabel) === key ||
      normalizeMetricKey(m.label) === key,
  );
}

export function findMetricByTemplateLabel(
  metrics: RNPMetricRow[],
  templateLabel: string,
): RNPMetricRow | undefined {
  const key = normalizeMetricKey(templateLabel);
  return metrics.find((m) => normalizeMetricKey(m.templateLabel) === key);
}
