import { NextResponse } from "next/server";
import { addTaskComment } from "@/lib/tasksStore";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as { body?: string };
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const comment = await addTaskComment(params.id, text);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("[tasks comments POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to add comment",
      },
      { status: 500 },
    );
  }
}
