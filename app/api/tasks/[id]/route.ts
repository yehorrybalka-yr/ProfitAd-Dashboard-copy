import { NextResponse } from "next/server";
import { deleteTask, getTaskWithDetails, updateTask } from "@/lib/tasksStore";
import type { TaskPriority, TaskStatus, UpdateTaskInput } from "@/types/tasks";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PRIORITIES = new Set<TaskPriority>(["high", "medium", "low"]);
const STATUSES = new Set<TaskStatus>(["open", "done"]);

function parsePriority(value: unknown): TaskPriority | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase() as TaskPriority;
  return PRIORITIES.has(normalized) ? normalized : undefined;
}

function parseStatus(value: unknown): TaskStatus | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase() as TaskStatus;
  return STATUSES.has(normalized) ? normalized : undefined;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const task = await getTaskWithDetails(params.id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error) {
    console.error("[tasks GET id]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load task" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as Partial<UpdateTaskInput>;
    const patch: UpdateTaskInput = {};

    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.projectId === "string") patch.projectId = body.projectId.trim();
    if (typeof body.projectName === "string") {
      patch.projectName = body.projectName.trim();
    }
    if (body.deadline !== undefined) {
      patch.deadline =
        typeof body.deadline === "string" && body.deadline.trim()
          ? body.deadline.trim()
          : null;
    }

    const priority = parsePriority(body.priority);
    if (priority) patch.priority = priority;

    const status = parseStatus(body.status);
    if (status) patch.status = status;

    const task = await updateTask(params.id, patch);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("[tasks PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update task" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const removed = await deleteTask(params.id);
    if (!removed) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tasks DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete task" },
      { status: 500 },
    );
  }
}
