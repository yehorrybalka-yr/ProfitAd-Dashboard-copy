import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS, getTaskPriorityClass } from "@/lib/taskLabels";
import type { TaskPriority } from "@/types/tasks";

export function TaskPriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        getTaskPriorityClass(priority),
        className,
      )}
    >
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}
