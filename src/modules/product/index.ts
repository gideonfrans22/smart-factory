export * from "./product.model";
export * from "./product-snapshot.model";
export * from "./product.types";
export * from "./product.validators";
export * from "./product.service";
export * from "./product.controller";
export { default as productRoutes } from "./product.routes";

/**
 * @module product
 * @description Handles all product-related operations including CRUD,
 * validation, version history, and business rules for product
 * specifications and recipes.
 *
 * @exports Product - Mongoose model
 * @exports ProductSnapshot - Mongoose model for version history
 * @exports productService - Business logic
 * @exports productRoutes - Express router (mount at /api/products)
 */
