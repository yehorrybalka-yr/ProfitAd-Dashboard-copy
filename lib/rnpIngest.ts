import { unstable_noStore as noStore } from "next/cache";
import { RNP_SHARED_SHEET_ENABLED } from "@/lib/rnpConfig";
import {
  fetchFreshCsvText,
  fetchStickyCsvText,
} from "@/lib/rnpCsvCache";
import { applyStatusOverrides } from "@/lib/rnpApplyStatusOverrides";
import { mergeRnpDatasets } from "@/lib/rnpMerge";
import { RNP_PROJECT_SOURCES } from "@/lib/rnpProjectSources";
import {
  mergeProjectTabResults,
  parseProjectSheetTab,
} from "@/lib/rnpProjectSheetParser";
import { assessRnpQuality } from "@/lib/rnpQuality";
import {
  getLatestAcceptedStats,
  getLatestGoodRnpSnapshot,
  saveRnpSnapshot,
} from "@/lib/rnpSnapshots";
import { listStatusOverrides } from "@/lib/rnpStatusStore";
import type { RNPDataset } from "@/types/rnp";

export interface RnpIngestResult {
  accepted: boolean;
  reason: string;
  dataset: RNPDataset;
}

function emptyDataset(): RNPDataset {
  return {
    months: [],
    defaultMonthKey: "",
    projectsByMonth: {},
    contentHash: "empty",
    csvByteLength: 0,
    fetchedAt: new Date().toISOString(),
    health: {
      source: "live",
      warnings: [],
      qualityScore: 0,
      accepted: false,
    },
  };
}

function attachLiveHealth(
  dataset: RNPDataset,
  warnings: string[],
  qualityScore: number,
  accepted: boolean,
): RNPDataset {
  return {
    ...dataset,
    health: {
      source: "live",
      warnings,
      qualityScore,
      accepted,
    },
  };
}

async function withManualStatuses(dataset: RNPDataset): Promise<RNPDataset> {
  try {
    const overrides = await listStatusOverrides();
    return applyStatusOverrides(dataset, overrides);
  } catch (error) {
    console.warn("[rnpIngest] status overrides unavailable:", error);
    return dataset;
  }
}

async function loadProjectDatasets(options?: {
  force?: boolean;
}): Promise<{ datasets: RNPDataset[]; csvByteLength: number }> {
  const datasets: RNPDataset[] = [];
  let csvByteLength = 0;

  for (const source of RNP_PROJECT_SOURCES) {
    try {
      const tabResults = [];

      for (const branch of source.branches) {
        const csvText = options?.force
          ? await fetchFreshCsvText(branch.csvUrl, null)
          : await fetchStickyCsvText(branch.csvUrl);

        if (!csvText) {
          tabResults.push(
            parseProjectSheetTab("", source, branch.variant),
          );
          continue;
        }

        csvByteLength += csvText.length;
        tabResults.push(
          parseProjectSheetTab(csvText, source, branch.variant),
        );
      }

      datasets.push(mergeProjectTabResults(source, tabResults));
    } catch (error) {
      console.warn(`[rnpIngest] project sheet ${source.id} failed:`, error);
      datasets.push({
        months: [],
        defaultMonthKey: "",
        projectsByMonth: {},
        contentHash: `error:${source.id}`,
        csvByteLength: 0,
        fetchedAt: new Date().toISOString(),
        health: {
          source: "live",
          warnings: [
            `${source.name}: ошибка загрузки (${
              error instanceof Error ? error.message : "unknown"
            })`,
          ],
          qualityScore: 0,
          accepted: false,
        },
      });
    }
  }

  // #region agent log
  fetch("http://127.0.0.1:7911/ingest/fdc3da9c-6ab8-4412-8cbf-0bd39ffd13d8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "97ccd5",
    },
    body: JSON.stringify({
      sessionId: "97ccd5",
      runId: "ingest",
      hypothesisId: "H-ingest-branches",
      location: "rnpIngest.ts:loadProjectDatasets",
      message: "project datasets loaded",
      data: {
        sharedEnabled: RNP_SHARED_SHEET_ENABLED,
        projectCount: datasets.length,
        defaultMonthProjects: datasets.flatMap(
          (ds) => ds.projectsByMonth[ds.defaultMonthKey] ?? [],
        ).map((p) => ({
          id: p.id,
          variant: p.variant,
          groupId: p.groupId,
        })),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return { datasets, csvByteLength };
}

/** Fetch project sheets → merge → quality gate → Neon */
export async function ingestRnpSnapshot(options?: {
  force?: boolean;
  fromHash?: string | null;
}): Promise<RnpIngestResult> {
  const { datasets: projectDatasets, csvByteLength } = await loadProjectDatasets({
    force: options?.force,
  });

  const base = RNP_SHARED_SHEET_ENABLED ? emptyDataset() : emptyDataset();
  const merged = mergeRnpDatasets(base, projectDatasets, RNP_PROJECT_SOURCES);
  const mergedWithSize = {
    ...merged,
    csvByteLength: merged.csvByteLength || csvByteLength,
  };

  const previous = await getLatestAcceptedStats().catch(() => null);
  const quality = assessRnpQuality(
    "x".repeat(Math.max(mergedWithSize.csvByteLength, 1)),
    mergedWithSize,
    previous,
  );

  const candidate = attachLiveHealth(
    mergedWithSize,
    quality.warnings,
    quality.qualityScore,
    quality.accepted,
  );

  if (quality.accepted) {
    if (!previous || previous.contentHash !== candidate.contentHash) {
      await saveRnpSnapshot({
        dataset: candidate,
        warnings: quality.warnings,
        qualityScore: quality.qualityScore,
        accepted: true,
      });
    }
    const stored = await getLatestGoodRnpSnapshot();
    return {
      accepted: true,
      reason: "accepted",
      dataset: await withManualStatuses(
        stored ?? {
          ...candidate,
          health: { ...candidate.health!, source: "neon" },
        },
      ),
    };
  }

  await saveRnpSnapshot({
    dataset: candidate,
    warnings: quality.warnings,
    qualityScore: quality.qualityScore,
    accepted: false,
  }).catch((error) => {
    console.warn("[rnpIngest] failed to store rejected snapshot:", error);
  });

  const stored = await getLatestGoodRnpSnapshot().catch(() => null);
  if (stored) {
    return {
      accepted: false,
      reason: "rejected-kept-previous",
      dataset: await withManualStatuses({
        ...stored,
        health: {
          source: "neon",
          warnings: [
            ...(stored.health?.warnings ?? []),
            "Новый снимок отклонён quality gate — показан последний хороший.",
            ...quality.warnings,
          ],
          qualityScore: stored.health?.qualityScore ?? 0,
          accepted: true,
        },
      }),
    };
  }

  return {
    accepted: false,
    reason: "rejected-no-previous",
    dataset: await withManualStatuses(candidate),
  };
}

/** SSR / poll: last good Neon snapshot, ingest if none */
export async function loadRnpDataset(): Promise<RNPDataset> {
  noStore();
  try {
    const stored = await getLatestGoodRnpSnapshot();
    if (stored) return withManualStatuses(stored);
  } catch (error) {
    console.warn("[rnpLoad] Neon unavailable:", error);
  }

  try {
    const ingested = await ingestRnpSnapshot();
    return ingested.dataset;
  } catch (error) {
    console.warn("[rnpLoad] ingest failed, project-only merge:", error);
    const { datasets } = await loadProjectDatasets();
    return withManualStatuses(
      mergeRnpDatasets(emptyDataset(), datasets, RNP_PROJECT_SOURCES),
    );
  }
}
