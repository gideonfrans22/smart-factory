import { Router } from "express";
import {
  getProducts,
  getProductById,
  getProductRecipes,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  getProductVersionHistory,
  restoreProductVersion,
  downloadProductImportTemplate,
  verifyProductImport,
  importProducts
} from "../controllers/productController";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { importUpload } from "../middleware/importUpload";

const router = Router();

// All routes require authentication and admin privileges
router.use(authenticateToken, requireAdmin);

// Excel import routes - must be registered before any "/:id" routes
// GET /api/products/import/template - Download Excel import template
router.get("/import/template", downloadProductImportTemplate);

// POST /api/products/import/verify - Verify Excel file without writing
router.post("/import/verify", importUpload, verifyProductImport);

// POST /api/products/import - Validate and import Excel file
router.post("/import", importUpload, importProducts);

/**
 * @route GET /api/products
 * @desc Get all products with filtering
 * @access Admin only
 */
router.get("/", getProducts);

/**
 * @route GET /api/products/:id
 * @desc Get product by ID
 * @access Admin only
 */
router.get("/:id", getProductById);

/**
 * @route GET /api/products/:id/recipes
 * @desc Get all recipes for a product
 * @access Admin only
 */
router.get("/:id/recipes", getProductRecipes);

/**
 * @route POST /api/products
 * @desc Create new product
 * @access Admin only
 */
router.post("/", createProduct);

/**
 * @route PUT /api/products/:id
 * @desc Update product
 * @access Admin only
 */
router.put("/:id", updateProduct);

/**
 * @route DELETE /api/products/:id
 * @desc Delete product
 * @access Admin only
 */
router.delete("/:id", deleteProduct);

/**
 * @route POST /api/products/:id/duplicate
 * @desc Duplicate a product with all its recipes
 * @access Admin only
 */
router.post("/:id/duplicate", duplicateProduct);

/**
 * @route GET /api/products/:id/versions
 * @desc Get version history of a product with all snapshots
 * @access Admin only
 */
router.get("/:id/versions", getProductVersionHistory);

/**
 * @route POST /api/products/:id/restore/:versionId
 * @desc Restore a product to a previous version
 * @access Admin only
 */
router.post("/:id/restore/:versionId", restoreProductVersion);

export default router;
