"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { CampaignPlatform, RunningCampaign } from "@/types/campaigns";

interface RunningCampaignsPanelProps {
  projectId: string;
  embedded?: boolean;
}

const PLATFORM_SECTIONS: {
  platform: CampaignPlatform;
  title: string;
  subtitle: string;
  accentClass: string;
}[] = [
  {
    platform: "google",
    title: "Google Ads",
    subtitle: "Запущенные кампании Google",
    accentClass: "border-l-brand",
  },
  {
    platform: "meta",
    title: "Meta Ads",
    subtitle: "Запущенные кампании Meta",
    accentClass: "border-l-violet-500",
  },
];

function formatCampaignDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function CampaignRow({
  campaign,
  onUpdate,
  onDelete,
}: {
  campaign: RunningCampaign;
  onUpdate: (
    id: string,
    patch: Partial<{ title: string; subtitle: string }>,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(campaign.title);
  const [subtitle, setSubtitle] = useState(campaign.subtitle);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setTitle(campaign.title);
    setSubtitle(campaign.subtitle);
  }, [campaign.title, campaign.subtitle]);

  const saveIfChanged = async () => {
    const nextTitle = title.trim();
    const nextSubtitle = subtitle.trim();
    if (
      !nextTitle ||
      (nextTitle === campaign.title && nextSubtitle === campaign.subtitle)
    ) {
      setTitle(campaign.title);
      setSubtitle(campaign.subtitle);
      return;
    }

    setSaving(true);
    try {
      await onUpdate(campaign.id, {
        title: nextTitle,
        subtitle: nextSubtitle,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(campaign.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group rounded-lg border border-border bg-surface-muted/30 p-3 transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void saveIfChanged()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveIfChanged();
              }
            }}
            placeholder="Заголовок кампании"
            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-ink outline-none transition-colors placeholder:text-ink-soft focus:border-border focus:bg-surface"
            aria-label="Заголовок кампании"
          />
          <input
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            onBlur={() => void saveIfChanged()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveIfChanged();
              }
            }}
            placeholder="Подзаголовок (описание, аудитория, бюджет…)"
            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs text-ink-muted outline-none transition-colors placeholder:text-ink-soft focus:border-border focus:bg-surface"
            aria-label="Подзаголовок кампании"
          />
          <p className="px-1 text-[10px] text-ink-soft">
            {saving ? "Сохранение…" : `Обновлено ${formatCampaignDate(campaign.updatedAt)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="rounded-md p-1.5 text-ink-soft opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100 disabled:opacity-50"
          aria-label="Удалить кампанию"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function CampaignSection({
  platform,
  title,
  subtitle,
  accentClass,
  campaigns,
  onAdd,
  onUpdate,
  onDelete,
  adding,
}: {
  platform: CampaignPlatform;
  title: string;
  subtitle: string;
  accentClass: string;
  campaigns: RunningCampaign[];
  onAdd: (platform: CampaignPlatform) => Promise<void>;
  onUpdate: (
    id: string,
    patch: Partial<{ title: string; subtitle: string }>,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  adding: CampaignPlatform | null;
}) {
  return (
    <section className={cn("rounded-xl border border-border border-l-4 bg-surface p-4", accentClass)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-ink">{title}</h4>
          <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void onAdd(platform)}
          disabled={adding === platform}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
        >
          <Plus size={14} />
          {adding === platform ? "Добавление…" : "Добавить"}
        </button>
      </div>

      {campaigns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-ink-muted">
          Кампании пока не добавлены
        </p>
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function RunningCampaignsPanel({
  projectId,
  embedded = false,
}: RunningCampaignsPanelProps) {
  const [campaigns, setCampaigns] = useState<RunningCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<CampaignPlatform | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/campaigns?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to load campaigns");
      }
      const payload = (await response.json()) as { campaigns: RunningCampaign[] };
      setCampaigns(payload.campaigns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byPlatform = useMemo(() => {
    const grouped: Record<CampaignPlatform, RunningCampaign[]> = {
      google: [],
      meta: [],
    };
    for (const campaign of campaigns) {
      grouped[campaign.platform].push(campaign);
    }
    return grouped;
  }, [campaigns]);

  const handleAdd = async (platform: CampaignPlatform) => {
    setAdding(platform);
    setError(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          platform,
          title: "Новая кампания",
          subtitle: "",
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to create campaign");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setAdding(null);
    }
  };

  const handleUpdate = async (
    id: string,
    patch: Partial<{ title: string; subtitle: string }>,
  ) => {
    setError(null);
    const response = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to update campaign");
      return;
    }
    const payload = (await response.json()) as { campaign: RunningCampaign };
    setCampaigns((prev) =>
      prev.map((item) => (item.id === id ? payload.campaign : item)),
    );
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const response = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to delete campaign");
      return;
    }
    setCampaigns((prev) => prev.filter((item) => item.id !== id));
  };

  const content = (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading && campaigns.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Загрузка кампаний…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {PLATFORM_SECTIONS.map((section) => (
            <CampaignSection
              key={section.platform}
              platform={section.platform}
              title={section.title}
              subtitle={section.subtitle}
              accentClass={section.accentClass}
              campaigns={byPlatform[section.platform]}
              onAdd={handleAdd}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              adding={adding}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Megaphone size={16} className="text-brand" />
            Запущенные кампании
          </span>
        }
        subtitle="Google Ads и Meta Ads — заполняется вручную"
      />
      <CardBody className="pt-0">{content}</CardBody>
    </Card>
  );
}
