import { getSql } from "@/lib/db";
import { isKnownRnpStatus } from "@/lib/rnpStatus";

let schemaReady: Promise<void> | null = null;

export function ensureRnpStatusSchema(): Promise<void> {
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
    CREATE TABLE IF NOT EXISTS rnp_project_status_overrides (
      project_key TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/** Карта projectKey → status (project id или groupId). */
export async function listStatusOverrides(): Promise<Record<string, string>> {
  await ensureRnpStatusSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT project_key, status
    FROM rnp_project_status_overrides
  `) as { project_key: string; status: string }[];

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.project_key] = row.status;
  }
  return map;
}

export async function upsertProjectStatus(
  projectKey: string,
  status: string,
): Promise<{ projectKey: string; status: string }> {
  await ensureRnpStatusSchema();
  const key = projectKey.trim();
  const next = status.trim();
  if (!key) throw new Error("projectKey is required");
  if (!isKnownRnpStatus(next)) throw new Error("Unknown status");

  const sql = getSql();
  await sql`
    INSERT INTO rnp_project_status_overrides (project_key, status, updated_at)
    VALUES (${key}, ${next}, NOW())
    ON CONFLICT (project_key)
    DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
  `;

  return { projectKey: key, status: next };
}

export async function deleteProjectStatus(projectKey: string): Promise<boolean> {
  await ensureRnpStatusSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM rnp_project_status_overrides
    WHERE project_key = ${projectKey.trim()}
    RETURNING project_key
  `;
  return (rows as { project_key: string }[]).length > 0;
}
