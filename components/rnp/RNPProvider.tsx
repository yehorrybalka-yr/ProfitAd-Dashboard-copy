"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RNPDataset, RNPMonthOption, RNPProject } from "@/types/rnp";
import { RNP_POLL_GRACE_MS, RNP_POLL_INTERVAL_MS } from "@/lib/rnpConfig";
import { resolveDefaultMonthKey } from "@/lib/rnpMonths";
import { evaluateFreshDataset } from "@/lib/rnpSync";
import { isArchivedStatus } from "@/lib/rnpStatus";
import { patchDatasetProjectStatus } from "@/lib/rnpApplyStatusOverrides";

type SyncStatus = "idle" | "syncing" | "updated" | "error";

interface RNPContextValue {
  dataset: RNPDataset;
  selectedMonthKey: string;
  setSelectedMonthKey: (key: string) => void;
  selectedMonth: RNPMonthOption | null;
  /** Активные проекты (без Archive) */
  projects: RNPProject[];
  /** Архивные проекты за выбранный месяц */
  archivedProjects: RNPProject[];
  getProjectById: (id: string) => RNPProject | undefined;
  getPreviousMonthKey: () => string | null;
  updateProjectStatus: (projectKey: string, status: string) => Promise<boolean>;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  refreshNow: () => void;
}

const RNPContext = createContext<RNPContextValue | null>(null);

export function RNPProvider({
  dataset: initialDataset,
  children,
}: {
  dataset: RNPDataset;
  children: React.ReactNode;
}) {
  const [dataset, setDataset] = useState(initialDataset);
  const [selectedMonthKey, setSelectedMonthKey] = useState(
    initialDataset.defaultMonthKey || initialDataset.months[0]?.key || "",
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    initialDataset.fetchedAt || null,
  );

  const hashRef = useRef(initialDataset.contentHash);
  const pendingHashRef = useRef<string | null>(null);
  const mountedAtRef = useRef(Date.now());
  const syncingRef = useRef(false);
  /** Инкремент при каждом refresh — устаревшие poll/refresh ответы отбрасываются */
  const syncGenRef = useRef(0);

  const applyDataset = useCallback((fresh: RNPDataset, force: boolean) => {
    if (!fresh.contentHash || fresh.months.length === 0) {
      setSyncStatus("error");
      return;
    }

    if (force) {
      hashRef.current = fresh.contentHash;
      pendingHashRef.current = null;
      // Не включать grace после ручного refresh — иначе poll 30с блокирует более свежие данные
      mountedAtRef.current = 0;
      setDataset(fresh);
      setLastSyncedAt(fresh.fetchedAt);
      setSyncStatus("updated");
      return;
    }

    const decision = evaluateFreshDataset({
      current: { contentHash: hashRef.current },
      fresh,
      pendingHash: pendingHashRef.current,
      mountedAt: mountedAtRef.current,
      graceMs: RNP_POLL_GRACE_MS,
    });

    pendingHashRef.current = decision.pendingHash;

    if (decision.accept) {
      hashRef.current = fresh.contentHash;
      setDataset(fresh);
      setSyncStatus("updated");
    } else {
      setSyncStatus("idle");
    }

    setLastSyncedAt(fresh.fetchedAt);
  }, []);

  const poll = useCallback(async () => {
    if (syncingRef.current || document.hidden) return;
    const gen = syncGenRef.current;
    syncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const res = await fetch("/api/rnp", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const fresh: RNPDataset = await res.json();
      if (gen !== syncGenRef.current) return;
      applyDataset(fresh, false);
    } catch {
      if (gen === syncGenRef.current) setSyncStatus("error");
    } finally {
      if (gen === syncGenRef.current) syncingRef.current = false;
    }
  }, [applyDataset]);

  const refreshNow = useCallback(async () => {
    // Force всегда приоритетнее poll — не блокируемся на syncingRef
    const gen = ++syncGenRef.current;
    syncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const res = await fetch(
        `/api/rnp?force=1&from=${encodeURIComponent(hashRef.current)}&_=${Date.now()}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const fresh: RNPDataset = await res.json();
      if (gen !== syncGenRef.current) return;
      applyDataset(fresh, true);
    } catch {
      if (gen === syncGenRef.current) setSyncStatus("error");
    } finally {
      if (gen === syncGenRef.current) syncingRef.current = false;
    }
  }, [applyDataset]);

  useEffect(() => {
    void poll();
    const interval = setInterval(poll, RNP_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  /** SSR иногда отстаёт от /api/rnp — сразу подтягиваем актуальный снимок */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/rnp", { cache: "no-store" });
        if (!res.ok || cancelled) return;

        const fresh: RNPDataset = await res.json();
        if (cancelled || !fresh.contentHash) return;

        if (fresh.contentHash !== hashRef.current) {
          // #region agent log
          fetch("http://127.0.0.1:7911/ingest/fdc3da9c-6ab8-4412-8cbf-0bd39ffd13d8", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "97ccd5",
            },
            body: JSON.stringify({
              sessionId: "97ccd5",
              runId: "hydrate",
              hypothesisId: "H-ssr-stale",
              location: "RNPProvider.tsx:hydrate",
              message: "SSR/API hash mismatch — applying API snapshot",
              data: {
                ssrHash: hashRef.current,
                apiHash: fresh.contentHash,
                apiProjectCount:
                  fresh.projectsByMonth[fresh.defaultMonthKey]?.length ?? 0,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion

          applyDataset(fresh, true);
        }
      } catch {
        /* ignore — poll/refresh остаются запасным каналом */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyDataset]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [poll]);

  useEffect(() => {
    if (syncStatus !== "updated") return;
    const t = setTimeout(() => setSyncStatus("idle"), 3000);
    return () => clearTimeout(t);
  }, [syncStatus]);

  useEffect(() => {
    if (dataset.months.length === 0) return;
    const monthExists = dataset.months.some((m) => m.key === selectedMonthKey);
    if (!monthExists) {
      setSelectedMonthKey(
        dataset.defaultMonthKey ||
          resolveDefaultMonthKey(dataset.months),
      );
    }
  }, [dataset, selectedMonthKey]);

  const selectedMonth = useMemo(
    () => dataset.months.find((m) => m.key === selectedMonthKey) ?? null,
    [dataset.months, selectedMonthKey],
  );

  const allProjects = useMemo(
    () => dataset.projectsByMonth[selectedMonthKey] ?? [],
    [dataset.projectsByMonth, selectedMonthKey],
  );

  const projects = useMemo(
    () => allProjects.filter((p) => !isArchivedStatus(p.status)),
    [allProjects],
  );

  const archivedProjects = useMemo(
    () => allProjects.filter((p) => isArchivedStatus(p.status)),
    [allProjects],
  );

  const getProjectById = (id: string) => allProjects.find((p) => p.id === id);

  const getPreviousMonthKey = () => {
    const idx = dataset.months.findIndex((m) => m.key === selectedMonthKey);
    if (idx <= 0) return null;
    return dataset.months[idx - 1].key;
  };

  const updateProjectStatus = useCallback(
    async (projectKey: string, status: string) => {
      const previous = dataset;
      setDataset(patchDatasetProjectStatus(dataset, projectKey, status));

      try {
        const response = await fetch("/api/rnp/status", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectKey, status }),
        });
        if (!response.ok) {
          setDataset(previous);
          return false;
        }
        return true;
      } catch {
        setDataset(previous);
        return false;
      }
    },
    [dataset],
  );

  const value = useMemo(
    () => ({
      dataset,
      selectedMonthKey,
      setSelectedMonthKey,
      selectedMonth,
      projects,
      archivedProjects,
      getProjectById,
      getPreviousMonthKey,
      updateProjectStatus,
      syncStatus,
      lastSyncedAt,
      refreshNow,
    }),
    [
      dataset,
      selectedMonthKey,
      selectedMonth,
      projects,
      archivedProjects,
      updateProjectStatus,
      syncStatus,
      lastSyncedAt,
      refreshNow,
    ],
  );

  return <RNPContext.Provider value={value}>{children}</RNPContext.Provider>;
}

export function useRNP(): RNPContextValue {
  const ctx = useContext(RNPContext);
  if (!ctx) {
    throw new Error("useRNP должен использоваться внутри RNPProvider");
  }
  return ctx;
}

export function useRNPOptional(): RNPContextValue | null {
  return useContext(RNPContext);
}
