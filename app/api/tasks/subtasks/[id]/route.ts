import { NextResponse } from "next/server";
import { deleteTaskSubtask, updateTaskSubtask } from "@/lib/tasksStore";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as { title?: string; done?: boolean };
    const subtask = await updateTaskSubtask(params.id, {
      title: typeof body.title === "string" ? body.title : undefined,
      done: typeof body.done === "boolean" ? body.done : undefined,
    });
    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }
    return NextResponse.json({ subtask });
  } catch (error) {
    console.error("[tasks subtasks PATCH]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update subtask",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const removed = await deleteTaskSubtask(params.id);
    if (!removed) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tasks subtasks DELETE]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete subtask",
      },
      { status: 500 },
    );
  }
}
