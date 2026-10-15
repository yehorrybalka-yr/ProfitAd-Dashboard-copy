import { cn } from "@/lib/utils";
import { getRNPStatusClass } from "@/lib/rnpStatus";

export function RNPStatusBadge({ status }: { status: string }) {
  if (!status || status === "—") {
    return (
      <span className="inline-flex w-max max-w-none shrink-0 whitespace-nowrap rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex w-max max-w-none shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium leading-none",
        getRNPStatusClass(status),
      )}
    >
      {status}
    </span>
  );
}
