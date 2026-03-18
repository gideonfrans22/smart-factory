export * from "./device-type.types";
export * from "./device-type.model";
export * from "./device-type.validators";
export * from "./device-type.service";
export * from "./device-type.controller";
export { default as deviceTypeRoutes } from "./device-type.routes";
/**
 * @module device-type
 * @description Handles all device type operations including CRUD,
 * validation, and business rules for device type constraints.
 *
 * @exports DeviceType - Mongoose model
 * @exports DeviceTypeService - Business logic
 * @exports deviceTypeRoutes - Express router (mount at /api/device-types)
 */
