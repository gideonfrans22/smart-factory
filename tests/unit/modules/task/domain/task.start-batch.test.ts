import type { TaskStatus } from "../../../../../src/modules/task/task.types";
import type {
  TaskRepo,
  TaskPersisted,
  TaskStartReadModel,
  TaskStartPersistState
} from "../../../../../src/modules/task/ports/TaskRepo";
import type { DeviceRepo } from "../../../../../src/modules/task/ports/DeviceRepo";
import type { TaskNotifier } from "../../../../../src/modules/task/ports/TaskNotifier";
import { TaskDomainError } from "../../../../../src/modules/task/domain/errors";
import { startTasksBatch } from "../../../../../src/modules/task/domain/task.start-batch";

describe("startTasksBatch domain use-case", () => {
  const createDeps = (overrides?: {
    tasks?: TaskStartReadModel[];
    persistShouldThrow?: boolean;
  }) => {
    const persistedTasks: TaskPersisted[] = [];

    const taskRepo: TaskRepo = {
      // unused methods for this test can be no-op or throw if called
      createMany: jest.fn(),
      listByProjectIdForMetrics: jest.fn(),
      countCompletedLastStepsByRecipeSnapshot: jest.fn(),
      countCompletedLastSteps: jest.fn(),
      loadForPause: jest.fn(),
      persistPause: jest.fn(),
      loadForStart: jest.fn(),
      persistStart: jest.fn(),
      findPendingForStartBatch: jest.fn(async () => overrides?.tasks ?? []),
      persistStartMany: jest.fn(async (states: TaskStartPersistState[]) => {
        if (overrides?.persistShouldThrow) {
          throw new Error("persist error");
        }
        // minimal shape for notifier calls
        const tasks = states.map(
          (s) =>
            ({
              id: s.id,
              status: "ONGOING" as TaskStatus
            } as unknown as TaskPersisted)
        );
        persistedTasks.push(...tasks);
        return tasks;
      }),
      loadForResume: jest.fn(),
      persistResume: jest.fn(),
      loadForStatusUpdate: jest.fn(),
      persistStatusUpdate: jest.fn(),
      loadForPatch: jest.fn(),
      persistPatch: jest.fn(),
      batchFindOngoingIds: jest.fn(),
      countTasksWithoutWorkerId: jest.fn(),
      countTasksWithoutDeviceId: jest.fn(),
      batchUpdate: jest.fn(),
      findDeviceIdsForTasks: jest.fn(),
      loadForFail: jest.fn(),
      persistFailRoot: jest.fn(),
      findActiveDependentsForFail: jest.fn(),
      persistFailDependent: jest.fn(),
      listTasksByProjectId: jest.fn(),
      loadForComplete: jest.fn(),
      persistComplete: jest.fn(),
      populateTaskForCompleteResponse: jest.fn(),
      findNextByDependentTask: jest.fn()
    };

    const deviceRepo: DeviceRepo = {
      assignCurrentTask: jest.fn(async () => {}),
      findForResumeCheck: jest.fn(),
      clearCurrentAssignment: jest.fn()
    };

    const notifier: TaskNotifier = {
      broadcastTaskStatusChange: jest.fn(async () => {}),
      broadcastTaskCompletion: jest.fn(async () => {}),
      broadcastTasksGeneratedForDeviceTypes: jest.fn(async () => {}),
      broadcastProjectProgress: jest.fn(async () => {}),
      broadcastProjectUpdate: jest.fn(async () => {})
    };

    return { taskRepo, deviceRepo, notifier, persistedTasks };
  };

  it("starts multiple pending tasks successfully", async () => {
    const tasks: TaskStartReadModel[] = [
      { id: "t1", status: "PENDING", progress: 0 },
      { id: "t2", status: "PENDING", progress: 10 }
    ];
    const { taskRepo, deviceRepo, notifier, persistedTasks } = createDeps({
      tasks
    });

    const result = await startTasksBatch(
      { taskRepo, deviceRepo, notifier },
      {
        projectId: "p1",
        recipeSnapshotId: "r1",
        stepOrder: 1,
        limit: 2,
        workerId: "w1",
        deviceId: "d1"
      }
    );

    expect(result.tasks).toHaveLength(2);
    expect(persistedTasks).toHaveLength(2);
    expect(deviceRepo.assignCurrentTask).toHaveBeenCalledTimes(2);
    expect(notifier.broadcastTaskStatusChange).toHaveBeenCalledTimes(2);
  });

  it("throws NOT_FOUND when no candidates", async () => {
    const { taskRepo, deviceRepo, notifier } = createDeps({ tasks: [] });

    await expect(
      startTasksBatch(
        { taskRepo, deviceRepo, notifier },
        {
          projectId: "p1",
          recipeSnapshotId: "r1",
          stepOrder: 1,
          limit: 5,
          workerId: "w1"
        }
      )
    ).rejects.toMatchObject({
      errorCode: "NOT_FOUND",
      statusCode: 404
    });
  });

  it("throws VALIDATION_ERROR when any task is not PENDING", async () => {
    const tasks: TaskStartReadModel[] = [
      { id: "t1", status: "PENDING", progress: 0 },
      { id: "t2", status: "ONGOING", progress: 50 }
    ];
    const { taskRepo, deviceRepo, notifier } = createDeps({ tasks });

    await expect(
      startTasksBatch(
        { taskRepo, deviceRepo, notifier },
        {
          projectId: "p1",
          recipeSnapshotId: "r1",
          stepOrder: 1,
          limit: 2,
          workerId: "w1"
        }
      )
    ).rejects.toMatchObject({
      errorCode: "VALIDATION_ERROR",
      statusCode: 400
    });
  });

  it("propagates errors from persistStartMany for all-or-nothing semantics", async () => {
    const tasks: TaskStartReadModel[] = [
      { id: "t1", status: "PENDING", progress: 0 }
    ];
    const { taskRepo, deviceRepo, notifier } = createDeps({
      tasks,
      persistShouldThrow: true
    });

    await expect(
      startTasksBatch(
        { taskRepo, deviceRepo, notifier },
        {
          projectId: "p1",
          recipeSnapshotId: "r1",
          stepOrder: 1,
          limit: 1,
          workerId: "w1"
        }
      )
    ).rejects.toEqual(expect.any(Error));
  });

  it("throws VALIDATION_ERROR when workerId is missing", async () => {
    const tasks: TaskStartReadModel[] = [
      { id: "t1", status: "PENDING", progress: 0 }
    ];
    const { taskRepo, deviceRepo, notifier } = createDeps({ tasks });

    await expect(
      // @ts-expect-error testing missing workerId
      startTasksBatch(
        { taskRepo, deviceRepo, notifier },
        {
          projectId: "p1",
          recipeSnapshotId: "r1",
          stepOrder: 1,
          limit: 1
        }
      )
    ).rejects.toBeInstanceOf(TaskDomainError);
  });
});
