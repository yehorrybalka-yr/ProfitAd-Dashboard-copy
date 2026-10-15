import { NextResponse } from "next/server";
import { reorderSubtasks } from "@/lib/tasksStore";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      taskId?: unknown;
      orderedIds?: unknown;
    };

    const taskId =
      typeof body.taskId === "string" ? body.taskId.trim() : "";
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.filter(
          (id): id is string => typeof id === "string" && id.trim().length > 0,
        )
      : [];

    if (!taskId || orderedIds.length === 0) {
      return NextResponse.json(
        { error: "taskId and orderedIds are required" },
        { status: 400 },
      );
    }

    const ok = await reorderSubtasks(taskId, orderedIds);
    if (!ok) {
      return NextResponse.json(
        { error: "Failed to reorder subtasks" },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tasks subtasks reorder POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reorder subtask",
      },
      { status: 500 },
    );
  }
}
