import { Task } from "@modules/task/task.model";
import { realtimeService } from "@shared/services";
import type { TaskForAlertPort } from "../../ports/TaskForAlertPort";

export class MongooseTaskForAlertAdapter implements TaskForAlertPort {
  async pauseOngoingForEmergency(params: {
    taskId: string;
    title: string;
    pausedBy: string;
  }): Promise<boolean> {
    const task = await Task.findById(params.taskId);
    if (!task || task.status !== "ONGOING") {
      return false;
    }
    task.status = "PAUSED_EMERGENCY";
    if (!task.pauseHistory) {
      task.pauseHistory = [];
    }
    task.pauseHistory.push({
      pausedAt: new Date(),
      reason: `Emergency: ${params.title}`,
      pausedBy: params.pausedBy
    });
    await task.save();
    await realtimeService.broadcastTaskStatusChange(task.toObject());
    return true;
  }

  async resumeFromEmergency(params: {
    taskId: string;
    resolvedBy: string;
  }): Promise<{ taskLabel: string } | null> {
    const task = await Task.findById(params.taskId);
    if (!task || task.status !== "PAUSED_EMERGENCY") {
      return null;
    }
    task.status = "ONGOING";

    if (task.pauseHistory && task.pauseHistory.length > 0) {
      const lastPause = task.pauseHistory[task.pauseHistory.length - 1];
      if (!lastPause.resumedAt) {
        lastPause.resumedAt = new Date();
        lastPause.resolvedBy = params.resolvedBy;

        const pauseDuration = Math.floor(
          (lastPause.resumedAt.getTime() - lastPause.pausedAt.getTime()) /
            (1000 * 60)
        );
        task.pausedDuration = (task.pausedDuration || 0) + pauseDuration;
      }
    }

    await task.save();
    await realtimeService.broadcastTaskStatusChange(task.toObject());
    const taskLabel =
      (task as { title?: string }).title || String(task._id);
    return { taskLabel };
  }
}

export const mongooseTaskForAlertAdapter = new MongooseTaskForAlertAdapter();
