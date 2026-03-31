import type { ITask } from "@shared/models";
import { realtimeService } from "@shared/services";
import type { TaskNotifier } from "../../ports/TaskNotifier";
import type { TaskPersisted } from "../../ports/TaskRepo";

export class RealtimeTaskNotifier implements TaskNotifier {
  async broadcastTaskStatusChange(task: TaskPersisted): Promise<void> {
    const doc = task as { toObject?: () => ITask };
    const payload =
      typeof doc.toObject === "function"
        ? doc.toObject()
        : (task as unknown as ITask);
    await realtimeService.broadcastTaskStatusChange(payload);
  }
}

export const realtimeTaskNotifier = new RealtimeTaskNotifier();
