"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useRNPOptional } from "@/components/rnp/RNPProvider";
import {
  buildProjectCardItems,
  resolveActiveCardId,
} from "@/lib/rnpGroups";
import { cn } from "@/lib/utils";

/** Горизонтальный список проектов на мобильных при просмотре деталей */
export function MobileProjectNav() {
  const pathname = usePathname();
  const rnp = useRNPOptional();

  const projectRouteId = pathname.match(/^\/projects\/([^/]+)$/)?.[1];
  const items = useMemo(
    () => (rnp ? buildProjectCardItems(rnp.projects) : []),
    [rnp],
  );

  const activeCardId = useMemo(() => {
    if (!projectRouteId || !rnp) return null;
    return resolveActiveCardId(rnp.projects, projectRouteId);
  }, [projectRouteId, rnp]);

  if (!projectRouteId || items.length === 0) return null;

  return (
    <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 lg:hidden">
      <div className="flex w-max gap-2 pb-1">
        {items.map((item) => {
          const isActive = item.id === activeCardId;
          return (
            <Link
              key={item.id}
              href={`/projects/${item.id}`}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "border-brand bg-brand-soft font-semibold text-brand"
                  : "border-border bg-surface text-ink-muted",
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
