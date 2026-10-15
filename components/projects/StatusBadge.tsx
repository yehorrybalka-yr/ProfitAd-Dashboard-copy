import { ProjectStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";

const STATUS_META: Record<ProjectStatus, { label: string; tone: "positive" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Активен", tone: "positive" },
  at_risk: { label: "Требует внимания", tone: "danger" },
  paused: { label: "На паузе", tone: "warning" },
  completed: { label: "Завершён", tone: "neutral" },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
