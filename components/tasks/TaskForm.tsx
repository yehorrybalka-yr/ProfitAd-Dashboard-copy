"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PrioritySelectForm } from "@/components/tasks/PrioritySelect";
import { Select } from "@/components/ui/Select";
import type { CreateTaskInput, TaskPriority } from "@/types/tasks";

interface TaskFormProps {
  projectOptions: { value: string; label: string }[];
  defaultProjectId?: string;
  defaultProjectName?: string;
  lockProject?: boolean;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
}

export function TaskForm({
  projectOptions,
  defaultProjectId,
  defaultProjectName,
  lockProject = false,
  onSubmit,
}: TaskFormProps) {
  const initialProjectId = defaultProjectId ?? projectOptions[0]?.value ?? "";
  const initialProjectName =
    defaultProjectName ??
    projectOptions.find((option) => option.value === initialProjectId)?.label ??
    "";

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(initialProjectId);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedProjectName = useMemo(() => {
    if (lockProject && defaultProjectName) return defaultProjectName;
    return (
      projectOptions.find((option) => option.value === projectId)?.label ?? ""
    );
  }, [defaultProjectName, lockProject, projectId, projectOptions]);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || !projectId || !selectedProjectName || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: trimmed,
        projectId,
        projectName: selectedProjectName,
        priority,
        deadline: deadline || null,
      });
      setTitle("");
      setDeadline("");
      setPriority("medium");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="grid gap-3 rounded-xl border border-dashed border-border bg-surface-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]"
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Новая задача…"
        className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-brand sm:col-span-2 lg:col-span-1"
      />

      {!lockProject && (
        <Select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          options={projectOptions}
        />
      )}

      <PrioritySelectForm
        value={priority}
        onChange={(event) => setPriority(event.target.value as TaskPriority)}
      />

      <input
        type="date"
        value={deadline}
        onChange={(event) => setDeadline(event.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
        aria-label="Дедлайн"
      />

      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:col-span-1"
      >
        <Plus size={16} />
        Добавить
      </button>
    </form>
  );
}
