import { getSql } from "@/lib/db";
import type { RNPDataset } from "@/types/rnp";
import { countDefaultMonthProjects } from "@/lib/rnpQuality";

let schemaReady: Promise<void> | null = null;

export function ensureRnpSnapshotsSchema(): Promise<void> {
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
    CREATE TABLE IF NOT EXISTS rnp_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_hash TEXT NOT NULL,
      csv_byte_length INTEGER NOT NULL DEFAULT 0,
      quality_score INTEGER NOT NULL DEFAULT 0,
      project_count INTEGER NOT NULL DEFAULT 0,
      warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      dataset JSONB NOT NULL,
      accepted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_rnp_snapshots_accepted_created
    ON rnp_snapshots (accepted, created_at DESC)`;
}

interface SnapshotRow {
  id: string;
  content_hash: string;
  csv_byte_length: number;
  quality_score: number;
  project_count: number;
  warnings: string[] | string;
  dataset: RNPDataset | string;
  accepted: boolean;
  created_at: string;
}

function parseJson<T>(value: T | string): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value;
}

function mapDataset(row: SnapshotRow): RNPDataset {
  const dataset = parseJson<RNPDataset>(row.dataset);
  const warnings = parseJson<string[]>(row.warnings);
  return {
    ...dataset,
    fetchedAt: dataset.fetchedAt || row.created_at,
    health: {
      source: "neon",
      warnings,
      qualityScore: row.quality_score,
      accepted: row.accepted,
    },
  };
}

export async function getLatestGoodRnpSnapshot(): Promise<RNPDataset | null> {
  await ensureRnpSnapshotsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id, content_hash, csv_byte_length, quality_score, project_count,
      warnings, dataset, accepted, created_at
    FROM rnp_snapshots
    WHERE accepted = true
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = (rows as SnapshotRow[])[0];
  return row ? mapDataset(row) : null;
}

export async function getLatestAcceptedStats(): Promise<{
  projectCount: number;
  csvByteLength: number;
  contentHash: string;
} | null> {
  await ensureRnpSnapshotsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT csv_byte_length, project_count, content_hash
    FROM rnp_snapshots
    WHERE accepted = true
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = (rows as {
    csv_byte_length: number;
    project_count: number;
    content_hash: string;
  }[])[0];
  if (!row) return null;
  return {
    csvByteLength: Number(row.csv_byte_length),
    projectCount: Number(row.project_count),
    contentHash: row.content_hash,
  };
}

export async function saveRnpSnapshot(input: {
  dataset: RNPDataset;
  warnings: string[];
  qualityScore: number;
  accepted: boolean;
}): Promise<void> {
  await ensureRnpSnapshotsSchema();
  const sql = getSql();
  const projectCount = countDefaultMonthProjects(input.dataset);
  await sql`
    INSERT INTO rnp_snapshots (
      content_hash, csv_byte_length, quality_score, project_count,
      warnings, dataset, accepted
    )
    VALUES (
      ${input.dataset.contentHash},
      ${input.dataset.csvByteLength},
      ${input.qualityScore},
      ${projectCount},
      ${JSON.stringify(input.warnings)}::jsonb,
      ${JSON.stringify(input.dataset)}::jsonb,
      ${input.accepted}
    )
  `;
}
