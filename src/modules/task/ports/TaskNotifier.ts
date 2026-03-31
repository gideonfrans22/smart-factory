import type { TaskPersisted } from "./TaskRepo";

export interface TaskNotifier {
  broadcastTaskStatusChange(task: TaskPersisted): Promise<void>;
}
