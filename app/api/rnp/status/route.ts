import { NextResponse } from "next/server";
import {
  deleteProjectStatus,
  listStatusOverrides,
  upsertProjectStatus,
} from "@/lib/rnpStatusStore";
import { isKnownRnpStatus } from "@/lib/rnpStatus";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const overrides = await listStatusOverrides();
    return NextResponse.json({ overrides });
  } catch (error) {
    console.error("[rnp status GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load statuses",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      projectKey?: unknown;
      status?: unknown;
    };
    const projectKey =
      typeof body.projectKey === "string" ? body.projectKey.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";

    if (!projectKey || !status) {
      return NextResponse.json(
        { error: "projectKey and status are required" },
        { status: 400 },
      );
    }
    if (!isKnownRnpStatus(status)) {
      return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    }

    const saved = await upsertProjectStatus(projectKey, status);
    return NextResponse.json(saved);
  } catch (error) {
    console.error("[rnp status PUT]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save status",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const projectKey = url.searchParams.get("projectKey")?.trim() ?? "";
    if (!projectKey) {
      return NextResponse.json(
        { error: "projectKey is required" },
        { status: 400 },
      );
    }
    const removed = await deleteProjectStatus(projectKey);
    return NextResponse.json({ ok: removed });
  } catch (error) {
    console.error("[rnp status DELETE]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete status",
      },
      { status: 500 },
    );
  }
}
