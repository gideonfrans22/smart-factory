import mongoose from "mongoose";
import { Task } from "../../task.model";
import type { TaskStatus } from "../../task.types";
import type {
  TaskPauseState,
  TaskPersisted,
  TaskRepo,
  TaskResumePersistState,
  TaskResumeReadModel,
  TaskStartPersistState,
  TaskStartReadModel
} from "../../ports/TaskRepo";

const LIFECYCLE_TASK_POPULATE = [
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

function deviceIdRef(task: InstanceType<typeof Task>): string | undefined {
  const d = task.deviceId;
  if (d == null) {
    return undefined;
  }
  if (typeof d === "object" && d !== null && "_id" in d) {
    return String((d as { _id: unknown })._id);
  }
  return String(d);
}

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

  async persistPause(state: TaskPauseState): Promise<TaskPersisted> {
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
    await task.populate([...LIFECYCLE_TASK_POPULATE]);
    return task as TaskPersisted;
  }

  async loadForStart(id: string): Promise<TaskStartReadModel | null> {
    const task = await Task.findById(id);
    if (!task) {
      return null;
    }
    return {
      id: task.id,
      status: task.status as TaskStatus,
      progress: task.progress
    };
  }

  async persistStart(state: TaskStartPersistState): Promise<TaskPersisted> {
    const task = await Task.findById(state.id);
    if (!task) {
      throw new Error("Task disappeared during start");
    }
    task.status = "ONGOING";
    task.workerId = state.workerId as unknown as mongoose.Types.ObjectId;
    if (state.deviceId) {
      task.deviceId = state.deviceId as unknown as mongoose.Types.ObjectId;
    }
    task.startedAt = state.startedAt;
    task.progress = state.progress;
    await task.save();
    await task.populate([...LIFECYCLE_TASK_POPULATE]);
    return task as TaskPersisted;
  }

  async loadForResume(id: string): Promise<TaskResumeReadModel | null> {
    const task = await Task.findById(id);
    if (!task) {
      return null;
    }
    const history = task.pauseHistory ?? [];
    return {
      id: task.id,
      status: task.status as TaskStatus,
      progress: task.progress,
      deviceId: deviceIdRef(task),
      pauseHistory: history.map((e) => ({
        pausedAt: e.pausedAt,
        resumedAt: e.resumedAt,
        reason: e.reason,
        pausedBy: e.pausedBy,
        resolvedBy: e.resolvedBy
      })),
      pausedDuration: task.pausedDuration ?? 0
    };
  }

  async persistResume(state: TaskResumePersistState): Promise<TaskPersisted> {
    const task = await Task.findById(state.id);
    if (!task) {
      throw new Error("Task disappeared during resume");
    }
    task.status = state.status;
    task.pauseHistory = state.pauseHistory.map((e) => ({
      pausedAt: e.pausedAt,
      resumedAt: e.resumedAt,
      reason: e.reason,
      pausedBy: e.pausedBy,
      resolvedBy: e.resolvedBy
    }));
    task.pausedDuration = state.pausedDuration;
    await task.save();
    await task.populate([...LIFECYCLE_TASK_POPULATE]);
    return task as TaskPersisted;
  }
}

export const mongoTaskRepository = new MongoTaskRepository();
