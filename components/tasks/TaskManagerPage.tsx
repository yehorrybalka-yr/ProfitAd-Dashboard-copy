"use client";

import { useMemo } from "react";
import { TaskManagerPanel } from "@/components/tasks/TaskManagerPanel";
import { useRNP } from "@/components/rnp/RNPProvider";
import { PageStack } from "@/components/layout/PageToolbar";
import { buildTaskProjectOptions } from "@/lib/taskProjects";

export function TaskManagerPage() {
  const { projects } = useRNP();

  const projectOptions = useMemo(
    () => buildTaskProjectOptions(projects),
    [projects],
  );

  return (
    <PageStack>
      <TaskManagerPanel
        title="Task Manager"
        subtitle="Задачи привязаны к проектам. Выполненные сегодня остаются внизу списка; в архив попадают на следующий день."
        projectOptions={projectOptions}
      />
    </PageStack>
  );
}
