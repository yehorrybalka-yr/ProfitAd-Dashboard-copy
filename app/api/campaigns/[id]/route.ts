import { NextResponse } from "next/server";
import { deleteCampaign, updateCampaign } from "@/lib/campaignsStore";
import type { CampaignPlatform, UpdateCampaignInput } from "@/types/campaigns";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PLATFORMS = new Set<CampaignPlatform>(["google", "meta"]);

function parsePlatform(value: unknown): CampaignPlatform | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase() as CampaignPlatform;
  return PLATFORMS.has(normalized) ? normalized : undefined;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as Partial<UpdateCampaignInput>;
    const patch: UpdateCampaignInput = {};

    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.subtitle === "string") patch.subtitle = body.subtitle.trim();

    const platform = parsePlatform(body.platform);
    if (platform) patch.platform = platform;

    const campaign = await updateCampaign(params.id, patch);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("[campaigns PATCH]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update campaign",
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
    const removed = await deleteCampaign(params.id);
    if (!removed) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[campaigns DELETE]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete campaign",
      },
      { status: 500 },
    );
  }
}
