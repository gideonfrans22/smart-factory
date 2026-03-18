export * from "./grid-layout.types";
export * from "./grid-layout.model";
export * from "./grid-layout.validators";
export * from "./grid-layout.service";
export * from "./grid-layout.controller";
export { default as gridLayoutRoutes } from "./grid-layout.routes";

/**
 * @module grid-layout
 * @description Handles all grid layout operations including CRUD,
 * validation, device positioning, and business rules for managing
 * device layouts on grids.
 *
 * @exports GridLayout - Mongoose model
 * @exports GridLayoutService - Business logic
 * @exports gridLayoutRoutes - Express router (mount at /api/grid-layouts)
 */
