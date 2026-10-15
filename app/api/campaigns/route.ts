import { NextResponse } from "next/server";
import { createCampaign, listCampaigns } from "@/lib/campaignsStore";
import type { CampaignPlatform, CreateCampaignInput } from "@/types/campaigns";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PLATFORMS = new Set<CampaignPlatform>(["google", "meta"]);

function parsePlatform(value: unknown): CampaignPlatform | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase() as CampaignPlatform;
  return PLATFORMS.has(normalized) ? normalized : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const campaigns = await listCampaigns({ projectId });
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("[campaigns GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load campaigns",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateCampaignInput>;
    const projectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const platform = parsePlatform(body.platform);

    if (!projectId || !title || !platform) {
      return NextResponse.json(
        { error: "projectId, title and platform are required" },
        { status: 400 },
      );
    }

    const input: CreateCampaignInput = {
      projectId,
      platform,
      title,
      subtitle:
        typeof body.subtitle === "string" ? body.subtitle.trim() : undefined,
    };

    const campaign = await createCampaign(input);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("[campaigns POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create campaign",
      },
      { status: 500 },
    );
  }
}
