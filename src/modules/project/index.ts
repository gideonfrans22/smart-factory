export * from "./project.types";
export * from "./project.model";
export * from "./project-device-configuration.model";
export * from "./project-device-configuration.types";
export * from "./project-device-configuration.service";
export {
  projectCreateBatchSchema,
  projectUpdateSchema,
  projectListQuerySchema,
  projectIdParamSchema,
  projectDeviceConfigurationPutBodySchema,
  type ProjectCreateBatchInput,
  type ProjectUpdateInput,
  type ProjectListQueryInput,
  type ProjectIdParamInput,
  type ProjectDeviceConfigurationPutBodyInput
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
