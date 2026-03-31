import type { IProject, ITask } from "@shared/models";
import { realtimeService } from "@shared/services";
import type { TaskNotifier } from "../../ports/TaskNotifier";
import type { TaskPersisted } from "../../ports/TaskRepo";

function toTaskPayload(task: TaskPersisted): ITask {
  const doc = task as { toObject?: () => ITask };
  return typeof doc.toObject === "function"
    ? doc.toObject()
    : (task as unknown as ITask);
}

function toProjectPayload(project: object): IProject {
  const doc = project as { toObject?: () => IProject };
  return typeof doc.toObject === "function"
    ? doc.toObject()
    : (project as IProject);
}

export class RealtimeTaskNotifier implements TaskNotifier {
  async broadcastTaskStatusChange(task: TaskPersisted): Promise<void> {
    await realtimeService.broadcastTaskStatusChange(toTaskPayload(task));
  }

  async broadcastTaskCompletion(
    task: TaskPersisted,
    nextTask: TaskPersisted | null,
    projectProgress?: number
  ): Promise<void> {
    await realtimeService.broadcastTaskCompletion(
      toTaskPayload(task),
      nextTask ? toTaskPayload(nextTask) : null,
      projectProgress
    );
  }

  async broadcastProjectProgress(project: object): Promise<void> {
    await realtimeService.broadcastProjectProgress(toProjectPayload(project));
  }

  async broadcastProjectUpdate(project: object): Promise<void> {
    await realtimeService.broadcastProjectUpdate(toProjectPayload(project));
  }
}

export const realtimeTaskNotifier = new RealtimeTaskNotifier();
