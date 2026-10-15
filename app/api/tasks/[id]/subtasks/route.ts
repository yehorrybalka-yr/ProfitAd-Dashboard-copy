import { NextResponse } from "next/server";
import { addTaskSubtask } from "@/lib/tasksStore";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as { title?: string };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const subtask = await addTaskSubtask(params.id, title);
    return NextResponse.json({ subtask }, { status: 201 });
  } catch (error) {
    console.error("[tasks subtasks POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to add subtask",
      },
      { status: 500 },
    );
  }
}
