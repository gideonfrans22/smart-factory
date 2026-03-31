import type { ProjectRepo } from "../ports/ProjectRepo";
import type { TaskNotifier } from "../ports/TaskNotifier";
import type { TaskPersisted, TaskRepo } from "../ports/TaskRepo";
import { TaskDomainError } from "./errors";

export interface FailTaskDeps {
  taskRepo: TaskRepo;
  projectRepo: ProjectRepo;
  notifier: TaskNotifier;
}

export interface FailTaskInput {
  taskId: string;
  notes?: string;
}

export interface FailTaskResult {
  failedTask: TaskPersisted;
  totalFailedTasks: number;
  project: {
    _id: unknown;
    status: unknown;
    progress: unknown;
  } | null;
  message: string;
}

async function failDependentsDepthFirst(
  taskId: string,
  rootTaskTitle: string,
  failedIds: string[],
  taskRepo: TaskRepo,
  notifier: TaskNotifier
): Promise<void> {
  const dependents = await taskRepo.findActiveDependentsForFail(taskId);
  for (const d of dependents) {
    const doc = await taskRepo.persistFailDependent({
      id: d.id,
      rootTaskTitle
    });
    await notifier.broadcastTaskStatusChange(doc);
    failedIds.push(d.id);
    await failDependentsDepthFirst(d.id, rootTaskTitle, failedIds, taskRepo, notifier);
  }
}

export async function failTask(
  deps: FailTaskDeps,
  input: FailTaskInput
): Promise<FailTaskResult> {
  const load = await deps.taskRepo.loadForFail(input.taskId);
  if (!load) {
    throw new TaskDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Task not found"
    });
  }

  const root = await deps.taskRepo.persistFailRoot({
    id: input.taskId,
    notes: input.notes
  });

  const failedIds: string[] = [load.id];
  await failDependentsDepthFirst(
    load.id,
    load.title,
    failedIds,
    deps.taskRepo,
    deps.notifier
  );

  let project: TaskPersisted | null = null;
  if (load.projectId) {
    project = await deps.projectRepo.resolveProjectAfterFail(
      load.projectId,
      deps.notifier
    );
  }

  await deps.notifier.broadcastTaskStatusChange(root);

  const projectSummary =
    project != null
      ? {
          _id: (project as { _id?: unknown })._id,
          status: (project as { status?: unknown }).status,
          progress: (project as { progress?: unknown }).progress
        }
      : null;

  return {
    failedTask: root,
    totalFailedTasks: failedIds.length,
    project: projectSummary,
    message: `Task marked as failed. ${
      failedIds.length - 1
    } dependent task(s) also marked as failed.`
  };
}
