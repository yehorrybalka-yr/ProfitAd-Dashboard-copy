import { getSql } from "@/lib/db";
import type {
  CreateTaskInput,
  Task,
  TaskComment,
  TaskListFilters,
  TaskPriority,
  TaskStatus,
  TaskSubtask,
  UpdateTaskInput,
} from "@/types/tasks";

let schemaReady: Promise<void> | null = null;

export function ensureTasksSchema(): Promise<void> {
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
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      project_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      branch TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      deadline DATE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS task_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS task_subtasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER`;
  await sql`ALTER TABLE task_subtasks ADD COLUMN IF NOT EXISTS sort_order INTEGER`;

  await sql`
    UPDATE tasks
    SET sort_order = ranked.rn
    FROM (
      SELECT
        id,
        (ROW_NUMBER() OVER (
          ORDER BY
            CASE WHEN status = 'open' THEN 0 ELSE 1 END,
            CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
            deadline ASC NULLS LAST,
            created_at DESC
        ) - 1)::int AS rn
      FROM tasks
      WHERE sort_order IS NULL
    ) ranked
    WHERE tasks.id = ranked.id
  `;

  await sql`
    UPDATE task_subtasks
    SET sort_order = ranked.rn
    FROM (
      SELECT
        id,
        (ROW_NUMBER() OVER (
          PARTITION BY task_id
          ORDER BY created_at ASC
        ) - 1)::int AS rn
      FROM task_subtasks
      WHERE sort_order IS NULL
    ) ranked
    WHERE task_subtasks.id = ranked.id
  `;

  await sql`UPDATE tasks SET sort_order = 0 WHERE sort_order IS NULL`;
  await sql`UPDATE task_subtasks SET sort_order = 0 WHERE sort_order IS NULL`;
  await sql`
    ALTER TABLE tasks
    ALTER COLUMN sort_order SET DEFAULT 0,
    ALTER COLUMN sort_order SET NOT NULL
  `;
  await sql`
    ALTER TABLE task_subtasks
    ALTER COLUMN sort_order SET DEFAULT 0,
    ALTER COLUMN sort_order SET NOT NULL
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks (completed_at DESC NULLS LAST)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks (sort_order)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON task_subtasks (task_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_subtasks_sort ON task_subtasks (task_id, sort_order)`;
}

interface TaskRow {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  branch: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  sort_order: number;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  subtask_total?: number;
  subtask_done_count?: number;
}

interface CommentRow {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
}

interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
}

function mapRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    projectId: row.project_id,
    projectName: row.project_name,
    branch: row.branch,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    deadline: row.deadline,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    subtaskTotal:
      row.subtask_total === undefined ? undefined : Number(row.subtask_total) || 0,
    subtaskDoneCount:
      row.subtask_done_count === undefined
        ? undefined
        : Number(row.subtask_done_count) || 0,
  };
}

function mapComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapSubtask(row: SubtaskRow): TaskSubtask {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    done: row.done,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
  };
}

function sortOpenTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
}

function sortDoneTodayTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      Date.parse(b.completedAt ?? b.updatedAt) -
      Date.parse(a.completedAt ?? a.updatedAt),
  );
}

function sortActiveTasks(tasks: Task[]): Task[] {
  const open = tasks.filter((task) => task.status === "open");
  const doneToday = tasks.filter((task) => task.status === "done");
  return [...sortOpenTasks(open), ...sortDoneTodayTasks(doneToday)];
}

async function nextTaskSortOrder(): Promise<number> {
  const sql = getSql();
  const rows = await sql`SELECT COALESCE(MAX(sort_order), -1)::int AS max FROM tasks`;
  return ((rows as { max: number }[])[0]?.max ?? -1) + 1;
}

async function nextSubtaskSortOrder(taskId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(MAX(sort_order), -1)::int AS max
    FROM task_subtasks
    WHERE task_id = ${taskId}
  `;
  return ((rows as { max: number }[])[0]?.max ?? -1) + 1;
}

export async function listTasks(filters: TaskListFilters = {}): Promise<Task[]> {
  await ensureTasksSchema();
  const sql = getSql();

  const today = filters.today ?? new Date().toISOString().slice(0, 10);
  const projectId = filters.projectId ?? null;
  const completedDate = filters.completedDate ?? null;
  const deadlineDate = filters.deadlineDate ?? null;
  const isArchive = filters.view === "archive";

  let rows: TaskRow[];

  if (isArchive) {
    rows = (await sql`
      SELECT
        t.id, t.title, t.project_id, t.project_name, t.branch, t.status, t.priority,
        t.deadline::text, t.sort_order, t.created_at, t.completed_at, t.updated_at,
        COALESCE(s.total, 0)::int AS subtask_total,
        COALESCE(s.done_count, 0)::int AS subtask_done_count
      FROM tasks t
      LEFT JOIN (
        SELECT
          task_id,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE done)::int AS done_count
        FROM task_subtasks
        GROUP BY task_id
      ) s ON s.task_id = t.id
      WHERE t.status = 'done'
        AND t.completed_at IS NOT NULL
        AND t.completed_at::date < ${today}::date
        AND (${projectId}::text IS NULL OR t.project_id = ${projectId})
        AND (${completedDate}::text IS NULL OR t.completed_at::date = ${completedDate}::date)
        AND (${deadlineDate}::text IS NULL OR t.deadline = ${deadlineDate}::date)
      ORDER BY t.completed_at DESC
    `) as TaskRow[];
  } else {
    rows = (await sql`
      SELECT
        t.id, t.title, t.project_id, t.project_name, t.branch, t.status, t.priority,
        t.deadline::text, t.sort_order, t.created_at, t.completed_at, t.updated_at,
        COALESCE(s.total, 0)::int AS subtask_total,
        COALESCE(s.done_count, 0)::int AS subtask_done_count
      FROM tasks t
      LEFT JOIN (
        SELECT
          task_id,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE done)::int AS done_count
        FROM task_subtasks
        GROUP BY task_id
      ) s ON s.task_id = t.id
      WHERE (
        t.status = 'open'
        OR (t.status = 'done' AND t.completed_at IS NOT NULL AND t.completed_at::date = ${today}::date)
      )
        AND (${projectId}::text IS NULL OR t.project_id = ${projectId})
      ORDER BY
        CASE WHEN t.status = 'open' THEN 0 ELSE 1 END,
        t.sort_order ASC,
        t.created_at DESC
    `) as TaskRow[];
  }

  const tasks = rows.map(mapRow);
  return isArchive ? tasks : sortActiveTasks(tasks);
}

export async function getTaskWithDetails(id: string): Promise<Task | null> {
  await ensureTasksSchema();
  const sql = getSql();

  const taskRows = await sql`
    SELECT
      t.id, t.title, t.project_id, t.project_name, t.branch, t.status, t.priority,
      t.deadline::text, t.sort_order, t.created_at, t.completed_at, t.updated_at,
      COALESCE(s.total, 0)::int AS subtask_total,
      COALESCE(s.done_count, 0)::int AS subtask_done_count
    FROM tasks t
    LEFT JOIN (
      SELECT
        task_id,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE done)::int AS done_count
      FROM task_subtasks
      GROUP BY task_id
    ) s ON s.task_id = t.id
    WHERE t.id = ${id}
    LIMIT 1
  `;
  const taskRow = (taskRows as TaskRow[])[0];
  if (!taskRow) return null;

  const commentRows = await sql`
    SELECT id, task_id, body, created_at
    FROM task_comments
    WHERE task_id = ${id}
    ORDER BY created_at ASC
  `;

  const subtaskRows = await sql`
    SELECT id, task_id, title, done, sort_order, created_at
    FROM task_subtasks
    WHERE task_id = ${id}
    ORDER BY sort_order ASC, created_at ASC
  `;

  return {
    ...mapRow(taskRow),
    comments: (commentRows as CommentRow[]).map(mapComment),
    subtasks: (subtaskRows as SubtaskRow[]).map(mapSubtask),
  };
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  await ensureTasksSchema();
  const sql = getSql();
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required");

  const sortOrder = await nextTaskSortOrder();

  const rows = await sql`
    INSERT INTO tasks (
      title, project_id, project_name, branch, priority, deadline, sort_order
    )
    VALUES (
      ${title},
      ${input.projectId},
      ${input.projectName},
      NULL,
      ${input.priority ?? "medium"},
      ${input.deadline ?? null},
      ${sortOrder}
    )
    RETURNING
      id, title, project_id, project_name, branch, status, priority,
      deadline::text, sort_order, created_at, completed_at, updated_at
  `;

  return {
    ...mapRow((rows as TaskRow[])[0]),
    subtaskTotal: 0,
    subtaskDoneCount: 0,
  };
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
): Promise<Task | null> {
  await ensureTasksSchema();
  const sql = getSql();

  const existingRows = await sql`
    SELECT
      id, title, project_id, project_name, branch, status, priority,
      deadline::text, sort_order, created_at, completed_at, updated_at
    FROM tasks
    WHERE id = ${id}
    LIMIT 1
  `;
  const existing = (existingRows as TaskRow[])[0];
  if (!existing) return null;

  const nextStatus = input.status ?? (existing.status as TaskStatus);
  const completedAt =
    nextStatus === "done"
      ? existing.completed_at ?? new Date().toISOString()
      : nextStatus === "open"
        ? null
        : existing.completed_at;

  const rows = await sql`
    UPDATE tasks
    SET
      title = ${input.title?.trim() || existing.title},
      project_id = ${input.projectId ?? existing.project_id},
      project_name = ${input.projectName ?? existing.project_name},
      priority = ${input.priority ?? existing.priority},
      deadline = ${input.deadline !== undefined ? input.deadline : existing.deadline},
      status = ${nextStatus},
      completed_at = ${completedAt},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id, title, project_id, project_name, branch, status, priority,
      deadline::text, sort_order, created_at, completed_at, updated_at
  `;

  return mapRow((rows as TaskRow[])[0]);
}

export async function deleteTask(id: string): Promise<boolean> {
  await ensureTasksSchema();
  const sql = getSql();
  const rows = await sql`DELETE FROM tasks WHERE id = ${id} RETURNING id`;
  return (rows as { id: string }[]).length > 0;
}

/** Persist a new order for the given task ids, keeping their sort_order pool. */
export async function reorderTasks(orderedIds: string[]): Promise<boolean> {
  if (orderedIds.length === 0) return true;
  await ensureTasksSchema();
  const sql = getSql();

  const sortValues: number[] = [];
  for (const id of orderedIds) {
    const rows = await sql`
      SELECT sort_order
      FROM tasks
      WHERE id = ${id} AND status = 'open'
      LIMIT 1
    `;
    const row = (rows as { sort_order: number }[])[0];
    if (!row) return false;
    sortValues.push(Number(row.sort_order) || 0);
  }

  sortValues.sort((a, b) => a - b);

  for (let index = 0; index < orderedIds.length; index += 1) {
    await sql`
      UPDATE tasks
      SET sort_order = ${sortValues[index]}, updated_at = NOW()
      WHERE id = ${orderedIds[index]}
    `;
  }

  return true;
}

export async function addTaskComment(
  taskId: string,
  body: string,
): Promise<TaskComment> {
  await ensureTasksSchema();
  const sql = getSql();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment body is required");

  const rows = await sql`
    INSERT INTO task_comments (task_id, body)
    VALUES (${taskId}, ${trimmed})
    RETURNING id, task_id, body, created_at
  `;

  return mapComment((rows as CommentRow[])[0]);
}

export async function updateTaskComment(
  id: string,
  body: string,
): Promise<TaskComment | null> {
  await ensureTasksSchema();
  const sql = getSql();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment body is required");

  const rows = await sql`
    UPDATE task_comments
    SET body = ${trimmed}
    WHERE id = ${id}
    RETURNING id, task_id, body, created_at
  `;
  const row = (rows as CommentRow[])[0];
  return row ? mapComment(row) : null;
}

export async function deleteTaskComment(id: string): Promise<boolean> {
  await ensureTasksSchema();
  const sql = getSql();
  const rows = await sql`DELETE FROM task_comments WHERE id = ${id} RETURNING id`;
  return (rows as { id: string }[]).length > 0;
}

export async function addTaskSubtask(
  taskId: string,
  title: string,
): Promise<TaskSubtask> {
  await ensureTasksSchema();
  const sql = getSql();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Subtask title is required");

  const sortOrder = await nextSubtaskSortOrder(taskId);

  const rows = await sql`
    INSERT INTO task_subtasks (task_id, title, sort_order)
    VALUES (${taskId}, ${trimmed}, ${sortOrder})
    RETURNING id, task_id, title, done, sort_order, created_at
  `;

  return mapSubtask((rows as SubtaskRow[])[0]);
}

export async function updateTaskSubtask(
  id: string,
  patch: { title?: string; done?: boolean },
): Promise<TaskSubtask | null> {
  await ensureTasksSchema();
  const sql = getSql();

  const existingRows = await sql`
    SELECT id, task_id, title, done, sort_order, created_at
    FROM task_subtasks
    WHERE id = ${id}
    LIMIT 1
  `;
  const existing = (existingRows as SubtaskRow[])[0];
  if (!existing) return null;

  const rows = await sql`
    UPDATE task_subtasks
    SET
      title = ${patch.title?.trim() || existing.title},
      done = ${patch.done ?? existing.done}
    WHERE id = ${id}
    RETURNING id, task_id, title, done, sort_order, created_at
  `;

  return mapSubtask((rows as SubtaskRow[])[0]);
}

export async function deleteTaskSubtask(id: string): Promise<boolean> {
  await ensureTasksSchema();
  const sql = getSql();
  const rows = await sql`DELETE FROM task_subtasks WHERE id = ${id} RETURNING id`;
  return (rows as { id: string }[]).length > 0;
}

/** Persist a new order for subtasks belonging to one task. */
export async function reorderSubtasks(
  taskId: string,
  orderedIds: string[],
): Promise<boolean> {
  if (orderedIds.length === 0) return true;
  await ensureTasksSchema();
  const sql = getSql();

  const existing = (await sql`
    SELECT id, sort_order
    FROM task_subtasks
    WHERE task_id = ${taskId}
    ORDER BY sort_order ASC, created_at ASC
  `) as { id: string; sort_order: number }[];

  if (existing.length !== orderedIds.length) return false;
  const allowed = new Set(existing.map((row) => row.id));
  if (orderedIds.some((id) => !allowed.has(id))) return false;

  const sortValues = existing
    .map((row) => Number(row.sort_order) || 0)
    .sort((a, b) => a - b);

  for (let index = 0; index < orderedIds.length; index += 1) {
    await sql`
      UPDATE task_subtasks
      SET sort_order = ${sortValues[index]}
      WHERE id = ${orderedIds[index]} AND task_id = ${taskId}
    `;
  }

  return true;
}

export function getLocalTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function isCompletedToday(
  completedAt: string | null,
  today = getLocalTodayKey(),
): boolean {
  if (!completedAt) return false;
  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.toLocaleDateString("en-CA") === today;
}
