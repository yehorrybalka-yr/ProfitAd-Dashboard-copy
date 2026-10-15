"use client";

import { AlertTriangle } from "lucide-react";
import { useRNPOptional } from "@/components/rnp/RNPProvider";

export function RNPHealthBanner() {
  const rnp = useRNPOptional();
  const warnings = rnp?.dataset.health?.warnings?.filter(Boolean) ?? [];
  if (warnings.length === 0) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-50 px-4 py-2 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 sm:px-6">
      <div className="mx-auto flex max-w-[1400px] items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Проверка снимка РНП</p>
          <ul className="mt-0.5 list-disc pl-4">
            {warnings.slice(0, 4).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
