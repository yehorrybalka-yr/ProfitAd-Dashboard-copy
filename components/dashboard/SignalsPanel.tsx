import { Signal } from "@/types";
import { AlertTriangle, OctagonAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SignalsPanel({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return (
      <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-ink-muted">
        <CheckCircle2 size={18} className="text-positive" />
        Проблемных зон не обнаружено — все метрики в норме.
      </div>
    );
  }

  return (
    <ul className="max-h-[420px] divide-y divide-border overflow-y-auto scrollbar-thin">
      {signals.map((signal) => (
        <li key={signal.id} className="flex gap-3 px-5 py-3.5">
          <div
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              signal.severity === "critical" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
            )}
          >
            {signal.severity === "critical" ? <OctagonAlert size={14} /> : <AlertTriangle size={14} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2">
              <p className="text-sm font-medium text-ink">{signal.title}</p>
              {signal.campaign_name && (
                <span className="truncate text-xs text-ink-soft">· {signal.campaign_name}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{signal.message}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
