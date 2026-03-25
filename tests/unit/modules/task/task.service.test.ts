import {
  taskService,
  TaskServiceError
} from "../../../../src/modules/task/task.service";

describe("TaskService — validation", () => {
  it("batchUpdateTasks throws TaskServiceError when taskIds is empty", async () => {
    await expect(
      taskService.batchUpdateTasks({ taskIds: [], updates: { status: "PENDING" } })
    ).rejects.toMatchObject({
      errorCode: "VALIDATION_ERROR",
      statusCode: 400
    });
  });

  it("batchUpdateTasks throws TaskServiceError when updates is not an object", async () => {
    await expect(
      taskService.batchUpdateTasks({
        taskIds: ["507f1f77bcf86cd799439011"],
        updates: null as unknown as { status?: string }
      })
    ).rejects.toEqual(expect.any(TaskServiceError));
  });
});
