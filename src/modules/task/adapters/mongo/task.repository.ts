import mongoose from "mongoose";
import { Task } from "../../task.model";
import type { TaskPriority, TaskStatus } from "../../task.types";
import type {
  TaskBatchPersistResult,
  TaskPauseState,
  TaskPatchPersistState,
  TaskPatchReadModel,
  TaskPersisted,
  TaskRepo,
  TaskResumePersistState,
  TaskResumeReadModel,
  TaskStartPersistState,
  TaskStartReadModel,
  TaskStatusUpdatePersistState,
  TaskStatusUpdateReadModel
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

const PATCH_TASK_POPULATE = [
  { path: "projectId", select: "name status" },
  { path: "workerId", select: "name username email" },
  { path: "deviceId", select: "name deviceName" },
  { path: "recipeSnapshotId", select: "name version" },
  {
    path: "productSnapshotId",
    select:
      "name version productNumber customerName personInCharge department"
  }
] as const;

function refIdToString(ref: unknown): string | undefined {
  if (ref == null) {
    return undefined;
  }
  if (typeof ref === "object" && ref !== null && "_id" in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

function deviceIdRef(task: InstanceType<typeof Task>): string | undefined {
  return refIdToString(task.deviceId);
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

  async loadForStatusUpdate(
    id: string
  ): Promise<TaskStatusUpdateReadModel | null> {
    const task = await Task.findById(id);
    if (!task) {
      return null;
    }
    const history = task.pauseHistory ?? [];
    return {
      id: task.id,
      status: task.status as TaskStatus,
      progress: task.progress ?? undefined,
      notes: task.notes == null ? undefined : task.notes,
      startedAt: task.startedAt ?? undefined,
      completedAt: task.completedAt ?? undefined,
      pauseHistory: history.map((e) => ({
        pausedAt: e.pausedAt,
        resumedAt: e.resumedAt,
        reason: e.reason,
        pausedBy: e.pausedBy,
        resolvedBy: e.resolvedBy
      })),
      pausedDuration: task.pausedDuration ?? undefined,
      workerId: refIdToString(task.workerId),
      deviceId: deviceIdRef(task)
    };
  }

  async persistStatusUpdate(
    state: TaskStatusUpdatePersistState
  ): Promise<TaskPersisted> {
    const task = await Task.findById(state.id);
    if (!task) {
      throw new Error("Task disappeared during status update");
    }
    task.status = state.status;
    if (state.notes !== undefined) {
      task.notes = state.notes == null ? undefined : state.notes;
    }
    if (state.startedAt !== undefined) {
      task.startedAt = state.startedAt ?? undefined;
    }
    if (state.completedAt !== undefined) {
      task.completedAt = state.completedAt ?? undefined;
    }
    if (state.progress !== undefined && state.progress !== null) {
      task.progress = state.progress;
    }
    task.pauseHistory = state.pauseHistory.map((e) => ({
      pausedAt: e.pausedAt,
      resumedAt: e.resumedAt,
      reason: e.reason,
      pausedBy: e.pausedBy,
      resolvedBy: e.resolvedBy
    }));
    if (state.pausedDuration !== undefined) {
      task.pausedDuration =
        state.pausedDuration === null ? undefined : state.pausedDuration;
    }
    if (state.actualDuration !== undefined && state.actualDuration !== null) {
      task.actualDuration = state.actualDuration;
    }
    await task.save();
    await task.populate("projectId workerId");
    return task as TaskPersisted;
  }

  async loadForPatch(id: string): Promise<TaskPatchReadModel | null> {
    const task = await Task.findById(id);
    if (!task) {
      return null;
    }
    const mediaFiles = (task.mediaFiles ?? []).map((m) => String(m));
    return {
      id: task.id,
      status: task.status as TaskStatus,
      priority: task.priority as TaskPriority,
      progress: task.progress ?? undefined,
      notes: task.notes == null ? undefined : task.notes,
      mediaFiles,
      deviceId: deviceIdRef(task),
      workerId: refIdToString(task.workerId),
      pausedDuration: task.pausedDuration ?? undefined,
      startedAt: task.startedAt ?? undefined,
      completedAt: task.completedAt ?? undefined
    };
  }

  async persistPatch(state: TaskPatchPersistState): Promise<TaskPersisted> {
    const task = await Task.findById(state.id);
    if (!task) {
      throw new Error("Task disappeared during patch");
    }
    task.status = state.status;
    task.priority = state.priority;
    if (state.notes !== undefined) {
      task.notes = state.notes == null ? undefined : state.notes;
    }
    task.mediaFiles = state.mediaFiles.map(
      (id) => new mongoose.Types.ObjectId(id)
    ) as unknown as mongoose.Types.ObjectId[];
    task.deviceId = state.deviceId
      ? (state.deviceId as unknown as mongoose.Types.ObjectId)
      : undefined;
    task.workerId = state.workerId
      ? (state.workerId as unknown as mongoose.Types.ObjectId)
      : undefined;
    if (state.pausedDuration !== undefined) {
      task.pausedDuration =
        state.pausedDuration === null ? undefined : state.pausedDuration;
    }
    task.startedAt = state.startedAt ?? undefined;
    task.completedAt = state.completedAt ?? undefined;
    if (state.progress !== undefined && state.progress !== null) {
      task.progress = state.progress;
    }
    if (
      state.actualDuration !== undefined &&
      state.actualDuration !== null
    ) {
      task.actualDuration = state.actualDuration;
    }
    await task.save();
    await task.populate([...PATCH_TASK_POPULATE]);
    return task as TaskPersisted;
  }

  async batchFindOngoingIds(taskIds: string[]): Promise<string[]> {
    const tasks = await Task.find({
      _id: { $in: taskIds },
      status: "ONGOING"
    });
    return tasks.map((t) => String(t._id));
  }

  async countTasksWithoutWorkerId(taskIds: string[]): Promise<number> {
    return Task.countDocuments({
      _id: { $in: taskIds },
      $or: [{ workerId: { $exists: false } }, { workerId: null }]
    });
  }

  async countTasksWithoutDeviceId(taskIds: string[]): Promise<number> {
    return Task.countDocuments({
      _id: { $in: taskIds },
      $or: [{ deviceId: { $exists: false } }, { deviceId: null }]
    });
  }

  async batchUpdate(
    taskIds: string[],
    updateFields: Record<string, unknown>
  ): Promise<TaskBatchPersistResult> {
    const tasks = await Task.find({ _id: { $in: taskIds } });
    const foundIds = tasks.map((t) => String(t._id));
    const foundObjectIds = tasks.map((t) => t._id as mongoose.Types.ObjectId);
    const notFoundIds = taskIds.filter(
      (tid: string) => !foundIds.includes(tid)
    );

    if (foundObjectIds.length === 0) {
      return {
        updatedTasks: [],
        foundIds: [],
        notFoundIds,
        modifiedCount: 0
      };
    }

    const updateResult = await Task.updateMany(
      { _id: { $in: foundObjectIds } },
      { $set: updateFields }
    );

    const updatedTasks = await Task.find({ _id: { $in: foundObjectIds } })
      .populate([
        { path: "projectId", select: "name status" },
        { path: "workerId", select: "name username email" },
        { path: "deviceId", select: "name deviceName" },
        { path: "recipeSnapshotId", select: "name version" },
        {
          path: "productSnapshotId",
          select:
            "name version productNumber customerName personInCharge department"
        }
      ])
      .sort({ createdAt: -1 });

    return {
      updatedTasks: updatedTasks as TaskPersisted[],
      foundIds,
      notFoundIds,
      modifiedCount: updateResult.modifiedCount ?? 0
    };
  }

  async findDeviceIdsForTasks(taskIds: string[]): Promise<string[]> {
    if (taskIds.length === 0) {
      return [];
    }
    const rows = await Task.find({
      _id: { $in: taskIds },
      deviceId: { $exists: true, $ne: null }
    })
      .select({ deviceId: 1 })
      .lean();
    const seen = new Set<string>();
    for (const row of rows) {
      const id = refIdToString((row as { deviceId?: unknown }).deviceId);
      if (id) {
        seen.add(id);
      }
    }
    return [...seen];
  }
}

export const mongoTaskRepository = new MongoTaskRepository();
