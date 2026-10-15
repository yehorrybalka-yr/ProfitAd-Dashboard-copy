# Ad Analytics — MVP дашборд (mock data)

Внутренний дашборд агентства для аналитики рекламных проектов. Данные пока
полностью моковые — интеграция с Google Sheets API сделана отдельным
следующим шагом и в этой версии не подключена.

## Запуск

```bash
npm install
npm run dev
```

Открыть http://localhost:3000

## Структура проекта

```
app/
  layout.tsx           — корневой layout, подключение шрифтов и AppShell
  page.tsx              — страница Dashboard
  projects/
    page.tsx             — страница Projects (список всех проектов)
    [id]/page.tsx         — страница Project Detail

components/
  layout/                — Sidebar, Header, AppShell
  dashboard/              — KpiCard, KpiGrid, FiltersBar, TrendChart,
                             CampaignsTable, SignalsPanel, NotesPanel
  projects/               — ProjectsTable, StatusBadge
  ui/                     — Card, Badge, Select (базовые примитивы)

lib/
  metrics.ts              — агрегация метрик, группировка по кампаниям/датам
  signals.ts               — генерация автоматических сигналов/алертов
  filters.ts                — фильтрация по проекту/периоду
  kpi.ts                     — сборка данных для KPI-карточек
  format.ts                   — форматирование чисел/валют/дат
  utils.ts                     — общие хелперы (cn, safeDiv, работа с датами)

types/
  index.ts               — Project, DailyMetric, Event + производные типы
                            (AggregatedMetrics, CampaignSummary, Signal, TrendPoint)

data/
  projects.ts             — 6 моковых проектов с разными статусами и целями
  metrics.ts                — генератор 60 дней ежедневных метрик по кампаниям
                              (детерминированный, с встроенными "проблемными"
                              трендами для демонстрации сигналов)
  events.ts                 — моковые заметки/события по проектам
```

## Как устроены сигналы (Signals / Alerts)

`lib/signals.ts` сравнивает выбранный период с предыдущим периодом такой же
длины (`splitForComparison` в `lib/metrics.ts`) и на уровне проекта и
кампаний проверяет:

- рост CPL (`cpl_up`)
- рост расхода при падении лидов (`spend_up_leads_down`)
- низкий CTR (`ctr_low`)
- рост CPM (`cpm_up`)
- расход без лидов (`spend_no_leads`)
- ROAS ниже целевого (`roas_below_target`)

Пороги вынесены в константу `THRESHOLDS` в начале файла — их легко
перенести в настройки проекта, когда появится реальный backend.

## Как позже подключить Google Sheets

Слой данных уже изолирован: все страницы читают данные только из
`data/projects.ts`, `data/metrics.ts`, `data/events.ts`. На следующем этапе
эти файлы можно заменить на функции, которые дергают Google Sheets API
(или собственный backend-эндпоинт, который синхронизирует таблицы), не
меняя ни компоненты, ни `lib/*`.

## Технологии

Next.js (App Router) · TypeScript · Tailwind CSS · Recharts · lucide-react
