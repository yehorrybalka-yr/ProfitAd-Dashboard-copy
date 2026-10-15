"use client";

import { RNPProvider } from "@/components/rnp/RNPProvider";
import { TaskProvider } from "@/components/tasks/TaskProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import type { RNPDataset } from "@/types/rnp";

export function AppProviders({
  dataset,
  children,
}: {
  dataset: RNPDataset;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <RNPProvider dataset={dataset}>
        <TaskProvider>{children}</TaskProvider>
      </RNPProvider>
    </ThemeProvider>
  );
}
