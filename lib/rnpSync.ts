import type { RNPDataset } from "@/types/rnp";

export type SyncRejectReason =
  | "empty"
  | "same"
  | "grace"
  | "pending"
  | "accepted";

export interface SyncDecision {
  accept: boolean;
  reason: SyncRejectReason;
  pendingHash: string | null;
}

type DatasetSnapshot = Pick<RNPDataset, "contentHash">;

/**
 * Sticky sync: после SSR не откатываемся на флап Google CDN.
 * - graceMs: игнорировать смену hash сразу после загрузки страницы
 * - новый hash применяем только после 2 подряд одинаковых ответов
 */
export function evaluateFreshDataset(input: {
  current: DatasetSnapshot;
  fresh: RNPDataset;
  pendingHash: string | null;
  mountedAt: number;
  now?: number;
  graceMs?: number;
}): SyncDecision {
  const {
    current,
    fresh,
    pendingHash,
    mountedAt,
    now = Date.now(),
    graceMs = 90_000,
  } = input;

  if (!fresh.contentHash || fresh.months.length === 0) {
    return { accept: false, reason: "empty", pendingHash: null };
  }

  if (fresh.contentHash === current.contentHash) {
    return { accept: false, reason: "same", pendingHash: null };
  }

  if (now - mountedAt < graceMs) {
    return { accept: false, reason: "grace", pendingHash: null };
  }

  if (pendingHash !== fresh.contentHash) {
    return {
      accept: false,
      reason: "pending",
      pendingHash: fresh.contentHash,
    };
  }

  return { accept: true, reason: "accepted", pendingHash: null };
}

/** @deprecated use evaluateFreshDataset */
export function shouldAcceptFreshDataset(
  current: DatasetSnapshot,
  fresh: RNPDataset,
): boolean {
  return evaluateFreshDataset({
    current,
    fresh,
    pendingHash: fresh.contentHash,
    mountedAt: 0,
    graceMs: 0,
  }).accept;
}
