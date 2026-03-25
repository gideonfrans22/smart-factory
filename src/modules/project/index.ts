export * from "./project.types";
export * from "./project.model";
export {
  projectCreateBatchSchema,
  projectUpdateSchema,
  projectListQuerySchema,
  projectIdParamSchema,
  type ProjectCreateBatchInput,
  type ProjectUpdateInput,
  type ProjectListQueryInput,
  type ProjectIdParamInput
} from "./project.validators";
export * from "./project.service";
export * as projectController from "./project.controller";
export { default as projectRoutes } from "./project.routes";

/**
 * @module project
 * @description Handles all project operations including CRUD, batch creation,
 * project activation/deactivation with snapshot and task generation, and
 * real-time monitoring of active projects.
 *
 * @exports Project - Mongoose model
 * @exports projectService - Business logic for project management
 * @exports projectRoutes - Express router (mount at /api/projects)
 */
