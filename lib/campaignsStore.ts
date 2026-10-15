import { getSql } from "@/lib/db";
import type {
  CampaignListFilters,
  CampaignPlatform,
  CreateCampaignInput,
  RunningCampaign,
  UpdateCampaignInput,
} from "@/types/campaigns";

let schemaReady: Promise<void> | null = null;

export function ensureCampaignsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = initSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function initSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS running_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_running_campaigns_project ON running_campaigns (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_running_campaigns_platform ON running_campaigns (platform)`;
}

interface CampaignRow {
  id: string;
  project_id: string;
  platform: string;
  title: string;
  subtitle: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: CampaignRow): RunningCampaign {
  return {
    id: row.id,
    projectId: row.project_id,
    platform: row.platform as CampaignPlatform,
    title: row.title,
    subtitle: row.subtitle,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PLATFORMS = new Set<CampaignPlatform>(["google", "meta"]);

function parsePlatform(value: unknown): CampaignPlatform | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase() as CampaignPlatform;
  return PLATFORMS.has(normalized) ? normalized : undefined;
}

export async function listCampaigns(
  filters: CampaignListFilters = {},
): Promise<RunningCampaign[]> {
  await ensureCampaignsSchema();
  const sql = getSql();
  const projectId = filters.projectId ?? null;

  const rows = await sql`
    SELECT id, project_id, platform, title, subtitle, created_at, updated_at
    FROM running_campaigns
    WHERE (${projectId}::text IS NULL OR project_id = ${projectId})
    ORDER BY platform ASC, created_at ASC
  `;

  return (rows as CampaignRow[]).map(mapRow);
}

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<RunningCampaign> {
  await ensureCampaignsSchema();
  const sql = getSql();
  const title = input.title.trim();
  if (!title) throw new Error("Campaign title is required");
  if (!input.projectId.trim()) throw new Error("projectId is required");

  const platform = parsePlatform(input.platform);
  if (!platform) throw new Error("Invalid platform");

  const rows = await sql`
    INSERT INTO running_campaigns (project_id, platform, title, subtitle)
    VALUES (
      ${input.projectId.trim()},
      ${platform},
      ${title},
      ${(input.subtitle ?? "").trim()}
    )
    RETURNING id, project_id, platform, title, subtitle, created_at, updated_at
  `;

  return mapRow((rows as CampaignRow[])[0]);
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
): Promise<RunningCampaign | null> {
  await ensureCampaignsSchema();
  const sql = getSql();

  const existingRows = await sql`
    SELECT id, project_id, platform, title, subtitle, created_at, updated_at
    FROM running_campaigns
    WHERE id = ${id}
    LIMIT 1
  `;
  const existing = (existingRows as CampaignRow[])[0];
  if (!existing) return null;

  const nextPlatform = input.platform
    ? parsePlatform(input.platform) ?? (existing.platform as CampaignPlatform)
    : (existing.platform as CampaignPlatform);

  const rows = await sql`
    UPDATE running_campaigns
    SET
      title = ${input.title?.trim() || existing.title},
      subtitle = ${input.subtitle !== undefined ? input.subtitle.trim() : existing.subtitle},
      platform = ${nextPlatform},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, project_id, platform, title, subtitle, created_at, updated_at
  `;

  return mapRow((rows as CampaignRow[])[0]);
}

export async function deleteCampaign(id: string): Promise<boolean> {
  await ensureCampaignsSchema();
  const sql = getSql();
  const rows = await sql`DELETE FROM running_campaigns WHERE id = ${id} RETURNING id`;
  return (rows as { id: string }[]).length > 0;
}
