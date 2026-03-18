export * from "./media.model";
export * from "./media.service";
export * from "./media.types";
export * from "./media.validators";
export * as mediaController from "./media.controller";
export { default as mediaRoutes } from "./media.routes";
/**
 * @module media
 * @description Handles file uploads, metadata and streaming.
 *
 * @exports Media - Mongoose model
 * @exports mediaService - Business logic
 * @exports mediaRoutes - Express router (mount at /api/media)
 */
