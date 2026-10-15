import { DailyMetric, Platform } from "@/types";
import { addDays, isoDate } from "@/lib/utils";

// Anchor date so the mock data always reads as "up to date" relative to `new Date()`
// during development, without needing a live backend.
export const LATEST_DATE = "2026-06-30";
export const HISTORY_DAYS = 60;
const FIRST_DATE = addDays(LATEST_DATE, -(HISTORY_DAYS - 1));

// Simple deterministic PRNG (mulberry32) so the mock dataset is stable across reloads.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CampaignBlueprint {
  campaign_name: string;
  adset_name: string;
  ad_name: string;
  platform: Platform;
  dailySpend: number; // baseline
  ctr: number; // % baseline
  cpm: number; // baseline
  cvr: number; // leads / click, baseline
  saleRate: number; // sales / lead, baseline
  aov: number; // revenue / sale, baseline
  seed: number;
  /** Multipliers applied to (spend, ctr, cpm, cvr) as a function of day index (0 = oldest). */
  trend?: (dayIndex: number, totalDays: number) => { spend?: number; ctr?: number; cpm?: number; cvr?: number };
}

interface ProjectBlueprint {
  project_id: string;
  campaigns: CampaignBlueprint[];
}

function jitter(rand: () => number, spread = 0.18) {
  return 1 + (rand() - 0.5) * 2 * spread;
}

function buildCampaignRows(
  project_id: string,
  bp: CampaignBlueprint,
  totalDays: number
): DailyMetric[] {
  const rand = mulberry32(bp.seed);
  const rows: DailyMetric[] = [];

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(FIRST_DATE, i);
    const trend = bp.trend?.(i, totalDays) ?? {};

    const spend = Math.max(0, bp.dailySpend * (trend.spend ?? 1) * jitter(rand));
    const ctr = Math.max(0.05, bp.ctr * (trend.ctr ?? 1) * jitter(rand, 0.12));
    const cpm = Math.max(1, bp.cpm * (trend.cpm ?? 1) * jitter(rand, 0.1));
    const cvr = Math.max(0.001, bp.cvr * (trend.cvr ?? 1) * jitter(rand, 0.15));

    const impressions = Math.round((spend / cpm) * 1000);
    const clicks = Math.round(impressions * (ctr / 100));
    const leads = Math.round(clicks * cvr);
    const sales = Math.round(leads * bp.saleRate * jitter(rand, 0.2));
    const revenue = Math.round(sales * bp.aov * jitter(rand, 0.1));

    rows.push({
      date,
      project_id,
      platform: bp.platform,
      campaign_name: bp.campaign_name,
      adset_name: bp.adset_name,
      ad_name: bp.ad_name,
      spend: Math.round(spend * 100) / 100,
      impressions,
      clicks,
      leads,
      sales,
      revenue,
    });
  }

  return rows;
}

// Trend helper: keeps metrics flat, then shifts over the last `windowDays`.
function lateShift(
  windowDays: number,
  totalDaysHint: number,
  shift: { spend?: number; ctr?: number; cpm?: number; cvr?: number }
) {
  return (dayIndex: number, totalDays: number) => {
    const daysFromEnd = totalDays - 1 - dayIndex;
    if (daysFromEnd >= windowDays) return {};
    const progress = 1 - daysFromEnd / windowDays; // 0 -> 1 as we approach latest day
    const lerp = (target?: number) => (target === undefined ? undefined : 1 + (target - 1) * progress);
    return { spend: lerp(shift.spend), ctr: lerp(shift.ctr), cpm: lerp(shift.cpm), cvr: lerp(shift.cvr) };
  };
}

const blueprints: ProjectBlueprint[] = [
  {
    // Nordic Dent — healthy, stable project.
    project_id: "proj-01",
    campaigns: [
      {
        campaign_name: "Импланты — холодный трафик",
        adset_name: "Города 25-45",
        ad_name: "Видео отзыв",
        platform: "Facebook",
        dailySpend: 90,
        ctr: 1.6,
        cpm: 9,
        cvr: 0.09,
        saleRate: 0.28,
        aov: 420,
        seed: 101,
      },
      {
        campaign_name: "Отбеливание — ретаргетинг",
        adset_name: "Посетители сайта 30д",
        ad_name: "Карусель до/после",
        platform: "Instagram",
        dailySpend: 40,
        ctr: 2.1,
        cpm: 8,
        cvr: 0.12,
        saleRate: 0.35,
        aov: 150,
        seed: 102,
      },
      {
        campaign_name: "Брекеты — поиск",
        adset_name: "Ключевые слова",
        ad_name: "Текстовое объявление",
        platform: "Google",
        dailySpend: 60,
        ctr: 4.2,
        cpm: 14,
        cvr: 0.15,
        saleRate: 0.22,
        aov: 900,
        seed: 103,
      },
    ],
  },
  {
    // UrbanFit — at risk: CPL climbing, CTR weak, ROAS under target.
    project_id: "proj-02",
    campaigns: [
      {
        campaign_name: "Абонемент — акция лета",
        adset_name: "Женщины 20-35",
        ad_name: "UGC видео",
        platform: "TikTok",
        dailySpend: 70,
        ctr: 1.1,
        cpm: 7,
        cvr: 0.07,
        saleRate: 0.18,
        aov: 60,
        seed: 201,
        trend: lateShift(14, HISTORY_DAYS, { spend: 1.6, cvr: 0.5, ctr: 0.7 }),
      },
      {
        campaign_name: "Персональный тренер — лиды",
        adset_name: "Интересы: фитнес",
        ad_name: "Статичный баннер",
        platform: "Facebook",
        dailySpend: 45,
        ctr: 0.6,
        cpm: 10,
        cvr: 0.05,
        saleRate: 0.15,
        aov: 120,
        seed: 202,
      },
    ],
  },
  {
    // GreenLeaf Realty — mostly fine, one campaign with rising CPM.
    project_id: "proj-03",
    campaigns: [
      {
        campaign_name: "Новостройки — просмотр планировок",
        adset_name: "Гео: центр города",
        ad_name: "Карусель ЖК",
        platform: "Facebook",
        dailySpend: 150,
        ctr: 1.4,
        cpm: 11,
        cvr: 0.06,
        saleRate: 0.1,
        aov: 3200,
        seed: 301,
        trend: lateShift(10, HISTORY_DAYS, { cpm: 1.5 }),
      },
      {
        campaign_name: "Ипотека — консультация",
        adset_name: "Семьи 28-45",
        ad_name: "Лид-форма",
        platform: "Google",
        dailySpend: 80,
        ctr: 3.5,
        cpm: 13,
        cvr: 0.11,
        saleRate: 0.12,
        aov: 2600,
        seed: 302,
      },
    ],
  },
  {
    // PetCare Plus — paused project, one campaign with spend but no leads.
    project_id: "proj-04",
    campaigns: [
      {
        campaign_name: "Запись на приём — акция",
        adset_name: "Владельцы животных",
        ad_name: "Фото клиники",
        platform: "Instagram",
        dailySpend: 25,
        ctr: 0.9,
        cpm: 9,
        cvr: 0.06,
        saleRate: 0.4,
        aov: 45,
        seed: 401,
        trend: lateShift(20, HISTORY_DAYS, { spend: 0.3, cvr: 0.15 }),
      },
      {
        campaign_name: "Вакцинация — сезонная",
        adset_name: "Ретаргетинг",
        ad_name: "Напоминание",
        platform: "Facebook",
        dailySpend: 15,
        ctr: 1.2,
        cpm: 8,
        cvr: 0.08,
        saleRate: 0.5,
        aov: 35,
        seed: 402,
        trend: lateShift(12, HISTORY_DAYS, { cvr: 0.01 }),
      },
    ],
  },
  {
    // Batumi Auto — auction heating up (CPM up across the board recently).
    project_id: "proj-05",
    campaigns: [
      {
        campaign_name: "Тест-драйв — новая модель",
        adset_name: "Гео: Батуми + 30км",
        ad_name: "Видео обзор",
        platform: "Facebook",
        dailySpend: 110,
        ctr: 1.8,
        cpm: 8,
        cvr: 0.1,
        saleRate: 0.2,
        aov: 250,
        seed: 501,
        trend: lateShift(9, HISTORY_DAYS, { cpm: 1.6 }),
      },
      {
        campaign_name: "Trade-in — оценка авто",
        adset_name: "Владельцы 3+ года",
        ad_name: "Лид-форма",
        platform: "Instagram",
        dailySpend: 55,
        ctr: 1.3,
        cpm: 9,
        cvr: 0.08,
        saleRate: 0.25,
        aov: 180,
        seed: 502,
        trend: lateShift(9, HISTORY_DAYS, { cpm: 1.4 }),
      },
    ],
  },
  {
    // EduSpace — completed project, activity winding down toward the end.
    project_id: "proj-06",
    campaigns: [
      {
        campaign_name: "Курс аналитики — набор",
        adset_name: "Интересы: карьера в IT",
        ad_name: "Вебинар-приглашение",
        platform: "LinkedIn",
        dailySpend: 65,
        ctr: 1.0,
        cpm: 16,
        cvr: 0.09,
        saleRate: 0.3,
        aov: 380,
        seed: 601,
        trend: lateShift(21, HISTORY_DAYS, { spend: 0.05 }),
      },
      {
        campaign_name: "Курс маркетинга — набор",
        adset_name: "Ретаргетинг лендинга",
        ad_name: "Отзывы выпускников",
        platform: "Google",
        dailySpend: 50,
        ctr: 3.8,
        cpm: 12,
        cvr: 0.13,
        saleRate: 0.27,
        aov: 340,
        seed: 602,
        trend: lateShift(21, HISTORY_DAYS, { spend: 0.05 }),
      },
    ],
  },
];

export const dailyMetrics: DailyMetric[] = blueprints.flatMap((project) =>
  project.campaigns.flatMap((bp) => buildCampaignRows(project.project_id, bp, HISTORY_DAYS))
);

export function isoToday(): string {
  return isoDate(new Date());
}
