import { NextResponse } from "next/server";
import { deleteTaskComment, updateTaskComment } from "@/lib/tasksStore";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as { body?: string };
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const comment = await updateTaskComment(params.id, text);
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    return NextResponse.json({ comment });
  } catch (error) {
    console.error("[tasks comments PATCH]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update comment",
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
    const removed = await deleteTaskComment(params.id);
    if (!removed) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tasks comments DELETE]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete comment",
      },
      { status: 500 },
    );
  }
}
