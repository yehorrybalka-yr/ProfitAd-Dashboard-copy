import { KpiCard, KpiCardData } from "./KpiCard";
import { cn } from "@/lib/utils";

export function KpiGrid({
  items,
  variant = "summary",
}: {
  items: KpiCardData[];
  variant?: "summary" | "detail";
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        variant === "summary"
          ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
          : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {items.map((item) => (
        <KpiCard key={item.key} data={item} />
      ))}
    </div>
  );
}
