import {
  projectService,
  ProjectServiceError,
  buildProjectMonitoringData
} from "../../../../src/modules/project/project.service";

describe("ProjectService - validation and helpers", () => {
  describe("createProjectsBatch validation", () => {
    it("throws ProjectServiceError when createdBy is missing", async () => {
      await expect(
        projectService.createProjectsBatch({
          products: [],
          recipes: [],
          createdBy: undefined
        })
      ).rejects.toEqual(
        expect.any(ProjectServiceError)
      );
    });

    it("throws VALIDATION_ERROR when no products or recipes are provided", async () => {
      await expect(
        projectService.createProjectsBatch({
          products: [],
          recipes: [],
          createdBy: "507f1f77bcf86cd799439011"
        })
      ).rejects.toMatchObject({
        errorCode: "VALIDATION_ERROR",
        statusCode: 400
      });
    });

    it("throws VALIDATION_ERROR when batch size exceeds 40", async () => {
      const items = Array.from({ length: 41 }).map((_, idx) => ({
        productId: `507f1f77bcf86cd7994390${(10 + idx).toString(16)}`,
        targetQuantity: 1,
        priority: "MEDIUM",
        status: "PLANNING"
      }));

      await expect(
        projectService.createProjectsBatch({
          products: items,
          recipes: [],
          createdBy: "507f1f77bcf86cd799439011"
        })
      ).rejects.toMatchObject({
        errorCode: "VALIDATION_ERROR",
        statusCode: 400
      });
    });
  });

  describe("buildProjectMonitoringData", () => {
    it("aggregates task counts by status correctly", () => {
      const projectId = "507f1f77bcf86cd799439011";
      const recipeSnapshotId = "507f1f77bcf86cd799439012";

      const activeProjects = [
        {
          id: projectId,
          productSnapshot: null,
          recipeSnapshot: { _id: recipeSnapshotId, name: "Recipe A" }
        }
      ];

      const tasks = [
        { projectId, recipeSnapshotId, status: "PENDING" },
        { projectId, recipeSnapshotId, status: "ONGOING" },
        { projectId, recipeSnapshotId, status: "COMPLETED" },
        { projectId, recipeSnapshotId, status: "COMPLETED" },
        { projectId, recipeSnapshotId, status: "PAUSED" },
        { projectId, recipeSnapshotId, status: "FAILED" }
      ].map((t) => ({
        ...t,
        projectId: {
          toString: () => projectId
        },
        recipeSnapshotId: {
          toString: () => recipeSnapshotId
        }
      }));

      const result = buildProjectMonitoringData(activeProjects as any[], tasks);

      expect(result).toHaveLength(1);
      const summary = result[0].taskSummary;
      expect(summary.total).toBe(6);
      expect(summary.byStatus).toEqual({
        PENDING: 1,
        ONGOING: 1,
        COMPLETED: 2,
        PAUSED: 1,
        FAILED: 1
      });
    });
  });
}

