import type { TaskPersisted } from "./TaskRepo";

export interface TaskNotifier {
  broadcastTaskStatusChange(task: TaskPersisted): Promise<void>;
  broadcastTaskCompletion(
    task: TaskPersisted,
    nextTask: TaskPersisted | null,
    projectProgress?: number
  ): Promise<void>;
  /** Opaque project document (mongoose doc or plain object). */
  broadcastProjectProgress(project: object): Promise<void>;
  broadcastProjectUpdate(project: object): Promise<void>;
}
