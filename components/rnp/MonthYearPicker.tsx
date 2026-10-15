"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useRNP } from "./RNPProvider";
import { getAvailableYears, parseMonthKey } from "@/lib/rnpMonths";

const MONTH_SHORT_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export function MonthYearPicker({ className }: { className?: string }) {
  const { dataset, selectedMonthKey, setSelectedMonthKey } = useRNP();

  const years = useMemo(() => getAvailableYears(dataset.months), [dataset.months]);
  const selectedYear = Number(selectedMonthKey.split("-")[0]) || years[0] || new Date().getFullYear();

  const monthsInYear = useMemo(
    () => dataset.months.filter((m) => m.year === selectedYear),
    [dataset.months, selectedYear],
  );

  const yearOptions = years.map((y) => ({ value: String(y), label: String(y) }));

  const monthOptions = monthsInYear.map((m) => ({
    value: m.key,
    label: MONTH_SHORT_RU[m.month],
  }));

  const handleYearChange = (yearStr: string) => {
    const year = Number(yearStr);
    const { month } = parseMonthKey(selectedMonthKey);
    const sameMonth = dataset.months.find(
      (m) => m.year === year && m.month === month,
    );
    if (sameMonth) {
      setSelectedMonthKey(sameMonth.key);
      return;
    }
    const firstInYear = dataset.months.find((m) => m.year === year);
    if (firstInYear) setSelectedMonthKey(firstInYear.key);
  };

  if (dataset.months.length === 0) {
    return (
      <div className="text-xs text-ink-muted">Нет данных по месяцам в таблице РНП</div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 text-ink-soft">
        <CalendarDays size={14} />
        <span className="text-xs font-medium">Период</span>
      </div>
      <Select
        className="w-28"
        options={yearOptions}
        value={String(selectedYear)}
        onChange={(e) => handleYearChange(e.target.value)}
        aria-label="Год"
      />
      <Select
        className="w-36"
        options={monthOptions}
        value={selectedMonthKey}
        onChange={(e) => setSelectedMonthKey(e.target.value)}
        aria-label="Месяц"
      />
    </div>
  );
}
