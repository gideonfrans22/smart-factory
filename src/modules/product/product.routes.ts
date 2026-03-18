import { Router } from "express";
import { productController } from "./product.controller";
import { authenticateToken, requireAdmin } from "@shared/middleware";
import { validate } from "@shared/middleware/validate";
import {
  productCreateSchema,
  productDuplicateSchema,
  productIdParamSchema,
  productListQuerySchema,
  productRestoreParamSchema,
  productUpdateSchema
} from "./product.validators";

const router = Router();

// All routes require authentication and admin privileges
router.use(authenticateToken, requireAdmin);

// Excel import routes - must be registered before any "/:id" routes
router.get("/import/template", productController.downloadTemplate);
router.post("/import/verify", productController.verifyImport);
router.post("/import", productController.import);

/**
 * @route GET /api/products
 * @desc Get all products with filtering
 */
router.get(
  "/",
  validate(productListQuerySchema, "query"),
  productController.list
);

/**
 * @route GET /api/products/:id
 * @desc Get product by ID
 */
router.get(
  "/:id",
  validate(productIdParamSchema, "params"),
  productController.getById
);

/**
 * @route GET /api/products/:id/recipes
 * @desc Get all recipes for a product
 */
router.get(
  "/:id/recipes",
  validate(productIdParamSchema, "params"),
  productController.getRecipes
);

/**
 * @route POST /api/products
 * @desc Create new product
 */
router.post("/", validate(productCreateSchema), productController.create);

/**
 * @route PUT /api/products/:id
 * @desc Update product
 */
router.put(
  "/:id",
  validate(productIdParamSchema, "params"),
  validate(productUpdateSchema),
  productController.update
);

/**
 * @route DELETE /api/products/:id
 * @desc Delete product
 */
router.delete(
  "/:id",
  validate(productIdParamSchema, "params"),
  productController.remove
);

/**
 * @route POST /api/products/:id/duplicate
 * @desc Duplicate a product with all its recipes
 */
router.post(
  "/:id/duplicate",
  validate(productIdParamSchema, "params"),
  validate(productDuplicateSchema),
  productController.duplicate
);

/**
 * @route GET /api/products/:id/versions
 * @desc Get version history of a product with all snapshots
 */
router.get(
  "/:id/versions",
  validate(productIdParamSchema, "params"),
  productController.getVersionHistory
);

/**
 * @route POST /api/products/:id/restore/:versionId
 * @desc Restore a product to a previous version
 */
router.post(
  "/:id/restore/:versionId",
  validate(productRestoreParamSchema, "params"),
  productController.restoreVersion
);

export default router;
