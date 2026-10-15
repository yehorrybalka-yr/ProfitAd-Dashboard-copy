import { NextResponse } from "next/server";
import { reorderTasks } from "@/lib/tasksStore";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { orderedIds?: unknown };
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.filter(
          (id): id is string => typeof id === "string" && id.trim().length > 0,
        )
      : [];

    if (orderedIds.length === 0) {
      return NextResponse.json(
        { error: "orderedIds is required" },
        { status: 400 },
      );
    }

    const ok = await reorderTasks(orderedIds);
    if (!ok) {
      return NextResponse.json(
        { error: "Failed to reorder tasks" },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tasks reorder POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reorder task",
      },
      { status: 500 },
    );
  }
}
