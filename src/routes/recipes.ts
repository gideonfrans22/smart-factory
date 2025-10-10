import { Router } from "express";
import {
  getRecipes,
  getRecipeById,
  getRecipeByProductCode,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  createRecipeVersion
} from "../controllers/recipeController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// All recipe routes require authentication
router.use(authenticateToken);

// Get all recipes (paginated)
router.get("/", getRecipes);

// Get recipe by product code (latest or specific version)
router.get("/product/:productCode", getRecipeByProductCode);

// Get recipe by ID
router.get("/:id", getRecipeById);

// Create new recipe
router.post("/", createRecipe);

// Update recipe
router.put("/:id", updateRecipe);

// Delete recipe
router.delete("/:id", deleteRecipe);

// Create new version of recipe
router.post("/:id/version", createRecipeVersion);

export default router;
