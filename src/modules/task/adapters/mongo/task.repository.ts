import mongoose from "mongoose";
import { Task } from "../../task.model";
import type { TaskPriority, TaskStatus } from "../../task.types";
import type {
  TaskBatchPersistResult,
  TaskCreateManyDoc,
  TaskCompletePersistState,
  TaskCompleteReadModel,
  TaskFailDependentPersistInput,
  TaskFailReadModel,
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
  async createMany(tasks: TaskCreateManyDoc[]): Promise<TaskPersisted[]> {
    if (tasks.length === 0) {
      return [];
    }
    const mapped = tasks.map((t) => {
      const doc = { ...(t as Record<string, unknown>) };
      if (typeof doc._id === "string" && mongoose.Types.ObjectId.isValid(doc._id)) {
        doc._id = new mongoose.Types.ObjectId(doc._id);
      }
      if (
        typeof doc.dependentTask === "string" &&
        mongoose.Types.ObjectId.isValid(doc.dependentTask)
      ) {
        doc.dependentTask = new mongoose.Types.ObjectId(doc.dependentTask);
      }
      return doc;
    });
    const created = await Task.insertMany(mapped, { ordered: true });
    return created as unknown as TaskPersisted[];
  }

  async listByProjectIdForMetrics(
    projectId: string
  ): Promise<Array<{ status: TaskStatus; isLastStepInRecipe?: boolean }>> {
    const tasks = await Task.find({ projectId })
      .select({ status: 1, isLastStepInRecipe: 1 })
      .lean();
    return tasks.map((t) => ({
      status: (t as { status: TaskStatus }).status,
      isLastStepInRecipe: (t as { isLastStepInRecipe?: boolean })
        .isLastStepInRecipe
    }));
  }

  async countCompletedLastStepsByRecipeSnapshot(
    projectId: string,
    recipeSnapshotId: string
  ): Promise<number> {
    return Task.countDocuments({
      projectId,
      recipeSnapshotId,
      isLastStepInRecipe: true,
      status: "COMPLETED"
    });
  }

  async countCompletedLastSteps(projectId: string): Promise<number> {
    return Task.countDocuments({
      projectId,
      isLastStepInRecipe: true,
      status: "COMPLETED"
    });
  }

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

  async findPendingForStartBatch(
    projectId: string,
    recipeSnapshotId: string,
    stepOrder: number,
    limit: number
  ): Promise<TaskStartReadModel[]> {
    const tasks = await Task.find({
      projectId,
      recipeSnapshotId,
      stepOrder,
      status: "PENDING"
    })
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit);

    return tasks.map((task) => ({
      id: task.id,
      status: task.status as TaskStatus,
      progress: task.progress
    }));
  }

  async persistStartMany(
    states: TaskStartPersistState[]
  ): Promise<TaskPersisted[]> {
    if (states.length === 0) {
      return [];
    }

    const ids = states.map((s) => s.id);
    const tasks = await Task.find({ _id: { $in: ids } });
    if (tasks.length !== ids.length) {
      throw new Error("One or more tasks disappeared during batch start");
    }

    const stateById = new Map(states.map((s) => [s.id, s]));

    for (const task of tasks) {
      const state = stateById.get(task.id);
      if (!state) {
        continue;
      }
      task.status = "ONGOING";
      task.workerId = state.workerId as unknown as mongoose.Types.ObjectId;
      if (state.deviceId) {
        task.deviceId = state.deviceId as unknown as mongoose.Types.ObjectId;
      }
      task.startedAt = state.startedAt;
      task.progress = state.progress;
    }

    await Promise.all(tasks.map((t) => t.save()));
    await Promise.all(tasks.map((t) => t.populate([...LIFECYCLE_TASK_POPULATE])));

    return tasks as unknown as TaskPersisted[];
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
      projectId: task.projectId ? String(task.projectId) : undefined,
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

  async loadForFail(id: string): Promise<TaskFailReadModel | null> {
    const task = await Task.findById(id);
    if (!task) {
      return null;
    }
    return {
      id: task.id,
      title: task.title,
      projectId: refIdToString(task.projectId) ?? null
    };
  }

  async persistFailRoot(input: {
    id: string;
    notes?: string;
  }): Promise<TaskPersisted> {
    const task = await Task.findById(input.id);
    if (!task) {
      throw new Error("Task disappeared during fail");
    }
    task.status = "FAILED";
    if (input.notes) {
      task.notes = input.notes;
    }
    await task.save();
    await task.populate([...LIFECYCLE_TASK_POPULATE]);
    return task as TaskPersisted;
  }

  async findActiveDependentsForFail(
    taskId: string
  ): Promise<Array<{ id: string; title: string }>> {
    const dependents = await Task.find({
      dependentTask: new mongoose.Types.ObjectId(taskId),
      status: { $in: ["PENDING", "ONGOING", "PAUSED"] }
    });
    return dependents.map((t) => ({
      id: t.id,
      title: t.title
    }));
  }

  async persistFailDependent(
    input: TaskFailDependentPersistInput
  ): Promise<TaskPersisted> {
    const depTask = await Task.findById(input.id);
    if (!depTask) {
      throw new Error("Dependent task disappeared during fail");
    }
    depTask.status = "FAILED";
    depTask.notes = `Automatically failed due to dependency failure: Task ${input.rootTaskTitle}`;
    await depTask.save();
    await depTask.populate([...LIFECYCLE_TASK_POPULATE]);
    return depTask as TaskPersisted;
  }

  async listTasksByProjectId(
    projectId: string
  ): Promise<Array<{ id: string; status: TaskStatus }>> {
    const tasks = await Task.find({ projectId });
    return tasks.map((t) => ({
      id: t.id,
      status: t.status as TaskStatus
    }));
  }

  async loadForComplete(id: string): Promise<TaskCompleteReadModel | null> {
    const task = await Task.findById(id).populate("recipeSnapshotId");
    if (!task) {
      return null;
    }
    const history = task.pauseHistory ?? [];
    const recipeSnapshotIdStr = refIdToString(task.recipeSnapshotId as unknown) ?? null;
    return {
      id: task.id,
      status: task.status as TaskStatus,
      workerId: refIdToString(task.workerId) ?? null,
      recipeSnapshotId: recipeSnapshotIdStr,
      projectId: refIdToString(task.projectId) ?? null,
      deviceId: deviceIdRef(task),
      pauseHistory: history.map((e) => ({
        pausedAt: e.pausedAt,
        resumedAt: e.resumedAt,
        reason: e.reason,
        pausedBy: e.pausedBy,
        resolvedBy: e.resolvedBy
      })),
      pausedDuration: task.pausedDuration ?? 0,
      startedAt: task.startedAt ?? null,
      isLastStepInRecipe: task.isLastStepInRecipe,
      recipeExecutionNumber: task.recipeExecutionNumber,
      totalRecipeExecutions: task.totalRecipeExecutions,
      productId: refIdToString(task.productId) ?? null,
      title: task.title
    };
  }

  async persistComplete(state: TaskCompletePersistState): Promise<TaskPersisted> {
    const task = await Task.findById(state.id);
    if (!task) {
      throw new Error("Task disappeared during complete");
    }
    task.status = state.status;
    task.workerId = state.workerId
      ? (state.workerId as unknown as mongoose.Types.ObjectId)
      : task.workerId;
    task.completedAt = state.completedAt;
    task.progress = state.progress;
    if (state.notes !== undefined) {
      task.notes = state.notes;
    }
    if (state.qualityData !== undefined) {
      task.qualityData = state.qualityData;
    }
    if (state.actualDuration !== undefined && state.actualDuration !== null) {
      task.actualDuration = state.actualDuration;
    }
    if (state.pausedDuration !== undefined && state.pausedDuration !== null) {
      task.pausedDuration = state.pausedDuration;
    }
    task.pauseHistory = state.pauseHistory.map((e) => ({
      pausedAt: e.pausedAt,
      resumedAt: e.resumedAt,
      reason: e.reason,
      pausedBy: e.pausedBy,
      resolvedBy: e.resolvedBy
    }));
    await task.save();
    return task as TaskPersisted;
  }

  async populateTaskForCompleteResponse(taskId: string): Promise<TaskPersisted> {
    const task = await Task.findById(taskId).populate("projectId workerId");
    if (!task) {
      throw new Error("Task disappeared during complete populate");
    }
    return task as TaskPersisted;
  }

  async findNextByDependentTask(
    completedTaskId: string
  ): Promise<TaskPersisted | null> {
    const next = await Task.findOne({
      dependentTask: new mongoose.Types.ObjectId(completedTaskId)
    });
    return next ? (next as TaskPersisted) : null;
  }
}

export const mongoTaskRepository = new MongoTaskRepository();
