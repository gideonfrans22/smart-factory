export * from "./raw-material.types";
export * from "./raw-material.model";
export * from "./raw-material.validators";
export * from "./raw-material.service";
export * from "./raw-material.controller";
export { default as rawMaterialRoutes } from "./raw-material.routes";
/**
 * @module raw-material
 * @description Handles all raw material operations including CRUD,
 * validation, Excel import/export, and business rules for material
 * specifications and stock.
 *
 * @exports RawMaterial - Mongoose model
 * @exports RawMaterialService - Business logic
 * @exports rawMaterialRoutes - Express router (mount at /api/raw-materials)
 */
