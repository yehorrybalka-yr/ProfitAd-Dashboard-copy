"use client";

import Link from "next/link";
import { Project, AggregatedMetrics } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency, formatNumber, formatRatioAsPercent } from "@/lib/format";
import { ChevronRight } from "lucide-react";

export interface ProjectRow {
  project: Project;
  metrics: AggregatedMetrics;
  signalCount: number;
}

function RoasCell({ value, target }: { value: number; target: number }) {
  const tone = value >= target ? "text-positive" : value >= target * 0.7 ? "text-warning" : "text-danger";
  return <span className={`font-mono font-medium tabular-nums ${tone}`}>{formatRatioAsPercent(value)}</span>;
}

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-5 py-3 font-medium">Проект</th>
            <th className="px-3 py-3 font-medium">Менеджер</th>
            <th className="px-3 py-3 font-medium">Статус</th>
            <th className="px-3 py-3 text-right font-medium">Расход (30д)</th>
            <th className="px-3 py-3 text-right font-medium">Лиды</th>
            <th className="px-3 py-3 text-right font-medium">CPL</th>
            <th className="px-3 py-3 text-right font-medium">ROAS</th>
            <th className="px-3 py-3 text-right font-medium">Сигналы</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ project, metrics, signalCount }) => (
            <tr key={project.project_id} className="border-b border-border/70 last:border-0 hover:bg-surface-muted/60">
              <td className="px-5 py-3.5">
                <p className="font-medium text-ink">{project.project_name}</p>
                <p className="text-xs text-ink-soft">{project.client_name}</p>
              </td>
              <td className="px-3 py-3.5 text-ink-muted">{project.manager}</td>
              <td className="px-3 py-3.5">
                <StatusBadge status={project.status} />
              </td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                {formatCurrency(metrics.spend, project.currency)}
              </td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">{formatNumber(metrics.leads)}</td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                {formatCurrency(metrics.cpl, project.currency)}
              </td>
              <td className="px-3 py-3.5 text-right">
                <RoasCell value={metrics.roas} target={project.target_roas} />
              </td>
              <td className="px-3 py-3.5 text-right">
                {signalCount > 0 ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-danger-soft px-1.5 text-xs font-medium text-danger">
                    {signalCount}
                  </span>
                ) : (
                  <span className="text-xs text-ink-soft">—</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-right">
                <Link
                  href={`/projects/${project.project_id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark"
                >
                  Открыть <ChevronRight size={13} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
