import { Router } from "express";
import {
  getProducts,
  getProductById,
  getProductRecipes,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  getProductVersionHistory
} from "../controllers/productController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * @route GET /api/products
 * @desc Get all products with filtering
 * @access Admin only
 */
router.get("/", authenticateToken, requireAdmin, getProducts);

/**
 * @route GET /api/products/:id
 * @desc Get product by ID
 * @access Admin only
 */
router.get("/:id", authenticateToken, requireAdmin, getProductById);

/**
 * @route GET /api/products/:id/recipes
 * @desc Get all recipes for a product
 * @access Admin only
 */
router.get("/:id/recipes", authenticateToken, requireAdmin, getProductRecipes);

/**
 * @route POST /api/products
 * @desc Create new product
 * @access Admin only
 */
router.post("/", authenticateToken, requireAdmin, createProduct);

/**
 * @route PUT /api/products/:id
 * @desc Update product
 * @access Admin only
 */
router.put("/:id", authenticateToken, requireAdmin, updateProduct);

/**
 * @route DELETE /api/products/:id
 * @desc Delete product
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteProduct);

/**
 * @route POST /api/products/:id/duplicate
 * @desc Duplicate a product with all its recipes
 * @access Admin only
 */
router.post(
  "/:id/duplicate",
  authenticateToken,
  requireAdmin,
  duplicateProduct
);

/**
 * @route GET /api/products/:id/versions
 * @desc Get version history of a product with all snapshots
 * @access Admin only
 */
router.get(
  "/:id/versions",
  authenticateToken,
  requireAdmin,
  getProductVersionHistory
);

export default router;
