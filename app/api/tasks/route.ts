import { NextResponse } from "next/server";
import { createTask, getLocalTodayKey, listTasks } from "@/lib/tasksStore";
import type { CreateTaskInput, TaskPriority } from "@/types/tasks";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PRIORITIES = new Set<TaskPriority>(["high", "medium", "low"]);

function parsePriority(value: unknown): TaskPriority | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase() as TaskPriority;
  return PRIORITIES.has(normalized) ? normalized : undefined;
}

/** Список задач и создание новой */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const archived = url.searchParams.get("archived") === "1";
    const today = url.searchParams.get("today") ?? getLocalTodayKey();
    const completedDate = url.searchParams.get("completedDate") ?? undefined;
    const deadlineDate = url.searchParams.get("deadlineDate") ?? undefined;

    const tasks = await listTasks({
      projectId,
      view: archived ? "archive" : "active",
      today,
      completedDate,
      deadlineDate,
    });
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("[tasks GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load tasks" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateTaskInput>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const projectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";
    const projectName =
      typeof body.projectName === "string" ? body.projectName.trim() : "";

    if (!title || !projectId || !projectName) {
      return NextResponse.json(
        { error: "title, projectId and projectName are required" },
        { status: 400 },
      );
    }

    const input: CreateTaskInput = {
      title,
      projectId,
      projectName,
      priority: parsePriority(body.priority) ?? "medium",
      deadline:
        typeof body.deadline === "string" && body.deadline.trim()
          ? body.deadline.trim()
          : null,
    };

    const task = await createTask(input);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("[tasks POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create task" },
      { status: 500 },
    );
  }
}
