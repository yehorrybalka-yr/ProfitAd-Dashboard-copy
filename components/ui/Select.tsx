import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { SelectHTMLAttributes } from "react";

interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  options,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[] }) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-9 w-full appearance-none rounded-lg border border-border bg-surface pl-3 pr-8 text-sm text-ink outline-none transition-colors hover:border-border-strong focus:border-brand"
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft"
      />
    </div>
  );
}
