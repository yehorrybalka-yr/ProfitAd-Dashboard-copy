"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type {
  CreateTaskInput,
  Task,
  TaskPriority,
  UpdateTaskInput,
} from "@/types/tasks";

interface TaskScope {
  projectId?: string;
}

export interface TaskArchiveFilters {
  completedDate?: string;
  deadlineDate?: string;
}

interface TaskContextValue {
  tasks: Task[];
  archivedTasks: Task[];
  loading: boolean;
  error: string | null;
  refresh: (scope?: TaskScope, archiveFilters?: TaskArchiveFilters) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task | null>;
  updateTask: (id: string, patch: UpdateTaskInput) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  reorderTasks: (orderedIds: string[]) => Promise<boolean>;
  toggleDone: (task: Task) => Promise<Task | null>;
}

const TaskContext = createContext<TaskContextValue | null>(null);

function getLocalTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

function buildQuery(
  scope: TaskScope | undefined,
  archived: boolean,
  archiveFilters: TaskArchiveFilters = {},
): string {
  const params = new URLSearchParams();
  params.set("today", getLocalTodayKey());
  if (archived) params.set("archived", "1");
  if (scope?.projectId) params.set("projectId", scope.projectId);
  if (archiveFilters.completedDate) {
    params.set("completedDate", archiveFilters.completedDate);
  }
  if (archiveFilters.deadlineDate) {
    params.set("deadlineDate", archiveFilters.deadlineDate);
  }
  return `?${params.toString()}`;
}

async function fetchTasks(
  scope: TaskScope | undefined,
  archived: boolean,
  archiveFilters: TaskArchiveFilters = {},
) {
  const response = await fetch(
    `/api/tasks${buildQuery(scope, archived, archiveFilters)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Failed to load tasks");
  }
  const payload = (await response.json()) as { tasks: Task[] };
  return payload.tasks;
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (scope?: TaskScope, archiveFilters?: TaskArchiveFilters) => {
      setLoading(true);
      setError(null);
      try {
        const [active, archived] = await Promise.all([
          fetchTasks(scope, false),
          fetchTasks(scope, true, archiveFilters),
        ]);
        setTasks(active);
        setArchivedTasks(archived);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tasks");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createTask = useCallback(async (input: CreateTaskInput) => {
    setError(null);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to create task");
      return null;
    }
    const payload = (await response.json()) as { task: Task };
    return payload.task;
  }, []);

  const updateTask = useCallback(async (id: string, patch: UpdateTaskInput) => {
    setError(null);
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to update task");
      return null;
    }
    const payload = (await response.json()) as { task: Task };
    return payload.task;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setError(null);
    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to delete task");
      return false;
    }
    return true;
  }, []);

  const reorderTasks = useCallback(async (orderedIds: string[]) => {
    setError(null);
    const response = await fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to reorder tasks");
      return false;
    }
    return true;
  }, []);

  const toggleDone = useCallback(
    async (task: Task) => {
      return updateTask(task.id, {
        status: task.status === "open" ? "done" : "open",
      });
    },
    [updateTask],
  );

  const value = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTasks must be used within TaskProvider");
  }
  return context;
}

export type { TaskPriority, TaskScope };
