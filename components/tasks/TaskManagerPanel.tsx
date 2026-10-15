"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ListTodo, X } from "lucide-react";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskItem } from "@/components/tasks/TaskItem";
import {
  useTasks,
  type TaskArchiveFilters,
  type TaskScope,
} from "@/components/tasks/TaskProvider";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { formatTaskCompletedDay } from "@/lib/taskLabels";
import { moveItemById } from "@/lib/reorder";
import { cn } from "@/lib/utils";
import type { CreateTaskInput, Task, TaskPriority } from "@/types/tasks";

interface TaskManagerPanelProps {
  scope?: TaskScope & {
    projectName?: string;
  };
  projectOptions?: { value: string; label: string }[];
  title?: string;
  subtitle?: string;
  embedded?: boolean;
}

function formatArchiveFilterDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ArchiveDateFilter({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasValue = Boolean(value);

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface transition-colors",
        hasValue ? "border-brand/30 bg-brand/5" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{label}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {hasValue ? formatArchiveFilterDate(value) : hint}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-ink-soft transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          <input
            type="date"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
            aria-label={label}
          />
          {hasValue && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <X size={12} />
              Сбросить фильтр
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function groupArchivedTasks(tasks: Task[]): { day: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const day = formatTaskCompletedDay(task.completedAt);
    const bucket = groups.get(day) ?? [];
    bucket.push(task);
    groups.set(day, bucket);
  }
  return Array.from(groups.entries()).map(([day, dayTasks]) => ({
    day,
    tasks: dayTasks,
  }));
}

export function TaskManagerPanel({
  scope,
  projectOptions = [],
  title = "Task Manager",
  subtitle,
  embedded = false,
}: TaskManagerPanelProps) {
  const {
    tasks,
    archivedTasks,
    loading,
    error,
    refresh,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    toggleDone,
  } = useTasks();

  const [view, setView] = useState<"active" | "archive">("active");
  const [projectFilter, setProjectFilter] = useState("all");
  const [completedDateFilter, setCompletedDateFilter] = useState("");
  const [deadlineDateFilter, setDeadlineDateFilter] = useState("");
  const [orderedOpenTasks, setOrderedOpenTasks] = useState<Task[]>([]);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState<string | null>(null);

  const fetchScope = useMemo(() => {
    if (scope?.projectId) {
      return { projectId: scope.projectId } satisfies TaskScope;
    }
    if (projectFilter !== "all") {
      return { projectId: projectFilter } satisfies TaskScope;
    }
    return undefined;
  }, [scope, projectFilter]);

  const archiveFilters = useMemo(
    (): TaskArchiveFilters => ({
      completedDate: completedDateFilter || undefined,
      deadlineDate: deadlineDateFilter || undefined,
    }),
    [completedDateFilter, deadlineDateFilter],
  );

  useEffect(() => {
    void refresh(fetchScope, archiveFilters);
  }, [fetchScope, archiveFilters, refresh]);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status === "open"),
    [tasks],
  );
  const doneTodayTasks = useMemo(
    () => tasks.filter((task) => task.status === "done"),
    [tasks],
  );

  useEffect(() => {
    setOrderedOpenTasks(openTasks);
  }, [openTasks]);

  const archivedGroups = useMemo(
    () => groupArchivedTasks(archivedTasks),
    [archivedTasks],
  );

  const filterOptions = useMemo(
    () => [{ value: "all", label: "Все проекты" }, ...projectOptions],
    [projectOptions],
  );

  const handleCreate = async (input: CreateTaskInput) => {
    await createTask(input);
    await refresh(fetchScope, archiveFilters);
  };

  const handleUpdate = async (
    id: string,
    patch: Partial<{
      title: string;
      priority: TaskPriority;
      deadline: string | null;
    }>,
  ) => {
    await updateTask(id, patch);
    await refresh(fetchScope, archiveFilters);
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
    await refresh(fetchScope, archiveFilters);
  };

  const handleToggle = async (task: Task) => {
    await toggleDone(task);
    await refresh(fetchScope, archiveFilters);
  };

  const handleTaskDrop = async (draggedId: string, targetId: string) => {
    const previous = orderedOpenTasks;
    const next = moveItemById(orderedOpenTasks, draggedId, targetId);
    if (next === previous) {
      setDraggingTaskId(null);
      setDropTargetTaskId(null);
      return;
    }
    setOrderedOpenTasks(next);
    setDraggingTaskId(null);
    setDropTargetTaskId(null);
    const ok = await reorderTasks(next.map((task) => task.id));
    if (!ok) {
      setOrderedOpenTasks(previous);
      return;
    }
    await refresh(fetchScope, archiveFilters);
  };

  const showProjectFilter = !scope?.projectId && projectOptions.length > 0;

  const content = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="inline-flex w-fit rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setView("active")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "active"
                ? "bg-brand/10 text-brand"
                : "text-ink-muted hover:text-ink",
            )}
          >
            <ListTodo size={15} />
            Активные
          </button>
          <button
            type="button"
            onClick={() => setView("archive")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "archive"
                ? "bg-brand/10 text-brand"
                : "text-ink-muted hover:text-ink",
            )}
          >
            <Archive size={15} />
            Архив
          </button>
        </div>

        {view === "archive" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {showProjectFilter && (
              <Select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                options={filterOptions}
                aria-label="Фильтр по проекту"
              />
            )}
            <ArchiveDateFilter
              label="Дата выполнения"
              hint="Когда задача была завершена"
              value={completedDateFilter}
              onChange={setCompletedDateFilter}
            />
            <ArchiveDateFilter
              label="Дата дедлайна"
              hint="Когда была запланирована задача"
              value={deadlineDateFilter}
              onChange={setDeadlineDateFilter}
            />
          </div>
        )}

        {view === "active" && showProjectFilter && (
          <Select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            options={filterOptions}
            className="w-full sm:w-56"
            aria-label="Фильтр по проекту"
          />
        )}
      </div>

      {view === "active" && (
        <TaskForm
          projectOptions={projectOptions}
          defaultProjectId={scope?.projectId}
          defaultProjectName={scope?.projectName}
          lockProject={Boolean(scope?.projectId)}
          onSubmit={handleCreate}
        />
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading && tasks.length === 0 && archivedTasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">Загрузка задач…</p>
      ) : view === "archive" ? (
        archivedTasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Архив пока пуст.</p>
        ) : (
          <div className="space-y-5">
            {archivedGroups.map((group) => (
              <section key={group.day} className="space-y-2">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {group.day}
                </h3>
                <div className="space-y-2">
                  {group.tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      archived
                      showProject={!scope?.projectId}
                      onToggleDone={(item) => void handleToggle(item)}
                      onUpdate={(id, patch) => void handleUpdate(id, patch)}
                      onDelete={(id) => void handleDelete(id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : orderedOpenTasks.length === 0 && doneTodayTasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Нет активных задач. Добавьте первую выше.
        </p>
      ) : (
        <div className="space-y-2">
          {orderedOpenTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              showProject={!scope?.projectId}
              reorderEnabled
              isDragging={draggingTaskId === task.id}
              isDropTarget={
                dropTargetTaskId === task.id &&
                Boolean(draggingTaskId) &&
                draggingTaskId !== task.id
              }
              onToggleDone={(item) => void handleToggle(item)}
              onUpdate={(id, patch) => void handleUpdate(id, patch)}
              onDelete={(id) => void handleDelete(id)}
              onTaskDragStart={setDraggingTaskId}
              onTaskDragOver={setDropTargetTaskId}
              onTaskDrop={(draggedId, targetId) =>
                void handleTaskDrop(draggedId, targetId)
              }
              onTaskDragEnd={() => {
                setDraggingTaskId(null);
                setDropTargetTaskId(null);
              }}
            />
          ))}

          {doneTodayTasks.length > 0 && (
            <>
              {orderedOpenTasks.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                    Выполнено сегодня
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              {doneTodayTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  doneToday
                  showProject={!scope?.projectId}
                  onToggleDone={(item) => void handleToggle(item)}
                  onUpdate={(id, patch) => void handleUpdate(id, patch)}
                  onDelete={(id) => void handleDelete(id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody className="pt-0">{content}</CardBody>
    </Card>
  );
}
