import { Event, EventType } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { formatDateFull } from "@/lib/format";
import { StickyNote } from "lucide-react";

const EVENT_LABEL: Record<EventType, { label: string; tone: "brand" | "positive" | "warning" | "danger" | "neutral" }> = {
  note: { label: "Заметка", tone: "neutral" },
  creative_change: { label: "Смена креатива", tone: "brand" },
  budget_change: { label: "Бюджет", tone: "warning" },
  launch: { label: "Запуск", tone: "positive" },
  issue: { label: "Проблема", tone: "danger" },
  optimization: { label: "Оптимизация", tone: "positive" },
};

export function NotesPanel({
  events,
  getProjectLabel,
}: {
  events: Event[];
  getProjectLabel?: (projectId: string) => string;
}) {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-ink-muted">
        <StickyNote size={16} className="text-ink-soft" />
        Заметок пока нет.
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <ul className="max-h-[420px] space-y-0 divide-y divide-border overflow-y-auto scrollbar-thin">
      {sorted.map((event, idx) => {
        const meta = EVENT_LABEL[event.event_type];
        return (
          <li key={idx} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <span className="text-xs text-ink-soft">{formatDateFull(event.date)}</span>
              {getProjectLabel && (
                <span className="text-xs text-ink-soft">· {getProjectLabel(event.project_id)}</span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-ink">{event.description}</p>
            <p className="mt-1 text-xs text-ink-soft">— {event.author}</p>
          </li>
        );
      })}
    </ul>
  );
}
