import { CampaignSummary } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatNumber, formatPercent, formatRatioAsPercent } from "@/lib/format";

const PLATFORM_TONE: Record<string, "brand" | "positive" | "warning" | "neutral"> = {
  Facebook: "brand",
  Instagram: "brand",
  Google: "positive",
  TikTok: "warning",
  LinkedIn: "neutral",
};

function RoasCell({ value }: { value: number }) {
  const tone = value >= 3 ? "text-positive" : value >= 1.5 ? "text-warning" : "text-danger";
  return <span className={`font-mono font-medium tabular-nums ${tone}`}>{formatRatioAsPercent(value)}</span>;
}

export function CampaignsTable({ campaigns, currency }: { campaigns: CampaignSummary[]; currency: string }) {
  if (campaigns.length === 0) {
    return <div className="px-5 py-10 text-center text-sm text-ink-soft">Нет кампаний за выбранный период</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-5 py-3 font-medium">Кампания</th>
            <th className="px-3 py-3 font-medium">Платформа</th>
            <th className="px-3 py-3 text-right font-medium">Расход</th>
            <th className="px-3 py-3 text-right font-medium">Показы</th>
            <th className="px-3 py-3 text-right font-medium">Клики</th>
            <th className="px-3 py-3 text-right font-medium">CTR</th>
            <th className="px-3 py-3 text-right font-medium">CPC</th>
            <th className="px-3 py-3 text-right font-medium">CPM</th>
            <th className="px-3 py-3 text-right font-medium">Лиды</th>
            <th className="px-3 py-3 text-right font-medium">CPL</th>
            <th className="px-3 py-3 text-right font-medium">Продажи</th>
            <th className="px-3 py-3 text-right font-medium">CPA</th>
            <th className="px-3 py-3 text-right font-medium">Выручка</th>
            <th className="px-5 py-3 text-right font-medium">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={`${c.campaign_name}-${c.platform}`} className="border-b border-border/70 last:border-0 hover:bg-surface-muted/60">
              <td className="max-w-[220px] truncate px-5 py-3 font-medium text-ink">{c.campaign_name}</td>
              <td className="px-3 py-3">
                <Badge tone={PLATFORM_TONE[c.platform] ?? "neutral"}>{c.platform}</Badge>
              </td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(c.spend, currency)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-muted">
                {formatNumber(c.impressions)}
              </td>
              <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-muted">
                {formatNumber(c.clicks)}
              </td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatPercent(c.ctr)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(c.cpc, currency)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(c.cpm, currency)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(c.leads)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(c.cpl, currency)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(c.sales)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(c.cpa, currency)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(c.revenue, currency)}</td>
              <td className="px-5 py-3 text-right">
                <RoasCell value={c.roas} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
