export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "open" | "done";

export interface TaskComment {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
}

export interface TaskSubtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  branch: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  sortOrder: number;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
  subtaskTotal?: number;
  subtaskDoneCount?: number;
  comments?: TaskComment[];
  subtasks?: TaskSubtask[];
}

export interface CreateTaskInput {
  title: string;
  projectId: string;
  projectName: string;
  priority?: TaskPriority;
  deadline?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  projectId?: string;
  projectName?: string;
  priority?: TaskPriority;
  deadline?: string | null;
  status?: TaskStatus;
}

export interface TaskListFilters {
  projectId?: string;
  view?: "active" | "archive";
  today?: string;
  completedDate?: string;
  deadlineDate?: string;
}
