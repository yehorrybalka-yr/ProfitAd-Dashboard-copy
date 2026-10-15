"use client";

import { useEffect, useState, type DragEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  GripVertical,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { PrioritySelect } from "@/components/tasks/PrioritySelect";
import { SubtaskProgressRing } from "@/components/tasks/SubtaskProgressRing";
import {
  decodeDragId,
  encodeDragId,
  getActiveDragKind,
  moveItemById,
  setActiveDragKind,
  SUBTASK_DRAG_PREFIX,
  TASK_DRAG_PREFIX,
} from "@/lib/reorder";
import { cn } from "@/lib/utils";
import {
  formatTaskCompletedDay,
  formatTaskDeadline,
  isDeadlineOverdue,
} from "@/lib/taskLabels";
import type { Task, TaskComment, TaskPriority, TaskSubtask } from "@/types/tasks";

interface TaskItemProps {
  task: Task;
  showProject?: boolean;
  archived?: boolean;
  doneToday?: boolean;
  reorderEnabled?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onToggleDone: (task: Task) => void;
  onUpdate: (
    id: string,
    patch: Partial<{
      title: string;
      priority: TaskPriority;
      deadline: string | null;
    }>,
  ) => void;
  onDelete: (id: string) => void;
  onTaskDragStart?: (taskId: string) => void;
  onTaskDragOver?: (taskId: string) => void;
  onTaskDrop?: (draggedId: string, targetId: string) => void;
  onTaskDragEnd?: () => void;
}

function formatCommentTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskItem({
  task,
  showProject = false,
  archived = false,
  doneToday = false,
  reorderEnabled = false,
  isDragging = false,
  isDropTarget = false,
  onToggleDone,
  onUpdate,
  onDelete,
  onTaskDragStart,
  onTaskDragOver,
  onTaskDrop,
  onTaskDragEnd,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentEditDraft, setCommentEditDraft] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskEditDraft, setSubtaskEditDraft] = useState("");
  const [draggingSubtaskId, setDraggingSubtaskId] = useState<string | null>(null);
  const [dropSubtaskId, setDropSubtaskId] = useState<string | null>(null);
  const [subtaskProgress, setSubtaskProgress] = useState({
    done: task.subtaskDoneCount ?? 0,
    total: task.subtaskTotal ?? 0,
  });

  const overdue =
    !archived && !doneToday && task.status === "open" && isDeadlineOverdue(task.deadline);
  const isCompleted = archived || doneToday || task.status === "done";
  const canReorderTask =
    reorderEnabled && !archived && !doneToday && task.status === "open";

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    setSubtaskProgress({
      done: task.subtaskDoneCount ?? 0,
      total: task.subtaskTotal ?? 0,
    });
  }, [task.subtaskDoneCount, task.subtaskTotal]);

  useEffect(() => {
    if (!expanded) return;

    let cancelled = false;
    setDetailsLoading(true);

    void (async () => {
      try {
        const response = await fetch(`/api/tasks/${task.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { task: Task };
        if (cancelled) return;
        const nextSubtasks = payload.task.subtasks ?? [];
        setComments(payload.task.comments ?? []);
        setSubtasks(nextSubtasks);
        setSubtaskProgress({
          done: nextSubtasks.filter((item) => item.done).length,
          total: nextSubtasks.length,
        });
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expanded, task.id]);

  const syncSubtaskProgress = (next: TaskSubtask[]) => {
    setSubtaskProgress({
      done: next.filter((item) => item.done).length,
      total: next.length,
    });
  };

  const saveTitle = () => {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (next && next !== task.title) onUpdate(task.id, { title: next });
    else setTitleDraft(task.title);
  };

  const toggleExpanded = () => {
    setExpanded((value) => !value);
  };

  const addComment = async () => {
    const body = commentDraft.trim();
    if (!body) return;

    const response = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { comment: TaskComment };
    setComments((prev) => [...prev, payload.comment]);
    setCommentDraft("");
  };

  const saveComment = async (commentId: string) => {
    const body = commentEditDraft.trim();
    if (!body) return;

    const response = await fetch(`/api/tasks/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { comment: TaskComment };
    setComments((prev) =>
      prev.map((item) => (item.id === commentId ? payload.comment : item)),
    );
    setEditingCommentId(null);
    setCommentEditDraft("");
  };

  const removeComment = async (commentId: string) => {
    const response = await fetch(`/api/tasks/comments/${commentId}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    setComments((prev) => prev.filter((item) => item.id !== commentId));
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      setCommentEditDraft("");
    }
  };

  const addSubtask = async () => {
    const title = subtaskDraft.trim();
    if (!title) return;

    const response = await fetch(`/api/tasks/${task.id}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { subtask: TaskSubtask };
    setSubtasks((prev) => {
      const next = [...prev, payload.subtask];
      syncSubtaskProgress(next);
      return next;
    });
    setSubtaskDraft("");
  };

  const toggleSubtask = async (subtask: TaskSubtask) => {
    const response = await fetch(`/api/tasks/subtasks/${subtask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !subtask.done }),
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { subtask: TaskSubtask };
    setSubtasks((prev) => {
      const next = prev.map((item) =>
        item.id === subtask.id ? payload.subtask : item,
      );
      syncSubtaskProgress(next);
      return next;
    });
  };

  const saveSubtask = async (subtaskId: string) => {
    const title = subtaskEditDraft.trim();
    if (!title) return;

    const response = await fetch(`/api/tasks/subtasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { subtask: TaskSubtask };
    setSubtasks((prev) =>
      prev.map((item) => (item.id === subtaskId ? payload.subtask : item)),
    );
    setEditingSubtaskId(null);
    setSubtaskEditDraft("");
  };

  const removeSubtask = async (subtaskId: string) => {
    const response = await fetch(`/api/tasks/subtasks/${subtaskId}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    setSubtasks((prev) => {
      const next = prev.filter((item) => item.id !== subtaskId);
      syncSubtaskProgress(next);
      return next;
    });
    if (editingSubtaskId === subtaskId) {
      setEditingSubtaskId(null);
      setSubtaskEditDraft("");
    }
  };

  const persistSubtaskOrder = async (next: TaskSubtask[]) => {
    const response = await fetch("/api/tasks/subtasks/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        orderedIds: next.map((item) => item.id),
      }),
    });
    if (!response.ok) return false;
    return true;
  };

  const handleSubtaskDrop = async (targetId: string, event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = decodeDragId(
      event.dataTransfer.getData("text/plain"),
      SUBTASK_DRAG_PREFIX,
    );
    setActiveDragKind(null);
    setDropSubtaskId(null);
    setDraggingSubtaskId(null);
    if (!draggedId || draggedId === targetId) return;

    const previous = subtasks;
    const next = moveItemById(subtasks, draggedId, targetId);
    if (next === previous) return;
    setSubtasks(next);
    const ok = await persistSubtaskOrder(next);
    if (!ok) setSubtasks(previous);
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface transition-colors",
        expanded && "ring-1 ring-brand/20",
        doneToday && "opacity-80",
        isDragging && "opacity-50",
        isDropTarget && "ring-2 ring-brand/40",
      )}
      onDragOver={(event) => {
        if (!canReorderTask || getActiveDragKind() !== "task") return;
        event.preventDefault();
        onTaskDragOver?.(task.id);
      }}
      onDrop={(event) => {
        if (!canReorderTask) return;
        event.preventDefault();
        const draggedId = decodeDragId(
          event.dataTransfer.getData("text/plain"),
          TASK_DRAG_PREFIX,
        );
        setActiveDragKind(null);
        if (draggedId) onTaskDrop?.(draggedId, task.id);
        onTaskDragEnd?.();
      }}
    >
      <div className="group flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {canReorderTask && (
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(
                  "text/plain",
                  encodeDragId(TASK_DRAG_PREFIX, task.id),
                );
                setActiveDragKind("task");
                onTaskDragStart?.(task.id);
              }}
              onDragEnd={() => {
                setActiveDragKind(null);
                onTaskDragEnd?.();
              }}
              className="mt-0.5 inline-flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink active:cursor-grabbing"
              aria-label="Перетащить задачу"
              title="Перетащить"
            >
              <GripVertical size={16} />
            </button>
          )}

          <input
            type="checkbox"
            checked={isCompleted}
            onChange={(event) => {
              event.stopPropagation();
              onToggleDone(task);
            }}
            onClick={(event) => event.stopPropagation()}
            className="mt-1 h-4 w-4 shrink-0 rounded border-border text-brand focus:ring-brand"
            aria-label={isCompleted ? "Вернуть в активные" : "Отметить выполненной"}
          />

          <button
            type="button"
            onClick={toggleExpanded}
            className="min-w-0 flex-1 space-y-2 text-left"
          >
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={saveTitle}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") saveTitle();
                  if (event.key === "Escape") {
                    setTitleDraft(task.title);
                    setEditingTitle(false);
                  }
                }}
                className="w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm text-ink outline-none focus:border-brand"
              />
            ) : (
              <span
                className={cn(
                  "block text-sm font-medium leading-snug",
                  isCompleted ? "text-ink-muted line-through" : "text-ink",
                )}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setEditingTitle(true);
                }}
              >
                {task.title}
              </span>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {showProject && (
                <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                  {task.projectName}
                </span>
              )}
              <SubtaskProgressRing
                done={subtaskProgress.done}
                total={subtaskProgress.total}
              />
              {comments.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
                  <MessageSquare size={12} />
                  {comments.length} комм.
                </span>
              )}
              {archived && task.completedAt && (
                <span className="text-[11px] text-ink-soft">
                  Выполнено {formatTaskCompletedDay(task.completedAt)}
                </span>
              )}
              {doneToday && (
                <span className="text-[11px] text-ink-soft">Выполнено сегодня</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={toggleExpanded}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label={expanded ? "Свернуть задачу" : "Развернуть задачу"}
          >
            <ChevronDown
              size={16}
              className={cn("transition-transform", expanded && "rotate-180")}
            />
          </button>
        </div>

        <div
          className="flex flex-wrap items-center gap-2 sm:shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
          <PrioritySelect
            value={task.priority}
            onChange={(event) =>
              onUpdate(task.id, {
                priority: event.target.value as TaskPriority,
              })
            }
            className="w-[118px]"
            aria-label="Приоритет"
          />

          <label className="relative">
            <span className="sr-only">Дедлайн</span>
            <CalendarDays
              size={14}
              className={cn(
                "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2",
                overdue ? "text-danger" : "text-ink-soft",
              )}
            />
            <input
              type="date"
              value={task.deadline ?? ""}
              onChange={(event) =>
                onUpdate(task.id, {
                  deadline: event.target.value || null,
                })
              }
              className={cn(
                "h-9 rounded-lg border border-border bg-surface pl-8 pr-2 text-sm text-ink outline-none transition-colors hover:border-border-strong focus:border-brand",
                overdue && "border-danger/50 text-danger",
              )}
              title={
                task.deadline
                  ? `Дедлайн: ${formatTaskDeadline(task.deadline)}`
                  : "Без дедлайна"
              }
            />
          </label>

          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink-soft transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
            aria-label="Удалить задачу"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/70 px-4 py-4">
          {detailsLoading ? (
            <p className="text-sm text-ink-muted">Загрузка…</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Подзадачи
                </h4>
                <div className="space-y-2">
                  {subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border border-border/70 bg-surface-muted/30 px-3 py-2 transition-colors",
                        draggingSubtaskId === subtask.id && "opacity-50",
                        dropSubtaskId === subtask.id &&
                          draggingSubtaskId &&
                          draggingSubtaskId !== subtask.id &&
                          "border-brand/50 ring-1 ring-brand/30",
                      )}
                      onDragOver={(event) => {
                        if (getActiveDragKind() !== "subtask") return;
                        event.preventDefault();
                        event.stopPropagation();
                        setDropSubtaskId(subtask.id);
                      }}
                      onDragLeave={() => {
                        setDropSubtaskId((current) =>
                          current === subtask.id ? null : current,
                        );
                      }}
                      onDrop={(event) => void handleSubtaskDrop(subtask.id, event)}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "text/plain",
                            encodeDragId(SUBTASK_DRAG_PREFIX, subtask.id),
                          );
                          setActiveDragKind("subtask");
                          setDraggingSubtaskId(subtask.id);
                        }}
                        onDragEnd={() => {
                          setActiveDragKind(null);
                          setDraggingSubtaskId(null);
                          setDropSubtaskId(null);
                        }}
                        className="mt-0.5 inline-flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-ink-soft hover:bg-surface-muted hover:text-ink active:cursor-grabbing"
                        aria-label="Перетащить подзадачу"
                        title="Перетащить"
                      >
                        <GripVertical size={14} />
                      </button>
                      <input
                        type="checkbox"
                        checked={subtask.done}
                        onChange={() => void toggleSubtask(subtask)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-brand focus:ring-brand"
                      />
                      {editingSubtaskId === subtask.id ? (
                        <div className="flex min-w-0 flex-1 gap-1.5">
                          <input
                            autoFocus
                            value={subtaskEditDraft}
                            onChange={(event) =>
                              setSubtaskEditDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void saveSubtask(subtask.id);
                              }
                              if (event.key === "Escape") {
                                setEditingSubtaskId(null);
                                setSubtaskEditDraft("");
                              }
                            }}
                            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-ink outline-none focus:border-brand"
                          />
                          <button
                            type="button"
                            onClick={() => void saveSubtask(subtask.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-brand/10"
                            aria-label="Сохранить подзадачу"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubtaskId(null);
                              setSubtaskEditDraft("");
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-soft hover:bg-surface-muted"
                            aria-label="Отменить"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span
                            className={cn(
                              "min-w-0 flex-1 text-sm",
                              subtask.done
                                ? "text-ink-muted line-through"
                                : "text-ink",
                            )}
                          >
                            {subtask.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubtaskId(subtask.id);
                              setSubtaskEditDraft(subtask.title);
                            }}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-surface-muted hover:text-ink"
                            aria-label="Редактировать подзадачу"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeSubtask(subtask.id)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-danger/5 hover:text-danger"
                            aria-label="Удалить подзадачу"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {subtasks.length === 0 && (
                    <p className="text-sm text-ink-muted">Подзадач пока нет.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={subtaskDraft}
                    onChange={(event) => setSubtaskDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addSubtask();
                      }
                    }}
                    placeholder="Новая подзадача…"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => void addSubtask()}
                    disabled={!subtaskDraft.trim()}
                    className="rounded-lg bg-brand px-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Комментарии
                </h4>
                <div className="space-y-2">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-border/70 bg-surface-muted/30 px-3 py-2"
                    >
                      {editingCommentId === comment.id ? (
                        <div className="space-y-2">
                          <textarea
                            autoFocus
                            value={commentEditDraft}
                            onChange={(event) =>
                              setCommentEditDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void saveComment(comment.id);
                              }
                              if (event.key === "Escape") {
                                setEditingCommentId(null);
                                setCommentEditDraft("");
                              }
                            }}
                            rows={2}
                            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                          />
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => void saveComment(comment.id)}
                              disabled={!commentEditDraft.trim()}
                              className="inline-flex h-7 items-center gap-1 rounded-md bg-brand px-2.5 text-xs font-medium text-white disabled:opacity-50"
                            >
                              <Check size={13} />
                              Сохранить
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(null);
                                setCommentEditDraft("");
                              }}
                              className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs text-ink-muted hover:bg-surface-muted"
                            >
                              <X size={13} />
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink">{comment.body}</p>
                            <p className="mt-1 text-[11px] text-ink-soft">
                              {formatCommentTime(comment.createdAt)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setCommentEditDraft(comment.body);
                            }}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-surface-muted hover:text-ink"
                            aria-label="Редактировать комментарий"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeComment(comment.id)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-danger/5 hover:text-danger"
                            aria-label="Удалить комментарий"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-ink-muted">Комментариев пока нет.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addComment();
                      }
                    }}
                    placeholder="Новый комментарий…"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => void addComment()}
                    disabled={!commentDraft.trim()}
                    className="rounded-lg bg-brand px-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
