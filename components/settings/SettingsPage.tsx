"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageStack } from "@/components/layout/PageToolbar";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    value: "light",
    label: "Светлая",
    description: "Классическая светлая тема",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Тёмная",
    description: "Комфортная тёмная тема",
    icon: Moon,
  },
  {
    value: "system",
    label: "Как на устройстве",
    description: "Следует настройкам системы и переключается автоматически",
    icon: Monitor,
  },
];

export function SettingsPage() {
  const { preference, setPreference } = useTheme();

  return (
    <PageStack>
      <Card>
        <CardHeader
          title="Оформление"
          subtitle="Тема интерфейса ProfitAd Dashboard"
        />
        <CardBody className="pt-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = preference === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreference(opt.value)}
                  className={cn(
                    "flex h-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                    active
                      ? "border-brand bg-brand-soft shadow-card"
                      : "border-border bg-surface hover:border-border-strong hover:bg-surface-muted",
                  )}
                >
                  <Icon
                    size={18}
                    className={active ? "text-brand" : "text-ink-muted"}
                  />
                  <span className="text-sm font-medium text-ink">{opt.label}</span>
                  <span className="text-xs leading-relaxed text-ink-muted">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </PageStack>
  );
}
