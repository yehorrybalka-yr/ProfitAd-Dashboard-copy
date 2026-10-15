import type { RNPProject } from "@/types/rnp";
import { parseMetricNumber } from "@/lib/rnpGoals";
import { resolveGroupDisplayStatus } from "@/lib/rnpStatus";

const VARIANT_PATTERN = /^(.+?)\s*-\s*(Subs|Leads)$/i;

/** Группы, где главная цель и дефолтная ветка — Leads, а не Subs */
const LEADS_PRIMARY_GOAL_GROUP_IDS = new Set(["credyt-is", "lexdixit"]);

export function prefersLeadsPrimaryGoal(groupNameOrId: string): boolean {
  const normalized = groupNameOrId.trim();
  if (!normalized) return false;
  const id = normalized.includes(" ")
    ? toProjectId(normalized)
    : normalized.toLowerCase();
  return LEADS_PRIMARY_GOAL_GROUP_IDS.has(id);
}

export function getPreferredDefaultMemberId(
  members: RNPProject[],
  goalProject: RNPProject | null,
): string | null {
  const groupName = goalProject?.groupName ?? goalProject?.groupId ?? "";
  if (!prefersLeadsPrimaryGoal(groupName)) return null;
  const leads = members.find((m) =>
    (m.variant ?? "").toLowerCase().includes("leads"),
  );
  return leads?.id ?? null;
}

export function sortGroupMembers(members: RNPProject[]): RNPProject[] {
  const groupName = members[0]?.groupName ?? members[0]?.groupId ?? "";
  if (!prefersLeadsPrimaryGoal(groupName)) return members;

  return [...members].sort((a, b) => {
    const aLeads = (a.variant ?? "").toLowerCase().includes("leads") ? 0 : 1;
    const bLeads = (b.variant ?? "").toLowerCase().includes("leads") ? 0 : 1;
    return aLeads - bLeads;
  });
}

export function parseProjectGrouping(name: string): {
  groupId: string | null;
  groupName: string | null;
  variant: string | null;
} {
  const match = name.match(VARIANT_PATTERN);
  if (!match) {
    return { groupId: null, groupName: null, variant: null };
  }
  const groupName = match[1].trim();
  return {
    groupName,
    groupId: toProjectId(groupName),
    variant: match[2],
  };
}

export function toProjectId(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

/** Назначает флаг isPrimaryGoalHolder подпроекту с главной целью */
export function assignPrimaryGoalHolders(projects: RNPProject[]): void {
  const byGroup = new Map<string, RNPProject[]>();

  for (const project of projects) {
    if (!project.groupId) {
      project.isPrimaryGoalHolder = true;
      continue;
    }
    const list = byGroup.get(project.groupId) ?? [];
    list.push(project);
    byGroup.set(project.groupId, list);
  }

  for (const members of byGroup.values()) {
    const holder = pickPrimaryGoalHolder(members);
    for (const member of members) {
      member.isPrimaryGoalHolder = member.id === holder.id;
    }
  }
}

function pickPrimaryGoalHolder(members: RNPProject[]): RNPProject {
  const withPlans = members.filter((m) => hasPrimaryGoalPlans(m));
  if (withPlans.length === 1) return withPlans[0];

  const groupName = members[0]?.groupName ?? members[0]?.groupId ?? "";
  const preferLeads = prefersLeadsPrimaryGoal(groupName);

  if (preferLeads) {
    const leads = withPlans.find((m) =>
      (m.variant ?? "").toLowerCase().includes("leads"),
    );
    if (leads) return leads;
  } else {
    const subs = withPlans.find((m) =>
      (m.variant ?? "").toLowerCase().includes("subs"),
    );
    if (subs) return subs;
  }

  if (withPlans.length > 0) return withPlans[0];
  return members[0];
}

function hasPrimaryGoalPlans(project: RNPProject): boolean {
  const { goals } = project.metrics;
  return goals.some((g) => parseMetricNumber(g.plan) > 0);
}

export type RNPTableEntry =
  | {
      kind: "group-header";
      groupId: string;
      groupName: string;
      status: string;
      goalProject: RNPProject;
    }
  | { kind: "project"; project: RNPProject };

/**
 * Строки таблицы Дашборда: одна строка на проект/группу.
 * Ветки (Subs/Leads) на Дашборде не показываем — они остаются внутри /projects/[id].
 */
export function buildTableEntries(projects: RNPProject[]): RNPTableEntry[] {
  const entries: RNPTableEntry[] = [];
  const emittedGroups = new Set<string>();

  for (const project of projects) {
    if (project.groupId) {
      if (emittedGroups.has(project.groupId)) continue;
      emittedGroups.add(project.groupId);

      const members = projects.filter((p) => p.groupId === project.groupId);
      const goalProject =
        members.find((m) => m.isPrimaryGoalHolder) ?? members[0];

      entries.push({
        kind: "group-header",
        groupId: project.groupId,
        groupName: project.groupName!,
        status: resolveGroupDisplayStatus(members, goalProject.status),
        goalProject,
      });
      continue;
    }

    entries.push({ kind: "project", project });
  }

  return entries;
}

export interface RNPProjectCardItem {
  id: string;
  name: string;
  status: string;
  goalProject: RNPProject;
  memberCount: number;
}

/** Карточки для выбора проекта: группы — одна карточка, одиночные — как есть */
export function buildProjectCardItems(projects: RNPProject[]): RNPProjectCardItem[] {
  const items: RNPProjectCardItem[] = [];
  const seenGroups = new Set<string>();
  const seenIds = new Set<string>();

  for (const project of projects) {
    if (project.groupId) {
      if (seenGroups.has(project.groupId)) continue;
      seenGroups.add(project.groupId);

      const members = projects.filter((p) => p.groupId === project.groupId);
      const goalProject =
        members.find((m) => m.isPrimaryGoalHolder) ?? members[0];

      items.push({
        id: project.groupId,
        name: project.groupName!,
        status: resolveGroupDisplayStatus(members, goalProject.status),
        goalProject,
        memberCount: members.length,
      });
      continue;
    }

    if (!seenIds.has(project.id)) {
      seenIds.add(project.id);
      items.push({
        id: project.id,
        name: project.name,
        status: project.status,
        goalProject: project,
        memberCount: 1,
      });
    }
  }

  return items;
}

/** ID карточки проекта для подсветки в сайдбаре */
export function resolveActiveCardId(projects: RNPProject[], routeId: string): string {
  const scope = resolveProjectScope(projects, routeId);
  if (scope.isGroup) return routeId;

  const project = projects.find((p) => p.id === routeId);
  if (project?.groupId) return project.groupId;

  return routeId;
}

/** Уникальные группы и одиночные проекты для фильтра */
export function buildProjectFilterOptions(
  projects: RNPProject[],
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const seenGroups = new Set<string>();
  const seenIds = new Set<string>();

  for (const project of projects) {
    if (project.groupId) {
      if (!seenGroups.has(project.groupId)) {
        seenGroups.add(project.groupId);
        options.push({ value: project.groupId, label: project.groupName! });
      }
      continue;
    }
    if (!seenIds.has(project.id)) {
      seenIds.add(project.id);
      options.push({ value: project.id, label: project.name });
    }
  }

  return options;
}

/** Проекты, относящиеся к id (группа или одиночный проект) */
export function resolveProjectScope(
  projects: RNPProject[],
  id: string,
): { isGroup: boolean; members: RNPProject[]; goalProject: RNPProject | null } {
  const groupMembers = sortGroupMembers(projects.filter((p) => p.groupId === id));
  if (groupMembers.length > 0) {
    const goalProject =
      groupMembers.find((m) => m.isPrimaryGoalHolder) ?? groupMembers[0];
    return { isGroup: true, members: groupMembers, goalProject };
  }

  const single = projects.find((p) => p.id === id);
  if (single?.groupId) {
    const members = sortGroupMembers(
      projects.filter((p) => p.groupId === single.groupId),
    );
    if (members.length > 0) {
      const goalProject =
        members.find((m) => m.isPrimaryGoalHolder) ?? members[0];
      return { isGroup: true, members, goalProject };
    }
  }

  if (single) {
    return { isGroup: false, members: [single], goalProject: single };
  }

  return { isGroup: false, members: [], goalProject: null };
}
