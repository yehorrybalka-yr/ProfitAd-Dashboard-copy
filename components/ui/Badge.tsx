import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "positive" | "warning" | "danger" | "brand";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-ink-muted",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  brand: "bg-brand-soft text-brand-dark",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
