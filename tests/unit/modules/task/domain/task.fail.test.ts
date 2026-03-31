import { failTask } from "../../../../../src/modules/task/domain/task.fail";
import type { ProjectRepo } from "../../../../../src/modules/task/ports/ProjectRepo";
import type { TaskNotifier } from "../../../../../src/modules/task/ports/TaskNotifier";
import type {
  TaskFailReadModel,
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

describe("failTask domain", () => {
  it("throws NOT_FOUND when task is missing", async () => {
    const taskRepo: Pick<TaskRepo, "loadForFail"> = {
      loadForFail: async () => null
    };
    const deps = {
      taskRepo: taskRepo as TaskRepo,
      projectRepo: {} as ProjectRepo,
      notifier: {} as TaskNotifier
    };
    await expect(
      failTask(deps, { taskId: "507f1f77bcf86cd799439011" })
    ).rejects.toMatchObject({
      errorCode: "NOT_FOUND",
      statusCode: 404
    });
  });

  it("marks root failed and resolves project when present", async () => {
    const calls: string[] = [];
    const rootDoc = doc("root", { title: "Root" });

    const taskRepo: Partial<TaskRepo> = {
      loadForFail: async (id): Promise<TaskFailReadModel | null> => {
        if (id === "root") {
          return { id: "root", title: "Root", projectId: "proj1" };
        }
        return null;
      },
      persistFailRoot: async () => {
        calls.push("persistFailRoot");
        return rootDoc;
      },
      findActiveDependentsForFail: async () => [],
      persistFailDependent: async () => {
        throw new Error("unexpected dependent persist");
      }
    };

    const projectRepo: Partial<ProjectRepo> = {
      resolveProjectAfterFail: async () => {
        calls.push("resolveProjectAfterFail");
        return { _id: "proj1", status: "ONGOING", progress: 10 };
      }
    };

    const notifier: TaskNotifier = {
      broadcastTaskStatusChange: async () => {
        calls.push("broadcastTaskStatusChange");
      },
      broadcastTaskCompletion: async () => {},
      broadcastProjectProgress: async () => {},
      broadcastProjectUpdate: async () => {}
    };

    const result = await failTask(
      {
        taskRepo: taskRepo as TaskRepo,
        projectRepo: projectRepo as ProjectRepo,
        notifier
      },
      { taskId: "root" }
    );

    expect(result.totalFailedTasks).toBe(1);
    expect(result.failedTask).toBe(rootDoc);
    expect(result.project).toEqual({
      _id: "proj1",
      status: "ONGOING",
      progress: 10
    });
    expect(calls).toEqual([
      "persistFailRoot",
      "resolveProjectAfterFail",
      "broadcastTaskStatusChange"
    ]);
  });

  it("fails dependents depth-first order", async () => {
    const calls: string[] = [];
    const rootDoc = doc("a", { title: "A" });
    const bDoc = doc("b", { title: "B" });
    const cDoc = doc("c", { title: "C" });

    const taskRepo: Partial<TaskRepo> = {
      loadForFail: async () => ({
        id: "a",
        title: "A",
        projectId: null
      }),
      persistFailRoot: async () => rootDoc,
      findActiveDependentsForFail: async (taskId: string) => {
        if (taskId === "a") {
          return [{ id: "b", title: "B" }];
        }
        if (taskId === "b") {
          return [{ id: "c", title: "C" }];
        }
        return [];
      },
      persistFailDependent: async (input) => {
        calls.push(`failDep:${input.id}`);
        return input.id === "b" ? bDoc : cDoc;
      }
    };

    const notifier: TaskNotifier = {
      broadcastTaskStatusChange: async () => {},
      broadcastTaskCompletion: async () => {},
      broadcastProjectProgress: async () => {},
      broadcastProjectUpdate: async () => {}
    };

    const result = await failTask(
      {
        taskRepo: taskRepo as TaskRepo,
        projectRepo: {
          resolveProjectAfterFail: async () => null
        } as unknown as ProjectRepo,
        notifier
      },
      { taskId: "a" }
    );

    expect(result.totalFailedTasks).toBe(3);
    expect(calls).toEqual(["failDep:b", "failDep:c"]);
  });
});
