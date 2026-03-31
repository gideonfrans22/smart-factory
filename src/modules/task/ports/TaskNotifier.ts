import type { TaskPausePersisted } from "./TaskRepo";

export interface TaskNotifier {
  broadcastTaskStatusChange(task: TaskPausePersisted): Promise<void>;
}
