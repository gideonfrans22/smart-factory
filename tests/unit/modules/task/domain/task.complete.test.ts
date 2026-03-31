import { completeTask } from "../../../../../src/modules/task/domain/task.complete";
import type { DeviceRepo } from "../../../../../src/modules/task/ports/DeviceRepo";
import type { ProjectRepo } from "../../../../../src/modules/task/ports/ProjectRepo";
import type { TaskNotifier } from "../../../../../src/modules/task/ports/TaskNotifier";
import type {
  TaskCompleteReadModel,
  TaskPersisted,
  TaskRepo
} from "../../../../../src/modules/task/ports/TaskRepo";

function doc(id: string, extra: Record<string, unknown> = {}): TaskPersisted {
  const base = { _id: id, ...extra };
  return {
    ...base,
    toObject: () => ({ ...base })
  } as TaskPersisted;
}

const noopNotifier: TaskNotifier = {
  broadcastTaskStatusChange: async () => {},
  broadcastTaskCompletion: async () => {},
  broadcastProjectProgress: async () => {},
  broadcastProjectUpdate: async () => {}
};

describe("completeTask domain", () => {
  it("throws NOT_FOUND when task is missing", async () => {
    const taskRepo: Partial<TaskRepo> = {
      loadForComplete: async () => null
    };
    await expect(
      completeTask(
        {
          taskRepo: taskRepo as TaskRepo,
          deviceRepo: {} as DeviceRepo,
          projectRepo: {} as ProjectRepo,
          notifier: noopNotifier
        },
        {
          taskId: "507f1f77bcf86cd799439011",
          body: { workerId: "507f1f77bcf86cd799439012" }
        }
      )
    ).rejects.toMatchObject({
      errorCode: "NOT_FOUND",
      statusCode: 404
    });
  });

  it("throws when workerId is missing and task has no worker", async () => {
    const read: TaskCompleteReadModel = {
      id: "t1",
      status: "ONGOING",
      workerId: null,
      recipeSnapshotId: "507f1f77bcf86cd799439099",
      projectId: null,
      deviceId: null,
      pauseHistory: [],
      pausedDuration: 0,
      startedAt: new Date(),
      isLastStepInRecipe: false,
      recipeExecutionNumber: 1,
      totalRecipeExecutions: 1,
      title: "T"
    };
    const taskRepo: Partial<TaskRepo> = {
      loadForComplete: async () => read
    };
    await expect(
      completeTask(
        {
          taskRepo: taskRepo as TaskRepo,
          deviceRepo: {} as DeviceRepo,
          projectRepo: {} as ProjectRepo,
          notifier: noopNotifier
        },
        { taskId: "t1", body: {} }
      )
    ).rejects.toMatchObject({
      errorCode: "VALIDATION_ERROR",
      statusCode: 400
    });
  });

  it("throws when recipe snapshot is missing", async () => {
    const read: TaskCompleteReadModel = {
      id: "t1",
      status: "ONGOING",
      workerId: "w1",
      recipeSnapshotId: null,
      projectId: null,
      deviceId: null,
      pauseHistory: [],
      pausedDuration: 0,
      startedAt: new Date(),
      isLastStepInRecipe: false,
      recipeExecutionNumber: 1,
      totalRecipeExecutions: 1,
      title: "T"
    };
    const taskRepo: Partial<TaskRepo> = {
      loadForComplete: async () => read
    };
    await expect(
      completeTask(
        {
          taskRepo: taskRepo as TaskRepo,
          deviceRepo: {} as DeviceRepo,
          projectRepo: {} as ProjectRepo,
          notifier: noopNotifier
        },
        { taskId: "t1", body: {} }
      )
    ).rejects.toMatchObject({
      errorCode: "VALIDATION_ERROR",
      statusCode: 400
    });
  });

  it("completes a minimal standalone-style task", async () => {
    const read: TaskCompleteReadModel = {
      id: "t1",
      status: "ONGOING",
      workerId: "w1",
      recipeSnapshotId: "507f1f77bcf86cd799439099",
      projectId: null,
      deviceId: null,
      pauseHistory: [],
      pausedDuration: 0,
      startedAt: new Date(Date.now() - 60000),
      isLastStepInRecipe: false,
      recipeExecutionNumber: 1,
      totalRecipeExecutions: 1,
      title: "T"
    };

    let persisted = false;
    const populated = doc("t1", { status: "COMPLETED" });

    const taskRepo: Partial<TaskRepo> = {
      loadForComplete: async () => read,
      persistComplete: async () => {
        persisted = true;
        return doc("t1");
      },
      populateTaskForCompleteResponse: async () => populated,
      findNextByDependentTask: async () => null
    };

    const deviceRepo: DeviceRepo = {
      assignCurrentTask: async () => {},
      findForResumeCheck: async () => null,
      clearCurrentAssignment: async () => {}
    };

    const result = await completeTask(
      {
        taskRepo: taskRepo as TaskRepo,
        deviceRepo,
        projectRepo: {} as ProjectRepo,
        notifier: noopNotifier
      },
      { taskId: "t1", body: {} }
    );

    expect(persisted).toBe(true);
    expect(result.message).toBe("Task completed");
    expect(result.data.completedTask).toBe(populated);
    expect(result.data.nextTask).toBeNull();
  });
});
