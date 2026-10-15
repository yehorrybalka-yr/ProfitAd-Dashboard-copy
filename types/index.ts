// ---------- Domain entities (source-of-truth shape, matches Google Sheets rows) ----------

export type ProjectStatus = "active" | "paused" | "at_risk" | "completed";

export interface Project {
  project_id: string;
  client_name: string;
  project_name: string;
  status: ProjectStatus;
  manager: string;
  target_cpl: number;
  target_cpa: number;
  target_roas: number; // e.g. 3 = 300%
  currency: "USD" | "EUR" | "GEL" | "RUB";
}

export type Platform = "Facebook" | "Google" | "TikTok" | "Instagram" | "LinkedIn";

export interface DailyMetric {
  date: string; // ISO yyyy-mm-dd
  project_id: string;
  platform: Platform;
  campaign_name: string;
  adset_name: string;
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  sales: number;
  revenue: number;
  notes?: string;
}

export type EventType =
  | "note"
  | "creative_change"
  | "budget_change"
  | "launch"
  | "issue"
  | "optimization";

export interface Event {
  date: string; // ISO yyyy-mm-dd
  project_id: string;
  event_type: EventType;
  description: string;
  author: string;
}

// ---------- Derived / computed shapes used across the UI ----------

export interface AggregatedMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  sales: number;
  revenue: number;
  ctr: number; // %
  cpc: number;
  cpm: number;
  cpl: number;
  cpa: number;
  roas: number; // ratio, 3 = 300%
}

export interface CampaignSummary extends AggregatedMetrics {
  campaign_name: string;
  platform: Platform;
}

export interface TrendPoint {
  date: string;
  spend: number;
  leads: number;
  cpl: number;
  cpm: number;
  ctr: number;
}

export type SignalType =
  | "cpl_up"
  | "spend_up_leads_down"
  | "ctr_low"
  | "cpm_up"
  | "spend_no_leads"
  | "roas_below_target";

export type SignalSeverity = "warning" | "critical";

export interface Signal {
  id: string;
  project_id: string;
  campaign_name?: string;
  type: SignalType;
  severity: SignalSeverity;
  title: string;
  message: string;
}

export interface DateRange {
  from: string; // ISO yyyy-mm-dd
  to: string; // ISO yyyy-mm-dd
}

export type PeriodPreset = "7d" | "14d" | "30d" | "90d" | "all";
