export type RNPGoalKey = "B" | "B+" | "C";

export interface RNPGoalTier {
  key: RNPGoalKey;
  label: string;
  plan: string;
  achieved: boolean;
  isActive: boolean;
}

/** Одна строка метрик из таблицы (факт + планы B/B+/C) */
export interface RNPMetricRow {
  label: string;
  /** Стабильный ключ строки из колонки A — для сопоставления между месяцами */
  templateLabel: string;
  fact: string;
  planB: string;
  planBPlus: string;
  planC: string;
  /** Вторая строка блока — главная цель проекта */
  isPrimaryGoal: boolean;
  /** Строка с планами, но не главная цель — KPI для детальной страницы */
  isKpi: boolean;
  goals: RNPGoalTier[];
  activeGoal: RNPGoalKey;
  progressPercentage: number;
}

export interface RNPProjectMetrics {
  /** Главная цель (2-я строка блока) */
  primaryGoalLabel: string;
  primaryGoalFact: string;
  primaryGoalPlan: string;
  activeGoal: RNPGoalKey;
  goals: RNPGoalTier[];
  progressPercentage: number;
  progressPercentageDisplay: string;
  /** Первые 5 строк метрик (пустые пропущены) */
  overviewMetrics: RNPMetricRow[];
  /** KPI — строки с планами среди первых 5, кроме главной цели */
  kpiMetrics: RNPMetricRow[];
  /** Дополнительные метрики после первых 5 строк */
  additionalMetrics: RNPMetricRow[];
}

export interface RNPProject {
  id: string;
  name: string;
  status: string;
  metrics: RNPProjectMetrics;
  /** ID группы для подпроектов (напр. credyt-is) */
  groupId: string | null;
  /** Базовое имя группы (напр. Credyt Is) */
  groupName: string | null;
  /** Вариант подпроекта: Subs, Leads и т.д. */
  variant: string | null;
  /** У этого подпроекта стоит главная цель группы */
  isPrimaryGoalHolder: boolean;
}

/** Один доступный месяц в таблице РНП */
export interface RNPMonthOption {
  key: string;
  year: number;
  month: number;
  sheetName: string;
  label: string;
}

export type RNPDataSource = "neon" | "live";

export interface RNPHealth {
  source: RNPDataSource;
  warnings: string[];
  qualityScore: number;
  accepted: boolean;
}

export interface RNPDataset {
  months: RNPMonthOption[];
  defaultMonthKey: string;
  projectsByMonth: Record<string, RNPProject[]>;
  contentHash: string;
  /** Размер сырого CSV — для защиты от stale CDN-ответов */
  csvByteLength: number;
  fetchedAt: string;
  health?: RNPHealth;
}
