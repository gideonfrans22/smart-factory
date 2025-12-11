/**
 * Query helpers for MongoDB models
 * 
 * These query helpers provide explicit control over field population,
 * replacing dangerous auto-population pre-hooks in model definitions.
 * 
 * Usage:
 *   import { ProductQuery, DeviceQuery } from '../queries';
 *   const products = await ProductQuery.getProductsPaginated({}, 1, 10);
 */

export { ProductQuery } from "./productQuery";
export { DeviceQuery } from "./deviceQuery";
export { RecipeQuery } from "./recipeQuery";
export { RawMaterialQuery } from "./rawMaterialQuery";
export { CustomerQuery } from "./customerQuery";

