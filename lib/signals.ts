import { DailyMetric, Project, Signal } from "@/types";
import { aggregateMetrics, percentDelta, summarizeByCampaign } from "./metrics";
import { formatCurrency, formatPercent, formatRatioAsPercent } from "./format";

// Thresholds — tuned for MVP, can move to project settings later.
const THRESHOLDS = {
  cplUpPct: 15, // CPL rose more than 15% vs previous period
  cpmUpPct: 15, // CPM rose more than 15% vs previous period
  spendUpPct: 15, // spend grew more than 15%
  leadsDownPct: -10, // while leads fell more than 10%
  ctrLowPct: 0.8, // CTR below 0.8% is considered low
  minSpendForNoLeads: 50, // ignore tiny test budgets
};

let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * Compares current vs previous period metrics (project-level and per-campaign)
 * and returns a flat list of human-readable signals.
 */
export function generateSignals(
  project: Project,
  currentRows: DailyMetric[],
  previousRows: DailyMetric[]
): Signal[] {
  const signals: Signal[] = [];
  const current = aggregateMetrics(currentRows);
  const previous = aggregateMetrics(previousRows);

  // 1. CPL up (project level)
  const cplDelta = percentDelta(current.cpl, previous.cpl);
  if (cplDelta !== null && cplDelta >= THRESHOLDS.cplUpPct && current.leads > 0) {
    signals.push({
      id: nextId("sig"),
      project_id: project.project_id,
      type: "cpl_up",
      severity: cplDelta >= 30 ? "critical" : "warning",
      title: "CPL вырос",
      message: `CPL вырос на ${formatPercent(cplDelta)} по сравнению с предыдущим периодом (${formatCurrency(
        current.cpl,
        project.currency
      )} против ${formatCurrency(previous.cpl, project.currency)}).`,
    });
  }

  // 2. Spend up while leads down (project level)
  const spendDelta = percentDelta(current.spend, previous.spend);
  const leadsDelta = percentDelta(current.leads, previous.leads);
  if (
    spendDelta !== null &&
    leadsDelta !== null &&
    spendDelta >= THRESHOLDS.spendUpPct &&
    leadsDelta <= THRESHOLDS.leadsDownPct
  ) {
    signals.push({
      id: nextId("sig"),
      project_id: project.project_id,
      type: "spend_up_leads_down",
      severity: "critical",
      title: "Расход растёт, лидов меньше",
      message: `Расход вырос на ${formatPercent(spendDelta)}, а лиды упали на ${formatPercent(
        Math.abs(leadsDelta)
      )}. Возможна проблема с оффером или таргетингом.`,
    });
  }

  // 3. ROAS below target (project level)
  if (project.target_roas > 0 && current.spend > 0 && current.roas < project.target_roas) {
    const gap = project.target_roas - current.roas;
    signals.push({
      id: nextId("sig"),
      project_id: project.project_id,
      type: "roas_below_target",
      severity: gap >= project.target_roas * 0.3 ? "critical" : "warning",
      title: "ROAS ниже целевого",
      message: `Текущий ROAS ${formatRatioAsPercent(current.roas)} ниже цели ${formatRatioAsPercent(
        project.target_roas
      )}.`,
    });
  }

  // Per-campaign checks: CTR low, CPM up, spend with no leads.
  const campaigns = summarizeByCampaign(currentRows);
  const prevCampaigns = summarizeByCampaign(previousRows);

  for (const camp of campaigns) {
    const prevCamp = prevCampaigns.find((c) => c.campaign_name === camp.campaign_name);

    if (camp.impressions > 500 && camp.ctr < THRESHOLDS.ctrLowPct) {
      signals.push({
        id: nextId("sig"),
        project_id: project.project_id,
        campaign_name: camp.campaign_name,
        type: "ctr_low",
        severity: camp.ctr < THRESHOLDS.ctrLowPct / 2 ? "critical" : "warning",
        title: "Низкий CTR",
        message: `«${camp.campaign_name}»: CTR ${formatPercent(camp.ctr)} — ниже нормы (${formatPercent(
          THRESHOLDS.ctrLowPct
        )}). Проверьте креативы.`,
      });
    }

    if (prevCamp) {
      const cpmDelta = percentDelta(camp.cpm, prevCamp.cpm);
      if (cpmDelta !== null && cpmDelta >= THRESHOLDS.cpmUpPct) {
        signals.push({
          id: nextId("sig"),
          project_id: project.project_id,
          campaign_name: camp.campaign_name,
          type: "cpm_up",
          severity: cpmDelta >= 30 ? "critical" : "warning",
          title: "CPM вырос",
          message: `«${camp.campaign_name}»: CPM вырос на ${formatPercent(cpmDelta)} — аукцион дорожает.`,
        });
      }
    }

    if (camp.spend >= THRESHOLDS.minSpendForNoLeads && camp.leads === 0) {
      signals.push({
        id: nextId("sig"),
        project_id: project.project_id,
        campaign_name: camp.campaign_name,
        type: "spend_no_leads",
        severity: "critical",
        title: "Расход есть, лидов нет",
        message: `«${camp.campaign_name}»: потрачено ${formatCurrency(
          camp.spend,
          project.currency
        )}, а лидов — 0. Остановите или проверьте кампанию.`,
      });
    }
  }

  const severityRank: Record<Signal["severity"], number> = { critical: 0, warning: 1 };
  return signals.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
