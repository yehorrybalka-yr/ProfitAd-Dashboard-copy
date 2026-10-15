/** Move item with `activeId` to the position of `overId` within a list. */
export function moveItemById<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
): T[] {
  if (activeId === overId) return items;
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const TASK_DRAG_PREFIX = "task:";
export const SUBTASK_DRAG_PREFIX = "subtask:";

export type DragKind = "task" | "subtask";

let activeDragKind: DragKind | null = null;

export function setActiveDragKind(kind: DragKind | null): void {
  activeDragKind = kind;
}

export function getActiveDragKind(): DragKind | null {
  return activeDragKind;
}

export function encodeDragId(prefix: string, id: string): string {
  return `${prefix}${id}`;
}

export function decodeDragId(
  value: string,
  prefix: string,
): string | null {
  if (!value.startsWith(prefix)) return null;
  const id = value.slice(prefix.length).trim();
  return id || null;
}
