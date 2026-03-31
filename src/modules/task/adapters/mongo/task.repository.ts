import { Task } from "../../task.model";
import type { TaskStatus } from "../../task.types";
import type {
  TaskPauseState,
  TaskRepo,
  TaskPausePersisted
} from "../../ports/TaskRepo";

const PAUSE_TASK_POPULATE = [
  { path: "projectId", select: "name status priority" },
  { path: "workerId", select: "name username email" },
  { path: "deviceId", select: "name deviceName ipAddress status" },
  { path: "recipeSnapshotId", select: "name version steps" },
  {
    path: "productSnapshotId",
    select:
      "name version productNumber customerName personInCharge department"
  }
] as const;

export class MongoTaskRepository implements TaskRepo {
  async loadForPause(id: string): Promise<TaskPauseState | null> {
    const task = await Task.findById(id);
    if (!task) {
      return null;
    }
    const history = task.pauseHistory ?? [];
    return {
      id: task.id,
      status: task.status as TaskStatus,
      pauseHistory: history.map((e) => ({
        pausedAt: e.pausedAt,
        resumedAt: e.resumedAt,
        reason: e.reason,
        pausedBy: e.pausedBy,
        resolvedBy: e.resolvedBy
      }))
    };
  }

  async persistPause(state: TaskPauseState): Promise<TaskPausePersisted> {
    const task = await Task.findById(state.id);
    if (!task) {
      throw new Error("Task disappeared during pause");
    }
    task.status = state.status;
    task.pauseHistory = state.pauseHistory.map((e) => ({
      pausedAt: e.pausedAt,
      resumedAt: e.resumedAt,
      reason: e.reason,
      pausedBy: e.pausedBy,
      resolvedBy: e.resolvedBy
    }));
    await task.save();
    await task.populate([...PAUSE_TASK_POPULATE]);
    return task as TaskPausePersisted;
  }
}

export const mongoTaskRepository = new MongoTaskRepository();
