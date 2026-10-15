import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { SelectHTMLAttributes } from "react";
import {
  TASK_PRIORITY_OPTIONS,
  getTaskPriorityClass,
  getTaskPrioritySelectClass,
} from "@/lib/taskLabels";
import type { TaskPriority } from "@/types/tasks";

interface SelectOption {
  value: string;
  label: string;
}

export function PrioritySelect({
  value,
  className,
  onChange,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "value"> & {
  value: TaskPriority;
  options?: SelectOption[];
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={onChange}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-transparent pl-3 pr-8 text-sm font-semibold outline-none transition-colors focus:ring-2 focus:ring-brand/30",
          getTaskPrioritySelectClass(value),
        )}
        {...props}
      >
        {TASK_PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 opacity-80"
      />
    </div>
  );
}

export function PrioritySelectForm({
  value,
  className,
  onChange,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "value"> & {
  value: TaskPriority;
}) {
  return (
    <PrioritySelect
      value={value}
      onChange={onChange}
      className={className}
      aria-label="Приоритет"
      {...props}
    />
  );
}

/** @deprecated use getTaskPrioritySelectClass */
export { getTaskPriorityClass };
