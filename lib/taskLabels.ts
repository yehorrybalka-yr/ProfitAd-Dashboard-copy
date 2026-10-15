import type { TaskPriority } from "@/types/tasks";

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function getTaskPriorityClass(priority: TaskPriority): string {
  switch (priority) {
    case "high":
      return "bg-red-600 text-white";
    case "medium":
      return "bg-amber-400 text-amber-950";
    case "low":
      return "bg-emerald-500 text-white";
    default:
      return "bg-surface-muted text-ink-muted";
  }
}

export function getTaskPrioritySelectClass(priority: TaskPriority): string {
  switch (priority) {
    case "high":
      return "bg-red-600 text-white hover:bg-red-700";
    case "medium":
      return "bg-amber-400 text-amber-950 hover:bg-amber-500";
    case "low":
      return "bg-emerald-500 text-white hover:bg-emerald-600";
    default:
      return "bg-surface-muted text-ink-muted";
  }
}

export function formatTaskDeadline(deadline: string | null): string {
  if (!deadline) return "—";
  const date = new Date(`${deadline}T12:00:00`);
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTaskCompletedDay(iso: string | null): string {
  if (!iso) return "Без даты";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function isDeadlineOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${deadline}T12:00:00`);
  return due.getTime() < today.getTime();
}

export function buildBranchLabel(branch: string | null): string | null {
  if (!branch) return null;
  return branch;
}
