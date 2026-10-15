import { Event } from "@/types";
import { addDays } from "@/lib/utils";
import { LATEST_DATE } from "./metrics";

export const events: Event[] = [
  {
    date: addDays(LATEST_DATE, -2),
    project_id: "proj-01",
    event_type: "optimization",
    description: "Отключили худший адсет по CPL в кампании «Импланты — холодный трафик».",
    author: "Анна Ковалёва",
  },
  {
    date: addDays(LATEST_DATE, -5),
    project_id: "proj-01",
    event_type: "creative_change",
    description: "Запустили новое видео-отзыв взамен статичного баннера.",
    author: "Анна Ковалёва",
  },
  {
    date: addDays(LATEST_DATE, -13),
    project_id: "proj-02",
    event_type: "budget_change",
    description: "Увеличили бюджет на «Абонемент — акция лета» на 60% из-за старта летней акции.",
    author: "Дмитрий Орлов",
  },
  {
    date: addDays(LATEST_DATE, -6),
    project_id: "proj-02",
    event_type: "issue",
    description: "Клиент сообщил о снижении качества лидов — уточняем оффер и посадочную страницу.",
    author: "Дмитрий Орлов",
  },
  {
    date: addDays(LATEST_DATE, -1),
    project_id: "proj-02",
    event_type: "note",
    description: "Нужно пересмотреть таргетинг по интересам — CTR по кампании с тренером продолжает падать.",
    author: "Дмитрий Орлов",
  },
  {
    date: addDays(LATEST_DATE, -9),
    project_id: "proj-03",
    event_type: "note",
    description: "CPM по кампании с новостройками растёт вслед за сезонным ростом конкуренции в нише.",
    author: "Мария Ильина",
  },
  {
    date: addDays(LATEST_DATE, -20),
    project_id: "proj-04",
    event_type: "issue",
    description: "Проект приостановлен клиентом на время ремонта клиники.",
    author: "Анна Ковалёва",
  },
  {
    date: addDays(LATEST_DATE, -12),
    project_id: "proj-04",
    event_type: "note",
    description: "Кампания «Вакцинация — сезонная» продолжает тратить бюджет без лидов — предложили клиенту паузу.",
    author: "Анна Ковалёва",
  },
  {
    date: addDays(LATEST_DATE, -8),
    project_id: "proj-05",
    event_type: "creative_change",
    description: "Обновили видео обзор новой модели — старый креатив выгорел.",
    author: "Георгий Меладзе",
  },
  {
    date: addDays(LATEST_DATE, -3),
    project_id: "proj-05",
    event_type: "note",
    description: "Аукцион ощутимо дорожает у всех локальных дилеров — обсуждаем повышение бюджета либо смену гео.",
    author: "Георгий Меладзе",
  },
  {
    date: addDays(LATEST_DATE, -25),
    project_id: "proj-06",
    event_type: "launch",
    description: "Финальный набор потока — кампании будут постепенно остановлены к концу месяца.",
    author: "Дмитрий Орлов",
  },
  {
    date: addDays(LATEST_DATE, -4),
    project_id: "proj-06",
    event_type: "budget_change",
    description: "Снизили бюджеты обеих кампаний в 10 раз перед плановым завершением проекта.",
    author: "Дмитрий Орлов",
  },
];
